import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
const page=read('../src/FinancePage.tsx');
const css=read('../src/styles.css');
const migration=read('../supabase/020_remove_finance_receipts.sql');

test('new tab order: income/expense, expected, transfers, overview',()=>{
 assert.match(page,/\['registers','Έσοδα \/ Έξοδα'\],\['expected','Αναμενόμενα'\],\['transfers','Μεταφορές'\],\['overview','Επισκόπηση'\]/);
});
test('compact balances appear at the top of income and expenses and use the selected month',()=>{
 const open=page.indexOf("{tab==='registers'&&<>");
 const balances=page.indexOf('finance-compact-balances',open);
 const actions=page.indexOf('finance-actionbar',open);
 assert.ok(open>=0&&balances>open&&actions>balances,'balances should precede search and actions');
 assert.match(page,/eur\(totals.availableClose\)/);
 assert.match(page,/totals.accounts.map\(a=><div className="finance-compact-balance"/);
 assert.match(page,/a.is_deposit\?' · εκτός διαθεσίμου'/);
 assert.match(css,/\.finance-compact-balances\{display:grid/);
 assert.match(css,/@media\(max-width:530px\)/);
});
test('receipt upload, query and view are all absent from the application',()=>{
 for(const token of ['finance_files','finance_attach','finance-receipts','openReceipt','setReceiptBusy','finance-upload','Paperclip','Απόδειξη'])assert.ok(!page.includes(token),token);
});
test('database migration refuses to remove nonempty receipts, revokes old endpoint and updates delete RPC',()=>{
 assert.match(migration,/FROM public.finance_files\)/);
 assert.match(migration,/FROM storage.objects WHERE bucket_id='finance-receipts'/);
 assert.match(migration,/CREATE OR REPLACE FUNCTION public.finance_delete_register/);
 assert.doesNotMatch(migration,/IF EXISTS \(SELECT 1 FROM public.finance_files WHERE transaction_id/);
 assert.match(migration,/DROP FUNCTION public.finance_attach\(uuid,text,text\)/);
 assert.match(migration,/DROP TABLE public.finance_files/);
 assert.match(migration,/DROP POLICY IF EXISTS finance_storage_upload/);
 assert.doesNotMatch(migration,/DELETE FROM storage.buckets/);
 assert.match(migration,/DROP POLICY IF EXISTS finance_storage_read/);
 assert.match(migration,/COMMIT/);
});
