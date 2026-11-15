import {test} from 'node:test';
import {strict as assert} from 'node:assert';
import {getMonthlyRegisterMovements,depositAvailableChangeForMonth,newestMovementFirst} from '../src/financePeriod.js';
import {readFileSync} from 'node:fs';
const page=readFileSync(new URL('../src/FinancePage.tsx',import.meta.url),'utf8');
const m=(id,reg,day,created='2026-10-20T04:00:00')=>({id,register_id:reg,kind:'income',happened_on:day,created_at:created});
test('Old register with movements in October and previous years shows only October movements',()=>{
 const tx=[m('old','r','2024-06-05'),m('oct15','r','2026-10-15'),m('oct18','r','2026-10-18'),m('sep','other','2026-09-27')];
 const grouped=getMonthlyRegisterMovements(tx,'2026-10-01');
 assert.deepEqual(grouped.get('r').map(t=>t.id),['oct18','oct15']);
 assert.equal(grouped.has('other'),false);
 assert.deepEqual(getMonthlyRegisterMovements(tx,'2024-06-01').get('r').map(t=>t.id),['old']);
});
test('Movements on same accounting day sort by creation timestamp, not register import time',()=>{
 const tx=[m('first','r','2026-10-12','2026-10-12T09:00:00'),m('later','r','2026-10-12','2026-10-12T12:00:00')];
 assert.deepEqual(tx.sort(newestMovementFirst).map(t=>t.id),['later','first']);
});
test('Deposit effect applies only to transfers in selected month with correct signed direction',()=>{
 const accounts=[{id:'cash',is_deposit:false},{id:'deposit',is_deposit:true}];
 const tx=[{id:'a',kind:'transfer',happened_on:'2026-09-30'}, {id:'b',kind:'transfer',happened_on:'2026-10-20'}, {id:'c',kind:'transfer',happened_on:'2026-11-01'}, {id:'o',kind:'opening',happened_on:'2026-10-01'}];
 const legs=[{transaction_id:'a',account_id:'deposit',delta:1000},{transaction_id:'b',account_id:'deposit',delta:618},{transaction_id:'c',account_id:'deposit',delta:-50},{transaction_id:'o',account_id:'deposit',delta:5000}];
 assert.equal(depositAvailableChangeForMonth(tx,legs,accounts,'2026-10-01'),-618);
 assert.equal(depositAvailableChangeForMonth(tx,legs,accounts,'2026-09-01'),-1000);
 assert.equal(depositAvailableChangeForMonth(tx,legs,accounts,'2026-11-01'),50);
 assert.equal(depositAvailableChangeForMonth(tx,legs,accounts,'2026-10-01',new Set(['b'])),0);
});
test('Monthly UI uses grouped posting dates and monthly sum, not cumulative register totals',()=>{
 assert.match(page,/registersWithMovements\.has\(r\.id\)/);
 assert.match(page,/bDay\.localeCompare\(aDay\)/);
 assert.match(page,/monthlyRegisterTotal\(r\.id\)/);
 assert.match(page,/depositAvailableChangeForMonth\(data\.transactions,data\.legs,data\.accounts,month,reversed\)/);
 assert.doesNotMatch(page,/recentRegisterActivity/);
 assert.match(page,/monthTransactions\]\.filter\(t=>t\.kind==='transfer'/);
});

test('Fiscal year table also shows deposit availability change for each month',()=>{
 assert.match(page,/depositDelta:depositAvailableChangeForMonth\(data\.transactions,data\.legs,data\.accounts,key,reversed\)/);
 assert.match(page,/<th>Από\/προς καταθετικό<\/th>/);
 assert.match(page,/eur\(r\.depositDelta\)/);
});
