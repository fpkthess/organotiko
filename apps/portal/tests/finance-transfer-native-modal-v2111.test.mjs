import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const source=readFileSync(new URL('../src/FinancePage.tsx',import.meta.url),'utf8');

test('transfer deletion never opens a browser confirm or prompt',()=>{
 const section=source.split('const openDeleteTransfer=')[1].split('// One atomic Admin-only RPC')[0];
 assert.doesNotMatch(section,/window\.(confirm|prompt|alert)/);
 assert.match(section,/setDeleteTransferTarget\(t\)/);
 assert.match(section,/finance_delete_transfer/);
});
test('transfer deletion uses accessible native portal modal',()=>{
 const modal=source.split('{deleteTransferTarget&&')[1].split('{cancelExpectedTarget&&')[0];
 assert.match(modal,/className="modal-backdrop"/);
 assert.match(modal,/className="modal finance-modal-compact"/);
 assert.match(modal,/role="dialog" aria-modal="true"/);
 assert.match(modal,/txAccount\(deleteTransferTarget\.id\)/);
 assert.match(modal,/eur\(deleteTransferTarget\.amount\)/);
 assert.match(modal,/Οριστική διαγραφή μεταφοράς/);
 assert.match(modal,/disabled=\{busy\}/);
 assert.match(modal,/Άκυρο/);
 assert.match(modal,/void deleteTransfer\(\)/);
});
test('transfer keeps compact red trash icon and blocks closed months',()=>{
 const transferTab=source.split("{tab==='transfers'&&")[1].split("{tab==='months'&&")[0];
 assert.match(transferTab,/finance-transfer-delete/);
 assert.match(transferTab,/disabled=\{busy\|\|locked\(t\.happened_on\)\}/);
 assert.match(transferTab,/onClick=\{\(\)=>openDeleteTransfer\(t\)\}/);
 assert.doesNotMatch(transferTab,/Αντιλογισμός/);
});
