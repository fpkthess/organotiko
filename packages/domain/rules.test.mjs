import test from 'node:test';
import assert from 'node:assert/strict';
import {assertRegistration, registerEfekth,setAnnualIntent,nextStudyYear,previewAnnualUpgrade,makeSyntheticStudents,freezeSession,reviewSessionRow,normalized,summarizeBy} from './index.js';
test('EF registration requires actual source, valid date and academic year',()=>{
 assert.throws(()=>assertRegistration({source:'',date:'2026-11-15',schoolYear:'2026-27'}),/πηγή/);
 assert.throws(()=>assertRegistration({source:'1',date:'2026-11-15',schoolYear:'2026-27'}),/πηγή/);
 assert.throws(()=>assertRegistration({source:'+',date:'',schoolYear:'2026-27'}),/ημερομηνία/);
 assert.throws(()=>assertRegistration({source:'+',date:'2026-02-31',schoolYear:'2026-27'}),/ημερομηνία/);
 assert.equal(assertRegistration({source:'ψ4',date:'2026-11-15',schoolYear:'2026-27'}).source,'ψ4');
});
test('TRUE persists into next school year without inventing a new annual source',()=>{
 const s={...makeSyntheticStudents(1)[0],efRegistered:true};
 const p=previewAnnualUpgrade([s],{from:'2026-27',to:'2027-28',durations:{'ΝΟΜΙΚΗ':4}})[0];
 assert.equal(p.efRegisteredAfter,true);assert.equal(p.annualRecord.registrationSource,null);assert.equal(p.annualRecord.intentCode,'');
});
test('First registration is complete and cannot repeat',()=>{
 const s={...makeSyntheticStudents(1)[0],efRegistered:false};
 const r=registerEfekth(s,{source:'Μ',date:'2026-11-15',schoolYear:'2026-27'});
 assert.equal(r.student.efRegistered,true);assert.equal(r.event.yearAtEvent,s.yearCode);
 assert.throws(()=>registerEfekth(r.student,{source:'+',date:'2026-11-15',schoolYear:'2026-27'}),/Ήδη/);
});
test('Intent codes limited and cannot overwrite actual registration',()=>{
 assert.equal(setAnnualIntent({registrationSource:null,intentCode:''},'2').intentCode,'2');
 assert.throws(()=>setAnnualIntent({registrationSource:'+',intentCode:''},'2'));
 assert.throws(()=>setAnnualIntent({intentCode:''},'9'));
});
test('Annual conversion is manual, preserves graduate/honorary and extends years',()=>{
 assert.equal(nextStudyYear('1',4).next,'2');assert.equal(nextStudyYear('4',4).next,'Ν1');
 assert.equal(nextStudyYear('Ν2',4).next,'Ν3');assert.equal(nextStudyYear('91').next,'92');
 assert.equal(nextStudyYear('92').review,true); assert.equal(nextStudyYear('0').next,'0');assert.equal(nextStudyYear('Π').next,'Π');
});
test('Upgrade refuses skipped years',()=>assert.throws(()=>previewAnnualUpgrade(makeSyntheticStudents(1),{from:'2026-27',to:'2028-29'})));
test('Session frozen membership and reviewed distinct count',()=>{
 const s=freezeSession(['a','b','a'],{year:1});assert.deepEqual(s.studentIds,['a','b']);
 const a=reviewSessionRow(reviewSessionRow(s,'a'),'a');assert.equal(a.reviewed.length,1);assert.throws(()=>reviewSessionRow(s,'c'));
});
test('Greek case and diacritic normalization',()=>assert.equal(normalized('  αθήνα  '),normalized('ΑΘΗΝΑ')));
test('Synthetic dataset reproducible, safe and aggregate analytics work',()=>{
 const s=makeSyntheticStudents(260);assert.equal(s.length,260);assert.equal(s[0].name.includes('001'),true);
 assert.equal(summarizeBy(s,['yearCode']).reduce((a,x)=>a+x.count,0),260);
});
