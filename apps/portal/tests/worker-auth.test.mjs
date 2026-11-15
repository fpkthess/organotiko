import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../worker/index.js';
const env = { SUPABASE_URL: 'https://testproj.supabase.co', SUPABASE_ANON_KEY: 'sb_publishable_test', SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_test', ASSETS: { fetch: async () => new Response('static') } };
const adminId = '56e2e0b1-fdc4-4ab7-b902-ea41ccc18016';
const memberId = '77e2e0b1-fdc4-4ab7-b902-ea41ccc18026';
const init = { username: 'maria.papadopoulou', name: 'Maria Papadopoulou', password: 'a-very-long-unique-password' };
function request(path = '/api/users/create', { origin = 'https://dashboard.example.org', jwt = 'valid', data = init } = {}) {
 return new Request(`https://dashboard.example.org${path}`, { method: 'POST', headers: { Origin: origin, Authorization: jwt ? `Bearer ${jwt}` : '', 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
}
function mocked(role = 'admin', active = true) {
 return async (url, config = {}) => {
  const u = String(url);
  if (u.includes('/auth/v1/user') && !u.includes('/admin/')) return Response.json({ id: adminId });
  if (u.includes('/rest/v1/profiles') && u.includes('select=username,role,active')) return Response.json([{ username: 'admino',role, active }]);
  if (u.includes('/rest/v1/profiles') && u.includes('select=id,username')) return Response.json([{ id: memberId, username: 'maria.papadopoulou' }]);
  if (u.endsWith('/auth/v1/admin/users')) {
   assert.equal(config.headers.apikey, env.SUPABASE_SERVICE_ROLE_KEY);
   const data = JSON.parse(config.body);
   assert.deepEqual({ email: data.email, email_confirm: data.email_confirm, role: data.user_metadata?.role }, { email: 'maria.papadopoulou@protoporiathess.com', email_confirm: true, role: undefined });
   return Response.json({ id: memberId });
  }
  if (u.endsWith(`/auth/v1/admin/users/${memberId}`)) {
   assert.deepEqual(JSON.parse(config.body), { password: 'reset-unique-password-12' });
   return Response.json({ id: memberId });
  }
  if (u.includes('/rest/v1/profiles') && config.method === 'PATCH') {
   assert.equal(config.headers.apikey, env.SUPABASE_SERVICE_ROLE_KEY);
   assert.deepEqual(JSON.parse(config.body), {role:'member',position_title:''});
   return new Response(null, {status:204});
  }
  if (u.includes('/rest/v1/audit_log')) {
   assert.equal(config.headers.apikey, env.SUPABASE_SERVICE_ROLE_KEY);
   assert.ok(!JSON.stringify(JSON.parse(config.body)).includes('password'));
   return new Response('', { status: 201 });
  }
  return Response.json({ error: 'Unexpected endpoint' }, { status: 404 });
 };
}
test('Request with no bearer is rejected', async () => {
 assert.equal((await worker.fetch(request(undefined, { jwt: '' }), env)).status, 401);
});
test('Cross-site origin cannot provision users', async () => {
 assert.equal((await worker.fetch(request(undefined, { origin: 'https://evil.example' }), env)).status, 403);
});
test('Member cannot provision users', async () => {
 const previous = globalThis.fetch; globalThis.fetch = mocked('member');
 try { assert.equal((await worker.fetch(request(), env)).status, 403); }
 finally { globalThis.fetch = previous; }
});
test('Inactive admin cannot provision users', async () => {
 const previous = globalThis.fetch; globalThis.fetch = mocked('admin', false);
 try { assert.equal((await worker.fetch(request(), env)).status, 403); }
 finally { globalThis.fetch = previous; }
});
test('Valid admin can create email-free visible login without secret disclosure', async () => {
 const previous = globalThis.fetch; globalThis.fetch = mocked();
 try { const r = await worker.fetch(request(), env); assert.equal(r.status, 200); const reply = await r.text(); assert.ok(reply.includes('maria.papadopoulou')); assert.ok(!reply.includes(env.SUPABASE_SERVICE_ROLE_KEY)); assert.ok(!reply.includes(init.password)); }
 finally { globalThis.fetch = previous; }
});
test('Invalid username is rejected before creation', async () => {
 const previous = globalThis.fetch; globalThis.fetch = mocked();
 try { const r = await worker.fetch(request(undefined, { data: { ...init, username: 'invalid@@' } }), env); assert.equal(r.status, 400); }
 finally { globalThis.fetch = previous; }
});
test('Short passwords are rejected', async () => {
 const previous = globalThis.fetch; globalThis.fetch = mocked();
 try { const r = await worker.fetch(request(undefined, { data: { ...init, password: 'short' } }), env); assert.equal(r.status, 400); }
 finally { globalThis.fetch = previous; }
});
test('Admin can reset another account password without email', async () => {
 const previous = globalThis.fetch; globalThis.fetch = mocked();
 try { const r = await worker.fetch(request('/api/users/reset-password', { data: { userId: memberId, password: 'reset-unique-password-12' } }), env); assert.equal(r.status, 200); }
 finally { globalThis.fetch = previous; }
});
test('Admin cannot self-reset through other-user endpoint', async () => {
 const previous = globalThis.fetch; globalThis.fetch = mocked();
 try { const r = await worker.fetch(request('/api/users/reset-password', { data: { userId: adminId, password: 'reset-unique-password-12' } }), env); assert.equal(r.status, 400); }
 finally { globalThis.fetch = previous; }
});

test('Admin can delete another account only after database preflight, without password',async()=>{
 const prev=globalThis.fetch;let preflight=0;let deletes=0;
 globalThis.fetch=async(url,config={})=>{
  const u=String(url);
  if(u.endsWith('/auth/v1/user'))return Response.json({id:adminId});
  if(u.includes('/rest/v1/profiles?')&&u.includes('select=username,role,active'))return Response.json([{username:'admino',role:'admin',active:true}]);
  if(u.includes('/rpc/portal_prepare_user_delete')){preflight++;assert.deepEqual(JSON.parse(config.body),{p_actor:adminId,p_target:memberId});return Response.json(true);}
  if(u.endsWith('/auth/v1/admin/users/'+memberId)){deletes++;assert.equal(config.method,'DELETE');return new Response(null,{status:204});}
  if(u.includes('/rest/v1/audit_log'))return new Response(null,{status:201});
  throw Error('Unexpected endpoint '+u);
 };
 try{const r=await worker.fetch(request('/api/users/delete',{data:{userId:memberId}}),env);
 assert.equal(r.status,200);assert.equal(preflight,1);assert.equal(deletes,1);
 }finally{globalThis.fetch=prev;}
});
test('User delete is forbidden to non-admin and current Admin self-deletion',async()=>{
 const prev=globalThis.fetch;
 globalThis.fetch=async(url)=>{
  const u=String(url);
  if(u.endsWith('/auth/v1/user'))return Response.json({id:adminId});
  if(u.includes('/rest/v1/profiles?')&&u.includes('select=username,role,active'))return Response.json([{username:'user',role:'member',active:true}]);
  throw Error('Unsafe endpoint '+u);
 };
 try{assert.equal((await worker.fetch(request('/api/users/delete',{data:{userId:memberId}}),env)).status,403);}finally{globalThis.fetch=prev;}
 globalThis.fetch=async(url)=>{
  const u=String(url);
  if(u.endsWith('/auth/v1/user'))return Response.json({id:adminId});
  if(u.includes('/rest/v1/profiles?')&&u.includes('select=username,role,active'))return Response.json([{username:'admino',role:'admin',active:true}]);
  throw Error('Unsafe endpoint '+u);
 };
 try{assert.equal((await worker.fetch(request('/api/users/delete',{data:{userId:adminId}}),env)).status,400);}finally{globalThis.fetch=prev;}
});
