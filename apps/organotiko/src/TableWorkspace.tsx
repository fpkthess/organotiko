import {useEffect,useMemo,useRef,useState} from 'react';
import type {KeyboardEvent,PointerEvent,FormEvent} from 'react';
import {ArrowDown,ArrowLeft,ArrowRight,ArrowUp,Columns3,Download,Expand,Filter,Minimize2,Plus,Search,SlidersHorizontal,UserRound, X} from 'lucide-react';
import type {Student} from '@organotiko/domain';
import {normalized} from '@organotiko/domain';
import {annualKey,cellValue,columnsForYear,filterStudents,fieldLabels} from './model';
import {saveCsv} from './csv';
import type {AnnualMap,EventMap,Column,ColumnFilter,Filters,FilterMode} from './model';

const filterModes:[FilterMode,string][]=[['values','Επιλογή τιμών'],['contains','Περιέχει'],['begins','Αρχίζει από'],['ends','Τελειώνει σε'],['equals','Είναι ακριβώς'],['not_contains','Δεν περιέχει'],['empty','Είναι κενό'],['not_empty','Δεν είναι κενό']];
const PAGE_SIZE=125;
const defaultFilter:ColumnFilter={mode:'values',query:'',values:[]};
type Props={students:Student[];annual:AnnualMap;events:EventMap;academicYear:string;
 onEdit:(s:Student,key:keyof Student,value:string|boolean)=>Promise<void>;
 onIntent:(s:Student,year:string,value:string)=>Promise<void>;
 onEvent:(s:Student,eventName:string,which:'intent'|'actual',value:string)=>Promise<void>;
 onRegister:(s:Student)=>void;onProfile:(s:Student)=>void;
 onAdd:(row:{surname:string;name:string;department:string;yearCode:string})=>Promise<void>;onNewStudent:()=>void;
 onSessionFromFilters?: (ids:string[],filters:Filters)=>void;
 setStatus:(status:string)=>void;
};
function Cell({student,col,annual,events,year,nav,commit,intent,event,onRegister,onProfile,index,columnIndex}: {
 student:Student;col:Column;annual:AnnualMap;events:EventMap;year:string;nav:(ev:KeyboardEvent<HTMLElement>)=>void;
 commit:Props['onEdit'];intent:Props['onIntent'];event:Props['onEvent'];onRegister:Props['onRegister'];onProfile:Props['onProfile'];index:number;columnIndex:number;
}){
 const raw=cellValue(student,col,annual,events);const [draft,setDraft]=useState(raw);const [editing,setEditing]=useState(false);
 useEffect(()=>{if(!editing)setDraft(raw)},[raw,editing]);
 const dataset={ 'data-row':index,'data-col':columnIndex };
 const tdProps={className:'grid-cell',style:{width:col.width,minWidth:col.width,maxWidth:col.width}};
 const save=()=>{if(draft===raw)return;
   if(col.kind==='history'){const m=/^event:(.+):(intent|actual)$/.exec(col.key);if(m)void event(student,m[1],m[2] as 'intent'|'actual',draft).catch(()=>setDraft(raw));return;}
   if(col.editable && col.kind!=='protected' && col.kind!=='boolean' && !col.key.startsWith('reg:')) void commit(student,col.key as keyof Student,draft).catch(()=>setDraft(raw));
 };
 if(col.key.startsWith('reg:')){
  const y=col.key.slice(4);const row=annual[annualKey(student.id,y)];const source=row?.registrationSource??'';
  if(source)return <td {...tdProps}><button type="button" className="read-only-cell actual-source" {...dataset} onKeyDown={nav} onClick={()=>onProfile(student)} title="Πηγή εγγραφής — δείτε την καρτέλα">{source}</button></td>;
  if(student.efRegistered)return <td {...tdProps}><button type="button" className="read-only-cell" {...dataset} onKeyDown={nav} title="Εγγεγραμμένος στην ΕΦΕΚΘ· το ιστορικό είναι μόνο για ανάγνωση">{y!==year?(row?.intentCode||'—'):'—'}</button></td>;
  return <td {...tdProps}><select className="sheet-input" aria-label={`${col.label} ${student.surname}`} {...dataset} value={row?.intentCode??''} onKeyDown={nav} onChange={e=>void intent(student,y,e.target.value)}><option value="">—</option><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></td>;
 }
 if(col.kind==='boolean'){
  const editable=col.key==='efRegistered'||col.key==='cadre';
  return <td {...tdProps}><input type="checkbox" {...dataset} aria-label={`${col.label} ${student.surname}`} checked={Boolean(student[col.key as keyof Student])} disabled={!editable} onKeyDown={nav} onChange={e=>col.key==='efRegistered'?onRegister(student):void commit(student,col.key as keyof Student,e.target.checked)}/></td>;
 }
 if(col.kind==='history')return <td {...tdProps}><input type="text" {...dataset} className="sheet-input" title={col.label} value={draft} onFocus={()=>setEditing(true)} onKeyDown={nav} onChange={e=>setDraft(e.target.value)} onBlur={()=>{setEditing(false);save()}}/></td>;
 if(col.kind==='protected')return <td {...tdProps}><button type="button" {...dataset} className="read-only-cell" onKeyDown={nav} title="Προστατευμένο ή ιστορικό πεδίο · θα ενεργοποιηθεί μετά τον έλεγχο δεδομένων">{raw||'—'}</button></td>;
 return <td {...tdProps}><div className="grid-input-wrap"><input type="text" {...dataset} className="sheet-input" aria-label={`${col.label} ${student.surname}`} value={draft} onFocus={()=>setEditing(true)} onKeyDown={nav} onBlur={()=>{setEditing(false);save()}} onChange={e=>setDraft(e.target.value)} {...(col.kind==='select'?{list:col.key==='department'?'department-options':col.key==='university'?'university-options':'nucleus-options'}:{})}/>{col.key==='surname'&&<button className="profile-in-grid" type="button" title="Άνοιγμα καρτέλας" onClick={()=>onProfile(student)}><UserRound size={13}/></button>}</div></td>;
}
export default function TableWorkspace(props:Props){
 const {students,annual,events,academicYear,onEdit,onIntent,onEvent,onRegister,onProfile,onAdd,onNewStudent,setStatus,onSessionFromFilters}=props;
 const [columns,setColumns]=useState<Column[]>(()=>columnsForYear(academicYear));
 const [filters,setFilters]=useState<Filters>({});const [filterKey,setFilterKey]=useState<string|null>(null);
 const [filterLookup,setFilterLookup]=useState('');const [quick,setQuick]=useState('');const [columnsOpen,setColumnsOpen]=useState(false);
 const [sort,setSort]=useState<{key:string;descending:boolean}|null>(null);const [page,setPage]=useState(0);
 const [inline,setInline]=useState({surname:'',name:'',department:'',yearCode:'1'});
 const [isFullscreen,setIsFullscreen]=useState(false);
 const [viewName,setViewName]=useState('');const [savedViews,setSavedViews]=useState<Array<{name:string;columns:Column[];filters:Filters;quick:string}>>(()=>{
  try{const v=JSON.parse(localStorage.getItem('organotiko-grid-views-v1')||'[]');return Array.isArray(v)?v:[]}catch{return []}
 });
 const [viewsOpen,setViewsOpen]=useState(false);
 useEffect(()=>{const changed=()=>setIsFullscreen(document.fullscreenElement===ref.current);document.addEventListener('fullscreenchange',changed);return()=>document.removeEventListener('fullscreenchange',changed)},[]);
 function persistViews(items:typeof savedViews){setSavedViews(items);localStorage.setItem('organotiko-grid-views-v1',JSON.stringify(items))}
 function saveView(){const name=viewName.trim();if(!name)return;persistViews([...savedViews.filter(v=>v.name!==name),{name,columns:columns.map(c=>({...c})),filters:structuredClone(filters),quick}]);setViewName('');setViewsOpen(false);setStatus(`Αποθηκεύτηκε η προβολή «${name}» σε αυτόν τον browser.`)}
 function applyView(name:string){const item=savedViews.find(v=>v.name===name);if(!item)return;setColumns(item.columns);setFilters(item.filters);setQuick(item.quick);setPage(0);setViewsOpen(false)}
 
 const ref=useRef<HTMLElement>(null);const nextFocus=useRef<{row:number;col:number}|null>(null);
 useEffect(()=>{setColumns(old=>{
    const target=columnsForYear(academicYear);return target.map(c=>old.find(x=>x.key===c.key)?{...c,...old.find(x=>x.key===c.key)!}:c)
 })},[academicYear]);
 const shownColumns=useMemo(()=>columns.filter(c=>c.show),[columns]);
 const rows=useMemo(()=>{
  let result=filterStudents(students,filters,quick,columns,annual,events);
  if(sort){const c=columns.find(c=>c.key===sort.key);if(c)result=[...result].sort((a,b)=>normalized(cellValue(a,c,annual,events)).localeCompare(normalized(cellValue(b,c,annual,events)),'el')*(sort.descending?-1:1));}
  return result;
 },[students,quick,filters,columns,annual,events,sort]);
 const pages=Math.max(1,Math.ceil(rows.length/PAGE_SIZE));const current=Math.min(page,pages-1);
 useEffect(()=>{if(page>pages-1)setPage(pages-1)},[page,pages]);
 useEffect(()=>{const position=nextFocus.current;if(position){nextFocus.current=null;requestAnimationFrame(()=>focusCell(position.row,position.col))}},[current]);
 const visible=rows.slice(current*PAGE_SIZE,(current+1)*PAGE_SIZE);
 function focusCell(row:number,col:number){const sel=`[data-row="${row}"][data-col="${col}"]`;
  const element=ref.current?.querySelector<HTMLElement>(sel);element?.focus();element?.scrollIntoView({block:'nearest',inline:'nearest'});if(element instanceof HTMLInputElement && element.type==='text')element.select();}
 function navigate(e:KeyboardEvent<HTMLElement>){const t=e.currentTarget as HTMLElement;
  // Space is reserved for native checkbox toggling (EF launches the mandatory registration dialog).
  if(e.key===' ' && t instanceof HTMLInputElement && t.type==='checkbox')return;
  const moves:Record<string,[number,number]>={ArrowDown:[1,0],ArrowUp:[-1,0],ArrowLeft:[0,-1],ArrowRight:[0,1],Enter:[1,0]};
  if(!(e.key in moves))return;
  const [dr,dc]=moves[e.key];const row=Number(t.dataset.row),col=Number(t.dataset.col);
  if(Number.isNaN(row)||Number.isNaN(col))return;
  // For a select, Alt+ArrowDown can still open its native options.
  if(e.altKey && e.key==='ArrowDown')return;
  e.preventDefault();if(t instanceof HTMLInputElement && t.type==='text')t.blur();
  let nextRow=row+dr;const nextCol=Math.max(0,Math.min(shownColumns.length-1,col+dc));
  if(nextRow>=visible.length && current<pages-1){nextFocus.current={row:0,col:nextCol};setPage(current+1);return;}
  if(nextRow<0 && current>0){nextFocus.current={row:PAGE_SIZE-1,col:nextCol};setPage(current-1);return;}
  nextRow=Math.max(0,Math.min(visible.length-1,nextRow));requestAnimationFrame(()=>focusCell(nextRow,nextCol));
 }
 function updateFilter(key:string,patch:Partial<ColumnFilter>){setFilters(old=>({...old,[key]:{...(old[key]??defaultFilter),...patch}}));setPage(0)}
 function clearFilter(key:string){setFilters(old=>{const copy={...old};delete copy[key];return copy});setPage(0)}
 function columnValues(column:Column){return [...new Set(students.map(s=>cellValue(s,column,annual,events)))].sort((a,b)=>a.localeCompare(b,'el',{numeric:true}));}
 function reorder(from:string,to:string){if(!from||from===to)return;setColumns(old=>{const a=[...old],i=a.findIndex(c=>c.key===from),j=a.findIndex(c=>c.key===to);if(i<0||j<0)return old;const [m]=a.splice(i,1);a.splice(j,0,m);return a;});}
 function resize(col:Column,e:PointerEvent<HTMLSpanElement>){e.preventDefault();e.stopPropagation();const x=e.clientX,w=col.width;
  const move=(ev:globalThis.PointerEvent)=>setColumns(old=>old.map(c=>c.key===col.key?{...c,width:Math.max(80,w+ev.clientX-x)}:c));
  const done=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',done)};
  window.addEventListener('pointermove',move);window.addEventListener('pointerup',done);
 }
 function csv(){saveCsv(`organotiko-${academicYear}`,shownColumns.map(c=>c.label),rows.map(s=>shownColumns.map(c=>cellValue(s,c,annual,events))));}

 async function create(e:FormEvent){e.preventDefault();try{await onAdd(inline);setInline({surname:'',name:'',department:'',yearCode:'1'});}catch(error){setStatus('Αποτυχία προσθήκης: '+String(error))}}
 const activeFilterCount=Object.values(filters).filter(f=>f.mode==='values'?f.values.length>0:['empty','not_empty'].includes(f.mode)||!!f.query).length;
 return <section ref={ref} className="table-workspace panel" aria-label="Κεντρικός πίνακας">
  <div className="table-top-toolbar"><div className="row wrap"><div className="search-field"><Search size={17}/><input aria-label="Αναζήτηση πίνακα" value={quick} onChange={e=>{setQuick(e.target.value);setPage(0)}} placeholder="Αναζήτηση στον πίνακα"/></div><button onClick={()=>setViewsOpen(x=>!x)}><SlidersHorizontal size={16}/> Προβολές</button><button onClick={()=>setColumnsOpen(x=>!x)} className={columnsOpen?'soft-active':''}><Columns3 size={16}/> Στήλες</button><button onClick={()=>{setFilters({});setQuick('');setPage(0)}}><Filter size={16}/> Φίλτρα{activeFilterCount>0?` (${activeFilterCount})`:''}</button></div>
  <div className="row wrap"><button onClick={csv} title="Εξαγωγή φιλτραρισμένης προβολής"><Download size={16}/> CSV</button>{onSessionFromFilters&&<button onClick={()=>onSessionFromFilters(rows.map(x=>x.id),filters)}>Οργανωτικό από φίλτρα</button>}<button onClick={()=>void(isFullscreen?document.exitFullscreen():ref.current?.requestFullscreen())}>{isFullscreen?<Minimize2 size={16}/>:<Expand size={16}/>} <span className="fullscreen-label">{isFullscreen?"Έξοδος πλήρους οθόνης":"Πλήρης οθόνη"}</span></button><button className="primary" onClick={onNewStudent}><Plus size={17}/> Νέος φοιτητής</button></div></div>
  {viewsOpen&&<div className="saved-views-panel"><strong>Αποθηκευμένες προβολές</strong><div className="row wrap">{savedViews.map(v=><span className="saved-view-item" key={v.name}><button onClick={()=>applyView(v.name)}>{v.name}</button><button className="icon-button" title="Διαγραφή προβολής" onClick={()=>persistViews(savedViews.filter(x=>x.name!==v.name))}><X size={14}/></button></span>)}{savedViews.length===0&&<span className="muted small">Δεν έχουν αποθηκευτεί προβολές.</span>}</div><div className="row wrap"><input value={viewName} onChange={e=>setViewName(e.target.value)} placeholder="Όνομα νέας προβολής"/><button onClick={saveView} disabled={!viewName.trim()}>Αποθήκευση τρέχουσας</button></div><span className="muted small">Οι προσωπικές προβολές αυτής της έκδοσης αποθηκεύονται μόνο στον browser.</span></div>}
  {columnsOpen&&<div className="column-manager"><div className="row space"><strong>Προβολή στηλών</strong><span className="muted small">Εμφάνιση · σειρά · πλάτος (με σύρσιμο)</span></div><div className="columns-config">{columns.map((c,i)=><div key={c.key} className="config-col"><label><input type="checkbox" checked={c.show} onChange={e=>setColumns(old=>old.map(x=>x.key===c.key?{...x,show:e.target.checked}:x))}/>{c.label}</label><div className="row compact"><button className="icon-button" disabled={i===0} onClick={()=>reorder(c.key,columns[i-1]?.key)} title="Μετακίνηση αριστερά"><ArrowLeft size={14}/></button><button className="icon-button" disabled={i===columns.length-1} onClick={()=>reorder(c.key,columns[i+1]?.key)} title="Μετακίνηση δεξιά"><ArrowRight size={14}/></button></div></div>)}</div></div>}
  <div className="sheet-scroll"><table className="sheet-table"><thead><tr>{shownColumns.map(col=>{const f=filters[col.key];const active=!!f&&(f.mode==='values'?f.values.length>0:f.mode==='empty'||f.mode==='not_empty'||!!f.query);const choices=columnValues(col).filter(v=>normalized(v).includes(normalized(filterLookup))).slice(0,300);return <th key={col.key} style={{width:col.width,minWidth:col.width,maxWidth:col.width}} draggable onDragStart={e=>e.dataTransfer.setData('text/plain',col.key)} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();reorder(e.dataTransfer.getData('text/plain'),col.key)}}>
   <div className="column-header"><button title="Ταξινόμηση" onClick={()=>setSort(old=>old?.key===col.key?{key:col.key,descending:!old.descending}:{key:col.key,descending:false})}>{col.label}{sort?.key===col.key?(sort.descending?' ↓':' ↑'):''}</button><button className={`header-filter ${active?'has-filter':''}`} title={`Φίλτρα ${col.label}`} onClick={()=>{setFilterKey(filterKey===col.key?null:col.key);setFilterLookup('')}}><Filter size={14}/></button></div>
   {filterKey===col.key&&<div className="filter-popover" onClick={e=>e.stopPropagation()}><div className="row space"><strong>{col.label}</strong><button className="icon-button" onClick={()=>setFilterKey(null)}><X size={15}/></button></div><select aria-label="Τύπος φίλτρου" value={f?.mode??'values'} onChange={e=>updateFilter(col.key,{mode:e.target.value as FilterMode,query:'',values:[]})}>{filterModes.map(([k,label])=><option key={k} value={k}>{label}</option>)}</select>{(f?.mode??'values')==='values'?<><input aria-label="Αναζήτηση στη λίστα" placeholder="Αναζήτηση στις τιμές…" value={filterLookup} onChange={e=>setFilterLookup(e.target.value)}/><div className="filter-items"><label><input type="checkbox" checked={choices.length>0&&choices.every(v=>(f?.values??[]).includes(v))} onChange={e=>updateFilter(col.key,{values:e.target.checked?[...new Set([...(f?.values??[]),...choices])]:[]})}/>Επιλογή ορατών τιμών</label>{choices.map(v=><label key={v}><input type="checkbox" checked={(f?.values??[]).includes(v)} onChange={e=>updateFilter(col.key,{values:e.target.checked?[...(f?.values??[]),v]:(f?.values??[]).filter(x=>x!==v)})}/><span>{v||'(Κενό)'}</span></label>)}</div></>:!['empty','not_empty'].includes(f?.mode??'')&&<input autoFocus value={f?.query??''} onChange={e=>updateFilter(col.key,{query:e.target.value})} placeholder="Κείμενο φίλτρου…"/>}<div className="row space"><button onClick={()=>clearFilter(col.key)}>Καθαρισμός</button><button className="primary" onClick={()=>setFilterKey(null)}>Εφαρμογή</button></div></div>}
   <span className="resize-handle" role="separator" aria-label={`Αλλαγή πλάτους ${col.label}`} onPointerDown={e=>resize(col,e)}/></th>})}</tr></thead><tbody>{visible.map((student,i)=><tr key={student.id}>{shownColumns.map((col,j)=><Cell key={`${student.id}-${col.key}`} student={student} col={col} annual={annual} events={events} year={academicYear} nav={navigate} commit={onEdit} intent={onIntent} event={onEvent} onRegister={onRegister} onProfile={onProfile} index={i} columnIndex={j}/>)}</tr>)}</tbody></table>{visible.length===0&&<div className="empty-sheet">Δεν βρέθηκαν εγγραφές με αυτά τα φίλτρα.</div>}<datalist id="nucleus-options">{[...new Set(students.map(s=>s.nucleus1).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el')).map(v=><option key={v} value={v}/>)}</datalist><datalist id="department-options">{[...new Set(students.map(s=>s.department).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el')).map(v=><option key={v} value={v}/>)}</datalist><datalist id="university-options">{[...new Set(students.map(s=>s.university||'').filter(Boolean))].sort((a,b)=>a.localeCompare(b,'el')).map(v=><option key={v} value={v}/>)}</datalist></div>
  <form className="table-new-record" onSubmit={e=>void create(e)}><span className="new-dot"><Plus size={15}/></span><input aria-label="Νέο επώνυμο" required value={inline.surname} onChange={e=>setInline(a=>({...a,surname:e.target.value}))} placeholder="Νέο επώνυμο"/><input aria-label="Νέο όνομα" required value={inline.name} onChange={e=>setInline(a=>({...a,name:e.target.value}))} placeholder="Όνομα"/><input value={inline.department} onChange={e=>setInline(a=>({...a,department:e.target.value}))} placeholder="Τμήμα"/><input style={{maxWidth:90}} value={inline.yearCode} onChange={e=>setInline(a=>({...a,yearCode:e.target.value}))} placeholder="Έτος"/><button type="submit"><Plus size={14}/> Προσθήκη</button></form>
  <div className="sheet-footer"><span>{rows.length.toLocaleString('el-GR')} από {students.length.toLocaleString('el-GR')} εγγραφές · {shownColumns.length} στήλες</span><div className="row compact"><button disabled={current===0} onClick={()=>setPage(current-1)}><ArrowLeft size={15}/> Πίσω</button><span>{current+1} / {pages}</span><button disabled={current>=pages-1} onClick={()=>setPage(current+1)}>Επόμενη <ArrowRight size={15}/></button>{isFullscreen&&<button onClick={()=>void document.exitFullscreen()}><Minimize2 size={15}/> Έξοδος fullscreen</button>}</div></div>
 </section>;
}
