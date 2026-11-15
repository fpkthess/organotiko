import { smsOperation, dispatchQueue } from './sms-core.js';
/**
 * PROTOPORIA Portal v2.0.3 — account provisioning + native SMS in Cloudflare/Supabase.
 * Members sign in using username/password in the browser. Supabase Auth stores
 * an internal username@protoporiathess.com identity, NOT a verified mailbox.
 * Environment secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY.
 * The secret/service-role key must NEVER be included in the frontend bundle.
 */
const LOGIN_DOMAIN = 'protoporiathess.com';
const USERNAME_PATTERN = /^[a-z][a-z0-9._-]{2,31}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer'
  }
});
const serverHeaders = key => ({ apikey: key, Authorization: `Bearer ${key}`, 'content-type': 'application/json' });
async function audit(base, service, actorId, entityId, action, details = {}) {
  // Audit is best-effort; never store passwords, session tokens, or secrets.
  await fetch(`${base}/rest/v1/audit_log`, {
    method: 'POST', headers: { ...serverHeaders(service), Prefer: 'return=minimal' },
    body: JSON.stringify({ actor_id: actorId, entity_type: 'user_account', entity_id: entityId, action, details })
  }).catch(() => null);
}
export default {
 async fetch(request, env) {
  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
  if (!['/api/users/create', '/api/users/reset-password','/api/users/delete','/api/sms','/api/audit/security'].includes(url.pathname)) return json({ error: 'Not found' }, 404);
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);
  if (request.headers.get('origin') !== url.origin) return json({ error: 'Invalid origin' }, 403);
  const site=request.headers.get('sec-fetch-site');
  if(site && site!=='same-origin' && site!=='none')return json({error:'Invalid site'},403);
  const bearer = request.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+$/i.test(bearer)) return json({ error: 'Authentication required' }, 401);
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY || !env.SUPABASE_SERVICE_ROLE_KEY) return json({ error: 'Server is not configured' }, 503);
  const base = String(env.SUPABASE_URL).replace(/\/$/, '');
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(base)) return json({ error: 'Invalid server configuration' }, 503);
  const service = env.SUPABASE_SERVICE_ROLE_KEY;
  try {
   const token = bearer.replace(/^Bearer\s+/i, '');
   const meRes = await fetch(`${base}/auth/v1/user`, {
    headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token}` }
   });
   if (!meRes.ok) return json({ error: 'Session expired' }, 401);
   const me = await meRes.json();
   if (!me?.id || !UUID_PATTERN.test(me.id)) return json({ error: 'Invalid session' }, 401);
   const profileRes = await fetch(`${base}/rest/v1/profiles?id=eq.${encodeURIComponent(me.id)}&select=username,role,active,sms_access,sms_manage_contacts,sms_manage_settings`, {
    headers: serverHeaders(service)
   });
   if (!profileRes.ok) return json({ error: 'Authorization unavailable' }, 503);
   const profileRows = await profileRes.json();
   const profile=profileRows?.[0];
   if(profile?.active !== true)return json({error:'Account inactive or missing'},403);
   if (url.pathname==='/api/audit/security') {
    // Best-effort client event; server validates actor. Never accept arbitrary audit entity/action.
    if ((request.headers.get('content-type')||'').split(';')[0]!=='application/json') return json({error:'Invalid request'},415);
    const raw=await request.text(); if(raw.length>120)return json({error:'Too large'},413);
    let event;try{event=JSON.parse(raw).event;}catch{return json({error:'Invalid JSON'},400);}
    if(!['login','password_changed'].includes(event))return json({error:'Unsupported event'},400);
    await audit(base,service,me.id,me.id,'self_'+event,{source:'portal'});
    return json({ok:true});
   }
   if (url.pathname==='/api/sms') {
    if(profile.role!=='admin' && profile.sms_access!==true)return json({ok:false,error:'Δεν έχεις πρόσβαση στα SMS.'},403);
    if((request.headers.get('content-type')||'').split(';')[0]!=='application/json')return json({ok:false,error:'Invalid content type'},415);
    if(Number(request.headers.get('content-length')||0)>600000)return json({ok:false,error:'Request too large'},413);
    const raw=await request.text();if(raw.length>600000)return json({ok:false,error:'Request too large'},413);
    let call;try{call=JSON.parse(raw);}catch{return json({ok:false,error:'Invalid JSON'},400);}
    const names=new Set(['getDashboard','getContacts','getExclusions','setExclusion','setSender','importContacts',
      'manageContact','clearContacts','previewRecipients','createCampaign','previewPersonalized','createPersonalizedCampaign','getCampaignDetails','getCampaignExport','getCampaigns','cancelCampaign']);
    if(!call||!names.has(call.method)||!Array.isArray(call.args)||call.args.length>5)return json({ok:false,error:'Unsupported operation'},400);
    try{
     const result=await smsOperation(env,profile,me.id,call.method,call.args);
     if(result&&typeof result.status==='number'&&result.error)return json({ok:false,error:result.error},result.status);
     return json({ok:true,result});
    }catch(e){
     console.error('SMS operation failure',call.method,String(e?.message||e).slice(0,200));
     return json({ok:false,error:'Δεν ολοκληρώθηκε η ενέργεια. Έλεγξε τις ρυθμίσεις και το ιστορικό πριν επαναλάβεις αποστολή.'},502);
    }
   }
   if (profile.role !== 'admin') return json({ error: 'Admin only' }, 403);

   const raw = await request.text();
   if (raw.length > 4096) return json({ error: 'Request too large' }, 413);
   let input;
   try { input = JSON.parse(raw); } catch { return json({ error: 'Invalid JSON' }, 400); }
   if (!input || typeof input !== 'object' || Array.isArray(input)) return json({ error: 'Invalid request' }, 400);
   if(url.pathname==='/api/users/delete'){
    const targetId=typeof input.userId==='string'?input.userId:'';
    if(!UUID_PATTERN.test(targetId)||targetId===me.id)return json({error:'Δεν επιτρέπεται η διαγραφή του τρέχοντος χρήστη.'},400);
    const preflight=await fetch(`${base}/rest/v1/rpc/portal_prepare_user_delete`,{
      method:'POST',headers:serverHeaders(service),body:JSON.stringify({p_actor:me.id,p_target:targetId})
    });
    if(!preflight.ok){
      const info=await preflight.json().catch(()=>({}));
      return json({error:typeof info.message==='string'?info.message:'Δεν είναι δυνατή η διαγραφή. Έλεγξε πρώτα τις αναθέσεις.'},409);
    }
    const removed=await fetch(`${base}/auth/v1/admin/users/${targetId}`,{
      method:'DELETE',headers:serverHeaders(service)
    });
    if(!removed.ok)return json({error:'Ο λογαριασμός δεν διαγράφηκε από το Auth. Προσπάθησε ξανά.'},502);
    await audit(base,service,me.id,targetId,'deleted',{target_id:targetId});
    return json({ok:true});
   }
   const password = input.password;
   if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    return json({ error: 'Ο κωδικός πρέπει να έχει 12–128 χαρακτήρες.' }, 400);
   }

   if (url.pathname === '/api/users/create') {
    const username = typeof input.username === 'string' ? input.username.trim().toLowerCase() : '';
    const name = typeof input.name === 'string' ? input.name.trim() : '';
    const role = ['admin','leadership','coordinator','member'].includes(input.role) ? input.role : 'member';
    const position = typeof input.position_title === 'string' ? input.position_title.trim() : '';
    if (!USERNAME_PATTERN.test(username) || name.length < 2 || name.length > 100 || position.length > 100) {
     return json({ error: 'Συμπλήρωσε όνομα και username 3–32 λατινικών χαρακτήρων, ξεκινώντας από γράμμα.' }, 400);
    }
    const email = `${username}@${LOGIN_DOMAIN}`;
    const created = await fetch(`${base}/auth/v1/admin/users`, {
     method: 'POST', headers: serverHeaders(service),
     body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: name, username } })
    });
    const body = await created.json().catch(() => ({}));
    if (!created.ok) {
     if (created.status === 422 && /already|exists|registered|duplicate/i.test(JSON.stringify(body))) {
      return json({ error: 'Το username χρησιμοποιείται ήδη.' }, 409);
     }
     return json({ error: 'Δεν δημιουργήθηκε ο χρήστης. Έλεγξε το username ή δοκίμασε ξανά.' }, created.status >= 500 ? 502 : 400);
    }
    const id = body.id || body.user?.id;
    if (!id || !UUID_PATTERN.test(id)) return json({ error: 'Αδυναμία επιβεβαίωσης δημιουργίας.' }, 502);
    const patched = await fetch(`${base}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`, {
      method: 'PATCH', headers: { ...serverHeaders(service), Prefer: 'return=minimal' },
      body: JSON.stringify({ role, position_title: position })
    });
    if (!patched.ok) {
      await fetch(`${base}/auth/v1/admin/users/${id}`, {method: 'DELETE',headers:serverHeaders(service)});
      return json({error:'Δεν αποθηκεύτηκαν τα δικαιώματα. Η δημιουργία ακυρώθηκε.'},502);
    }
    await audit(base, service, me.id, id, 'created', { username, role, position });
    return json({ ok: true, username });
   }

   // Reset by Admin: no email is sent, and the user can change it after login.
   const userId = typeof input.userId === 'string' ? input.userId : '';
   if (!UUID_PATTERN.test(userId) || userId === me.id) return json({ error: 'Επίλεξε άλλο έγκυρο στέλεχος.' }, 400);
   const target = await fetch(`${base}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}&select=id,username`, {
    headers: serverHeaders(service)
   });
   if (!target.ok) return json({ error: 'Δεν ήταν δυνατός ο έλεγχος του χρήστη.' }, 503);
   const users = await target.json();
   if (!Array.isArray(users) || users.length !== 1) return json({ error: 'Ο χρήστης δεν βρέθηκε.' }, 404);
   const updated = await fetch(`${base}/auth/v1/admin/users/${userId}`, {
    method: 'PUT', headers: serverHeaders(service), body: JSON.stringify({ password })
   });
   if (!updated.ok) return json({ error: 'Αποτυχία επαναφοράς κωδικού.' }, updated.status >= 500 ? 502 : 400);
   await audit(base, service, me.id, userId, 'password_reset', { username: users[0].username });
   return json({ ok: true });
  } catch {
   return json({ error: 'Προσωρινό πρόβλημα επικοινωνίας.' }, 502);
  }
 },
 async scheduled(_event,env,ctx){
  ctx.waitUntil(dispatchQueue(env).catch(e=>console.error('SMS dispatch failed:',String(e?.message||e).slice(0,140))));
 }
};
