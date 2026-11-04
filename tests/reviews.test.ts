import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyFilters, matchesFilters } from '../packages/domain/src/filters.ts';
import { editReview, finishReview, markExamined, planReview, reviewSummary, startReview } from '../packages/domain/src/reviews.ts';
import { syntheticStudents } from '../packages/domain/src/students.ts';
const at='2026-11-03T10:00:00.000Z';
const filter={mode:'all' as const,rules:[{id:'r',field:'surname' as const,operator:'equals' as const,value:'ΔΕΙΓΜΑΤΟΣ 007'}]};
function setup(){const rows=syntheticStudents();const planned=planReview('s','ΔΟΚΙΜΗ',at,filter);return {rows,session:startReview([planned],'s',rows,at)[0]};}
test('typed filters combine AND/OR, Greek matching, blanks and boolean values',()=>{
 const row=syntheticStudents()[1];
 const a={id:'a',field:'name' as const,operator:'equals' as const,value:'Μαρία'};
 const b={id:'b',field:'efRegistered' as const,operator:'equals' as const,value:'false'};
 assert.equal(matchesFilters(row,{mode:'all',rules:[a,b]}),false);
 assert.equal(matchesFilters(row,{mode:'any',rules:[a,b]}),true);
 assert.equal(matchesFilters(row,{mode:'all',rules:[{id:'c',field:'notes',operator:'empty',value:''}]}),true);
 assert.equal(matchesFilters(row,emptyFilters()),true);
 assert.equal(matchesFilters(row,{mode:'all',rules:[{...b,value:'invalid'}]}),false);
});
test('cohort freezes at actual start, excludes archived/zero and survives changed records/resume',()=>{
 const rows=syntheticStudents();const planned=planReview('s','TEST',at,filter);
 rows[6]={...rows[6],notes:'CHANGED BEFORE START'};
 const session=startReview([planned],'s',rows,at)[0];
 assert.deepEqual(session.cohort,[rows[6].id]);assert.equal(session.baseline[0].notes,'CHANGED BEFORE START');
 rows[6].notes='LATER';assert.equal(session.baseline[0].notes,'CHANGED BEFORE START');
 const paused=finishReview(session,'paused',rows,at);
 const resumed=startReview([paused],'s',[...rows,{...rows[6],id:'new'}],at)[0];
 assert.deepEqual(resumed.cohort,session.cohort);assert.deepEqual(resumed.baseline,session.baseline);
 const full=startReview([planReview('all','ALL',at)],'all',rows,at)[0];
 assert.ok(full.cohort.every(id=>rows.find(r=>r.id===id)?.status==='active'));
});
test('only one session can be active in the domain state; starting or resuming another fails',()=>{
 const {rows,session}=setup();const plan=planReview('two','SECOND',at);
 assert.throws(()=>startReview([session,plan],'two',rows,at),/ενεργή/);
 const paused=finishReview({...session,id:'paused'},'paused',rows,at);
 assert.throws(()=>startReview([session,paused],'paused',rows,at),/ενεργή/);
});
test('examination is unique and rejects outsiders; failed edits preserve data and progress',()=>{
 const {rows,session}=setup();const id=session.cohort[0];
 const marked=markExamined(markExamined(session,id),id);assert.deepEqual(marked.examined,[id]);
 assert.throws(()=>markExamined(session,'outsider'));
 assert.throws(()=>editReview(session,rows,id,'name','stale','X','c',at));
 assert.throws(()=>editReview(session,rows,id,'name',rows[6].name,' ','c',at));
 assert.equal(session.examined.length,0);assert.equal(session.changes.length,0);
});
test('completed/cancelled lock permanently; cancellation retains saved student edits',()=>{
 const {rows,session}=setup();const id=session.cohort[0];
 const edited=editReview(session,rows,id,'notes',rows[6].notes,'SESSION CHANGE','c',at);
 const cancelled=finishReview(edited.session,'cancelled',edited.rows,at);
 assert.equal(edited.rows[6].notes,'SESSION CHANGE');
 assert.throws(()=>startReview([cancelled],cancelled.id,edited.rows,at));
 assert.throws(()=>markExamined(cancelled,id));
 assert.throws(()=>editReview(cancelled,edited.rows,id,'notes','SESSION CHANGE','X','c2',at));
 const completed=finishReview(edited.session,'completed',edited.rows,at);
 assert.throws(()=>finishReview(completed,'paused',edited.rows,at));
});
test('stable reports distinguish examined/cohort and attribute only session changes',()=>{
 const rows=syntheticStudents();const s=startReview([planReview('s','TEST',at)],'s',rows,at)[0];
 const id=s.cohort[0], target=rows.find(r=>r.id===id)!;
 const edited=editReview(s,rows,id,'notes',target.notes,'SESSION','c',at);
 // External changes affect frozen before/after values, but not session attribution.
 const external=edited.rows.map(r=>r.id===id?{...r,efRegistered:!r.efRegistered}:r);
 const completed=finishReview(markExamined(edited.session,id),'completed',external,at);
 const summary=reviewSummary(completed,'examined');
 assert.equal(summary.total,1);assert.equal(summary.ownChanges.length,1);assert.equal(summary.changedPeople,1);
 assert.notEqual(summary.beforeRegistered,summary.afterRegistered);
 assert.equal(reviewSummary(completed,'cohort').total,s.cohort.length);
 external.find(r=>r.id===id)!.notes='AFTER COMPLETION';assert.equal(completed.final.find(r=>r.id===id)!.notes,'SESSION');
});
