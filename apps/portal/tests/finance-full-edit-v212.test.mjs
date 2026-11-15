import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const file=(name)=>readFileSync(new URL(name, import.meta.url),'utf8');
const page=file('../src/FinancePage.tsx');
const sql=file('../supabase/017_finance_full_entry_edit.sql');
const css=file('../src/styles.css');

test('a completed income or expense can reopen its entire creation form',()=>{
 assert.match(page,/const openEditRegister=/);
 assert.match(page,/openEditRegister\(r\)/);
 assert.match(page,/form==='edit'\|\|form==='editPayment'/);
 for(const field of ['Τίτλος εγγραφής','Κατηγορία','Περιγραφή εγγραφής','Ημερομηνία πληρωμής','Ποσό (€)','Λογαριασμός','Σημείωση πληρωμής'])assert.ok(page.includes(field),field);
 assert.match(css,/finance-register-edit/);
});
test('each movement has independent edit while multi-payment register metadata is editable',()=>{
 assert.match(page,/openEditPayment\(r,t\)/);
 assert.match(page,/movements.length===1\?movements\[0\]:null/);
 assert.match(page,/Η εγγραφή έχει πολλές πληρωμές/);
 assert.match(page,/activeRegisterMovements\(editingRegisterId\|\|''\)\.length>1/);
});
test('editing payments invokes guarded atomic database RPC, not client-side direct UPDATE',()=>{
 assert.match(page,/rpc\('finance_edit_entry'/);
 assert.match(page,/p_transaction:editingTransactionId/);
 assert.match(page,/p_amount:value/);
 assert.match(page,/p_allocations:value===null\?\[\]:allocations/);
 assert.doesNotMatch(page,/supabase\.from\('finance_transactions'\)\.update/);
});
test('posted payments are reversed and reposted, not silently mutated',()=>{
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.finance_edit_entry/);
 assert.match(sql,/PERFORM public\.finance_reverse/);
 assert.match(sql,/v_replacement := public\.finance_post/);
 assert.doesNotMatch(sql,/UPDATE public\.finance_transactions/);
 assert.match(sql,/IF v_payment_changed THEN/);
 assert.match(sql,/v_old_allocations/);
});
test('financial RPC checks permission, locking, allocations, and previous month closes',()=>{
 assert.match(sql,/PERFORM public\.finance_check\(\);/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/finance_month_closes/);
 assert.match(sql,/PERFORM public\.finance_check\(v_tx\.happened_on\)/);
 assert.match(sql,/PERFORM public\.finance_check\(p_date\)/);
 assert.match(sql,/p_allocations/);
 assert.match(sql,/REVOKE ALL ON FUNCTION public\.finance_edit_entry[\s\S]*FROM PUBLIC, anon/);
 assert.match(sql,/GRANT EXECUTE ON FUNCTION public\.finance_edit_entry[\s\S]*TO authenticated/);
});
test('linked predictions and existing closed-period postings cannot be accidentally rewritten',()=>{
 assert.match(sql,/settled_transaction_id=p_transaction/);
 assert.match(sql,/register_id=p_register/);
 assert.match(page,/locked\(t\.happened_on\)/);
});
