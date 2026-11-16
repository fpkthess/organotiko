import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import type {Student} from '@organotiko/domain';
const url=import.meta.env.VITE_SUPABASE_URL?.trim();
const key=import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
export const connected=Boolean(url&&key);
export const supabase:SupabaseClient|null=connected?createClient(url!,key!,{auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}}):null;
export type DbStudent=Student & {personVersion:number;studentVersion:number;studentRowId:string;status:string};
export type RegistrationEventEntry={id:string;studentId:string;year:string;source:string;date:string;studentYearAtRegistration:string};
type DbRow={id:string;name:string;surname:string;version?:number;organotiko_students?:Array<{id:string;department:string|null;year_code:string|null;ef_registered:boolean|null;notes:string|null;status:string;version?:number;university?:string|null;phone_cy?:string|null;phone_gr?:string|null;entry_year?:string|null;unique_number?:string|null;adt?:string|null;member?:boolean|null;bluepass?:boolean|null;cadre?:boolean|null;nucleus2?:string|null}>};

export async function loadStudents():Promise<DbStudent[]> {
 if(!supabase)throw Error('Δεν έχει ρυθμιστεί staging Supabase.');
 const {data,error}=await supabase.from('organotiko_people').select('id,name,surname,version,organotiko_students(id,department,year_code,ef_registered,notes,status,version,university,phone_cy,phone_gr,entry_year,unique_number,adt,member,bluepass,cadre,nucleus2)').order('surname').limit(5000);
 if(error)throw error;
 return (data as unknown as DbRow[]).flatMap((p)=> {
  const rel:unknown=p.organotiko_students;
  const items: NonNullable<DbRow['organotiko_students']> = Array.isArray(rel) ? rel : rel ? [rel as NonNullable<DbRow['organotiko_students']>[number]] : [];
  return items.map((s)=>({
  id:p.id,name:p.name,surname:p.surname,personVersion:p.version??0,studentVersion:s.version??0,studentRowId:s.id,
  status:s.status,department:s.department??'',university:s.university??'',yearCode:s.year_code??'',efRegistered:Boolean(s.ef_registered),
  notes:s.notes??'',phoneCy:s.phone_cy??'',phoneGr:s.phone_gr??'',entryYear:s.entry_year??'',uniqueNumber:s.unique_number??'',adt:s.adt??'',
  member:Boolean(s.member),bluepass:Boolean(s.bluepass),cadre:Boolean(s.cadre),nucleus1:'',nucleus2:s.nucleus2??''
 }));
 });
}

/** Only update whitelisted ordinary fields. Affected-row version check detects concurrent writes. */
export async function saveStudentField(s:DbStudent,key:keyof Student,value:string|boolean):Promise<{personVersion:number;studentVersion:number}> {
 if(!supabase)throw Error('Δεν έχει συνδεθεί η βάση.');
 if(key==='efRegistered'||key==='member'||key==='bluepass')throw Error('Αυτή η ιδιότητα αλλάζει μόνο με επιβεβαιωμένη ειδική διαδικασία.');
 if(key==='nucleus1'){
  await setPrimaryNucleus(s,String(value));
  return {personVersion:s.personVersion,studentVersion:s.studentVersion};
 }
 if(key==='name'||key==='surname'){
  const {data,error}=await supabase.from('organotiko_people').update({[key]:value}).eq('id',s.id).eq('version',s.personVersion).select('version').maybeSingle();
  if(error)throw error;
  if(!data)throw Error('Η εγγραφή άλλαξε από άλλον χρήστη. Ανανέωσε πριν αποθηκεύσεις.');
  return {personVersion:data.version,studentVersion:s.studentVersion};
 }
 const map:Record<string,string>={department:'department',yearCode:'year_code',notes:'notes',university:'university',phoneCy:'phone_cy',phoneGr:'phone_gr',entryYear:'entry_year',nucleus2:'nucleus2',uniqueNumber:'unique_number',adt:'adt',cadre:'cadre'};
 if(!map[String(key)])throw Error('Η αλλαγή αυτού του πεδίου δεν έχει ενεργοποιηθεί.');
 const {data,error}=await supabase.from('organotiko_students').update({[map[String(key)]]:value}).eq('id',s.studentRowId).eq('version',s.studentVersion).select('version').maybeSingle();
 if(error)throw error;
 if(!data)throw Error('Η εγγραφή άλλαξε από άλλον χρήστη. Ανανέωσε πριν αποθηκεύσεις.');
 return {studentVersion:data.version,personVersion:s.personVersion};
}

export async function createStudent(row:{name:string;surname:string;department?:string;yearCode?:string}):Promise<DbStudent> {
 if(!supabase)throw Error('Δεν έχει συνδεθεί η βάση.');
 // RPC guarantees parent+child insertion atomically, with access checks.
 const {data,error}=await supabase.rpc('organotiko_create_student',{p_name:row.name.trim().toUpperCase(),p_surname:row.surname.trim().toUpperCase(),p_department:row.department??'',p_year_code:row.yearCode??'1'});
 if(error)throw error;
 const list=await loadStudents();
 const found=list.find(s=>s.id===data);
 if(!found)throw Error('Δημιουργήθηκε η εγγραφή αλλά δεν εμφανίζεται· ανανέωσε τον πίνακα.');
 return found;
}
export async function registerStudent(s:DbStudent,schoolYear:string,source:string,date:string):Promise<void>{
 if(!supabase)throw Error('Δεν έχει συνδεθεί η βάση.');
 const {error}=await supabase.rpc('organotiko_register_efekth',{p_student_id:s.studentRowId,p_school_year:schoolYear,p_source:source,p_registered_on:date});
 if(error)throw error;
}

/** Related annual and historic event records; uses the existing protected read policies. */
export async function loadHistoricData(students:DbStudent[]):Promise<{
 annual:import('./model').AnnualMap;events:import('./model').EventMap;registrations:RegistrationEventEntry[];
}> {
 if(!supabase)throw Error('Δεν έχει συνδεθεί η βάση.');
 const [yearsResult, yearlyResult, eventsCatalogResult, eventRowsResult, assignsResult,nucleiResult,registrationEventsResult]=await Promise.all([
  supabase.from('organotiko_academic_years').select('id,code').limit(100),
  supabase.from('organotiko_yearly_records').select('student_id,year_id,intent_code,registration_source,registered_on').limit(10000),
  supabase.from('organotiko_event_catalog').select('id,title').limit(500),
  supabase.from('organotiko_event_records').select('student_id,event_id,intent,actual').limit(10000),
  supabase.from('organotiko_student_assignments').select('student_id,nucleus_id,kind,ended_at').is('ended_at',null).limit(5000),
  supabase.from('organotiko_nuclei').select('id,name').limit(500),
  supabase.from('organotiko_registration_events').select('id,student_id,year_id,source,registered_on,year_code_at_event').limit(20000)
 ]);
 for(const r of [yearsResult,yearlyResult,eventsCatalogResult,eventRowsResult,assignsResult,nucleiResult,registrationEventsResult])if(r.error)throw r.error;
 const personByStudent=new Map(students.map(s=>[s.studentRowId,s.id]));
 const yearById=new Map<string,string>(((yearsResult.data??[]) as Array<{id:string;code:string}>).map(y=>[y.id,y.code]));
 const eventById=new Map<string,string>(((eventsCatalogResult.data??[]) as Array<{id:string;title:string}>).map(e=>[e.id,e.title]));
 const annual:import('./model').AnnualMap={};const events:import('./model').EventMap={};
 for(const item of yearlyResult.data??[]){const person=personByStudent.get(item.student_id),year=yearById.get(item.year_id);if(person&&year)annual[`${person}|${year}`]={intentCode:item.intent_code||'',registrationSource:item.registration_source??null,registeredOn:item.registered_on??null}}
 for(const item of eventRowsResult.data??[]){const person=personByStudent.get(item.student_id),title=eventById.get(item.event_id);if(person&&title){events[person]??={};events[person][title]={intent:item.intent??'',actual:item.actual??''}}}
 const nucleusById=new Map<string,string>(((nucleiResult.data??[]) as Array<{id:string;name:string}>).map(n=>[n.id,n.name]));
 for(const assignment of assignsResult.data??[]){if(assignment.kind!=='primary')continue;const person=personByStudent.get(assignment.student_id);if(!person)continue;const s=students.find(x=>x.id===person);if(s)s.nucleus1=nucleusById.get(assignment.nucleus_id)??'';}
 const registrations:RegistrationEventEntry[]=(registrationEventsResult.data??[]).flatMap(r=>{const studentId=personByStudent.get(r.student_id),year=yearById.get(r.year_id);return studentId&&year?[{id:r.id,studentId,year,source:r.source,date:r.registered_on,studentYearAtRegistration:r.year_code_at_event||'—'}]:[]});
 return {annual,events,registrations};
}
export async function setAnnualIntent(student:DbStudent,year:string,value:string):Promise<void>{
 if(!supabase)throw Error('Δεν υπάρχει βάση');
 const {error}=await supabase.rpc('organotiko_set_annual_intent',{p_student_id:student.studentRowId,p_school_year:year,p_intent:value});
 if(error)throw error;
}
export async function setHistoryEvent(student:DbStudent,eventCode:string,which:'intent'|'actual',value:string):Promise<void>{
 if(!supabase)throw Error('Δεν υπάρχει βάση');
 const {error}=await supabase.rpc('organotiko_set_event_value',{p_student_id:student.studentRowId,p_event_code:eventCode,p_which:which,p_value:value});
 if(error)throw error;
}
export async function setPrimaryNucleus(student:DbStudent,nucleusName:string):Promise<void>{
 if(!supabase)throw Error('Δεν υπάρχει βάση');
 const {error}=await supabase.rpc('organotiko_set_primary_nucleus',{p_student_id:student.studentRowId,p_nucleus_name:nucleusName});
 if(error)throw error;
}
