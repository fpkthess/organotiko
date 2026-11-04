import { emptyFilters, filterFields, matchesFilters, type FilterGroup } from './filters.ts';
import { projectNuclei, type NucleusState } from './nuclei.ts';
import { normalize, operational, type Student } from './students.ts';
export const reportColumns = [
  {key:'surname',label:'ΕΠΩΝΥΜΟ'}, {key:'name',label:'ΟΝΟΜΑ'},
  {key:'department',label:'ΤΜΗΜΑ'}, {key:'year',label:'ΕΤΟΣ'},
  {key:'efRegistered',label:'ΕΦΕΚΘ'}, {key:'annualRegistration',label:'ΕΤΗΣΙΑ ΕΓΓΡΑΦΗ'}, {key:'registrationDate',label:'ΗΜΕΡΟΜΗΝΙΑ ΕΓΓΡΑΦΗΣ'}, {key:'nucleus',label:'ΠΡΩΤΕΥΩΝ ΠΥΡΗΝΑΣ'},
  {key:'secondaryNucleus',label:'ΔΕΥΤΕΡΕΥΩΝ ΠΥΡΗΝΑΣ'},
  {key:'protoporia',label:'ΠΡΩΤΟΠΟΡΙΑ'}, {key:'bluepass',label:'BLUEPASS'}, {key:'notes',label:'ΠΛΗΡΟΦΟΡΙΕΣ'},
] as const;
export type ReportColumn = typeof reportColumns[number]['key'];
export interface ReportOptions {
  title:string; kind:'students'|'nuclei'; allNuclei:boolean; nucleusIds:string[];
  assignmentScope:'primary'|'secondary'|'both'; filters:FilterGroup; columns:ReportColumn[];
  sortBy:ReportColumn; ascending:boolean; includeEmpty:boolean;
}
export interface ReportSection {
  id:string; title:string; category:string; manager:string; placeholder:boolean;
  students:Student[]; registered:number; unregistered:number;
}
export interface ReportSnapshot {
  id:string; generatedAt:string; options:ReportOptions; sections:ReportSection[];
  uniqueStudents:number; totalRows:number;
}
export interface ReportTemplate {id:string; name:string; version:1; options:ReportOptions}
export function defaultReportOptions():ReportOptions {
  return {title:'ΚΑΤΑΣΤΑΣΗ ΧΡΕΩΣΗΣ ΠΥΡΗΝΩΝ',kind:'nuclei',allNuclei:true,nucleusIds:[],assignmentScope:'primary',filters:emptyFilters(),columns:['surname','name','department','year','efRegistered','notes'],sortBy:'surname',ascending:true,includeEmpty:true};
}
export function isReportOptions(value:unknown):value is ReportOptions {
  if(!value||typeof value!=='object')return false;
  const v=value as Record<string,unknown>;
  const keys=reportColumns.map(c=>c.key) as string[];
  if(typeof v.title!=='string'||!v.title.trim()||v.title.length>120||!['students','nuclei'].includes(String(v.kind))||typeof v.allNuclei!=='boolean'||!Array.isArray(v.nucleusIds)||!v.nucleusIds.every(x=>typeof x==='string')||!['primary','secondary','both'].includes(String(v.assignmentScope))||typeof v.ascending!=='boolean'||typeof v.includeEmpty!=='boolean'||!keys.includes(String(v.sortBy)))return false;
  if(!Array.isArray(v.columns)||!v.columns.length||!v.columns.every(k=>keys.includes(String(k)))||new Set(v.columns).size!==v.columns.length)return false;
  const f=v.filters as FilterGroup|undefined;
  return !!f&&['all','any'].includes(f.mode)&&Array.isArray(f.rules)&&f.rules.every(r=>{
    if(!r||typeof r.id!=='string'||typeof r.value!=='string')return false;
    const field=filterFields.find(x=>x[0]===r.field);
    if(!field)return false;
    return field[2]==='boolean'?['equals','notEquals'].includes(r.operator)&&['true','false'].includes(r.value):['contains','equals','notEquals','empty','notEmpty'].includes(r.operator);
  });
}
export function parseReportTemplates(value:unknown):ReportTemplate[] {
  if(!Array.isArray(value))return [];
  return value.filter((v):v is ReportTemplate=>!!v&&typeof v==='object'&&typeof v.id==='string'&&typeof v.name==='string'&&!!v.name.trim()&&v.version===1&&isReportOptions(v.options));
}
export function buildReport(rows:Student[],state:NucleusState,options:ReportOptions,id:string,at:string):ReportSnapshot {
  if(!isReportOptions(options))throw new Error('Ελέγξτε τίτλο, στήλες και φίλτρα αναφοράς.');
  if(!Number.isFinite(Date.parse(at)))throw new Error('Μη έγκυρη ημερομηνία αναφοράς.');
  const students=operational(projectNuclei(rows,state)).filter(r=>matchesFilters(r,options.filters));
  function section(id:string,title:string,category:string,manager:string,placeholder:boolean,selected:Student[]):ReportSection {
    const sorted=[...selected].sort((a,b)=>{
      const compare=normalize(String(a[options.sortBy]??'')).localeCompare(normalize(String(b[options.sortBy]??'')),'el');
      return (compare||a.surname.localeCompare(b.surname,'el')||a.name.localeCompare(b.name,'el')||a.id.localeCompare(b.id))*(options.ascending?1:-1);
    });
    return {id,title,category,manager,placeholder,students:structuredClone(sorted),registered:selected.filter(r=>r.efRegistered).length,unregistered:selected.filter(r=>!r.efRegistered).length};
  }
  let sections:ReportSection[];
  if(options.kind==='students')sections=[section('students','ΦΟΙΤΗΤΙΚΕΣ ΕΓΓΡΑΦΕΣ','','',false,students)];
  else {
    if(!options.allNuclei&&(!options.nucleusIds.length||options.nucleusIds.some(id=>!state.nuclei.some(n=>n.id===id))))throw new Error('Επιλέξτε υπαρκτούς πυρήνες για την αναφορά.');
    const nuclei=state.nuclei.filter(n=>options.allNuclei||options.nucleusIds.includes(n.id));
    if(!nuclei.length)throw new Error('Δεν υπάρχουν πυρήνες για την αναφορά.');
    sections=nuclei.map(n=>{
      const ids=new Set(state.assignments.filter(a=>!a.endedAt&&a.nucleusId===n.id&&(options.assignmentScope==='both'||a.kind===options.assignmentScope)).map(a=>a.studentId));
      const manager=state.people.find(p=>p.id===state.managers.find(m=>m.nucleusId===n.id&&!m.endedAt)?.personId);
      return section(n.id,n.name,state.categories.find(c=>c.id===n.categoryId)?.name||'',manager?`${manager.name}${manager.active?'':' · ΑΝΕΝΕΡΓΟΣ'}`:'ΧΩΡΙΣ ΥΠΕΥΘΥΝΟ',n.placeholder,students.filter(r=>ids.has(r.id)));
    }).filter(s=>options.includeEmpty||s.students.length>0);
  }
  return {id,generatedAt:at,options:structuredClone(options),sections,uniqueStudents:new Set(sections.flatMap(s=>s.students.map(r=>r.id))).size,totalRows:sections.reduce((sum,s)=>sum+s.students.length,0)};
}
export function reportCell(student:Student,column:ReportColumn):string {
  const value=student[column];return typeof value==='boolean'?value?'ΝΑΙ':'ΟΧΙ':value||'—';
}
export function reportCsv(snapshot:ReportSnapshot):string {
  const quote=(value:string)=>{const safe=/^[\s]*[=+@\-]/u.test(value)||/^[\t\r]/u.test(value)?"'"+value:value;return '"'+safe.replaceAll('"','""')+'"';};
  const data=[['ΕΝΟΤΗΤΑ','ΚΑΤΗΓΟΡΙΑ','ΥΠΕΥΘΥΝΟΣ',...snapshot.options.columns.map(k=>reportColumns.find(c=>c.key===k)!.label)],
    ...snapshot.sections.flatMap(section=>section.students.map(row=>[section.title,section.category,section.manager,...snapshot.options.columns.map(k=>reportCell(row,k))]))];
  return '\uFEFF'+data.map(row=>row.map(quote).join(';')).join('\r\n');
}
