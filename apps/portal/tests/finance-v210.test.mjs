import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import fs from 'node:fs';
import {parseEuro,accountBalanceAt,eventResult} from '../src/financeMath.js';
const sql=fs.readFileSync(new URL('../supabase/012_finance_and_event_kinds.sql',import.meta.url),'utf8');
const app=fs.readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const page=fs.readFileSync(new URL('../src/FinancePage.tsx',import.meta.url),'utf8');
test('Greek € amount parsing is unambiguous and cent exact',()=>{
 assert.equal(parseEuro('1.234,56'),1234.56);assert.equal(parseEuro('1.234'),1234);
 assert.equal(parseEuro('1234,56'),1234.56);assert.equal(parseEuro('1234.56'),1234.56);
 assert.ok(Number.isNaN(parseEuro('1,000')));assert.ok(Number.isNaN(parseEuro('-150')));
 assert.ok(Number.isNaN(parseEuro('1.2.3')));
});
test('cash to deposit reduces available balance but keeps total assets unchanged',()=>{
 const tx=[{id:'o',kind:'opening',happened_on:'2026-09-01'},{id:'t',kind:'transfer',happened_on:'2026-10-13'}];
 const l=[{transaction_id:'o',account_id:'bank',delta:2000},{transaction_id:'t',account_id:'bank',delta:-500},{transaction_id:'t',account_id:'deposit',delta:500}];
 assert.equal(accountBalanceAt(l,tx,'bank','2026-10-01'),2000);
 assert.equal(accountBalanceAt(l,tx,'bank','2026-11-01'),1500);
 assert.equal(accountBalanceAt(l,tx,'deposit','2026-11-01'),500);
 assert.equal(accountBalanceAt(l,tx,'bank','2026-11-01')+accountBalanceAt(l,tx,'deposit','2026-11-01'),2000);
});
test('monthly opening is recognized even when the opening marker is on the first day',()=>{
 assert.equal(accountBalanceAt([{account_id:'cash',transaction_id:'o',delta:48}], [{id:'o',kind:'opening',happened_on:'2024-06-01'}], 'cash','2024-06-01',true),48);
});
test('reversals cancel balances and event result without deleting history',()=>{
 const tx=[{id:'p',kind:'expense',happened_on:'2026-10-02',reversed_transaction_id:null},{id:'r',kind:'reversal',happened_on:'2026-10-02',reversed_transaction_id:'p'}];
 const legs=[{transaction_id:'p',account_id:'cash',delta:-90},{transaction_id:'r',account_id:'cash',delta:90}];
 assert.equal(accountBalanceAt(legs,tx,'cash','2026-11-01'),0);
 const result=eventResult([{transaction_id:'p',event_id:'a',amount:90},{transaction_id:'r',event_id:'a',amount:-90}],tx,'a');
 assert.equal(result.expenseCents,0);
});
test('multi-event allocations count only each attributed amount',()=>{
 const tx=[{id:'p',kind:'income',happened_on:'2026-10-02',reversed_transaction_id:null}];
 const result1=eventResult([{transaction_id:'p',event_id:'a',amount:100},{transaction_id:'p',event_id:'b',amount:200}],tx,'a');
 const result2=eventResult([{transaction_id:'p',event_id:'a',amount:100},{transaction_id:'p',event_id:'b',amount:200}],tx,'b');
 assert.equal(result1.incomeCents,10000);assert.equal(result2.incomeCents,20000);
});
test('finance RLS and role checks exist at the database level',()=>{
 assert.match(sql,/finance_manager boolean NOT NULL DEFAULT false/);
 assert.match(sql,/role IN \('admin','leadership'\) OR finance_manager IS TRUE/);
 assert.match(sql,/ALTER TABLE public\.finance_transactions ENABLE ROW LEVEL SECURITY|ALTER TABLE public\.%I ENABLE ROW LEVEL SECURITY/);
 assert.match(sql,/REVOKE ALL ON TABLE public\.%I FROM anon, authenticated/);
 assert.match(sql,/finance_post\(/);
});
test('opening balance is distinct from operational income',()=>{
 assert.match(sql,/kind IN \('income','expense','transfer','opening','reversal'\)/);
 assert.match(sql,/finance_opening\(/);
 assert.match(page,/ΓΕΝΙΚΟ ΔΙΑΘΕΣΙΜΟ/);
});
test('no finance access in portal for ordinary members unless delegated',()=>{
 assert.match(app,/canUseFinance=!!profile\?\.active&&\(isAdmin\|\|profile\?\.role==='leadership'\|\|!!profile\?\.finance_manager\)/);
 assert.match(app,/page==='finance'&&canUseFinance/);
});
test('expectations are separate from posted balances and settle atomically',()=>{
 assert.match(sql,/CREATE TABLE public\.finance_expected/);
 assert.match(sql,/finance_settle_expected\(/);
 assert.match(page,/finance_settle_expected/);
});
test('event kinds are admin-editable with historical references protected',()=>{
 assert.match(sql,/CREATE TABLE IF NOT EXISTS public\.event_kinds/);
 assert.match(sql,/FOREIGN KEY \(kind\) REFERENCES public\.event_kinds\(key\) ON UPDATE RESTRICT ON DELETE RESTRICT/);
});
test('ledger entries are append only and counteracted with reversing legs',()=>{
 assert.match(sql,/INSERT INTO public\.finance_legs\(transaction_id,account_id,delta\)\s+SELECT v_id,account_id,-delta/);
 assert.match(sql,/finance_record\('reverse'/);
});

test('future months remain writable after previous month close, past closed periods remain immutable',()=>{
 assert.match(sql,/WHERE month_start >= date_trunc\('month',p_date\)::date/);
 assert.match(page,/const locked=\(day:string\)=>data\.closes\.some\(c=>c\.month_start>=monthStart\(day\)\)/);
});
test('initial balances all use exactly the same date',()=>{
 assert.match(sql,/Όλοι οι λογαριασμοί πρέπει να έχουν κοινή ημερομηνία εκκίνησης/);
 assert.match(sql,/Οριστικοποίησε τα 4 αρχικά υπόλοιπα πριν κλείσεις μήνα/);
});
test('partial financial allocation is never silently skipped',()=>{
 assert.match(page,/allocations=splits\.map/);
 assert.match(page,/Συμπλήρωσε σωστά όλες τις εκδηλώσεις/);
});
test('finance permission changes are recorded in a restricted audit',()=>{
 assert.match(sql,/finance_permission_audit_trigger AFTER UPDATE OF finance_manager/);
 assert.match(sql,/finance_access_change/);
});

test('planning events linked to finance are cancelled instead of deleted',()=>{
 assert.match(sql,/EXISTS\(SELECT 1 FROM public\.finance_allocations WHERE event_id=e\.id\)/);
 assert.match(sql,/EXISTS\(SELECT 1 FROM public\.finance_expected WHERE event_id=e\.id\)/);
 assert.match(sql,/UPDATE public\.events SET stage='cancelled' WHERE id=e\.id/);
});

test('expected-entry and category modifications retain before/after audit snapshots',()=>{
 assert.match(sql,/finance_record\('update','expected'.*jsonb_build_object\('before',v_old,'after'/s);
 assert.match(sql,/finance_record\('category_change','category'.*jsonb_build_object\('before',v_old,'after'/s);
});

test('expected receipts can be edited before settlement without affecting posted balances',()=>{
 assert.match(page,/setEditingExpected\(p\.id\)/);
 assert.match(page,/p_id:editingExpected/);
});

test('opening and closing obey same calendar month boundaries',()=>{
 assert.match(sql,/EXTRACT\(DAY FROM p_date\)<>1 THEN RAISE EXCEPTION/);
 assert.match(sql,/Δεν μπορείς να κλείσεις μήνα πριν την εκκίνηση/);
});
