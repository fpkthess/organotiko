import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {readFileSync} from 'node:fs';
const file=(p)=>readFileSync(new URL(p,import.meta.url),'utf8');
const page=file('../src/FinancePage.tsx');
const css=file('../src/styles.css');

test('Registers render a single compact row with small actions',()=>{
 assert.match(page,/finance-register-compact/);
 assert.match(page,/finance-register-summary/);
 assert.match(page,/finance-register-name/);
 assert.match(page,/finance-register-amount/);
 assert.match(page,/finance-register-inline-actions/);
 assert.doesNotMatch(page,/Προσθήκη ποσού στην ίδια εγγραφή<\/button>/);
 assert.match(css,/\.finance-register-summary\{display:grid/);
 assert.match(css,/min-height:60px/);
});
test('Movement details remain expandable, without receipt uploads',()=>{
 assert.match(page,/expanded&&<div className="finance-detail"/);
 assert.match(page,/registerId===r\.id/);
 assert.match(page,/finance_register/);
 assert.match(page,/openPayment\(r\)/);
 assert.doesNotMatch(page,/finance-file-link|finance-upload|finance_attach|finance_files/);
 assert.match(page,/reverse\(t\)/);
});
test('Finance entries can be filtered by direction without changing database records',()=>{
 assert.match(page,/registerFilter!=='all'&&r\.direction!==registerFilter/);
 assert.match(page,/\['all','Όλα'\]/);
 assert.match(page,/\['income','Έσοδα'\]/);
 assert.match(page,/\['expense','Έξοδα'\]/);
});
test('Newest accounting-date movements are rendered first for the selected month',()=>{
 assert.match(page,/getMonthlyRegisterMovements\(data\.transactions,month\)/);
 assert.match(page,/bDay\.localeCompare\(aDay\)/);
 assert.match(page,/const movements=monthRegisterMovements\.get\(r\.id\)\|\|\[\]/);
 assert.match(page,/eur\(monthlyRegisterTotal\(r\.id\)\)/);
});
test('Mobile compact list avoids full-card height and preserves accessible controls',()=>{
 assert.match(css,/@media\(max-width:700px\)/);
 assert.match(page,/aria-expanded=\{expanded\}/);
 assert.match(page,/aria-label=\{'Προσθήκη ποσού στην εγγραφή '/);
});
