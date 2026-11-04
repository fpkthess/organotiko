import {test} from 'node:test';
import assert from 'node:assert/strict';
import {correctRegistration,createRegistrationPeriod,createRegistrationYear,entryFor,projectAnnualRegistrations,recordRegistration,registrationStats,saveAnnualIntention,setAssociationMembership,syntheticRegistrations,validCalendarDate} from '../packages/domain/src/registrations.ts';
import {syntheticStudents} from '../packages/domain/src/students.ts';
import {changeStudentStatus} from '../packages/domain/src/studentCards.ts';
const at='2026-11-03T15:00:00.000Z';
function setup(){const rows=syntheticStudents(),state=syntheticRegistrations(rows);return {rows,state,student:rows[6]};}
test('intentions are separate from actual registration, source and current membership',()=>{
 const {rows,state,student}=setup();
 const intended=saveAnnualIntention(state,rows,student.id,state.currentYearId,'','2','i',at);
 assert.equal(projectAnnualRegistrations(rows,intended)[6].annualRegistration,'2');assert.equal(rows[6].efRegistered,false);
 const registered=recordRegistration(intended,rows,student.id,'demo-period-2026','2026-11-03','ψ3','r',at);
 const entry=entryFor(registered.state,student.personId,state.currentYearId)!;
 assert.equal(entry.intention,'2');assert.equal(entry.source,'ψ3');assert.equal(registered.rows[6].efRegistered,true);
 assert.equal(projectAnnualRegistrations(registered.rows,registered.state)[6].annualRegistration,'ψ3');
 assert.throws(()=>saveAnnualIntention(registered.state,registered.rows,student.id,state.currentYearId,'2','3','later',at));
});
test('duplicate identity/year records are rejected, including a different student ID linked to same person',()=>{
 const {rows,state,student}=setup();const result=recordRegistration(state,rows,student.id,'demo-period-2026','2026-11-03','+','r',at);
 assert.throws(()=>recordRegistration(result.state,result.rows,student.id,'demo-period-2026','2026-11-03','+','r2',at));
 const another={...student,id:'linked-duplicate'};
 assert.throws(()=>recordRegistration(result.state,[...result.rows,another],another.id,'demo-period-2026','2026-11-03','+','r3',at));
});
test('dates, periods, source codes and Sunday exclusions are validated',()=>{
 const {rows,state,student}=setup();
 assert.equal(validCalendarDate('2025-02-29'),false);assert.equal(validCalendarDate('2024-02-29'),true);
 assert.throws(()=>recordRegistration(state,rows,student.id,'demo-period-2026','2026-11-08','+','r',at));
 assert.throws(()=>recordRegistration(state,rows,student.id,'demo-period-2026','2026-11-03','UNKNOWN','r',at));
 assert.throws(()=>recordRegistration(state,rows,student.id,'demo-period-2025','2025-10-03','+','r',at));
 const period={id:'no-sunday',yearId:state.currentYearId,label:'NO SUNDAY',startsOn:'2026-11-01',endsOn:'2026-11-07',skipSundays:true};
 const next=createRegistrationPeriod(state,period,at);
 assert.throws(()=>recordRegistration(next,rows,student.id,period.id,'2026-11-01','+','r',at),/Κυριακή/);
 assert.throws(()=>createRegistrationPeriod(state,{...period,startsOn:'2025-01-01'},at));
});
test('corrections are revision checked and reasoned; fixed original identity dimensions survive',()=>{
 const {rows,state,student}=setup();const registered=recordRegistration(state,rows,student.id,'demo-period-2026','2026-11-03','+','r',at);
 const before=structuredClone(registered.state.entries.find(e=>e.id==='r')!);
 const corrected=correctRegistration(registered.state,'r',1,'demo-period-2026','2026-11-04','μ','CORRECTION','c',at);
 const entry=corrected.entries.find(e=>e.id==='r')!;assert.equal(entry.revision,2);assert.equal(entry.date,'2026-11-04');assert.deepEqual(entry.snapshot,before.snapshot);
 assert.ok(corrected.history[0].before.includes('2026-11-03'));assert.equal(corrected.history[0].reason,'CORRECTION');
 assert.throws(()=>correctRegistration(corrected,'r',1,'demo-period-2026','2026-11-05','+','STALE','c2',at));
 assert.throws(()=>correctRegistration(corrected,'r',2,'demo-period-2026','2026-11-05','+',' ','c2',at));
});
test('independent membership false does not remove annual records or affect other memberships',()=>{
 const {rows,state,student}=setup();const registered=recordRegistration(state,rows,student.id,'demo-period-2026','2026-11-03','+','r',at);
 const before=registrationStats(registered.state,state.currentYearId).total;
 const changed=setAssociationMembership(registered.state,registered.rows,student.id,true,false,'STATUS CHANGE','b',at);
 assert.equal(changed.rows[6].efRegistered,false);assert.equal(changed.rows[6].protoporia,student.protoporia);assert.equal(changed.rows[6].bluepass,student.bluepass);
 assert.equal(registrationStats(changed.state,state.currentYearId).total,before);assert.equal(entryFor(changed.state,student.personId,state.currentYearId)!.source,'+');
 assert.throws(()=>setAssociationMembership(changed.state,changed.rows,student.id,true,true,'STALE','c',at));
});
test('historical statistics retain records after student archive and include zero days for a selected period',()=>{
 const {rows,state,student}=setup();const registered=recordRegistration(state,rows,student.id,'demo-period-2026','2026-11-03','+','r',at);
 const archived=changeStudentStatus(registered.rows,student.id,'active','archived','ARCHIVE','a',at);
 const stats=registrationStats(registered.state,state.currentYearId,'demo-period-2026');
 assert.equal(stats.daily.length,7);assert.equal(stats.daily.at(-1)!.cumulative,stats.total);assert.equal(stats.daily.find(d=>d.date==='2026-11-07')!.count,0);
 assert.ok(registered.state.entries.some(e=>e.studentId===student.id));assert.equal(archived.rows[6].status,'archived');
 assert.throws(()=>recordRegistration(state,archived.rows,student.id,'demo-period-2026','2026-11-03','+','r2',at));
});
test('adding a reporting year starts blank and changes neither current year nor student progression/membership',()=>{
 const {rows,state}=setup(),original=structuredClone(rows);
 const added=createRegistrationYear(state,{id:'next',label:'2027 / 28',startsOn:'2027-09-01',endsOn:'2028-08-31',sourceCodes:['+','μ']},at);
 assert.equal(added.currentYearId,state.currentYearId);assert.equal(added.entries.filter(e=>e.yearId==='next').length,0);assert.deepEqual(rows,original);
 assert.equal(registrationStats(added,'next').total,0);
 assert.throws(()=>createRegistrationYear(state,{id:'bad',label:'BAD',startsOn:'2027-09-01',endsOn:'2028-08-31',sourceCodes:['+','+']},at));
});
