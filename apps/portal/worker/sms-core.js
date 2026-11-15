import {normalizePhone,senderValid,sendProvider} from './sms-providers.js';
import {personalizedSnapshot,encryptMessage,decryptMessage} from './personalized.js';
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const goodList=v=>['STAFF','EMBEDDED','BOTH','MANUAL'].includes(v);
const num=(v,def=0,max=2000)=>Math.max(0,Math.min(max,Number.isFinite(Number(v))?Math.floor(Number(v)):def));
const limited=(s,n)=>String(s??'').trim().slice(0,n);
const fail=(error,status=400)=>({error,status});
function dbase(env){const base=String(env.SUPABASE_URL||'').replace(/\/$/,'');const key=env.SUPABASE_SERVICE_ROLE_KEY;
 if(!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base)||!key)throw Error('Supabase not configured');
 return {base,key};
}
export async function queryDb(env,path,{method='GET',body,prefer}={}){
 const {base,key}=dbase(env);
 const r=await fetch(`${base}/rest/v1/${path}`,{method,headers:{apikey:key,authorization:`Bearer ${key}`,
  'content-type':'application/json',...(prefer?{Prefer:prefer}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const txt=await r.text();let value;
 try{value=txt?JSON.parse(txt):null;}catch{value=null;}
 if(!r.ok){throw Error(`Database ${r.status}: ${String(value?.message||'Operation failed').slice(0,140)}`);}
 return {value,headers:r.headers};
}
export async function rpc(env,fn,payload){return (await queryDb(env,'rpc/'+fn,{method:'POST',body:payload})).value;}
export async function logAudit(env,actor,type,id,action,details={}){
 await queryDb(env,'audit_log',{method:'POST',body:{actor_id:actor||null,entity_type:type,entity_id:id||null,action,details},prefer:'return=minimal'});
}
async function allRecords(env,table,select='*',limit=3000,sort='created_at.desc',extra=''){
 // Supabase API projects commonly cap rows per query at 1000; walk smaller pages
 // so a 1500-recipient upload is NOT silently truncated to its first 1000 rows.
 const rows=[];
 for(let offset=0;offset<limit;offset+=500){
  const take=Math.min(500,limit-offset);
  const {value}=await queryDb(env,`${table}?select=${encodeURIComponent(select)}&order=${encodeURIComponent(sort)}&limit=${take}&offset=${offset}${extra?'&'+extra:''}`);
  const page=Array.isArray(value)?value:[];rows.push(...page);
  if(page.length<take)break;
 }
 return rows;
}
async function snapshot(env,source,manual){
 let rows=[];
 if(source==='MANUAL')rows=String(manual||'').split(/[\n;,]+/).filter(x=>x.trim()).map(phone=>({phone}));
 else{
  const contacts=await allRecords(env,'sms_contacts','list,first_name,last_name,phone',4000,'created_at.asc');
  rows=contacts.filter(c=>source==='BOTH'||c.list===source);
 }
 if(rows.length>3000)throw Error('Too many source recipients');
 const excludes=new Set((await allRecords(env,'sms_exclusions','phone',4000)).map(r=>r.phone));
 let invalid=0,duplicates=0,excluded=0;
 const seen=new Set(),valid=[];
 for(const item of rows){const phone=normalizePhone(item.phone);if(!phone){invalid++;continue;}
  if(seen.has(phone)){duplicates++;continue;}
  seen.add(phone);if(excludes.has(phone)){excluded++;continue;}
  valid.push({phone,first_name:limited(item.first_name,100),last_name:limited(item.last_name,100)});
 }
 if(valid.length>1500)throw Error('Maximum 1500 unique recipients');
 return {valid,invalid,duplicates,excluded,sourceTotal:rows.length};
}
const hash=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
function canContacts(p){return p.role==='admin'||(p.sms_access&&p.sms_manage_contacts);}
function canSettings(p){return p.role==='admin'||(p.sms_access&&p.sms_manage_settings);}
export async function smsOperation(env,profile,actor,method,args){
 if(!profile.active || !(profile.role==='admin'||profile.sms_access))return fail('Δεν έχεις πρόσβαση στα SMS.',403);
 const list=await (async()=>{
  switch(method){
   case 'getDashboard':{
    const [campaigns,senders,exclusions,contacts]=await Promise.all([
     allRecords(env,'sms_campaigns','id,title,provider,sender,source,status,total,planned_at,created_at,finished_at,created_by',120,'created_at.desc'),
     allRecords(env,'sms_sender_ids','sender,enabled,archived_at,created_at',200,'created_at.asc,sender.asc'),
     allRecords(env,'sms_exclusions','id,phone,reason,created_at',4000,'created_at.desc'),
     allRecords(env,'sms_contacts','list',4000)
    ]);
    return {campaigns,senders,exclusionsCount:exclusions.length,staffCount:contacts.filter(c=>c.list==='STAFF').length,
     embeddedCount:contacts.filter(c=>c.list==='EMBEDDED').length,providers:{APIFON:!!(env.APIFON_CLIENT_ID&&env.APIFON_CLIENT_SECRET),MICROSMS:!!(env.MICROSMS_USERNAME&&env.MICROSMS_PASSWORD)},
     rights:{contacts:canContacts(profile),settings:canSettings(profile)}};
   }
   case 'getCampaigns':{
    const offset=num(args[0],0,100000);
    const search=limited(args[1],100).toLocaleLowerCase('el');
    const campaigns=await allRecords(env,'sms_campaigns','id,title,provider,sender,source,status,total,planned_at,created_at,finished_at,created_by',4000,'created_at.desc');
    const filtered=campaigns.filter(c=>(`${c.title} ${c.provider} ${c.sender} ${c.status}`).toLocaleLowerCase('el').includes(search));
    return {rows:filtered.slice(offset,offset+100),total:filtered.length};
   }
   case 'getContacts':{
    if(!['STAFF','EMBEDDED'].includes(args[0]))return fail('Invalid list');
    const search=limited(args[1],100).toLocaleLowerCase('el');const offset=num(args[2],0,100000);
    const rows=(await allRecords(env,'sms_contacts','id,list,first_name,last_name,phone,created_at',4000,'last_name.asc'))
      .filter(c=>c.list===args[0]&&(`${c.first_name} ${c.last_name} ${c.phone}`).toLocaleLowerCase('el').includes(search))
      .sort((a,b)=>a.last_name.localeCompare(b.last_name,'el',{sensitivity:'base'})||a.first_name.localeCompare(b.first_name,'el',{sensitivity:'base'})||a.phone.localeCompare(b.phone));
    return {rows:rows.slice(offset,offset+100),total:rows.length};
   }
   case 'getExclusions':{
    if(!canSettings(profile))return fail('Only settings managers can see exclusions',403);
    return await allRecords(env,'sms_exclusions','id,phone,reason,created_at',4000,'created_at.desc');
   }
   case 'setExclusion':{
    if(!canSettings(profile))return fail('No settings rights',403);
    const phone=normalizePhone(args[0]);if(!phone)return fail('Μη έγκυρος αριθμός');
    await rpc(env,'sms_manage_exclusion',{p_actor:actor,p_phone:phone,p_reason:limited(args[1],200),p_remove:args[2]===true});return {ok:true};
   }
   case 'setSender':{
    if(profile.role!=='admin')return fail('Only Admin can manage Sender IDs',403);
    const sender=limited(args[0],11).toUpperCase();if(!senderValid(sender))return fail('Sender ID: 1–11 λατινικοί χαρακτήρες ή αριθμοί');
    const action=String(args[1]);if(!['enable','disable','archive'].includes(action))return fail('Invalid sender action');
    await rpc(env,'sms_manage_sender',{p_actor:actor,p_sender:sender,p_action:action});return {ok:true};
   }
   case 'importContacts':{
    if(!canContacts(profile))return fail('No contacts management rights',403);
    const [lst,mode,raw]=args;
    if(!['STAFF','EMBEDDED'].includes(lst)||!['APPEND','REPLACE'].includes(mode)||!Array.isArray(raw)||raw.length>1500||!raw.length)return fail('Invalid import');
    const rows=[];let invalid=0;
    for(const r of raw){if(!Array.isArray(r)||r.length>3)return fail('Invalid import row');
      const phone=normalizePhone(r[2]);if(!phone){invalid++;continue;}
      if(String(r[0]||'').length>100||String(r[1]||'').length>100)return fail('Name too long');
      rows.push({first_name:limited(r[0],100),last_name:limited(r[1],100),phone});
    }
    if(invalid) return fail(`Το αρχείο περιέχει ${invalid} μη έγκυρους αριθμούς. Δεν έγινε καμία αλλαγή.`);
    return await rpc(env,'sms_import_contacts',{p_actor:actor,p_list:lst,p_mode:mode,p_rows:rows});
   }
   case 'clearContacts':{
    if(!canContacts(profile))return fail('No contacts management rights',403);
    if(args[0]!=='EMBEDDED')return fail('Only the Embedded list can be cleared',400);
    return {deleted:await rpc(env,'sms_clear_embedded_contacts',{p_actor:actor})};
   }
   case 'manageContact':{
    if(!canContacts(profile))return fail('No contacts management rights',403);
    const [lst,phone,first,last,remove]=args;if(!['STAFF','EMBEDDED'].includes(lst))return fail('Invalid list');
    const normalized=normalizePhone(phone);if(!normalized)return fail('Μη έγκυρος αριθμός');
    await rpc(env,'sms_manage_contact',{p_actor:actor,p_list:lst,p_phone:normalized,p_first:limited(first,100),p_last:limited(last,100),p_remove:remove===true});return {ok:true};
   }
   case 'previewRecipients':{
    if(!goodList(args[0]))return fail('Invalid recipient list');
    const result=await snapshot(env,args[0],args[1]);
    return {total:result.valid.length,invalid:result.invalid,duplicates:result.duplicates,excluded:result.excluded,
      sample:result.valid.slice(0,10).map(v=>({...v,phone:'***'+v.phone.slice(-4)})),
      fingerprint:await hash(result.valid.map(x=>x.phone).join('|'))};
   }
   case 'previewPersonalized':{
    const [rows,template]=args;
    const exclusions=await allRecords(env,'sms_exclusions','phone',4000);
    const snap=personalizedSnapshot(rows,template,exclusions.map(x=>x.phone));
    return {total:snap.valid.length,invalid:snap.invalid,duplicates:snap.duplicates,excluded:snap.excluded,
     sample:snap.valid.slice(0,4).map(v=>({phone:'***'+v.phone.slice(-4),first_name:v.first_name,last_name:v.last_name})),
     previewMessages:snap.valid.slice(0,4).map(v=>({name:[v.first_name,v.last_name].filter(Boolean).join(' ')||'Παραλήπτης',phone:'***'+v.phone.slice(-4),message:v.redacted})),
     fingerprint:await hash(JSON.stringify({template,valid:snap.valid.map(v=>[v.phone,v.rendered])}))};
   }
   case 'createPersonalizedCampaign':{
    const p=args[0];if(!p||typeof p!=='object'||Array.isArray(p))return fail('Μη έγκυρη καμπάνια.');
    if(!UUID.test(p.requestId)||!['APIFON','MICROSMS'].includes(p.provider)||!senderValid(p.sender)
      ||typeof p.title!=='string'||p.title.trim().length<3||p.title.length>180
      ||typeof p.message!=='string'||p.message.length>612)return fail('Έλεγξε τα πεδία της καμπάνιας.');
    if(!/^[0-9a-f]{64}$/i.test(String(env.PERSONALIZED_SMS_ENCRYPTION_KEY||'')))return fail('Λείπει το Cloudflare secret PERSONALIZED_SMS_ENCRYPTION_KEY.',503);
    if(p.provider==='APIFON'&&!(env.APIFON_CLIENT_ID&&env.APIFON_CLIENT_SECRET))return fail('Δεν έχουν ρυθμιστεί τα credentials Apifon.',503);
    if(p.provider==='MICROSMS'&&!(env.MICROSMS_USERNAME&&env.MICROSMS_PASSWORD))return fail('Δεν έχουν ρυθμιστεί τα credentials MicroSMS.',503);
    const senders=await allRecords(env,'sms_sender_ids','sender,enabled,archived_at',200);
    if(!senders.some(s=>s.sender===p.sender&&s.enabled&&!s.archived_at))return fail('Sender ID ανενεργό ή άγνωστο.');
    const plannedAt=p.scheduleAt?new Date(p.scheduleAt):new Date();
    if(!Number.isFinite(plannedAt.getTime())||plannedAt.getTime()<Date.now()-5*60000||plannedAt.getTime()>Date.now()+365*86400000)
      return fail('Μη έγκυρη ημερομηνία αποστολής.');
    const exclusions=await allRecords(env,'sms_exclusions','phone',4000);
    const snap=personalizedSnapshot(p.rows,p.message,exclusions.map(x=>x.phone));
    const fingerprint=await hash(JSON.stringify({template:p.message,valid:snap.valid.map(v=>[v.phone,v.rendered])}));
    if(fingerprint!==p.recipientHash)return fail('Το αρχείο ή οι εξαιρέσεις άλλαξαν. Κάνε νέα προεπισκόπηση.',409);
    const requestHash=await hash(JSON.stringify({provider:p.provider,sender:p.sender,title:p.title,message:p.message,plannedAt:p.scheduleAt||'',fingerprint}));
    const rows=[];
    for(let i=0;i<snap.valid.length;i+=20){
     const block=await Promise.all(snap.valid.slice(i,i+20).map(async v=>({phone:v.phone,
      first_name:v.first_name,last_name:v.last_name,
      encrypted_message:await encryptMessage(v.rendered,env.PERSONALIZED_SMS_ENCRYPTION_KEY)})));
     rows.push(...block);
    }
    const id=await rpc(env,'sms_create_personalized_campaign',{p_actor:actor,p_request:p.requestId,p_hash:requestHash,
      p_title:p.title,p_provider:p.provider,p_sender:p.sender,p_template:p.message,p_planned_at:plannedAt.toISOString(),p_rows:rows});
    return {id,scheduled:plannedAt.getTime()>Date.now()+30000};
   }
   case 'createCampaign':{
    const p=args[0];if(!p||typeof p!=='object'||Array.isArray(p))return fail('Invalid campaign');
    if(!UUID.test(p.requestId)||!['APIFON','MICROSMS'].includes(p.provider)||!goodList(p.source)
      ||!senderValid(p.sender)||String(p.title||'').trim().length<3||String(p.title).length>180||String(p.message||'').length<1
      ||String(p.message||'').length>612)return fail('Έλεγξε τα πεδία της καμπάνιας.');
    if(p.provider==='APIFON'&&!(env.APIFON_CLIENT_ID&&env.APIFON_CLIENT_SECRET))return fail('Δεν έχουν ρυθμιστεί τα credentials Apifon.',503);
    if(p.provider==='MICROSMS'&&!(env.MICROSMS_USERNAME&&env.MICROSMS_PASSWORD))return fail('Δεν έχουν ρυθμιστεί τα credentials MicroSMS.',503);
    const senders=await allRecords(env,'sms_sender_ids','sender,enabled,archived_at',200);
    if(!senders.some(s=>s.sender===p.sender&&s.enabled&&!s.archived_at))return fail('Sender ID ανενεργό ή άγνωστο.');
    const plannedAt=p.scheduleAt?new Date(p.scheduleAt):new Date();
    if(!Number.isFinite(plannedAt.getTime())||plannedAt.getTime()<Date.now()-5*60000||plannedAt.getTime()>Date.now()+365*86400000)
     return fail('Μη έγκυρη ημερομηνία αποστολής');
    const snap=await snapshot(env,p.source,p.manual);
    if(!snap.valid.length||snap.invalid) return fail(`Μη έγκυροι αριθμοί: ${snap.invalid}. Διόρθωσε πρώτα τη λίστα.`);
    const fingerprint=await hash(snap.valid.map(v=>v.phone).join('|'));
    if(fingerprint!==p.recipientHash) return fail('Η λίστα άλλαξε. Κάνε νέα προεπισκόπηση πριν επιβεβαιώσεις.',409);
    const requestHash=await hash(JSON.stringify({provider:p.provider,sender:p.sender,title:p.title,message:p.message,source:p.source,plannedAt:p.scheduleAt||'',fingerprint}));
    const id=await rpc(env,'sms_create_campaign',{p_actor:actor,p_request:p.requestId,p_hash:requestHash,p_title:p.title,p_provider:p.provider,
      p_sender:p.sender,p_source:p.source,p_message:p.message,p_planned_at:plannedAt.toISOString(),p_rows:snap.valid});
    return {id,scheduled:plannedAt.getTime()>Date.now()+30000};
   }
   case 'getCampaignDetails':{
    const id=args[0];if(!UUID.test(id))return fail('Invalid campaign ID');
    const c=(await queryDb(env,`sms_campaigns?select=*&id=eq.${id}&limit=1`)).value?.[0];if(!c)return fail('Campaign not found',404);
    const offset=num(args[1],0,100000);
    const {value:rows}=await queryDb(env,`sms_recipients?select=id,first_name,last_name,phone,status,provider_message_id,note,processed_at&campaign_id=eq.${id}&order=id.asc&limit=100&offset=${offset}`);
    const all=await allRecords(env,'sms_recipients','status',1700,'id.asc',`campaign_id=eq.${id}`);
    const counts=Object.fromEntries(['QUEUED','SENDING','ACCEPTED','FAILED','UNCERTAIN','EXCLUDED','CANCELLED'].map(s=>[s,all.filter(r=>r.status===s).length]));
    return {campaign:c,rows,total:all.length,counts};
   }
   case 'getCampaignExport':{
    if(!UUID.test(args[0]))return fail('Invalid campaign ID');
    const id=args[0];const all=await allRecords(env,'sms_recipients','first_name,last_name,phone,status,note,provider_message_id',1700,'id.asc',`campaign_id=eq.${id}`);
    await logAudit(env,actor,'sms_campaign',id,'export',{'recipient_count':all.length,'format':'csv'});
    return {rows:all};
   }
   case 'cancelCampaign':{
    if(!UUID.test(args[0]))return fail('Invalid campaign ID');
    return {cancelled:await rpc(env,'sms_cancel_campaign',{p_actor:actor,p_id:args[0]})};
   }
   default:return fail('Unsupported SMS operation',404);
  }
 })();
 return list;
}
export async function dispatchQueue(env){
 if(!env.SUPABASE_URL||!env.SUPABASE_SERVICE_ROLE_KEY)return {processed:0,error:'DB configuration missing'};
 // Keep personalized campaigns separate so an older Worker cannot accidentally
 // send encrypted ciphertext as if it were the real SMS after a rollback.
 const standard=await rpc(env,'sms_claim_batch',{p_limit:4});
 const personalized=await rpc(env,'sms_claim_personalized_batch',{p_limit:8-(standard||[]).length});
 const claimed=[...(standard||[]),...(personalized||[])];let sent=0,uncertain=0;
 for(const row of (claimed||[])){
  // Recheck sender & exclusions just before each external call.
  const sender=(await queryDb(env,`sms_sender_ids?select=enabled,archived_at&sender=eq.${row.sender}&limit=1`)).value?.[0];
  const exclude=(await queryDb(env,`sms_exclusions?select=id&phone=eq.${row.phone}&limit=1`)).value;
  let result;
  if(exclude?.length)result={status:'EXCLUDED',note:'Excluded immediately before provider call'};
  else if(!sender?.enabled||sender?.archived_at||
    (row.provider==='APIFON'&&!(env.APIFON_CLIENT_ID&&env.APIFON_CLIENT_SECRET))||
    (row.provider==='MICROSMS'&&!(env.MICROSMS_USERNAME&&env.MICROSMS_PASSWORD))){
    await rpc(env,'sms_release_unattempted',{p_id:row.recipient_id,p_reason:'Paused: sender disabled or provider unconfigured; no SMS attempted'});
    continue;
  }
  else {
   let plain;
   try {plain=await decryptMessage(row.message,env.PERSONALIZED_SMS_ENCRYPTION_KEY);}
   catch(e){
    // No provider call occurred: release for later retry after the secret is restored.
    await rpc(env,'sms_release_unattempted',{p_id:row.recipient_id,p_reason:'Personalized SMS key unavailable; no provider call made'});
    continue;
   }
   result=await sendProvider({provider:row.provider,phone:row.phone,sender:row.sender,message:plain,ref:row.recipient_id},env);
  }
  try{await rpc(env,'sms_complete_recipient',{p_id:row.recipient_id,p_status:result.status,p_provider_id:result.providerId||'',p_note:result.note||''});}catch(e){
   console.error('SMS completion persistence failed for recipient:',row.recipient_id,String(e.message).slice(0,100));
   // Never retry a claim just because persistence failed; stale reservation => UNCERTAIN.
  }
  sent++;if(result.status==='UNCERTAIN')uncertain++;
 }
 await rpc(env,'sms_reconcile_campaigns',{});
 return {processed:sent,uncertain};
}
