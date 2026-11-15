import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {filterByEvent,allocatedAmount} from '../src/financeEventFilter.js';

const events=readFileSync(new URL('../src/EventsPage.tsx',import.meta.url),'utf8');
const finance=readFileSync(new URL('../src/FinancePage.tsx',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase/018_optional_event_template_assignee.sql',import.meta.url),'utf8');

test('events default to the current month and are grouped by local calendar month',()=>{
 assert.match(events,/setFilterMonth.*new Date\(\)\.toLocaleDateString\('sv-SE'\)/);
 assert.match(events,/eventGroups\.map/);
 assert.match(events,/eventMonthLabel\(groupMonth\)/);
 assert.match(events,/Εμφάνιση όλων/);
});
test('events can be filtered by kind and sorted by kind or date',()=>{
 assert.match(events,/filterKind==='all'\|\|e\.kind===filterKind/);
 assert.match(events,/sortMode==='kind'/);
 assert.match(events,/Ταξινόμηση εκδηλώσεων/);
 assert.match(events,/Όλοι οι μήνες/);
});
test('event template owner is optional in UI and confirmation SQL',()=>{
 assert.match(events,/assignee_id:tplPerson\|\|null/);
 assert.match(events,/Υπεύθυνος \(προαιρετικό\)/);
 assert.doesNotMatch(events,/<select required value=\{tplPerson\}/);
 assert.match(migration,/DROP NOT NULL/);
 assert.match(migration,/IF t\.assignee_id IS NOT NULL THEN/);
 assert.match(migration,/IF t\.assignee_id IS NOT NULL AND NOT EXISTS/);
});
test('finance tabs open in income/expense, then expected, transfers, overview',()=>{
 assert.match(finance,/\('registers'\);/);
 assert.match(finance,/\[\['registers','Έσοδα \/ Έξοδα'\],\['expected','Αναμενόμενα'\],\['transfers','Μεταφορές'\],\['overview','Επισκόπηση'\]/);
});
test('finance event selector is small and directly below register search',()=>{
 assert.match(finance,/finance-actionbar.*Αναζήτηση οικονομικής εγγραφής/);
 assert.match(finance,/finance-event-filter/);
 assert.match(finance,/setEventFilter\(e\.target\.value\)/);
});
test('only transactions attributed to an event appear in its register list',()=>{
 const t=[{id:'a',amount:100},{id:'b',amount:90}];
 const a=[{transaction_id:'a',event_id:'e1',amount:40},{transaction_id:'a',event_id:'e2',amount:60},{transaction_id:'b',event_id:'e2',amount:90}];
 assert.deepEqual(filterByEvent(t,a,'e1'),[t[0]]);
 assert.deepEqual(filterByEvent(t,a,''),t);
 assert.equal(allocatedAmount(t[0],a,'e1'),40);
 assert.equal(allocatedAmount(t[0],a,'e2'),60);
 assert.equal(allocatedAmount(t[0],a,''),100);
});
test('month close cannot be offered for current or later months, or out of order',()=>{
 assert.match(finance,/month>=monthStart\(today\(\)\)\|\|!!\(earliestUnclosedMonth/);
 assert.match(finance,/Πρώτος μήνας για κλείσιμο/);
 assert.match(finance,/Μετάβαση στον μήνα/);
});
