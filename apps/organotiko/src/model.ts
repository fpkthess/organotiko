import type {Student} from '@organotiko/domain';
import {normalized} from '@organotiko/domain';

export type Annual = {intentCode:string; registrationSource:string|null; registeredOn:string|null};
export type AnnualMap = Record<string,Annual>;
export type EventRecord = {intent:string; actual:string; attended?:boolean};
export type EventMap = Record<string,Record<string,EventRecord>>;
export type EventDefinition = {id:string;title:string;kind:string;yearId?:string;date?:string};
export type FilterMode = 'values'|'contains'|'begins'|'ends'|'equals'|'not_contains'|'empty'|'not_empty';
export type ColumnFilter = {mode:FilterMode; query:string; values:string[]};
export type Filters = Record<string,ColumnFilter>;
export type Column = {key:string; label:string; kind:'text'|'boolean'|'select'|'annual'|'history'|'note'|'protected'; width:number; show:boolean; editable?:boolean};
export type StudentProfileData={student:Student; annual:AnnualMap; events:EventMap};

export const fieldLabels:Record<string,string>={
  surname:'ΕΠΙΘΕΤΟ',name:'ΟΝΟΜΑ',nucleus1:'ΠΥΡΗΝΑΣ1',nucleus2:'ΠΥΡΗΝΑΣ2',yearCode:'ΕΤΟΣ',department:'ΤΜΗΜΑ',university:'ΠΑΝΕΠΙΣΤΗΜΙΟ',
  efRegistered:'ΕΦΕΚΘ',member:'ΜΕΛΟΣ',cadre:'ΣΤΕΛΕΧΟΣ',bluepass:'BLUEPASS',phoneCy:'ΚΙΝΗΤΟ CY',phoneGr:'ΚΙΝΗΤΟ GR',entryYear:'ΕΙΣΔΟΧΗ',
  uniqueNumber:'ΜΟΝΑΔΙΚΟΣ',adt:'ΑΔΤ',notes:'ΠΛΗΡΟΦΟΡΙΕΣ',location:'ΠΟΛΗ-ΧΩΡΙΟ',partyMember:'ΜΕΛΟΣ ΔΗΣΥ',partyCharacterization:'ΧΑΡΑΚΤΗΡΙΣΜΟΣ ΔΗΣΥ',
  electoralArea:'ΕΚΛΟΓΙΚΗ ΠΕΡΙΦΕΡΕΙΑ',meeting26:'ΣΥΝΑΝΤΗΣΗ 26'
};
const core:(Omit<Column,'width'|'show'> & {width?:number;show?:boolean})[]=[
  {key:'surname',label:'ΕΠΙΘΕΤΟ',kind:'text',editable:true,width:172,show:true},
  {key:'name',label:'ΟΝΟΜΑ',kind:'text',editable:true,width:158,show:true},
  {key:'nucleus1',label:'ΠΥΡΗΝΑΣ1',kind:'select',editable:true,width:180,show:true},
  {key:'yearCode',label:'ΕΤΟΣ',kind:'text',editable:true,width:94,show:true},
  {key:'department',label:'ΤΜΗΜΑ',kind:'select',editable:true,width:190,show:true},
  {key:'university',label:'ΠΑΝΕΠΙΣΤΗΜΙΟ',kind:'select',editable:true,width:176,show:true},
  {key:'efRegistered',label:'ΕΦΕΚΘ',kind:'boolean',editable:true,width:96,show:true},
  {key:'reg:2026-27',label:'ΕΓΓΡΑΦΕΣ 26-27',kind:'annual',editable:true,width:152,show:true},
  {key:'member',label:'ΜΕΛΟΣ',kind:'boolean',width:95,show:true},
  {key:'cadre',label:'ΣΤΕΛΕΧΟΣ',kind:'boolean',editable:true,width:108,show:true},
  {key:'bluepass',label:'BLUEPASS',kind:'boolean',width:108,show:true},
  {key:'nucleus2',label:'ΠΥΡΗΝΑΣ2',kind:'text',editable:true,width:156,show:false},
  {key:'phoneCy',label:'ΚΙΝΗΤΟ CY',kind:'text',editable:true,width:145,show:false},
  {key:'phoneGr',label:'ΚΙΝΗΤΟ GR',kind:'text',editable:true,width:145,show:false},
  {key:'entryYear',label:'ΕΙΣΔΟΧΗ',kind:'text',editable:true,width:105,show:false},
  {key:'uniqueNumber',label:'ΜΟΝΑΔΙΚΟΣ',kind:'text',editable:true,width:122,show:false},
  {key:'adt',label:'ΑΔΤ',kind:'protected',editable:false,width:125,show:false},
  {key:'notes',label:'ΠΛΗΡΟΦΟΡΙΕΣ',kind:'note',editable:true,width:250,show:false},
  {key:'meeting26',label:'ΣΥΝΑΝΤΗΣΗ 26',kind:'boolean',width:130,show:false},
  {key:'location',label:'ΠΟΛΗ-ΧΩΡΙΟ',kind:'protected',width:145,show:false},
  {key:'partyMember',label:'ΜΕΛΟΣ ΔΗΣΥ',kind:'protected',width:145,show:false},
  {key:'partyCharacterization',label:'ΧΑΡΑΚΤΗΡΙΣΜΟΣ ΔΗΣΥ',kind:'protected',width:150,show:false},
  {key:'electoralArea',label:'ΕΚΛΟΓΙΚΗ ΠΕΡΙΦΕΡΕΙΑ',kind:'protected',width:175,show:false}
 ];
export const legacyYears=['2025-26','2024-25','2023-24'];
export const legacyEvents=['ΕΚΛ26','ΒΓΣ26','ΑΓΣ25','ΕΚΛ25','ΒΓΣ25','ΑΓΣ24','ΕΚΛ24-2','ΕΚΛ24-1','ΒΓΣ24','ΑΓΣ23'];
export const historicalNotes=['26-27','25-26','24-25','23-24','22-23','21-22'];
export function columnsForYear(year:string):Column[]{
 const annualCore=core.map(c=>c.key==='reg:2026-27'?{...c,key:`reg:${year}`,label:`ΕΓΓΡΑΦΕΣ ${year.slice(2)}`}:{...c});
 const yearly=legacyYears.filter(y=>y!==year).map(y=>({key:`reg:${y}`,label:`ΕΓΓΡΑΦΕΣ ${y}`,kind:'annual' as const,width:150,show:false,editable:true}));
 const events=legacyEvents.flatMap(e=>[
  {key:`event:${e}:intent`,label:`Π ${e}`,kind:'history' as const,width:105,show:false,editable:true},
  {key:`event:${e}:actual`,label:e,kind:'history' as const,width:105,show:false,editable:true}
 ]);
 const notes=historicalNotes.map(y=>({key:`note:${y}`,label:`ΠΛΗΡΟΦΟΡΙΕΣ ${y}`,kind:'protected' as const,width:215,show:false,editable:false}));
 return [...annualCore,...yearly,...events,...notes].map(c=>({...c,width:c.width??130,show:c.show??false}));
}
export function annualKey(studentId:string,year:string){return `${studentId}|${year}`;}
export function cellValue(s:Student,col:Column,annual:AnnualMap,events:EventMap):string{
 if(col.key.startsWith('reg:')){
  const v=annual[annualKey(s.id,col.key.slice(4))];return v?.registrationSource??v?.intentCode??'';
 }
 if(col.key.startsWith('event:')){
  const m=/^event:(.*):(intent|actual)$/.exec(col.key);return m?events[s.id]?.[m[1]]?.[m[2] as 'intent'|'actual']??'':'';
 }
 if(col.key.startsWith('note:'))return '';
 if(col.kind==='boolean')return s[col.key as keyof Student]?'ΝΑΙ':'ΟΧΙ';
 return String(s[col.key as keyof Student]??'');
}
export function matchesColumnFilter(value:string,filter:ColumnFilter|undefined):boolean{
 if(!filter)return true;
 const v=normalized(value),q=normalized(filter.query);
 switch(filter.mode){
  case 'contains':return v.includes(q);
  case 'begins':return v.startsWith(q);
  case 'ends':return v.endsWith(q);
  case 'equals':return v===q;
  case 'not_contains':return !v.includes(q);
  case 'empty':return !v;
  case 'not_empty':return Boolean(v);
  default:return filter.values.length===0||filter.values.some(x=>normalized(x)===v);
 }
}
export const GLOBAL_SEARCH_KEYS:(keyof Student)[]=['surname','name','department','university','yearCode','nucleus1','nucleus2','phoneCy','phoneGr','uniqueNumber','entryYear'];
export function matchesGlobal(s:Student,query:string):boolean{
 const terms=normalized(query).split(/\s+/).filter(Boolean);
 if(!terms.length)return true;
 const haystack=GLOBAL_SEARCH_KEYS.map(k=>String(s[k]??'')).join(' ')+' '+s.surname+' '+s.name;
 return terms.every(term=>normalized(haystack).includes(term));
}
export function filterStudents(rows:Student[],filters:Filters,quick:string,columns:Column[],annual:AnnualMap,events:EventMap):Student[]{
 const byKey=new Map(columns.map(c=>[c.key,c]));
 return rows.filter(s=>matchesGlobal(s,quick)&&Object.entries(filters).every(([key,f])=>{
  const col=byKey.get(key);return col?matchesColumnFilter(cellValue(s,col,annual,events),f):true;
 }));
}
