import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
import {normalizePhone,senderValid,smsEncoding,sendProvider} from '../worker/sms-providers.js';
import {smsOperation,dispatchQueue} from '../worker/sms-core.js';
const actor='56e2e0b1-fdc4-4ab7-b902-ea41ccc18016';
const env={SUPABASE_URL:'https://testproj.supabase.co',SUPABASE_ANON_KEY:'sb_publishable_test',SUPABASE_SERVICE_ROLE_KEY:'sb_secret_test',ASSETS:{fetch:async()=>new Response('static')}};
const req=(method='getDashboard',args=[],origin='https://portal.test')=>new Request('https://portal.test/api/sms',{method:'POST',headers:{origin,authorization:'Bearer demo','content-type':'application/json'},body:JSON.stringify({method,args})});
const original=globalThis.fetch;
function mock(role='member',active=true,sms=false,db=()=>Response.json([]),sms_manage_contacts=false,sms_manage_settings=false){
 return async(url,opts={})=>{
  const u=String(url);
  if(u.includes('/auth/v1/user'))return Response.json({id:actor});
  if(u.includes('/rest/v1/profiles?')&&!u.includes('sms_contacts'))return Response.json([{username:'staffuser',role,active,sms_access:sms,sms_manage_contacts,sms_manage_settings}]);
  if(u.includes('script.google.com')||u.includes('msg.organotiko.com'))throw Error('Legacy SMS forbidden');
  return db(u,opts);
 };
}
async function tryReq(fetchMock,request=req()){
 globalThis.fetch=fetchMock;try{return await worker.fetch(request,env);}finally{globalThis.fetch=original;}
}
test('uncredentialed and cross-origin SMS requests fail before DB mutation',async()=>{
 const unauth=new Request('https://portal.test/api/sms',{method:'POST',headers:{origin:'https://portal.test','content-type':'application/json'},body:JSON.stringify({method:'getDashboard',args:[]})});
 assert.equal((await worker.fetch(unauth,env)).status,401);
 assert.equal((await worker.fetch(req('getDashboard',[],'https://evil.test'),env)).status,403);
});
test('inactive and unpermitted members cannot use SMS',async()=>{
 assert.equal((await tryReq(mock('member',true,false))).status,403);
 assert.equal((await tryReq(mock('member',false,true))).status,403);
});
test('no GAS or second login exists in native SMS API',async()=>{
 for(const method of ['login','logout','adminAddUser','getAuditLog','legacyProxy'])
  assert.equal((await tryReq(mock('admin'),req(method,[]))).status,400);
});
test('authorized member reads native Supabase dashboard',async()=>{
 const db=(url,opts)=>{assert.ok(url.startsWith('https://testproj.supabase.co/rest/v1/'));assert.equal(opts?.headers?.apikey,env.SUPABASE_SERVICE_ROLE_KEY);return Response.json([]);};
 const r=await tryReq(mock('member',true,true,db));assert.equal(r.status,200);const json=await r.json();assert.equal(json.ok,true);assert.equal(json.result.staffCount,0);
});
test('contacts import denied without granular rights',async()=>{
 const r=await tryReq(mock('member',true,true),req('importContacts',['STAFF','REPLACE',[['X','Y','99123456']]]));
 assert.equal(r.status,403);
});
test('sender administration requires admin even when SMS setting right is granted',async()=>{
 const r=await tryReq(mock('member',true,true,()=>Response.json([]),false,true),req('setSender',['TEST','enable']));
 assert.equal(r.status,403);
});
test('unsupported method arguments are rejected',async()=>{
 assert.equal((await tryReq(mock('admin'),req('getDashboard',Array(9).fill('x')))).status,400);
});
test('validates Cyprus/Greece numbers and rejects hidden shortcodes',()=>{
 assert.equal(normalizePhone('00357 99 123 456'),'35799123456');
 assert.equal(normalizePhone('+30 6912345678'),'306912345678');
 assert.equal(normalizePhone('99123456'),'35799123456');
 assert.equal(normalizePhone('6912345678'),'306912345678');
 for(const raw of ['12345','123456789','99abc123','+44001234567','+357+99123456'])assert.equal(normalizePhone(raw),'');
});
test('sender ID valid max 11, and Greek text requires UCS2',()=>{
 assert.equal(senderValid('PROTOPORIA'),true);
 assert.equal(senderValid('123456789012'),false);
 assert.equal(senderValid('WITH SPACE'),false);
 assert.equal(smsEncoding('Καλημέρα'),'UCS2');
 assert.equal(smsEncoding('Hello there!'),'GSM7');
});
test('provider missing credentials never calls external network',async()=>{
 globalThis.fetch=async()=>{throw Error('Must not call network');};
 try{const a=await sendProvider({provider:'APIFON',phone:'35799123456',sender:'TEST',message:'hi',ref:'id'},{});
 assert.equal(a.status,'UNCERTAIN'); assert.match(a.note,/no send attempted/);}finally{globalThis.fetch=original;}
});
test('no SMS sender is invoked when the Cron queue is empty',async()=>{
 const events=[];
 globalThis.fetch=async(url,opts={})=>{events.push(String(url));if(String(url).includes('/rpc/'))return Response.json([]);throw Error('Unexpected fetch');};
 try{const x=await dispatchQueue(env);assert.equal(x.processed,0);assert.ok(events.every(u=>u.includes('/rest/v1/rpc/')));}
 finally{globalThis.fetch=original;}
});

test('preview removes exclusions, duplicates and invalid entries without provider calls',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=async(url)=>{
  const u=String(url);
  if(u.includes('/sms_exclusions?'))return Response.json([{phone:'35799123456'}]);
  if(u.includes('/sms_contacts?'))return Response.json([]);
  throw Error('Unrecognized endpoint '+u);
 };
 try{
  const r=await smsOperation(env,{role:'admin',active:true,sms_access:false},actor,'previewRecipients',['MANUAL','99123456\n6912345678\n+30 6912345678\n12345']);
  assert.equal(r.total,1);assert.equal(r.excluded,1);assert.equal(r.duplicates,1);assert.equal(r.invalid,1);
  assert.ok(!JSON.stringify(r.sample).includes('306912345678'));
 }finally{globalThis.fetch=previous;}
});

test('file import is atomic and invalid number rejects all rows before the RPC',async()=>{
 const previous=globalThis.fetch;let count=0;
 globalThis.fetch=async()=>{count++;throw Error('Must not reach DB');};
 try{
  const r=await smsOperation(env,{role:'admin',active:true},actor,'importContacts',['STAFF','REPLACE', [['Eleni','Nikou','99123456'],['X','Y','123']]]);
  assert.equal(r.status,400);assert.equal(count,0);
 }finally{globalThis.fetch=previous;}
});

test('Provider HTTP success without provider message ID is UNCERTAIN, not ACCEPTED',async()=>{
 const previous=globalThis.fetch;
 globalThis.fetch=async(url)=>{
  const u=String(url);
  if(u.includes('/oauth2/token'))return Response.json({access_token:'shortlived-token',expires_in:60});
  if(u.includes('/sms/send'))return Response.json({results:{}});
  throw Error('Unexpected endpoint '+u);
 };
 try{
  const r=await sendProvider({provider:'APIFON',phone:'35799123456',sender:'TEST',message:'Hello',ref:'campaign-recipient'},
   {APIFON_CLIENT_ID:'clientForTest',APIFON_CLIENT_SECRET:'secretForTest'});
  assert.equal(r.status,'UNCERTAIN');
 }finally{globalThis.fetch=previous;}
});

test('Worker Cron never sends when sender ID disabled at dispatch',async()=>{
 const prev=globalThis.fetch;
 const recipient='66e2e0b1-fdc4-4ab7-b902-ea41ccc18016';let providerCalls=0;let outcome=null;
 globalThis.fetch=async(url,opts={})=>{
  const u=String(url);
  if(u.includes('oauth2/token')||u.includes('/sms/send')||u.includes('microsms.net')){providerCalls++;throw Error('Must not send');}
  if(u.includes('/sms_sender_ids?'))return Response.json([{enabled:false,archived_at:null}]);
  if(u.includes('/sms_exclusions?'))return Response.json([]);
  if(u.includes('/rpc/sms_claim_personalized_batch'))return Response.json([]);
  if(u.includes('/rpc/sms_claim_batch'))return Response.json([{recipient_id:recipient,campaign_id:'other',phone:'35799123456',provider:'APIFON',sender:'SENDER',message:'Hello'}]);
  if(u.includes('/rpc/sms_release_unattempted')){outcome=JSON.parse(opts.body);return Response.json(null);}
  if(u.includes('/rpc/sms_reconcile_campaigns'))return Response.json(1);
  throw Error('Unexpected '+u);
 };
 try{
  const r=await dispatchQueue({...env,APIFON_CLIENT_ID:'id',APIFON_CLIENT_SECRET:'secret'});
  assert.equal(r.processed,0);assert.equal(providerCalls,0);assert.match(outcome.p_reason,/no SMS attempted/);
 }finally{globalThis.fetch=prev;}
});

test('Worker Cron respects late exclusions before provider call',async()=>{
 const prev=globalThis.fetch;
 let outcome=null;let providerCalls=0;
 globalThis.fetch=async(url,opts={})=>{
  const u=String(url);
  if(u.includes('apifon.com')||u.includes('microsms.net')){providerCalls++;throw Error('Must not send');}
  if(u.includes('/sms_sender_ids?'))return Response.json([{enabled:true,archived_at:null}]);
  if(u.includes('/sms_exclusions?'))return Response.json([{id:'exclusion'}]);
  if(u.includes('/rpc/sms_claim_personalized_batch'))return Response.json([]);
  if(u.includes('/rpc/sms_claim_batch'))return Response.json([{recipient_id:actor,campaign_id:'other',phone:'35799123456',provider:'APIFON',sender:'TEST',message:'Hello'}]);
  if(u.includes('/rpc/sms_complete_recipient')){outcome=JSON.parse(opts.body);return Response.json(null);}
  if(u.includes('/rpc/sms_reconcile_campaigns'))return Response.json(1);
  throw Error('Unexpected '+u);
 };
 try{await dispatchQueue({...env,APIFON_CLIENT_ID:'id',APIFON_CLIENT_SECRET:'secret'});assert.equal(providerCalls,0);assert.equal(outcome.p_status,'EXCLUDED');}
 finally{globalThis.fetch=prev;}
});

test('bulk clear is restricted to Embedded list and SMS contact managers',async()=>{
 const prev=globalThis.fetch;let rpcCalls=0;
 globalThis.fetch=async(url,opts={})=>{
  if(String(url).includes('/rpc/sms_clear_embedded_contacts')){rpcCalls++;assert.equal(JSON.parse(opts.body).p_actor,actor);return Response.json(17);}
  throw Error('Unexpected endpoint '+String(url));
 };
 try{
  const profile={role:'member',active:true,sms_access:true,sms_manage_contacts:true};
  assert.equal((await smsOperation(env,profile,actor,'clearContacts',['STAFF'])).status,400);
  assert.equal(rpcCalls,0);
  assert.equal((await smsOperation(env,{...profile,sms_manage_contacts:false},actor,'clearContacts',['EMBEDDED'])).status,403);
  const result=await smsOperation(env,profile,actor,'clearContacts',['EMBEDDED']);
  assert.equal(result.deleted,17);assert.equal(rpcCalls,1);
 }finally{globalThis.fetch=prev;}
});
test('SMS contact sorting is surname then first name in Greek collation',async()=>{
 const prev=globalThis.fetch;
 globalThis.fetch=async(url)=>{
  if(String(url).includes('/sms_contacts?'))return Response.json([
   {id:'3',list:'STAFF',first_name:'Γιώργος',last_name:'Παπαδόπουλος',phone:'35799100001'},
   {id:'1',list:'STAFF',first_name:'Ανδρέας',last_name:'Αλεξίου',phone:'35799100002'},
   {id:'2',list:'STAFF',first_name:'Βασίλης',last_name:'Παπαδόπουλος',phone:'35799100003'}]);
  throw Error('Unexpected endpoint');
 };
 try{const r=await smsOperation(env,{role:'admin',active:true},actor,'getContacts',['STAFF','',0]);
  assert.deepEqual(r.rows.map(x=>x.first_name),['Ανδρέας','Βασίλης','Γιώργος']);
 }finally{globalThis.fetch=prev;}
});
