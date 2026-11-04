import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport, defaultReportOptions, isReportOptions, parseReportTemplates, reportCsv } from '../packages/domain/src/reports.ts';
import { assignStudent, saveNucleus, syntheticNuclei } from '../packages/domain/src/nuclei.ts';
import { operational, syntheticStudents } from '../packages/domain/src/students.ts';
const at='2026-11-03T12:00:00.000Z';
function setup(){const rows=syntheticStudents();return {rows,state:syntheticNuclei(rows),options:defaultReportOptions()};}
test('assignment reports exclude archived/zero, reconcile per-section counts and sort deterministically',()=>{
 const {rows,state,options}=setup();const report=buildReport(rows,state,options,'r',at);
 assert.equal(report.sections.length,4);assert.equal(report.uniqueStudents,operational(rows).length);assert.equal(report.totalRows,report.uniqueStudents);
 for(const section of report.sections){assert.equal(section.registered+section.unregistered,section.students.length);assert.ok(section.students.every(s=>s.status==='active'));assert.deepEqual(section.students.map(s=>s.surname),[...section.students.map(s=>s.surname)].sort((a,b)=>a.localeCompare(b,'el')));}
});
test('secondary scope and cross-nucleus rows preserve distinct-people totals',()=>{
 const {rows,state,options}=setup();const target=state.nuclei[1];
 const next=assignStudent(state,rows,rows[1].id,'secondary',target.id,'SECONDARY',at,'a');
 const both=buildReport(rows,next,{...options,assignmentScope:'both'},'both',at);
 assert.equal(both.uniqueStudents,operational(rows).length);assert.equal(both.totalRows,both.uniqueStudents+1);
 const secondary=buildReport(rows,next,{...options,assignmentScope:'secondary',includeEmpty:false},'secondary',at);
 assert.equal(secondary.sections.length,1);assert.equal(secondary.sections[0].id,target.id);assert.equal(secondary.uniqueStudents,1);
});
test('selected stable IDs survive nucleus rename; snapshots do not change afterward',()=>{
 const {rows,state,options}=setup();const chosen=state.nuclei[0];
 const report=buildReport(rows,state,{...options,allNuclei:false,nucleusIds:[chosen.id]},'r',at);
 const renamed=saveNucleus(state,chosen.id,'ΝΕΟ ΟΝΟΜΑ',chosen.categoryId,false,'RENAME',at,'rename');
 const next=buildReport(rows,renamed,report.options,'new',at);assert.equal(next.sections[0].title,'ΝΕΟ ΟΝΟΜΑ');assert.equal(report.sections[0].title,chosen.name);
 const first=report.sections[0].students[0],oldNote=first.notes;rows.find(r=>r.id===first.id)!.notes='LATER';
 assert.equal(first.notes,oldNote);options.columns.pop();assert.equal(report.options.columns.length,6);
});
test('student report includes unassigned active people and applies typed filters',()=>{
 const {rows,state,options}=setup();const report=buildReport(rows,{...state,assignments:[]},{...options,kind:'students',filters:{mode:'all',rules:[{id:'r',field:'efRegistered',operator:'equals',value:'true'}]}},'r',at);
 assert.equal(report.sections.length,1);assert.equal(report.uniqueStudents,operational(rows).filter(s=>s.efRegistered).length);assert.ok(report.sections[0].students.every(s=>s.nucleus===''));
});
test('invalid or missing saved nucleus selection fails rather than silently reporting all',()=>{
 const {rows,state,options}=setup();
 assert.throws(()=>buildReport(rows,state,{...options,allNuclei:false,nucleusIds:[]},'r',at));
 assert.throws(()=>buildReport(rows,state,{...options,allNuclei:false,nucleusIds:['missing']},'r',at));
 assert.throws(()=>buildReport(rows,state,{...options,columns:[]},'r',at));
 assert.throws(()=>buildReport(rows,state,options,'r','not-a-date'));
});
test('empty-section policy is explicit and malformed templates are discarded',()=>{
 const {rows,state,options}=setup();const none={...options,filters:{mode:'all' as const,rules:[{id:'x',field:'surname' as const,operator:'equals' as const,value:'NO MATCH'}]}};
 assert.equal(buildReport(rows,state,none,'r',at).sections.length,4);
 assert.equal(buildReport(rows,state,{...none,includeEmpty:false},'r',at).sections.length,0);
 assert.equal(isReportOptions(null),false);assert.equal(isReportOptions({...options,columns:['unknown']}),false);
 assert.deepEqual(parseReportTemplates({}),[]);
 const valid={id:'t',name:'TEST',version:1,options};assert.equal(parseReportTemplates([null,{},valid,{...valid,version:2}]).length,1);
});
test('CSV includes group context and safely quotes Greek names, newlines, delimiters and formulas',()=>{
 const {rows,state,options}=setup();rows[1].notes=' =HYPERLINK("x");\nTEST';
 const report=buildReport(rows,state,{...options,kind:'students'},'r',at);const csv=reportCsv(report);
 assert.ok(csv.startsWith('\uFEFF"ΕΝΟΤΗΤΑ";"ΚΑΤΗΓΟΡΙΑ";"ΥΠΕΥΘΥΝΟΣ"'));
 assert.ok(csv.includes('"\' =HYPERLINK(""x"");\nTEST"'));
});
