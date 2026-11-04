import { emptyFilters, matchesFilters, type FilterGroup } from './filters.ts';
import { operational, patchField, type Change, type EditableField, type Student } from './students.ts';
export type ReviewStatus = 'planned' | 'active' | 'paused' | 'completed' | 'cancelled';
export interface ReviewSession {
  id: string; name: string; status: ReviewStatus; filters: FilterGroup;
  cohort: string[]; baseline: Student[]; examined: string[]; changes: Change[];
  final: Student[]; createdAt: string; startedAt?: string; endedAt?: string;
}
const copy = <T>(value: T): T => structuredClone(value);
function requireStatus(session: ReviewSession, allowed: ReviewStatus[]) {
  if (!allowed.includes(session.status)) throw new Error('Η ενέργεια δεν επιτρέπεται σε αυτή την κατάσταση συνεδρίας.');
}
export function planReview(id: string, name: string, at: string, filters = emptyFilters()): ReviewSession {
  if (!name.trim()) throw new Error('Δώστε όνομα συνεδρίας.');
  return {id, name:name.trim(), createdAt:at, status:'planned', filters:copy(filters), cohort:[], baseline:[], examined:[], changes:[], final:[]};
}
export function startReview(sessions: ReviewSession[], id: string, rows: Student[], at: string): ReviewSession[] {
  const session = sessions.find(s => s.id === id);
  if (!session) throw new Error('Η συνεδρία δεν βρέθηκε.');
  requireStatus(session, ['planned','paused']);
  if (sessions.some(s => s.status === 'active')) throw new Error('Υπάρχει ήδη ενεργή συνεδρία. Παύστε ή ολοκληρώστε την πρώτα.');
  if (session.status === 'paused') return sessions.map(s => s.id === id ? {...s,status:'active'} : s);
  const cohort = operational(rows).filter(row => matchesFilters(row,session.filters));
  if (!cohort.length) throw new Error('Δεν υπάρχουν ενεργοί φοιτητές με αυτά τα φίλτρα.');
  return sessions.map(s => s.id === id ? {...s,status:'active',startedAt:at,cohort:cohort.map(r=>r.id),baseline:copy(cohort)} : s);
}
export function markExamined(session: ReviewSession, id: string): ReviewSession {
  requireStatus(session,['active']);
  if (!session.cohort.includes(id)) throw new Error('Ο φοιτητής δεν ανήκει στο παγωμένο σύνολο.');
  return session.examined.includes(id) ? session : {...session,examined:[...session.examined,id]};
}
export function editReview(session: ReviewSession, rows: Student[], id: string, field: EditableField, expected: string, value: string, changeId: string, at: string) {
  requireStatus(session,['active']);
  if (!session.cohort.includes(id)) throw new Error('Ο φοιτητής δεν ανήκει στο παγωμένο σύνολο.');
  const result = patchField(rows,id,field,expected,value);
  if (result.conflict) throw new Error('Το πεδίο άλλαξε. Ακυρώστε την επεξεργασία και ανοίξτε το ξανά.');
  const after = result.rows.find(r=>r.id===id)![field];
  const change: Change = {id:changeId,studentId:id,field,before:expected,after,at};
  return { rows:result.rows, session: result.changed ? {...session,changes:[...session.changes,change]} : session };
}
export function finishReview(session: ReviewSession, status: 'paused'|'completed'|'cancelled', rows: Student[], at: string): ReviewSession {
  requireStatus(session,status==='cancelled'?['planned','active','paused']:status==='completed'?['active','paused']:['active']);
  return {...session,status,...(status!=='paused'?{endedAt:at,final:copy(rows.filter(r=>session.cohort.includes(r.id)))}:{})};
}
export function reviewSummary(session: ReviewSession, scope: 'examined'|'cohort') {
  requireStatus(session,['completed','cancelled']);
  const ids = new Set(scope==='examined'?session.examined:session.cohort);
  const before = session.baseline.filter(r=>ids.has(r.id));
  const after = session.final.filter(r=>ids.has(r.id));
  return {total:ids.size,beforeRegistered:before.filter(r=>r.efRegistered).length,afterRegistered:after.filter(r=>r.efRegistered).length,
    changedPeople:new Set(session.changes.filter(c=>ids.has(c.studentId)).map(c=>c.studentId)).size,
    ownChanges:session.changes.filter(c=>ids.has(c.studentId))};
}
