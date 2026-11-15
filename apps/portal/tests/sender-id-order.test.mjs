import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {smsOperation} from '../worker/sms-core.js';

const src=readFileSync(new URL('../src/SmsPage.tsx',import.meta.url),'utf8');
const actor='56e2e0b1-fdc4-4ab7-b902-ea41ccc18016';
const env={SUPABASE_URL:'https://testproj.supabase.co',SUPABASE_SERVICE_ROLE_KEY:'service-role-test'};
const originalFetch=globalThis.fetch;

// Guarantee sorting happens at DB fetch and UI uses the SAME ordered list in both locations.
test('dashboard requests Sender IDs by created_at ascending (oldest first), stable tie-break', async()=>{
 const requests=[];
 globalThis.fetch=async (url)=>{
  const u=String(url); requests.push(u);
  if(u.includes('/sms_sender_ids?')) return Response.json([
   {sender:'FIRST',enabled:true,archived_at:null,created_at:'2026-10-16T10:00:00Z'},
   {sender:'SECOND',enabled:true,archived_at:null,created_at:'2026-10-18T10:00:00Z'}
  ]);
  return Response.json([]);
 };
 try {
  const result=await smsOperation(env,{role:'admin',active:true},actor,'getDashboard',[]);
  assert.deepEqual(result.senders.map(s=>s.sender),['FIRST','SECOND']);
  const senderQuery=requests.find(u=>u.includes('/sms_sender_ids?'));
  assert.ok(senderQuery,'sender request missing');
  assert.equal(new URL(senderQuery).searchParams.get('order'),'created_at.asc,sender.asc');
  assert.match(new URL(senderQuery).searchParams.get('select'),/created_at/);
 } finally {globalThis.fetch=originalFetch;}
});
test('Sender IDs page and compose dropdown reuse oldest-first ordering',()=>{
 assert.match(src,/const orderedSenders=useMemo/);
 assert.match(src,/a\.created_at\.localeCompare\(b\.created_at\)/);
 assert.match(src,/const active=orderedSenders\.filter/);
 assert.match(src,/orderedSenders\.map\(s=><tr key=\{s\.sender\}>/);
 assert.doesNotMatch(src,/dashboard\.senders\.map\(/);
});
