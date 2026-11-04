import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csv, normalize, operational, patchField, syntheticStudents } from '../packages/domain/src/students.ts';
test('synthetic cohort contains 250 unique source identities; daily views exclude archived and zero',()=>{
 const rows=syntheticStudents(); assert.equal(rows.length,250);assert.equal(new Set(rows.map(r=>r.id)).size,250);assert.ok(operational(rows).length<250);assert.ok(operational(rows).every(r=>r.status==='active'));
});
test('different-field edits survive while stale same-field writes conflict',()=>{
 const rows=syntheticStudents(), row=rows[1];
 const a=patchField(rows,row.id,'name',row.name,'ΝΕΟ ΟΝΟΜΑ');
 const b=patchField(a.rows,row.id,'notes',row.notes,'Σημείωση');
 assert.equal(b.conflict,false);assert.equal(b.rows[1].name,'ΝΕΟ ΟΝΟΜΑ');assert.equal(b.rows[1].notes,'Σημείωση');
 const conflict=patchField(b.rows,row.id,'name',row.name,'ΔΕΥΤΕΡΟ');assert.equal(conflict.conflict,true);assert.equal(conflict.rows[1].name,'ΝΕΟ ΟΝΟΜΑ');
});
test('Greek search is accent-insensitive and invalid blank name is rejected',()=>{
 assert.equal(normalize('Άννα'),normalize('ΑΝΝΑ'));const rows=syntheticStudents();assert.throws(()=>patchField(rows,rows[0].id,'name',rows[0].name,' '));
});
test('CSV quotes delimiters/newlines and neutralizes spreadsheet formulas',()=>{
 const row={...syntheticStudents()[0],notes:'=HYPERLINK("x")\n;test'};
 const result=csv([row],['notes'],['ΠΛΗΡΟΦΟΡΙΕΣ']);assert.ok(result.includes('"\'=HYPERLINK(""x"")\n;test"'));
});
