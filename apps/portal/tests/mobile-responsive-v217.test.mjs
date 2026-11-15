import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
const finance=readFileSync(new URL('../src/FinancePage.tsx',import.meta.url),'utf8');
const app=readFileSync(new URL('../src/App.tsx',import.meta.url),'utf8');
const index=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const mobile=css.slice(css.indexOf('/* v2.1.7 — mobile-first UI audit.'));
test('mobile financial entry uses one compact row of four icons',()=>{
 for(const symbol of ['<Plus size={15}/>','<Pencil size={15}/>','<Trash2 size={15}/>','<ChevronDown size={16}/>']) assert.ok(finance.includes(symbol));
 assert.match(mobile,/\.finance-register-inline-actions\{[^}]*display:flex;flex-direction:row;flex-wrap:nowrap/);
 assert.match(mobile,/\.finance-register-inline-actions \.finance-add-label,[\s\S]*?\.finance-register-inline-actions \.finance-expand-label\{display:none\}/);
 assert.doesNotMatch(mobile,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\);gap:7px;margin:0;width:100%;align-items:stretch/);
});
test('mobile action icons have compact hit areas and red delete',()=>{
 assert.match(mobile,/flex:0 0 38px;width:38px;min-width:38px;max-width:38px;height:36px;min-height:36px/);
 assert.match(mobile,/\.finance-register-inline-actions \.finance-register-delete\{color:#b32635/);
 assert.match(mobile,/@media\(max-width:359px\)/);
});
test('each action has descriptive accessible labels for icon-only buttons',()=>{
 for(const label of ['Προσθήκη ποσού στην εγγραφή ','Επεξεργασία εγγραφής ','Οριστική διαγραφή εγγραφής ','Προβολή κινήσεων: ']) assert.ok(finance.includes(label));
 assert.match(finance,/aria-expanded=\{expanded\}/);
 assert.match(mobile,/grid-template-columns:30px minmax\(0,1fr\) auto/);
 assert.match(mobile,/\.finance-register-inline-actions\{[^}]*grid-column:2\/-1;grid-row:2/);
});
test('expected income and expense table cards have accessible field labels',()=>{
 assert.match(finance,/finance-expected-list/);
 for(const label of ['Ημερομηνία','Περιγραφή','Είδος','Ποσό','Κατάσταση']) assert.ok(finance.includes(`data-label="${label}"`));
 assert.match(mobile,/\.finance-expected-list tbody\{display:grid/);
});
test('mobile navigation is safe-area aware and preserves room for bottom dock',()=>{
 assert.match(index,/viewport-fit=cover/);
 assert.match(mobile,/\.mobile-dock\{padding:6px 8px calc\(7px \+ env\(safe-area-inset-bottom\)\)/);
 assert.match(mobile,/\.content\{padding:19px 12px calc\(95px \+ env\(safe-area-inset-bottom\)\)/);
 assert.match(app,/className="breadcrumb-home"/);
});
test('mobile drawer closes after choosing SMS and keeps SMS submenu available',()=>{
 assert.match(app,/if\(item\.page==='sms'\)setSmsExpanded\(v=>!v\);setMobileOpen\(false\);setAccountOpen\(false\)/);
});
test('mobile modals and form controls avoid Safari zoom and home indicator',()=>{
 assert.match(mobile,/input,select,textarea\{font-size:16px;max-width:100%\}/);
 assert.match(mobile,/\.modal-backdrop,\.sms-modal-backdrop\{padding:8px 8px calc\(8px \+ env\(safe-area-inset-bottom\)\)/);
 assert.match(mobile,/\.form-actions\{position:sticky;bottom:-1px/);
});
test('event controls, SMS navigation and kanban support narrow viewports',()=>{
 assert.match(mobile,/\.event-month-controls\{display:grid;grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(mobile,/\.kanban\{grid-template-columns:minmax\(0,1fr\);overflow-x:visible/);
 assert.match(mobile,/\.sms-tabs button\{min-height:44px\}/);
});
