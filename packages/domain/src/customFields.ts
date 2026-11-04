import { normalize, type Student } from './students.ts';
export type CustomValue=string|number|boolean|null;
export type CustomFieldType='text'|'number'|'date'|'boolean'|'select';
export interface CustomField {id:string;label:string;type:CustomFieldType;options:string[];preserveCase:boolean;editable:boolean;retired:boolean}
export interface CustomValueRecord {studentId:string;fieldId:string;value:CustomValue}
export interface CustomFieldEvent {id:string;studentId?:string;fieldId:string;label:string;before:CustomValue;after:CustomValue;at:string;action:'definition'|'value';reason:string}
export interface CustomFieldState {definitions:CustomField[];values:CustomValueRecord[];history:CustomFieldEvent[]}
export function initialCustomFields():CustomFieldState {return {definitions:[{id:'demo-field-address',label:'ΔΙΕΥΘΥΝΣΗ',type:'text',options:[],preserveCase:false,editable:true,retired:false},{id:'demo-field-instagram',label:'INSTAGRAM',type:'text',options:[],preserveCase:true,editable:true,retired:false}],values:[],history:[]};}
export function defineCustomField(state:CustomFieldState,field:CustomField,eventId:string,at:string):CustomFieldState {
  const label=normalize(field.label.trim());
  if(!label||label.length>80)throw new Error('Συμπληρώστε όνομα πεδίου έως 80 χαρακτήρες.');
  if(!field.id||!['text','number','date','boolean','select'].includes(field.type))throw new Error('Μη έγκυρος τύπος πεδίου.');
  if(state.definitions.some(f=>f.id!==field.id&&normalize(f.label)===label))throw new Error('Υπάρχει ήδη πεδίο με αυτό το όνομα.');
  const current=state.definitions.find(f=>f.id===field.id);
  if(current&&(current.type!==field.type||current.preserveCase!==field.preserveCase||JSON.stringify(current.options)!==JSON.stringify(field.options)))throw new Error('Ο τύπος και οι κανόνες τιμών παραμένουν σταθεροί. Δημιουργήστε νέο πεδίο για διαφορετική δομή.');
  const options=field.type==='select'?field.options.map(x=>normalize(x.trim())):[];
  if(field.type==='select'&&(!options.length||options.some(x=>!x)||new Set(options).size!==options.length))throw new Error('Δώστε διαφορετικές, μη κενές επιλογές.');
  const next={...field,label,options};
  return {...state,definitions:current?state.definitions.map(f=>f.id===field.id?next:f):[...state.definitions,next],history:[{id:eventId,fieldId:field.id,label,before:current?`${current.label} · ${current.retired?'ΑΠΟΣΥΡΜΕΝΟ':'ΕΝΕΡΓΟ'} · ${current.editable?'ΕΠΕΞΕΡΓΑΣΙΜΟ':'ΑΝΑΓΝΩΣΗ'}`:null,after:`${label} · ${field.retired?'ΑΠΟΣΥΡΜΕΝΟ':'ΕΝΕΡΓΟ'} · ${field.editable?'ΕΠΕΞΕΡΓΑΣΙΜΟ':'ΑΝΑΓΝΩΣΗ'}`,at,action:'definition',reason:'ΤΟΠΙΚΗ ΡΥΘΜΙΣΗ ΠΕΔΙΟΥ'},...state.history]};
}
export function parseCustomValue(field:CustomField,input:string):CustomValue {
  const value=input.trim();if(!value)return null;
  switch(field.type){
    case 'text':if(value.length>2000)throw new Error('Το κείμενο υπερβαίνει τους 2000 χαρακτήρες.');return field.preserveCase?value:normalize(value);
    case 'number':{const numeric=value.replace(',','.');if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/u.test(numeric)||!Number.isFinite(Number(numeric)))throw new Error('Δώστε έγκυρο αριθμό.');return Number(numeric);}
    case 'date':if(!/^\d{4}-\d{2}-\d{2}$/u.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw new Error('Δώστε υπαρκτή ημερομηνία.');return value;
    case 'boolean':if(!['true','false'].includes(value))throw new Error('Επιλέξτε ΝΑΙ ή ΟΧΙ.');return value==='true';
    case 'select':{const choice=normalize(value);if(!field.options.includes(choice))throw new Error('Επιλέξτε επιτρεπόμενη τιμή.');return choice;}
  }
}
export function customValue(state:CustomFieldState,studentId:string,fieldId:string):CustomValue {return state.values.find(v=>v.studentId===studentId&&v.fieldId===fieldId)?.value??null;}
export function saveCustomValue(state:CustomFieldState,rows:Student[],studentId:string,fieldId:string,expected:CustomValue,input:string,eventId:string,at:string):CustomFieldState {
  const field=state.definitions.find(f=>f.id===fieldId);
  if(!field||field.retired||!field.editable)throw new Error('Το πεδίο δεν επιτρέπει αλλαγές.');
  if(!rows.some(r=>r.id===studentId&&r.status==='active'))throw new Error('Η καρτέλα δεν είναι ενεργή.');
  const before=customValue(state,studentId,fieldId);if(before!==expected)throw new Error('Η τιμή άλλαξε. Φορτώστε την τρέχουσα τιμή πριν αποθηκεύσετε.');
  const after=parseCustomValue(field,input);if(before===after)return state;
  return {...state,values:[...state.values.filter(v=>v.studentId!==studentId||v.fieldId!==fieldId),{studentId,fieldId,value:after}],history:[{id:eventId,studentId,fieldId,label:field.label,before,after,at,action:'value',reason:'ΤΟΠΙΚΗ ΚΑΡΤΕΛΑ'},...state.history]};
}
export function formatCustomValue(value:CustomValue):string {return value===null?'—':typeof value==='boolean'?value?'ΝΑΙ':'ΟΧΙ':String(value);}
export function studentGridCsv(rows:Student[],columns:(keyof Student)[],labels:string[],state:CustomFieldState,fieldIds:string[],includeRetired=false):string {
  const fields=state.definitions.filter(f=>fieldIds.includes(f.id)&&(includeRetired||!f.retired));
  const quote=(value:unknown)=>{let text=typeof value==='boolean'?value?'ΝΑΙ':'ΟΧΙ':String(value??'');if(/^[\s]*[=+@-]/u.test(text)||/^[\t\r]/u.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
  return '\uFEFF'+[[...labels,...fields.map(f=>f.label)],...rows.map(row=>[...columns.map(c=>row[c]),...fields.map(f=>customValue(state,row.id,f.id))])].map(row=>row.map(quote).join(';')).join('\r\n');
}
