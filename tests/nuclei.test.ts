import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assignManager, assignStudent, createCategory, createManagerPerson, nucleusCounts, projectNuclei, saveNucleus, setManagerActive, syntheticNuclei } from '../packages/domain/src/nuclei.ts';
import { operational, syntheticStudents } from '../packages/domain/src/students.ts';
const at='2026-11-03T11:00:00.000Z';
function setup(){const rows=syntheticStudents();return {rows,state:syntheticNuclei(rows)};}
test('reassignment closes previous primary and preserves exactly one current assignment',()=>{
 const {rows,state}=setup(),student=rows[1];const old=state.assignments.find(a=>a.studentId===student.id)!;
 const target=state.nuclei.find(n=>n.id!==old.nucleusId)!;
 const next=assignStudent(state,rows,student.id,'primary',target.id,'ΑΛΛΑΓΗ',at,'change');
 assert.equal(next.assignments.find(a=>a.id===old.id)!.endedAt,at);
 assert.equal(next.assignments.filter(a=>a.studentId===student.id&&a.kind==='primary'&&!a.endedAt).length,1);
 assert.equal(projectNuclei(rows,next)[1].nucleus,target.name);
 assert.equal(state.assignments.find(a=>a.id===old.id)!.endedAt,undefined);
 assert.equal(next.history[0].reason,'ΑΛΛΑΓΗ');
});
test('primary and secondary cannot conflict; secondary replacement is historical and optional',()=>{
 const {rows,state}=setup(),student=rows[1],primary=state.assignments.find(a=>a.studentId===student.id)!.nucleusId;
 assert.throws(()=>assignStudent(state,rows,student.id,'secondary',primary,'WHY',at,'s'));
 const other=state.nuclei.find(n=>n.id!==primary)!;
 const next=assignStudent(state,rows,student.id,'secondary',other.id,'SECONDARY',at,'s');
 assert.equal(projectNuclei(rows,next)[1].secondaryNucleus,other.name);
 assert.throws(()=>assignStudent(next,rows,student.id,'primary',other.id,'WHY',at,'x'));
 const cleared=assignStudent(next,rows,student.id,'secondary',null,'REMOVE',at,'clear');
 assert.equal(projectNuclei(rows,cleared)[1].secondaryNucleus,'');assert.equal(cleared.assignments.find(a=>a.id==='s')!.endedAt,at);
});
test('unique category counts include secondary assignments without double-counting students',()=>{
 const {rows,state}=setup();const student=rows[1],primary=state.assignments.find(a=>a.studentId===student.id)!.nucleusId;
 const other=state.nuclei.find(n=>n.id!==primary)!;
 const next=assignStudent(state,rows,student.id,'secondary',other.id,'SECONDARY',at,'s');
 const all=nucleusCounts(next,rows,next.nuclei.map(n=>n.id));
 assert.equal(all.total,operational(rows).length);assert.equal(all.total,all.registered+all.unregistered);assert.equal(all.secondary,1);
 assert.equal(nucleusCounts(next,rows,[other.id]).total,nucleusCounts(state,rows,[other.id]).total+1);
 assert.throws(()=>assignStudent(state,rows,rows[0].id,'primary',other.id,'ARCHIVED',at,'x'));
});
test('nucleus rename/category movement retains stable assignment IDs and history',()=>{
 const {rows,state}=setup();const original=state.nuclei[0];
 const category=createCategory(state,'cat','Νέα κατηγορία',at);
 const next=saveNucleus(category,original.id,'Νέο όνομα','cat',true,'RENAME',at,'rename');
 assert.equal(next.nuclei.find(n=>n.id===original.id)!.name,'ΝΕΟ ΟΝΟΜΑ');
 assert.deepEqual(next.assignments,state.assignments);
 assert.equal(projectNuclei(rows,next).find(r=>state.assignments.find(a=>a.studentId===r.id)!.nucleusId===original.id)!.nucleus,'ΝΕΟ ΟΝΟΜΑ');
 assert.throws(()=>createCategory(category,'dup','νέα κατηγορία',at));
 assert.throws(()=>saveNucleus(state,'new',original.name,'demo-category',false,'',at,'dup'));
 assert.throws(()=>saveNucleus(state,'new','NAME','missing',false,'',at,'bad'));
});
test('nonstudent managers can manage multiple nuclei; deactivation never erases links',()=>{
 const {state}=setup(),person=state.people[0];assert.equal(person.studentId,undefined);
 const nucleus=state.nuclei[2];
 const next=assignManager(state,nucleus.id,person.id,'RESPONSIBILITY',at,'m');
 assert.ok(next.managers.filter(m=>m.personId===person.id&&!m.endedAt).length>=2);
 const inactive=setManagerActive(next,person.id,false,'INACTIVE',at,'inactive');
 assert.deepEqual(inactive.managers,next.managers);
 assert.throws(()=>assignManager(inactive,state.nuclei[3].id,person.id,'WHY',at,'bad'));
 const replacement=assignManager(inactive,nucleus.id,state.people[1].id,'REPLACE',at,'new');
 assert.equal(replacement.managers.find(m=>m.id==='m')!.endedAt,at);
 assert.equal(replacement.managers.filter(m=>m.nucleusId===nucleus.id&&!m.endedAt).length,1);
});
test('people can be independent or explicitly linked, never automatically name-merged',()=>{
 const {rows,state}=setup();const a=createManagerPerson(state,rows,'a','Συνθετικός άνθρωπος',null,at);
 const b=createManagerPerson(a,rows,'b','Συνθετικός άνθρωπος',null,at);
 assert.equal(b.people.filter(p=>p.name==='ΣΥΝΘΕΤΙΚΟΣ ΑΝΘΡΩΠΟΣ').length,2);
 const linked=createManagerPerson(b,rows,'c','',rows[2].id,at);
 assert.equal(linked.people.find(p=>p.id==='c')!.studentId,rows[2].id);
 assert.throws(()=>createManagerPerson(linked,rows,'d','',rows[2].id,at));
 assert.throws(()=>assignManager(state,'unknown',null,'WHY',at,'bad'));
 assert.throws(()=>setManagerActive(state,'unknown',false,'WHY',at,'bad'));
});
