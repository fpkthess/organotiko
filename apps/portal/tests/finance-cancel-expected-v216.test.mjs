import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const page = fs.readFileSync(new URL('../src/FinancePage.tsx', import.meta.url), 'utf8');
const mig = fs.readFileSync(new URL('../supabase/021_cancel_expected_removes_record.sql', import.meta.url), 'utf8');
test('cancel pending expected calls destructive audited RPC, no status-only update', () => {
  assert.match(page, /rpc\('finance_expected_cancel_delete',\{p_id:p.id\}\)/);
  assert.doesNotMatch(page, /p_status:'cancelled'/);
  assert.match(mig, /DELETE FROM public\.finance_expected WHERE id=p_id AND status='pending'/);
  assert.match(mig, /finance_record\('cancel_delete','expected'/);
});
test('cancelled expected items excluded from rendering including old records',()=>{
  assert.match(page,/visibleExpected=useMemo\(\(\)=>data\.expected\.filter\(e=>e\.status!=='cancelled'\)/);
  assert.match(page,/\[\.\.\.visibleExpected\]\.sort\(/);
  assert.match(page,/!visibleExpected\.length/);
});
test('cancellation requires visible confirmation and does not delete settled postings',()=>{
  assert.match(page,/setCancelExpectedTarget\(p\)/);
  assert.match(page,/Ακύρωση και διαγραφή/);
  assert.match(mig,/settled_transaction_id IS NOT NULL/);
  assert.match(mig,/finance_check\(\)/);
  assert.match(mig,/REVOKE ALL ON FUNCTION public\.finance_expected_cancel_delete\(uuid\) FROM PUBLIC,anon/);
});
test('historic cancelled entries are auditable and no posted ledgers are touched',()=>{
  assert.match(mig,/cancel_delete_migration/);
  assert.match(mig,/jsonb_build_object\('before',to_jsonb\(e\)/);
  assert.doesNotMatch(mig,/DELETE FROM public\.finance_transactions/);
  assert.doesNotMatch(mig,/DELETE FROM public\.finance_legs/);
});
