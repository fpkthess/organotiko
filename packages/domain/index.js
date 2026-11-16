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
  if (/^Ν\d+$/.test(y)) return {next:`Ν${Number(y.slice(1))+1}`,review:true,reason:'extended_year_review'};
  if (y==='9') return {next:'91',review:true,reason:'masters_year_review'};
  if (y==='91') return {next:'92',review:true,reason:'masters_year_review'};
  if (y==='92') return {next:'92',review:true,reason:'masters_completion_review'};
  if (/^\d+$/.test(y)) {
    const n=Number(y);
    if (n>=1 && n<=9) {
      if (Number.isInteger(duration) && duration>=1 && n>=duration) return {next:'Ν1',review:true,reason:'end_of_nominal_duration'};
      const next=String(n+1).padStart(y.length===2?2:1,'0');
      return {next,review:!duration,reason:!duration?'unknown_course_duration':'regular'};
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

/** School-specific annual audit. No operation in this function writes student records.
 * Catalog MUST be verified by an Organotikos; never assume every programme is 4 years.
 * programme keys include university AND department so same department labels cannot collide.
 */
export function programKey(university, department) {
  return `${normalized(university)}|${normalized(department)}`;
}
export function previewAnnualUpgradeReviewed(students,{from,to,programs={}}) {
  if (!/^\d{4}-\d{2}$/.test(from)||!/^\d{4}-\d{2}$/.test(to)||
      Number(to.slice(0,4))!==Number(from.slice(0,4))+1 ||
      Number(to.slice(5))!==((Number(from.slice(5))+1)%100))
    throw new Error('Η αναβάθμιση απαιτεί ακριβώς το επόμενο ακαδημαϊκό έτος.');
  return students.map(student=>{
    const key=programKey(student.university,student.department);
    const rule=programs[key];
    const kind=rule?.kind||'';
    const duration=Number(rule?.duration);
    const verified=Boolean(rule?.verified)&&['undergraduate','masters','iek'].includes(kind)&&
      (kind==='undergraduate'?Number.isInteger(duration)&&duration>=2&&duration<=8:true);
    const code=String(student.yearCode??'').toUpperCase().trim();
    const graduated=code==='0',honorary=code==='Π';
    if(graduated||honorary)return {...student,id:student.id,person:`${student.surname} ${student.name}`,
      from:code,to:code,university:student.university||'',department:student.department||'',
      review:false,blocked:false,reason:graduated?'graduate_unchanged':'honorary_unchanged',
      efRegisteredBefore:student.efRegistered,efRegisteredAfter:student.efRegistered};
    // An unknown or unverified programme must not invent the advancement rule.
    if(!verified)return {id:student.id,person:`${student.surname} ${student.name}`,
      from:code,to:code,university:student.university||'',department:student.department||'',
      review:true,blocked:true,reason:'unverified_school',
      efRegisteredBefore:student.efRegistered,efRegisteredAfter:student.efRegistered};
    const ruleDuration=kind==='undergraduate'?duration:null;
    const proposal=nextStudyYear(code,ruleDuration);
    const mustReview=kind!=='undergraduate'||proposal.review||Boolean(rule.annualReview);
    const reason=kind==='iek'?'iek_annual_review':kind==='masters'?'masters_annual_review':proposal.reason;
    return {id:student.id,person:`${student.surname} ${student.name}`,from:code,to:proposal.next,
      university:student.university||'',department:student.department||'',
      review:mustReview,blocked:false,reason,
      efRegisteredBefore:student.efRegistered,efRegisteredAfter:student.efRegistered};
  });
}
/** Deterministic proposed matches only. No status changes or automatic linking. */
export function proposeSourceMatches(students,external){
 const normalizedPhone=v=>String(v??'').replace(/[^0-9]/g,'');
 return external.map(source=>{
  const full=`${normalized(source.surname)} ${normalized(source.name)}`.trim();
  const phone=normalizedPhone(source.phone);
  const candidates=students.flatMap(s=>{
    const studentFull=`${normalized(s.surname)} ${normalized(s.name)}`.trim();
    const sameName=full.length>2&&full===studentFull;
    const samePhone=phone.length>=8&&[s.phoneCy,s.phoneGr].some(p=>normalizedPhone(p)===phone);
    if(!sameName&&!samePhone)return [];
    return [{studentId:s.id,surname:s.surname,name:s.name,
      sameName,samePhone,score:Number(sameName)*2+Number(samePhone)}];
  }).sort((a,b)=>b.score-a.score||a.surname.localeCompare(b.surname,'el'));
  return {sourceId:source.sourceId,sourceSystem:source.sourceSystem,candidates,
    state:candidates.length?'needs_manual_review':'unmatched'};
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
