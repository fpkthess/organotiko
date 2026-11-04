import { normalize, type Student } from './students.ts';
export interface RegistrationYear {id:string;label:string;startsOn:string;endsOn:string;sourceCodes:string[]}
export interface RegistrationPeriod {id:string;yearId:string;label:string;startsOn:string;endsOn:string;skipSundays:boolean}
export interface AnnualIntention {studentId:string;yearId:string;value:''|'1'|'2'|'3'}
export interface RegistrationEntry {
 id:string;studentId:string;personId:string;yearId:string;periodId:string;date:string;source:string;intention:string;revision:number;
 snapshot:{surname:string;name:string;department:string;year:string;nucleus:string;status:Student['status']};
}
export interface RegistrationEvent {id:string;at:string;studentId?:string;subject:string;action:string;before:string;after:string;reason:string}
export interface RegistrationState {currentYearId:string;years:RegistrationYear[];periods:RegistrationPeriod[];intentions:AnnualIntention[];entries:RegistrationEntry[];history:RegistrationEvent[]}
export function validCalendarDate(value:string):boolean {return /^\d{4}-\d{2}-\d{2}$/u.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;}
function history(state:RegistrationState,id:string,at:string,action:string,subject:string,before:string,after:string,reason:string,studentId?:string):RegistrationState {
 return {...state,history:[{id,at,studentId,subject,action,before,after,reason},...state.history]};
}
function requiredReason(reason:string){if(!reason.trim())throw new Error('Συμπληρώστε αιτιολογία.');return reason.trim();}
function activeStudent(rows:Student[],id:string){const row=rows.find(r=>r.id===id);if(!row||row.status!=='active')throw new Error('Επιλέξτε ενεργή φοιτητική καρτέλα.');return row;}
export function createRegistrationYear(state:RegistrationState,year:RegistrationYear,at:string):RegistrationState {
 if(state.years.some(y=>y.id===year.id||normalize(y.label)===normalize(year.label.trim())))throw new Error('Το έτος υπάρχει ήδη.');
 const sourceCodes=year.sourceCodes.map(s=>s.trim());
 if(!year.label.trim()||!validCalendarDate(year.startsOn)||!validCalendarDate(year.endsOn)||year.startsOn>year.endsOn||!sourceCodes.length||sourceCodes.some(s=>!s)||new Set(sourceCodes).size!==sourceCodes.length)throw new Error('Ελέγξτε όνομα έτους, ημερομηνίες και διαφορετικούς κωδικούς πηγής.');
 // Creating a year neither advances academic codes nor changes current membership.
 return history({...state,years:[...state.years,{...year,label:normalize(year.label.trim()),sourceCodes}]},year.id,at,'ΝΕΟ ΕΤΟΣ ΕΓΓΡΑΦΩΝ',year.label,'',year.label,'ΚΕΝΟ ΕΤΟΣ · ΧΩΡΙΣ ΠΡΟΑΓΩΓΗ');
}
export function createRegistrationPeriod(state:RegistrationState,period:RegistrationPeriod,at:string):RegistrationState {
 const year=state.years.find(y=>y.id===period.yearId);
 if(!year||!period.label.trim()||!validCalendarDate(period.startsOn)||!validCalendarDate(period.endsOn)||period.startsOn>period.endsOn||period.startsOn<year.startsOn||period.endsOn>year.endsOn)throw new Error('Η περίοδος πρέπει να βρίσκεται μέσα στις ημερομηνίες του έτους.');
 if(state.periods.some(p=>p.id===period.id||p.yearId===period.yearId&&normalize(p.label)===normalize(period.label.trim())))throw new Error('Η περίοδος υπάρχει ήδη.');
 return history({...state,periods:[...state.periods,{...period,label:normalize(period.label.trim())}]},period.id,at,'ΝΕΑ ΠΕΡΙΟΔΟΣ',period.label,'',`${period.startsOn} — ${period.endsOn}`,'ΧΕΙΡΟΚΙΝΗΤΟΣ ΟΡΙΣΜΟΣ');
}
export function entryFor(state:RegistrationState,personId:string,yearId:string){return state.entries.find(e=>e.personId===personId&&e.yearId===yearId);}
export function annualIntention(state:RegistrationState,studentId:string,yearId:string):AnnualIntention['value']{return state.intentions.find(i=>i.studentId===studentId&&i.yearId===yearId)?.value||'';}
export function saveAnnualIntention(state:RegistrationState,rows:Student[],studentId:string,yearId:string,expected:string,value:AnnualIntention['value'],id:string,at:string):RegistrationState {
 const row=activeStudent(rows,studentId);
 if(yearId!==state.currentYearId)throw new Error('Οι προθέσεις αλλάζουν μόνο στο τρέχον έτος εγγραφών.');
 if(entryFor(state,row.personId,yearId))throw new Error('Υπάρχει πραγματική εγγραφή. Η πρόθεση διατηρείται στο ιστορικό.');
 if(!['','1','2','3'].includes(value)||annualIntention(state,studentId,yearId)!==expected)throw new Error('Η πρόθεση άλλαξε ή η τιμή δεν είναι έγκυρη.');
 if(value===expected)return state;
 return history({...state,intentions:[...state.intentions.filter(i=>i.studentId!==studentId||i.yearId!==yearId),{studentId,yearId,value}]},id,at,'ΠΡΟΘΕΣΗ ΕΓΓΡΑΦΗΣ',`${row.surname} ${row.name}`,expected,value,'',studentId);
}
function validateRegistration(state:RegistrationState,yearId:string,periodId:string,date:string,source:string){
 const year=state.years.find(y=>y.id===yearId),period=state.periods.find(p=>p.id===periodId&&p.yearId===yearId);
 if(!year||!period||!validCalendarDate(date)||date<period.startsOn||date>period.endsOn||!year.sourceCodes.includes(source))throw new Error('Επιλέξτε περίοδο, ημερομηνία εντός περιόδου και επιτρεπόμενη πηγή.');
 if(period.skipSundays&&new Date(date+'T00:00:00Z').getUTCDay()===0)throw new Error('Η επιλεγμένη περίοδος δεν δέχεται εγγραφές Κυριακή.');
}
export function recordRegistration(state:RegistrationState,rows:Student[],studentId:string,periodId:string,date:string,source:string,id:string,at:string){
 const row=activeStudent(rows,studentId),yearId=state.currentYearId;
 validateRegistration(state,yearId,periodId,date,source);
 if(entryFor(state,row.personId,yearId)||state.entries.some(e=>e.id===id))throw new Error('Υπάρχει ήδη εγγραφή αυτού του προσώπου για το έτος. Χρησιμοποιήστε διόρθωση.');
 const entry:RegistrationEntry={id,studentId,personId:row.personId,yearId,periodId,date,source,intention:annualIntention(state,studentId,yearId),revision:1,snapshot:{surname:row.surname,name:row.name,department:row.department,year:row.year,nucleus:row.nucleus,status:row.status}};
 let next=history({...state,entries:[...state.entries,entry]},id,at,'ΠΡΑΓΜΑΤΙΚΗ ΕΓΓΡΑΦΗ',`${row.surname} ${row.name}`,'',`${date} · ${source}`,'ΚΑΤΑΧΩΡΙΣΗ ΕΤΟΥΣ',studentId);
 if(!row.efRegistered)next=history(next,`${id}:membership`,at,'ΙΔΙΟΤΗΤΑ ΜΕΣΩ ΕΓΓΡΑΦΗΣ',`${row.surname} ${row.name}`,'ΟΧΙ','ΝΑΙ',`ΕΓΓΡΑΦΗ ${id}`,studentId);
 return {state:next,rows:rows.map(r=>r.id===studentId?{...r,efRegistered:true}:r)};
}
export function correctRegistration(state:RegistrationState,id:string,expectedRevision:number,periodId:string,date:string,source:string,reason:string,eventId:string,at:string):RegistrationState {
 const entry=state.entries.find(e=>e.id===id);reason=requiredReason(reason);
 if(!entry||entry.revision!==expectedRevision)throw new Error('Η εγγραφή άλλαξε. Φορτώστε ξανά τα στοιχεία.');
 validateRegistration(state,entry.yearId,periodId,date,source);
 if(entry.periodId===periodId&&entry.date===date&&entry.source===source)return state;
 return history({...state,entries:state.entries.map(e=>e.id===id?{...e,periodId,date,source,revision:e.revision+1}:e)},eventId,at,'ΔΙΟΡΘΩΣΗ ΕΓΓΡΑΦΗΣ',`${entry.snapshot.surname} ${entry.snapshot.name}`,`${entry.date} · ${entry.source} · ${entry.periodId}`,`${date} · ${source} · ${periodId}`,reason,entry.studentId);
}
export function setAssociationMembership(state:RegistrationState,rows:Student[],studentId:string,expected:boolean,value:boolean,reason:string,id:string,at:string){
 const row=activeStudent(rows,studentId);reason=requiredReason(reason);
 if(row.efRegistered!==expected)throw new Error('Η ιδιότητα ΕΦΕΚΘ άλλαξε. Φορτώστε ξανά την καρτέλα.');
 if(expected===value)return {state,rows};
 return {rows:rows.map(r=>r.id===studentId?{...r,efRegistered:value}:r),state:history(state,id,at,'ΑΝΕΞΑΡΤΗΤΗ ΙΔΙΟΤΗΤΑ ΕΦΕΚΘ',`${row.surname} ${row.name}`,expected?'ΝΑΙ':'ΟΧΙ',value?'ΝΑΙ':'ΟΧΙ',reason,studentId)};
}
export function projectAnnualRegistrations(rows:Student[],state:RegistrationState):Student[] {
 return rows.map(row=>{const entry=entryFor(state,row.personId,state.currentYearId),intention=annualIntention(state,row.id,state.currentYearId);return {...row,annualRegistration:entry?.source||intention,registrationIntention:intention,registrationDate:entry?.date||''};});
}
export function registrationStats(state:RegistrationState,yearId:string,periodId?:string){
 const entries=state.entries.filter(e=>e.yearId===yearId&&(!periodId||e.periodId===periodId));
 const byDate=new Map<string,number>(),bySource=new Map<string,number>();
 for(const entry of entries){byDate.set(entry.date,(byDate.get(entry.date)||0)+1);bySource.set(entry.source,(bySource.get(entry.source)||0)+1);}
 const period=periodId?state.periods.find(p=>p.id===periodId&&p.yearId===yearId):undefined;
 if(period){for(let date=period.startsOn;date<=period.endsOn;date=new Date(Date.parse(date+'T00:00:00Z')+86400000).toISOString().slice(0,10)){if(!byDate.has(date))byDate.set(date,0);}}
 let cumulative=0;
 return {total:entries.length,daily:[...byDate].sort(([a],[b])=>a.localeCompare(b)).map(([date,count])=>({date,count,cumulative:cumulative+=count})),sources:[...bySource].map(([source,count])=>({source,count}))};
}
export function syntheticRegistrations(rows:Student[]):RegistrationState {
 const sources=['+','ψ2','ψ3','ψ4','ψ5','μ'];
 const state:RegistrationState={currentYearId:'demo-reg-2026',years:[{id:'demo-reg-2025',label:'2025 / 26 · ΔΟΚΙΜΗ',startsOn:'2025-09-01',endsOn:'2026-08-31',sourceCodes:sources},{id:'demo-reg-2026',label:'2026 / 27 · ΔΟΚΙΜΗ',startsOn:'2026-09-01',endsOn:'2027-08-31',sourceCodes:sources}],periods:[{id:'demo-period-2025',yearId:'demo-reg-2025',label:'ΣΥΝΘΕΤΙΚΗ ΠΕΡΙΟΔΟΣ 2025',startsOn:'2025-10-01',endsOn:'2025-10-07',skipSundays:false},{id:'demo-period-2026',yearId:'demo-reg-2026',label:'ΣΥΝΘΕΤΙΚΗ ΠΕΡΙΟΔΟΣ ΝΟΕΜΒΡΙΟΥ',startsOn:'2026-11-01',endsOn:'2026-11-07',skipSundays:false}],intentions:[],entries:[],history:[]};
 rows.forEach((row,i)=>{if(row.efRegistered&&i%2===0){const old=i%4===0;const yearId=old?'demo-reg-2025':'demo-reg-2026',date=old?'2025-10-03':`2026-11-0${i%3+1}`;state.entries.push({id:`demo-registration-${i}`,studentId:row.id,personId:row.personId,yearId,periodId:old?'demo-period-2025':'demo-period-2026',date,source:sources[i%sources.length],intention:'',revision:1,snapshot:{surname:row.surname,name:row.name,department:row.department,year:row.year,nucleus:row.nucleus,status:row.status}});}});
 return state;
}
