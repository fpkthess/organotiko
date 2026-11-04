import {test} from 'node:test';
import assert from 'node:assert/strict';
import {changeStudentStatus,studentNoteHistory} from '../packages/domain/src/studentCards.ts';
import {customValue,defineCustomField,initialCustomFields,parseCustomValue,saveCustomValue,studentGridCsv,type CustomField} from '../packages/domain/src/customFields.ts';
import {operational,syntheticStudents} from '../packages/domain/src/students.ts';
import {syntheticNuclei,nucleusCounts} from '../packages/domain/src/nuclei.ts';
import {buildReport,defaultReportOptions} from '../packages/domain/src/reports.ts';
import {finishReview,planReview,reviewSummary,startReview} from '../packages/domain/src/reviews.ts';
const at='2026-11-03T14:00:00.000Z';
const field:CustomField={id:'f',label:'ΔΟΚΙΜΗ',type:'text',options:[],preserveCase:false,editable:true,retired:false};
test('custom value types distinguish empty, false, zero and validate dates/numbers/options',()=>{
 assert.equal(parseCustomValue(field,'Άννα'),'ΑΝΝΑ');assert.equal(parseCustomValue({...field,preserveCase:true},'@User.Name'),'@User.Name');
 assert.equal(parseCustomValue({...field,type:'number'},'0'),0);assert.equal(parseCustomValue({...field,type:'number'},'12,5'),12.5);
 assert.equal(parseCustomValue({...field,type:'boolean'},'false'),false);assert.equal(parseCustomValue(field,'  '),null);
 assert.equal(parseCustomValue({...field,type:'date'},'2024-02-29'),'2024-02-29');
 assert.throws(()=>parseCustomValue({...field,type:'date'},'2025-02-29'));assert.throws(()=>parseCustomValue({...field,type:'number'},'Infinity'));assert.throws(()=>parseCustomValue({...field,type:'number'},'0x10'));
 assert.throws(()=>parseCustomValue({...field,type:'boolean'},'yes'));
 assert.equal(parseCustomValue({...field,type:'select',options:['Α','Β']},'α'),'Α');assert.throws(()=>parseCustomValue({...field,type:'select',options:['Α']},'Β'));
});
test('field identity/type stays stable; retirement and read-only preserve values and history',()=>{
 const rows=syntheticStudents();let state=defineCustomField(initialCustomFields(),field,'def',at);
 state=saveCustomValue(state,rows,rows[1].id,'f',null,'ΑΡΧΙΚΗ','value',at);
 assert.equal(customValue(state,rows[1].id,'f'),'ΑΡΧΙΚΗ');
 const readonly=defineCustomField(state,{...field,editable:false},'readonly',at);
 assert.throws(()=>saveCustomValue(readonly,rows,rows[1].id,'f','ΑΡΧΙΚΗ','ΑΛΛΑΓΗ','x',at));
 const retired=defineCustomField(state,{...field,retired:true},'retired',at);
 assert.equal(customValue(retired,rows[1].id,'f'),'ΑΡΧΙΚΗ');assert.equal(retired.history.filter(e=>e.action==='value').length,1);
 assert.throws(()=>saveCustomValue(retired,rows,rows[1].id,'f','ΑΡΧΙΚΗ','X','x',at));
 assert.throws(()=>defineCustomField(state,{...field,type:'number'},'change-type',at));
 assert.throws(()=>defineCustomField(state,{...field,id:'dup'},'dup',at));
});
test('stale custom edits conflict, unrelated fields survive, and archived values cannot be edited',()=>{
 const rows=syntheticStudents();let state=initialCustomFields();
 state=saveCustomValue(state,rows,rows[1].id,'demo-field-address',null,'ΔΟΚΙΜΗ','a',at);
 state=saveCustomValue(state,rows,rows[1].id,'demo-field-instagram',null,'@Example','b',at);
 assert.equal(customValue(state,rows[1].id,'demo-field-address'),'ΔΟΚΙΜΗ');assert.equal(customValue(state,rows[1].id,'demo-field-instagram'),'@Example');
 assert.throws(()=>saveCustomValue(state,rows,rows[1].id,'demo-field-address',null,'STALE','c',at));
 assert.throws(()=>saveCustomValue(state,rows,rows[0].id,'demo-field-address',null,'ARCHIVED','c',at));
});
test('archive/restore preserves independent statuses, assignments and existing report/session snapshots',()=>{
 const rows=syntheticStudents(),id=rows[1].id,original={...rows[1]},nuclei=syntheticNuclei(rows);
 const report=buildReport(rows,nuclei,defaultReportOptions(),'r',at);
 const session=finishReview(startReview([planReview('s','TEST',at)],'s',rows,at)[0],'completed',rows,at);
 const archived=changeStudentStatus(rows,id,'active','archived','ΑΙΤΙΟΛΟΓΙΑ','archive',at);
 assert.equal(operational(archived.rows).length,operational(rows).length-1);
 assert.deepEqual({...archived.rows[1],status:'active'},original);
 assert.equal(archived.event.before,'active');assert.equal(archived.event.after,'archived');
 assert.equal(report.uniqueStudents,operational(rows).length);assert.equal(reviewSummary(session,'cohort').total,operational(rows).length);
 assert.equal(nucleusCounts(nuclei,archived.rows,nuclei.nuclei.map(n=>n.id)).total,operational(rows).length-1);
 const restored=changeStudentStatus(archived.rows,id,'archived','zero','ΡΗΤΗ ΕΠΙΛΟΓΗ','restore',at);
 assert.equal(restored.rows[1].status,'zero');assert.equal(operational(restored.rows).length,operational(rows).length-1);
 assert.throws(()=>changeStudentStatus(rows,id,'archived','active','WHY','stale',at));assert.throws(()=>changeStudentStatus(rows,id,'active','archived',' ','bad',at));
 assert.throws(()=>changeStudentStatus(rows,id,'active','zero','WHY','bad',at));
});
test('note history keeps source attribution and excludes other students and fields',()=>{
 const events=[{id:'1',studentId:'s',field:'notes' as const,before:'A',after:'B',at,source:'Πίνακας'},{id:'2',studentId:'s',field:'notes' as const,before:'B',after:'C',at:'2026-11-03T15:00:00.000Z',source:'Συνεδρία'},{id:'3',studentId:'other',field:'notes' as const,before:'',after:'X',at,source:'Καρτέλα'}];
 assert.deepEqual(studentNoteHistory('s',events).map(e=>e.source),['Συνεδρία','Πίνακας']);
});
test('grid CSV includes selected custom fields, preserves booleans and escapes formula text',()=>{
 const rows=syntheticStudents();let state=initialCustomFields();state=saveCustomValue(state,rows,rows[1].id,'demo-field-instagram',null,'=FORMULA("x")','a',at);
 const csv=studentGridCsv([rows[1]],['surname'],['ΕΠΩΝΥΜΟ'],state,['demo-field-instagram']);
 assert.ok(csv.includes('"INSTAGRAM"'));assert.ok(csv.includes('"\'=FORMULA(""x"")"'));
 assert.ok(!studentGridCsv([rows[1]],['surname'],['ΕΠΩΝΥΜΟ'],state,[]).includes('INSTAGRAM'));
});

test('all-field CSV can include retained retired custom values without exposing them in visible-column export',()=>{
 const rows=syntheticStudents();let state=initialCustomFields();state=saveCustomValue(state,rows,rows[1].id,'demo-field-instagram',null,'@Retained','a',at);
 state=defineCustomField(state,{...state.definitions[1],retired:true},'retire',at);
 assert.ok(!studentGridCsv([rows[1]],['surname'],['ΕΠΩΝΥΜΟ'],state,['demo-field-instagram']).includes('@Retained'));
 assert.ok(studentGridCsv([rows[1]],['surname'],['ΕΠΩΝΥΜΟ'],state,['demo-field-instagram'],true).includes('@Retained'));
});
