import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const source=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const page=source('../src/FinancePage.tsx');
const app=source('../src/App.tsx');
const events=source('../src/EventsPage.tsx');
const sql=source('../supabase/013_expected_nullable_kind_reorder.sql');
test('Finance menu comes above teams',()=>assert.ok(app.indexOf("{page:'finance',")<app.indexOf("{page:'teams',")));
test('Expected records accept unknown amounts and unspecified dates',()=>{
 assert.match(sql,/ALTER TABLE public.finance_expected ALTER COLUMN amount DROP NOT NULL/);
 assert.match(sql,/ALTER TABLE public.finance_expected ALTER COLUMN expected_on DROP NOT NULL/);
 assert.match(page,/type Expected=\{[^\n]*amount:number\|null;expected_on:string\|null/);
 assert.match(page,/p_amount:value,p_date:date\|\|null/);
 assert.match(page,/required=\{form!=='expected'\}/);
 assert.match(page,/p\.amount==null\?'Άγνωστο':eur\(p\.amount\)/);
});
test('Expected records are global, and unknown estimates excluded from totals',()=>{
 assert.match(page,/e\.status==='pending'&&e\.direction==='income'&&e\.amount!=null/);
 assert.doesNotMatch(page,/e\.expected_on\.startsWith\(month/);
 assert.match(page,/tab!=='expected'&&tab!=='settings'/);
});
test('Settlement requires actual amount and uses atomic guarded RPC',()=>{
 assert.match(page,/finance_settle_expected_amount/);
 assert.match(sql,/p_amount IS NULL OR p_amount<=0/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/jsonb_build_object\('event_id',v_plan.event_id,'amount',p_amount\)/);
 assert.match(sql,/UPDATE public\.finance_expected SET status='settled'/);
});
test('Event kinds editing is inline and reorder is server-authorized',()=>{
 assert.doesNotMatch(events,/window\.prompt\('Σειρά εμφάνισης/);
 assert.match(events,/function EventKindEditor/);
 assert.match(events,/event_kinds_reorder/);
 assert.match(sql,/IF NOT public\.is_admin\(\)/);
 assert.match(sql,/cardinality\(p_keys\)/);
});
test('Finance category editor uses inline controls instead of browser prompts',()=>{
 assert.match(page,/function FinanceCategoryEditor/);
 assert.doesNotMatch(page,/window\.prompt\('Νέα ονομασία κατηγορίας/);
});
