import test from 'node:test';
import assert from 'node:assert/strict';
import {smsOperation,dispatchQueue} from '../worker/sms-core.js';
import {decryptMessage,encryptMessage} from '../worker/personalized.js';
const actor='56e2e0b1-fdc4-4ab7-b902-ea41ccc18016';
const key='b'.repeat(64);
const env={SUPABASE_URL:'https://testproj.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'test',PERSONALIZED_SMS_ENCRYPTION_KEY:key,APIFON_CLIENT_ID:'cid',APIFON_CLIENT_SECRET:'pass'};
const profile={role:'admin',active:true};
const recipients=[{phone:'99123456',first_name:'Test',username:'testuser',password:'OneTimePassword123!'}];
const msg='Hello {first_name}. User: {username}, pass: {password}';
const oldFetch=globalThis.fetch;
test('API preview displays masked passwords, not real values',async()=>{
 globalThis.fetch=async(url)=>String(url).includes('/sms_exclusions?')?Response.json([]):(()=>{throw Error(String(url));})();
 try{
 const preview=await smsOperation(env,profile,actor,'previewPersonalized',[recipients,msg]);
 assert.equal(preview.total,1);assert.match(preview.previewMessages[0].message,/••••••/);
 assert.doesNotMatch(JSON.stringify(preview),/OneTimePassword/);
 }finally{globalThis.fetch=oldFetch;}
});
test('campaign creation sends only ciphertext and SMS template to DB',async()=>{
 let received=null;
 globalThis.fetch=async(url,opts={})=>{
  const u=String(url);
  if(u.includes('/sms_exclusions?'))return Response.json([]);
  if(u.includes('/sms_sender_ids?'))return Response.json([{sender:'TEST',enabled:true,archived_at:null}]);
  if(u.includes('/rpc/sms_create_personalized_campaign')){
   received=JSON.parse(opts.body);
   return Response.json('00000000-0000-4000-8000-000000000001');
  }
  throw Error(u);
 };
 try{
  const preview=await smsOperation(env,profile,actor,'previewPersonalized',[recipients,msg]);
  const result=await smsOperation(env,profile,actor,'createPersonalizedCampaign',[{
   requestId:'00000000-0000-4000-8000-000000000002',recipientHash:preview.fingerprint,
   provider:'APIFON',sender:'TEST',title:'Account info',message:msg,rows:recipients
  }]);
  assert.equal(result.id,'00000000-0000-4000-8000-000000000001');
  assert.ok(received);assert.match(received.p_rows[0].encrypted_message,/^ENC1:/);
  assert.ok(!JSON.stringify(received).includes('OneTimePassword123!'));
  assert.ok(!JSON.stringify(received).includes('testuser') || JSON.stringify(received).includes('testuser}')); // template variable only
  assert.match(await decryptMessage(received.p_rows[0].encrypted_message,key),/OneTimePassword123!/);
 }finally{globalThis.fetch=oldFetch;}
});
test('dispatch decrypts encrypted message before sending and never uses ciphertext at provider',async()=>{
 const blob=await encryptMessage('Hello secret-only-for-receiver',key);let providerText='';
 globalThis.fetch=async(url,opts={})=>{
  const u=String(url);
  if(u.includes('ids.apifon.com'))return Response.json({access_token:'t',expires_in:60});
  if(u.includes('ars.apifon.com')){providerText=JSON.parse(opts.body).message.text;return Response.json({results:{'35799123456':[{message_id:'1'}]}});}
  if(u.includes('/rpc/sms_claim_personalized_batch'))return Response.json([{recipient_id:actor,campaign_id:'x',phone:'35799123456',provider:'APIFON',sender:'TEST',message:blob}]);
  if(u.includes('/rpc/sms_claim_batch'))return Response.json([]);
  if(u.includes('/sms_sender_ids?'))return Response.json([{enabled:true,archived_at:null}]);
  if(u.includes('/sms_exclusions?'))return Response.json([]);
  if(u.includes('/rpc/sms_complete_recipient')||u.includes('/rpc/sms_reconcile_campaigns'))return Response.json(null);
  throw Error(u);
 };
 try{await dispatchQueue(env);assert.equal(providerText,'Hello secret-only-for-receiver');}finally{globalThis.fetch=oldFetch;}
});
