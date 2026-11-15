/** ORGANOTIKO domain rules. Pure functions shared by the apps & independently tested. */
export const REGISTRATION_SOURCES = Object.freeze(['+', 'ψ2', 'ψ3', 'ψ4', 'ψ5', 'Μ']);
export const INTENT_CODES = Object.freeze(['', '1', '2', '3']);
export const EVENT_KINDS = Object.freeze(['ΑΓΣ', 'ΒΓΣ', 'ΕΚΛ']);

export function isActualSource(v) { return REGISTRATION_SOURCES.includes(String(v ?? '')); }
export function isIntent(v) { return INTENT_CODES.includes(String(v ?? '')); }
export function assertRegistration({source, date, schoolYear}) {
  if (!isActualSource(source)) throw new Error('Η πηγή εγγραφής ΕΦΕΚΘ είναι υποχρεωτική (+, ψ2–ψ5, Μ).');
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(date??''));
  const actual = match ? new Date(`${date}T00:00:00Z`) : null;
  if (!match || !actual || Number.isNaN(actual.getTime()) || actual.getUTCFullYear()!==Number(match[1]) || actual.getUTCMonth()+1!==Number(match[2]) || actual.getUTCDate()!==Number(match[3])) throw new Error('Απαιτείται έγκυρη ημερομηνία εγγραφής.');
  if (!/^\d{4}-\d{2}$/.test(String(schoolYear ?? ''))) throw new Error('Απαιτείται ακαδημαϊκό έτος εγγραφής.');
  const [year, end] = String(schoolYear).split('-');
  if ((Number(year) + 1) % 100 !== Number(end)) throw new Error('Μη έγκυρο ακαδημαϊκό έτος.');
  return { source, date, schoolYear };
}

/** All annual values are an independent record. FALSE->TRUE requires a new dated event. */
export function registerEfekth(student, {source, date, schoolYear}) {
  const valid = assertRegistration({source,date,schoolYear});
  if (student.efRegistered) throw new Error('Ήδη εγγεγραμμένος ΕΦΕΚΘ· δεν δημιουργείται δεύτερη πρώτη εγγραφή.');
  return {
    student: {...student,efRegistered:true},
    event: {kind:'registration',...valid,yearAtEvent:student.yearCode,studentId:student.id},
    yearly: {schoolYear, registrationSource: source,intentCode:''}
  };
}
export function setAnnualIntent(row, code) {
  if (!isIntent(code)) throw new Error('Επιτρέπονται μόνο 1, 2, 3 ή κενό για πρόθεση εγγραφής.');
  if (row.registrationSource) throw new Error('Η πραγματική πηγή εγγραφής δεν αντικαθίσταται από πρόθεση.');
  return {...row,intentCode:code};
}

/** Returns a proposed year code, not an irreversible archival decision. */
export function nextStudyYear(code, duration = null) {
  const y=String(code??'').toUpperCase().trim();
  if (!y || y==='0' || y==='Π') return {next:y,review:false,reason:'unchanged'};
  if (/^Ν\d+$/.test(y)) return {next:`Ν${Number(y.slice(1))+1}`,review:false,reason:'extended'};
  if (y==='91') return {next:'92',review:false,reason:'masters'};
  if (y==='92') return {next:'92',review:true,reason:'masters_completion_review'};
  if (/^\d+$/.test(y)) {
    const n=Number(y);
    if (n>=1 && n<=9) {
      if (Number.isInteger(duration) && duration>=1 && n>=duration) return {next:'Ν1',review:false,reason:'extended'};
      return {next:String(n+1),review:!duration,reason:!duration?'unknown_course_duration':'regular'};
    }
  }
  return {next:y,review:true,reason:'nonstandard_code'};
}

/** Never changes the overall EF registration boolean. Starts a new, blank annual record. */
export function previewAnnualUpgrade(students, {from,to,durations = {}}) {
  if (!/^\d{4}-\d{2}$/.test(from) || !/^\d{4}-\d{2}$/.test(to)) throw new Error('Μη έγκυρο ακαδημαϊκό έτος.');
  if (Number(to.slice(0,4)) !== Number(from.slice(0,4))+1) throw new Error('Η αναβάθμιση πρέπει να αφορά το αμέσως επόμενο έτος.');
  return students.map(s => {
    const proposal=nextStudyYear(s.yearCode,durations[s.department]??null);
    return {id:s.id,person:s.surname+' '+s.name,from:s.yearCode,to:proposal.next,
      review:proposal.review,reason:proposal.reason,efRegisteredBefore:s.efRegistered,
      efRegisteredAfter:s.efRegistered,annualRecord:{schoolYear:to,intentCode:'',registrationSource:null,events:{ΑΓΣ:{intent:'',actual:''},ΒΓΣ:{intent:'',actual:''},ΕΚΛ:{intent:'',actual:''}}}};
  });
}

export function normalized(value) {return String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleUpperCase('el-GR').trim();}
export function matchesFilters(person, filters) {
  return filters.every(({field,values})=> !values?.length || values.some(v=>normalized(person[field])===normalized(v)));
}
export function summarizeBy(records, dimensions) {
  if (dimensions.length<1||dimensions.length>2) throw new Error('Επιτρέπονται μία ή δύο διαστάσεις.');
  const counts=new Map();
  for(const r of records){const key=dimensions.map(d=>String(r[d]??'—')).join(' / ');counts.set(key,(counts.get(key)||0)+1);}
  return [...counts].map(([label,count])=>({label,count})).sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label,'el'));
}
export function freezeSession(studentIds, filterSnapshot) {
  return {studentIds:[...new Set(studentIds)],filterSnapshot:structuredClone(filterSnapshot),reviewed:[],status:'draft'};
}
export function reviewSessionRow(session,id) {
  if (!session.studentIds.includes(id)) throw new Error('Ο φοιτητής δεν ανήκει στην παγωμένη λίστα.');
  return {...session,reviewed:[...new Set([...session.reviewed,id])]};
}

const surnames=['ΔΟΚΙΜΑΣΤΙΚΟΣ','ΠΑΡΑΔΕΙΓΜΑ','ΥΠΟΔΕΙΓΜΑ','ΕΙΚΟΝΙΚΟΣ','ΔΕΙΓΜΑ'];
const names=['ΑΛΦΑ','ΒΗΤΑ','ΓΑΜΜΑ','ΔΕΛΤΑ','ΕΨΙΛΟΝ'];
const departments=['ΝΟΜΙΚΗ','ΟΙΚΟΝΟΜΙΚΩΝ ΕΠΙΣΤΗΜΩΝ','ΠΛΗΡΟΦΟΡΙΚΗ','ΙΑΤΡΙΚΗ','ΜΑΘΗΜΑΤΙΚΟ'];
const nuclei=['ΑΠΥΡΗΝΩΤΟΙ','ΠΥΡΗΝΑΣ Α','ΠΥΡΗΝΑΣ Β','ΠΥΡΗΝΑΣ Γ'];
export function makeSyntheticStudents(count=260) {
  return Array.from({length:count},(_,i)=>({
    id:`DEMO-${String(i+1).padStart(4,'0')}`,surname:surnames[i%5],name:`${names[(i*3)%5]} ${String(i+1).padStart(3,'0')}`,
    department:departments[i%departments.length],university:'ΑΠΘ',yearCode:String(1+(i%5)),
    nucleus1:nuclei[(i*7)%nuclei.length],nucleus2:'',efRegistered:i%4===0,
    member:i%6===0,bluepass:i%3===0,cadre:i%9===0,
    phoneCy:'',phoneGr:'',entryYear:String(2026-(i%5)),uniqueNumber:'',adt:'',notes:''
  }));
}
