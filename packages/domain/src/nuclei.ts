import { normalize, operational, type Student } from './students.ts';
export interface NucleusCategory { id: string; name: string }
export interface Nucleus { id: string; name: string; categoryId: string; placeholder: boolean }
export interface ManagerPerson { id: string; name: string; active: boolean; studentId?: string }
export interface NucleusAssignment { id: string; studentId: string; nucleusId: string; kind: 'primary'|'secondary'; startedAt: string; endedAt?: string }
export interface ManagerAssignment { id: string; nucleusId: string; personId: string; startedAt: string; endedAt?: string }
export interface NucleusEvent { id: string; at: string; action: string; subject: string; before: string; after: string; reason: string }
export interface NucleusState { categories: NucleusCategory[]; nuclei: Nucleus[]; people: ManagerPerson[]; assignments: NucleusAssignment[]; managers: ManagerAssignment[]; history: NucleusEvent[] }
function text(value:string) {const result=normalize(value.trim());if(!result)throw new Error('Συμπληρώστε το όνομα.');return result;}
function reasonText(value:string) {if(!value.trim())throw new Error('Συμπληρώστε αιτιολογία για το ιστορικό.');return value.trim();}
function event(state:NucleusState,id:string,at:string,action:string,subject:string,before:string,after:string,reason:string):NucleusState {
  return {...state,history:[{id,at,action,subject,before,after,reason},...state.history]};
}
function uniqueName(items:{id:string;name:string}[],name:string,except?:string) {
  if(items.some(x=>x.id!==except&&normalize(x.name)===name))throw new Error('Υπάρχει ήδη εγγραφή με αυτό το όνομα.');
}
export function createCategory(state:NucleusState,id:string,name:string,at:string):NucleusState {
  name=text(name);uniqueName(state.categories,name);
  if(state.categories.some(c=>c.id===id))throw new Error('Η κατηγορία υπάρχει ήδη.');
  return event({...state,categories:[...state.categories,{id,name}]},id,at,'ΔΗΜΙΟΥΡΓΙΑ ΚΑΤΗΓΟΡΙΑΣ',name,'',name,'');
}
export function saveNucleus(state:NucleusState,id:string,name:string,categoryId:string,placeholder:boolean,reason:string,at:string,eventId:string):NucleusState {
  name=text(name);uniqueName(state.nuclei,name,id);
  if(!state.categories.some(c=>c.id===categoryId))throw new Error('Η κατηγορία δεν βρέθηκε.');
  const current=state.nuclei.find(n=>n.id===id);
  if(current)reason=reasonText(reason);
  const next={id,name,categoryId,placeholder};
  return event({...state,nuclei:current?state.nuclei.map(n=>n.id===id?next:n):[...state.nuclei,next]},eventId,at,current?'ΕΝΗΜΕΡΩΣΗ ΠΥΡΗΝΑ':'ΔΗΜΙΟΥΡΓΙΑ ΠΥΡΗΝΑ',name,current?`${current.name} · ${state.categories.find(c=>c.id===current.categoryId)?.name} · ${current.placeholder?'ΟΜΑΔΟΠΟΙΗΣΗ':'ΠΥΡΗΝΑΣ'}`:'',`${name} · ${state.categories.find(c=>c.id===categoryId)?.name} · ${placeholder?'ΟΜΑΔΟΠΟΙΗΣΗ':'ΠΥΡΗΝΑΣ'}`,reason);
}
export function assignStudent(state:NucleusState,rows:Student[],studentId:string,kind:NucleusAssignment['kind'],nucleusId:string|null,reason:string,at:string,id:string):NucleusState {
  reason=reasonText(reason);
  const student=rows.find(r=>r.id===studentId);
  if(!student||student.status!=='active')throw new Error('Επιλέξτε ενεργό φοιτητή.');
  if(nucleusId&&!state.nuclei.some(n=>n.id===nucleusId))throw new Error('Ο πυρήνας δεν βρέθηκε.');
  const active=state.assignments.filter(a=>a.studentId===studentId&&!a.endedAt);
  if(nucleusId&&active.some(a=>a.kind!==kind&&a.nucleusId===nucleusId))throw new Error('Ο πρωτεύων και ο δευτερεύων πυρήνας πρέπει να διαφέρουν.');
  const current=active.find(a=>a.kind===kind);
  if((current?.nucleusId||null)===nucleusId)return state;
  const names=(value:string|undefined)=>state.nuclei.find(n=>n.id===value)?.name||'ΧΩΡΙΣ ΑΝΑΘΕΣΗ';
  const assignments=state.assignments.map(a=>a.studentId===studentId&&a.kind===kind&&!a.endedAt?{...a,endedAt:at}:a);
  if(nucleusId)assignments.push({id,studentId,nucleusId,kind,startedAt:at});
  return event({...state,assignments},id,at,kind==='primary'?'ΠΡΩΤΕΥΩΝ ΠΥΡΗΝΑΣ':'ΔΕΥΤΕΡΕΥΩΝ ΠΥΡΗΝΑΣ',`${student.surname} ${student.name}`,names(current?.nucleusId),names(nucleusId||undefined),reason);
}
export function assignManager(state:NucleusState,nucleusId:string,personId:string|null,reason:string,at:string,id:string):NucleusState {
  reason=reasonText(reason);
  const nucleus=state.nuclei.find(n=>n.id===nucleusId);
  if(!nucleus)throw new Error('Ο πυρήνας δεν βρέθηκε.');
  if(personId&&!state.people.some(p=>p.id===personId&&p.active))throw new Error('Επιλέξτε ενεργό υπεύθυνο.');
  const current=state.managers.find(m=>m.nucleusId===nucleusId&&!m.endedAt);
  if((current?.personId||null)===personId)return state;
  const managers=state.managers.map(m=>m.nucleusId===nucleusId&&!m.endedAt?{...m,endedAt:at}:m);
  if(personId)managers.push({id,nucleusId,personId,startedAt:at});
  return event({...state,managers},id,at,'ΥΠΕΥΘΥΝΟΣ ΠΥΡΗΝΑ',nucleus.name,state.people.find(p=>p.id===current?.personId)?.name||'ΧΩΡΙΣ ΥΠΕΥΘΥΝΟ',state.people.find(p=>p.id===personId)?.name||'ΧΩΡΙΣ ΥΠΕΥΘΥΝΟ',reason);
}
export function setManagerActive(state:NucleusState,personId:string,active:boolean,reason:string,at:string,id:string):NucleusState {
  reason=reasonText(reason);const person=state.people.find(p=>p.id===personId);if(!person)throw new Error('Το πρόσωπο δεν βρέθηκε.');
  if(person.active===active)return state;
  // Existing management links remain intact until explicitly reassigned.
  return event({...state,people:state.people.map(p=>p.id===personId?{...p,active}:p)},id,at,'ΚΑΤΑΣΤΑΣΗ ΥΠΕΥΘΥΝΟΥ',person.name,person.active?'ΕΝΕΡΓΟΣ':'ΑΝΕΝΕΡΓΟΣ',active?'ΕΝΕΡΓΟΣ':'ΑΝΕΝΕΡΓΟΣ',reason);
}
export function projectNuclei(rows:Student[],state:NucleusState):Student[] {
  return rows.map(row=>{const active=state.assignments.filter(a=>a.studentId===row.id&&!a.endedAt);return {...row,nucleus:state.nuclei.find(n=>n.id===active.find(a=>a.kind==='primary')?.nucleusId)?.name||'',secondaryNucleus:state.nuclei.find(n=>n.id===active.find(a=>a.kind==='secondary')?.nucleusId)?.name||''};});
}
export function nucleusCounts(state:NucleusState,rows:Student[],ids:string[]) {
  const selected=new Set(ids), active=operational(rows);
  const people=new Set(state.assignments.filter(a=>!a.endedAt&&selected.has(a.nucleusId)).map(a=>a.studentId));
  const counted=active.filter(r=>people.has(r.id));
  return {total:counted.length,registered:counted.filter(r=>r.efRegistered).length,unregistered:counted.filter(r=>!r.efRegistered).length,
    primary:active.filter(r=>state.assignments.some(a=>!a.endedAt&&a.kind==='primary'&&a.studentId===r.id&&selected.has(a.nucleusId))).length,
    secondary:active.filter(r=>state.assignments.some(a=>!a.endedAt&&a.kind==='secondary'&&a.studentId===r.id&&selected.has(a.nucleusId))).length};
}
export function syntheticNuclei(rows:Student[]):NucleusState {
  const at='2026-11-03T00:00:00.000Z';
  const nuclei=[...new Set(rows.map(r=>r.nucleus))].map((name,i)=>({id:`demo-nucleus-${i}`,name,categoryId:'demo-category',placeholder:name==='ΑΠ26'}));
  return {categories:[{id:'demo-category',name:'ΔΟΚΙΜΑΣΤΙΚΗ ΚΑΤΗΓΟΡΙΑ'}],nuclei,
    people:[{id:'demo-manager-a',name:'ΔΟΚΙΜΑΣΤΙΚΟΣ ΥΠΕΥΘΥΝΟΣ Α',active:true},{id:'demo-manager-b',name:'ΔΟΚΙΜΑΣΤΙΚΗ ΥΠΕΥΘΥΝΗ Β',active:true},{id:'demo-manager-c',name:`${rows[1].surname} ${rows[1].name}`,active:true,studentId:rows[1].id}],
    assignments:rows.map(r=>({id:`seed-${r.id}`,studentId:r.id,nucleusId:nuclei.find(n=>n.name===r.nucleus)!.id,kind:'primary',startedAt:at})),
    managers:nuclei.filter(n=>!n.placeholder).map((n,i)=>({id:`seed-manager-${i}`,nucleusId:n.id,personId:i===2?'demo-manager-c':'demo-manager-a',startedAt:at})),history:[]};
}
export function createManagerPerson(state:NucleusState,rows:Student[],id:string,name:string,studentId:string|null,at:string):NucleusState {
  if(state.people.some(p=>p.id===id))throw new Error('Το πρόσωπο υπάρχει ήδη.');
  const student=studentId?rows.find(r=>r.id===studentId):undefined;
  if(studentId&&!student)throw new Error('Ο φοιτητής δεν βρέθηκε.');
  if(studentId&&state.people.some(p=>p.studentId===studentId))throw new Error('Ο φοιτητής έχει ήδη καρτέλα υπευθύνου.');
  const person:ManagerPerson={id,name:student?`${student.surname} ${student.name}`:text(name),active:true,...(studentId?{studentId}:{})};
  return event({...state,people:[...state.people,person]},id,at,'ΔΗΜΙΟΥΡΓΙΑ ΠΡΟΣΩΠΟΥ',person.name,'',person.name,studentId?'ΡΗΤΗ ΣΥΝΔΕΣΗ ΜΕ ΦΟΙΤΗΤΗ':'ΑΝΕΞΑΡΤΗΤΟ ΣΥΝΘΕΤΙΚΟ ΠΡΟΣΩΠΟ');
}
