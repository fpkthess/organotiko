import { type Change, type Student } from './students.ts';
export interface StudentStatusChange {id:string;studentId:string;before:Student['status'];after:Student['status'];reason:string;at:string}
export function changeStudentStatus(rows:Student[],id:string,expected:Student['status'],next:Student['status'],reason:string,eventId:string,at:string) {
  const row=rows.find(r=>r.id===id);
  if(!row||row.status!==expected)throw new Error('Η κατάσταση άλλαξε. Ανοίξτε ξανά την καρτέλα.');
  if(!reason.trim())throw new Error('Η αιτιολογία είναι υποχρεωτική.');
  if(!['active','zero','archived'].includes(next)||next===expected)throw new Error('Μη έγκυρη αλλαγή κατάστασης.');
  if(next!=='archived'&&expected!=='archived')throw new Error('Η επαναφορά επιτρέπεται μόνο από το αρχείο.');
  const event:StudentStatusChange={id:eventId,studentId:id,before:expected,after:next,reason:reason.trim(),at};
  return {rows:rows.map(r=>r.id===id?{...r,status:next}:r),event};
}
export interface NoteVersion extends Change { source:string }
export function studentNoteHistory(id:string,changes:NoteVersion[]):NoteVersion[] {
  return changes.filter(c=>c.studentId===id&&c.field==='notes').sort((a,b)=>b.at.localeCompare(a.at));
}
