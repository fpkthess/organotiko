import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {transferDirection} from '../src/transferDirection.js';

const accounts=[{id:'a',name:'Μετρητά'},{id:'b',name:'Revolut'},{id:'c',name:'Τράπεζα'}];
const legs=(from,to,n)=>[{transaction_id:'t',account_id:from,delta:-n},{transaction_id:'t',account_id:to,delta:n}];

test('direction comes from debit/credit signs, not account sorting',()=>{
  assert.deepEqual(transferDirection('t',legs('b','a',100),accounts),{from:'Revolut',to:'Μετρητά',fromId:'b',toId:'a',amount:100});
  assert.deepEqual(transferDirection('t',legs('a','b',100).reverse(),accounts),{from:'Μετρητά',to:'Revolut',fromId:'a',toId:'b',amount:100});
});
test('direction works for any bank pair',()=>{
  assert.equal(transferDirection('t',legs('c','a',17),accounts)?.from,'Τράπεζα');
  assert.equal(transferDirection('t',legs('c','a',17),accounts)?.to,'Μετρητά');
});
test('refuse invalid, missing, extra, nonbalancing, zero legs',()=>{
  assert.equal(transferDirection('missing',legs('a','b',7),accounts),null);
  assert.equal(transferDirection('t',[...legs('a','b',7),{transaction_id:'t',account_id:'c',delta:7}],accounts),null);
  assert.equal(transferDirection('t',[{transaction_id:'t',account_id:'a',delta:-7},{transaction_id:'t',account_id:'b',delta:6}],accounts),null);
  assert.equal(transferDirection('t',legs('a','b',0),accounts),null);
  assert.equal(transferDirection('t',legs('a','x',7),accounts),null);
});
test('transfers use compact red trash icon and atomic delete, not reversal button',()=>{
  const src=readFileSync(new URL('../src/FinancePage.tsx',import.meta.url),'utf8');
  const section=src.split("{tab==='transfers'&&")[1].split("{tab==='months'&&")[0];
  assert.match(section,/finance-transfer-delete/);
  assert.match(section,/<Trash2 size=\{16\}\/>/);
  assert.match(section,/openDeleteTransfer\(t\)/);
  assert.doesNotMatch(section,/void reverse\(t\)|>Αντιλογισμός</);
  assert.match(src,/finance_delete_transfer/);
  assert.match(src,/transferDirection\(txId,data.legs,data.accounts\)/);
});
test('mobile: transfer amount and delete icon cannot collapse into vertical letters',()=>{
 const css=readFileSync(new URL('../src/styles.css',import.meta.url),'utf8');
 assert.match(css,/\.finance-transfer-amount\{[^}]*white-space:nowrap/);
 assert.match(css,/\.finance-transfer-row \.finance-transfer-actions\{[^}]*max-width:none/);
 assert.match(css,/\.finance-transfer-delete\{[^}]*width:38px/);
});
