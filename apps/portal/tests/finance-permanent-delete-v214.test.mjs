import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(path)=>readFileSync(new URL(path,import.meta.url),'utf8');
const sql=read('../supabase/019_finance_permanent_delete_register.sql');
const ui=read('../src/FinancePage.tsx');
const css=read('../src/styles.css');

test('Admin sees an explicit delete control for each full income or expense register',()=>{
 assert.match(ui,/isAdmin&&<button className="btn ghost finance-register-delete"/);
 assert.match(ui,/openPermanentDelete\(r\)/);
 assert.match(ui,/Trash2/);
 assert.match(css,/finance-register-delete/);
});
test('the warning is about all months, not the currently selected month',()=>{
 assert.match(ui,/ΟΛΕΣ οι πληρωμές της από όλους τους μήνες/);
 assert.match(ui,/Αιτιολογία οριστικής διαγραφής/);
 assert.match(ui,/Επιβεβαίωση οριστικής διαγραφής/);
 assert.match(ui,/deleteConfirmation!=='ΔΙΑΓΡΑΦΗ'/);
 assert.match(ui,/p_register:id,p_confirmation:deleteConfirmation,p_reason:deleteReason\.trim\(\)/);
});
test('deletion is performed through one privileged RPC, not an unaudited client-side DELETE',()=>{
 assert.match(ui,/rpc\('finance_delete_register'/);
 assert.doesNotMatch(ui,/supabase\.from\('finance_registers'\)\.delete\(/);
 assert.match(sql,/CREATE OR REPLACE FUNCTION public\.finance_delete_register/);
 assert.match(sql,/IF auth\.uid\(\) IS NULL OR NOT public\.is_admin\(\) THEN/);
 assert.match(sql,/PERFORM public\.finance_check\(\);/);
 assert.match(sql,/FOR UPDATE/);
 assert.match(sql,/p_confirmation IS DISTINCT FROM 'ΔΙΑΓΡΑΦΗ'/);
 assert.match(sql,/FROM PUBLIC, anon/);
 assert.match(sql,/TO authenticated/);
});
test('connected expected entries, attachments and closed accounting periods cannot be orphaned or rewritten',()=>{
 assert.match(sql,/finance_expected e/);
 assert.match(sql,/finance_files WHERE transaction_id=ANY\(v_all_ids\)/);
 assert.match(sql,/PERFORM public\.finance_check\(v_date\)/);
 assert.match(sql,/finance_transactions WHERE reversed_transaction_id=ANY\(v_direct_ids\)/);
});
test('original entries and their reversals are deleted in FK-safe order and saved to audit',()=>{
 assert.match(sql,/PERFORM public\.finance_record\('permanent_delete','register',p_register,v_snapshot\)/);
 assert.match(sql,/historical_sources/);
 assert.match(sql,/event_allocations/);
 const steps=['DELETE FROM public.finance_historical_sources','DELETE FROM public.finance_allocations','DELETE FROM public.finance_legs','DELETE FROM public.finance_transactions WHERE id=ANY(v_reversal_ids)','DELETE FROM public.finance_transactions WHERE id=ANY(v_direct_ids)','DELETE FROM public.finance_registers WHERE id=p_register'];
 let prev=0;for(const st of steps){const idx=sql.indexOf(st,prev);assert.ok(idx>=prev,st);prev=idx+st.length;}
 assert.match(sql,/IF v_removed<>1 THEN RAISE EXCEPTION/);
});
