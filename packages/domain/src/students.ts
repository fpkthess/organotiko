export interface Student {
 id: string; personId: string; surname: string; name: string; department: string; year: string;
 nucleus: string; secondaryNucleus?: string; annualRegistration?: string; registrationIntention?: string; registrationDate?: string; efRegistered: boolean; protoporia: boolean; bluepass: boolean; notes: string;
 status: 'active' | 'zero' | 'archived';
}
export type EditableField = 'surname' | 'name' | 'notes';
export interface Change { id: string; studentId: string; field: EditableField; before: string; after: string; at: string; source?: string }
export function normalize(value: string) { return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleUpperCase('el'); }
export function operational(rows: Student[]) { return rows.filter(s => s.status === 'active'); }
export function patchField(rows: Student[], id: string, field: EditableField, expected: string, value: string): {rows: Student[]; conflict: boolean; changed: boolean} {
 const row = rows.find(s => s.id === id);
 if (!row || row[field] !== expected) return { rows, conflict: true, changed: false };
 const after = field === 'notes' ? value : normalize(value.trim());
 if (field !== 'notes' && !after) throw new Error('Το πεδίο δεν μπορεί να είναι κενό.');
 return {rows: rows.map(s => s.id === id ? {...s,[field]:after} : s), conflict:false, changed:row[field] !== after};
}
export function csv(rows: Student[], fields: (keyof Student)[], labels: string[]) {
 const quote = (v: unknown) => { let s = typeof v === 'boolean' ? (v ? 'ΝΑΙ' : 'ΟΧΙ') : String(v ?? ''); if (/^[=+@\-\t\r]/.test(s)) s = "'" + s; return '"' + s.replaceAll('"','""') + '"'; };
 return '\uFEFF' + [labels, ...rows.map(s => fields.map(f => s[f]))].map(r => r.map(quote).join(';')).join('\r\n');
}
const names = ['ΑΝΔΡΕΑΣ','ΜΑΡΙΑ','ΓΙΩΡΓΟΣ','ΕΛΕΝΗ','ΝΙΚΟΣ','ΑΝΝΑ','ΜΙΧΑΛΗΣ','ΣΟΦΙΑ'];
const surnames = ['ΔΕΙΓΜΑΤΟΣ','ΔΟΚΙΜΟΥ','ΠΑΡΑΔΕΙΓΜΑΤΟΣ','ΣΥΝΘΕΤΙΚΟΥ','ΕΛΕΓΧΟΥ','ΠΡΟΤΥΠΟΥ'];
export const departments = ['ΝΟΜΙΚΗ','ΙΑΤΡΙΚΗ','ΠΛΗΡΟΦΟΡΙΚΗ','ΟΙΚΟΝΟΜΙΚΩΝ','ΠΟΛΙΤΙΚΩΝ ΜΗΧΑΝΙΚΩΝ','ΨΥΧΟΛΟΓΙΑ'];
export const nuclei = ['ΠΥΡΗΝΑΣ Α','ΠΥΡΗΝΑΣ Β','ΠΥΡΗΝΑΣ Γ','ΑΠ26'];
export function syntheticStudents(): Student[] { return Array.from({length:250}, (_,i) => ({
 id:`demo-student-${i+1}`,personId:`demo-person-${i+1}`,surname:`${surnames[i%6]} ${String(i+1).padStart(3,'0')}`,name:names[i%8],
 department:departments[Math.floor(i/3)%6],year:String(Math.floor(i/7)%6+1).padStart(2,'0'),nucleus:nuclei[Math.floor(i/5)%4],efRegistered:i%3!==0,protoporia:i%4!==0,bluepass:i%5<2,
 notes:i%7===0?'Συνθετική σημείωση για δοκιμή.':'',status:i%31===0?'archived':i%37===0?'zero':'active'
 })); }
