import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, Copy, Pause, Play, Plus, X } from 'lucide-react';
import { editReview, emptyFilters, filterFields, finishReview, markExamined, matchesFilters, operational, planReview, reviewSummary, startReview, type EditableField, type FilterGroup, type ReviewSession, type Student } from '@organotiko/domain';
import { FilterBuilder } from './FilterBuilder';
const labels = {planned:'Προγραμματισμένη',active:'Ενεργή',paused:'Σε παύση',completed:'Ολοκληρωμένη',cancelled:'Ακυρωμένη'};
const fields: {key:EditableField;label:string}[] = [{key:'surname',label:'ΕΠΩΝΥΜΟ'},{key:'name',label:'ΟΝΟΜΑ'},{key:'notes',label:'ΠΛΗΡΟΦΟΡΙΕΣ'}];
export function ReviewSessions({rows,onRows,sessions,onSessions,initialFilters,onConsumeInitial}:{rows:Student[];onRows:(rows:Student[])=>void;sessions:ReviewSession[];onSessions:(sessions:ReviewSession[])=>void;initialFilters:FilterGroup|null;onConsumeInitial:()=>void}) {
  const [selected,setSelected]=useState<string|null>(null);
  const [name,setName]=useState('');
  const [planFilters,setPlanFilters]=useState<FilterGroup>(()=>structuredClone(initialFilters||emptyFilters()));
  const [displayFilters,setDisplayFilters]=useState<FilterGroup>(emptyFilters);
  const [showFilters,setShowFilters]=useState(false);
  const [showNotes,setShowNotes]=useState(true);
  const [scope,setScope]=useState<'examined'|'cohort'>('examined');
  const [confirm,setConfirm]=useState<'completed'|'cancelled'|null>(null);
  const [sortAsc,setSortAsc]=useState(true);
  const [error,setError]=useState('');
  const [editing,setEditing]=useState<{id:string;field:EditableField;expected:string;draft:string}|null>(null);
  const input=useRef<HTMLInputElement>(null);
  const session=sessions.find(s=>s.id===selected);
  useEffect(()=>{onConsumeInitial();},[]);
  useEffect(()=>{input.current?.focus();},[editing?.id,editing?.field]);
  const cohort=session?session.cohort.map(id=>rows.find(r=>r.id===id)!).filter(Boolean):[];
  const visible=cohort.filter(r=>matchesFilters(r,displayFilters)).sort((a,b)=>a.surname.localeCompare(b.surname,'el')*(sortAsc?1:-1));
  const editableFields=showNotes?fields:fields.slice(0,2);
  function replace(s:ReviewSession){onSessions(sessions.map(x=>x.id===s.id?s:x));}
  function run(action:()=>void){try{action();setError('');}catch(e){setError((e as Error).message);}}
  function open(s:ReviewSession){setSelected(s.id);setDisplayFilters(emptyFilters());setEditing(null);setConfirm(null);setError('');setScope('examined');}
  function save(direction?:'up'|'down'|'left'|'right'):boolean {
    if(!editing||!session)return true;
    try {
      const result=editReview(session,rows,editing.id,editing.field,editing.expected,editing.draft,crypto.randomUUID(),new Date().toISOString());
      let next=result.session;
      const index=visible.findIndex(r=>r.id===editing.id), fieldIndex=editableFields.findIndex(f=>f.key===editing.field);
      let rowIndex=index, colIndex=fieldIndex;
      if(direction==='down')rowIndex++;
      if(direction==='up')rowIndex--;
      if(direction==='right'){colIndex++;if(colIndex===editableFields.length){colIndex=0;rowIndex++;}}
      if(direction==='left'){colIndex--;if(colIndex<0){colIndex=editableFields.length-1;rowIndex--;}}
      if(rowIndex>index) next=markExamined(next,editing.id);
      onRows(result.rows);replace(next);setError('');
      const target=visible[rowIndex], field=editableFields[colIndex];
      if(direction&&target&&field){const updated=result.rows.find(r=>r.id===target.id)!;setEditing({id:updated.id,field:field.key,expected:updated[field.key],draft:updated[field.key]});}
      else setEditing(null);
      return true;
    } catch(e){setError((e as Error).message);return false;}
  }
  function transition(status:'paused'|'completed'|'cancelled') {
    if(!session||!save())return;
    // save may update the session; terminal actions are kept separate from editing.
    if(editing)return;
    run(()=>{replace(finishReview(session,status,rows,new Date().toISOString()));setConfirm(null);});
  }
  function clone(s:ReviewSession){setSelected(null);setName(`${s.name} · ΑΝΤΙΓΡΑΦΟ`);setPlanFilters(structuredClone(s.filters));}
  const summary=session&&['completed','cancelled'].includes(session.status)?reviewSummary(session,scope):null;
  return <div className="review-workspace">
    <p className="prototype-note">Τοπική δοκιμή με συνθετικά δεδομένα. Οι συνεδρίες και οι αλλαγές διατηρούνται μέχρι την ανανέωση. Ο καθολικός έλεγχος ενεργής συνεδρίας θα εφαρμοστεί στον διακομιστή.</p>
    {error&&<div role="alert" className="review-error">{error}</div>}
    {!session?<>
      <section className="review-card"><h2>Προετοιμασία οργανωτικού</h2><p>Αποθηκεύστε τα φίλτρα σας. Το σύνολο των φοιτητών παγώνει όταν ξεκινήσει η συνεδρία.</p>
        <form onSubmit={e=>{e.preventDefault();run(()=>{const s=planReview(crypto.randomUUID(),name,new Date().toISOString(),planFilters);onSessions([...sessions,s]);setName('');open(s);});}}>
          <label className="form-label">Όνομα συνεδρίας<input required maxLength={100} value={name} onChange={e=>setName(e.target.value)} placeholder="π.χ. ΟΡΓΑΝΩΤΙΚΟ ΝΟΕΜΒΡΙΟΥ"/></label>
          <FilterBuilder value={planFilters} onChange={setPlanFilters}/>
          <div className="review-actions"><span>{operational(rows).filter(r=>matchesFilters(r,planFilters)).length} φοιτητές με τα σημερινά δεδομένα</span><button className="primary" disabled={!name.trim()}><Plus size={15}/>Προγραμματισμός συνεδρίας</button></div>
        </form>
      </section>
      <div className="section-title"><h2>Συνεδρίες & πρότυπα</h2><span>{sessions.length} συνεδρίες</span></div>
      {!sessions.length?<div className="empty">Δεν υπάρχουν συνεδρίες ακόμη.</div>:<div className="review-list">{sessions.map(s=><article key={s.id}><div><span className={`review-status ${s.status}`}>{labels[s.status]}</span><h3>{s.name}</h3><p>{s.startedAt?new Date(s.startedAt).toLocaleString('el'): 'Το σύνολο δεν έχει παγώσει ακόμη'}</p></div><div className="review-actions"><button onClick={()=>clone(s)} aria-label={`Αντιγραφή ${s.name}`}><Copy size={15}/></button><button onClick={()=>open(s)}>Άνοιγμα</button></div></article>)}</div>}
    </>:<>
      <div className="review-top"><button onClick={()=>{if(editing){setError('Αποθηκεύστε ή ακυρώστε το τρέχον πεδίο πριν φύγετε.');return;}setSelected(null);setConfirm(null);}}><ArrowLeft size={15}/>Όλες οι συνεδρίες</button><span className={`review-status ${session.status}`}>{labels[session.status]}</span></div>
      <section className="review-card"><div className="section-title"><h2>{session.name}</h2>{session.status!=='active'&&<button onClick={()=>clone(session)}><Copy size={14}/>Αντιγραφή ρυθμίσεων</button>}</div>
        {session.status==='planned'?<><p>Η εκκίνηση θα παγώσει τους φοιτητές που ταιριάζουν στα φίλτρα εκείνη τη στιγμή.</p><FilterBuilder value={session.filters} onChange={filters=>replace({...session,filters})}/><button className="primary" onClick={()=>run(()=>{onSessions(startReview(sessions,session.id,rows,new Date().toISOString()));})}><Play size={14}/>Έναρξη συνεδρίας</button><button onClick={()=>setConfirm('cancelled')}>Ακύρωση συνεδρίας</button></>:null}
        {session.status==='paused'&&<div className="review-actions"><p>Το σύνολο παραμένει παγωμένο. Οι αποθηκευμένες αλλαγές διατηρούνται.</p><button className="primary" onClick={()=>run(()=>onSessions(startReview(sessions,session.id,rows,new Date().toISOString())))}><Play size={14}/>Συνέχιση</button><button onClick={()=>setConfirm('completed')}>Ολοκλήρωση</button><button onClick={()=>setConfirm('cancelled')}>Ακύρωση συνεδρίας</button></div>}
        {session.status==='active'&&<>
          <div className="review-actions"><strong className="review-progress" role="status">{session.examined.length}/{session.cohort.length} εξετάστηκαν</strong><button disabled={!!editing} onClick={()=>transition('paused')}><Pause size={14}/>Παύση</button><button disabled={!!editing} onClick={()=>setConfirm('completed')}>Ολοκλήρωση</button><button disabled={!!editing} onClick={()=>setConfirm('cancelled')}><X size={14}/>Ακύρωση</button></div>
          <div className="review-actions"><button disabled={!!editing} onClick={()=>setShowFilters(!showFilters)}>Φίλτρα προβολής</button><label><input type="checkbox" checked={showNotes} disabled={!!editing} onChange={e=>setShowNotes(e.target.checked)}/>Πληροφορίες</label><span>Το παγωμένο σύνολο δεν αλλάζει.</span></div>
          {showFilters&&<FilterBuilder value={displayFilters} onChange={next=>{if(!editing)setDisplayFilters(next);else setError('Αποθηκεύστε ή ακυρώστε το πεδίο πριν αλλάξετε φίλτρα.');}}/>}
          <div className="table-scroll review-table"><table><thead><tr><th>#</th><th><button disabled={!!editing} onClick={()=>setSortAsc(!sortAsc)}>ΕΠΩΝΥΜΟ {sortAsc?'↑':'↓'}</button></th><th>ΟΝΟΜΑ</th><th>ΤΜΗΜΑ / ΕΤΟΣ</th><th>ΠΥΡΗΝΑΣ</th>{showNotes&&<th>ΠΛΗΡΟΦΟΡΙΕΣ</th>}<th>ΕΞΕΤΑΣΗ</th></tr></thead><tbody>{visible.map((r,i)=><tr key={r.id} className={session.examined.includes(r.id)?'examined-row':''}><td className="row-number">{i+1}</td>{fields.slice(0,2).map(f=>cell(r,f))}<td>{r.department} · {r.year}</td><td>{r.nucleus}</td>{showNotes&&cell(r,fields[2])}<td><button disabled={!!editing} aria-label={`Εξετάστηκε ${r.surname}`} onClick={()=>run(()=>replace(markExamined(session,r.id)))}>{session.examined.includes(r.id)?<Check size={14}/>:'Εξετάστηκε'}</button></td></tr>)}</tbody></table>{!visible.length&&<div className="empty">Δεν υπάρχουν εγγραφές με αυτά τα φίλτρα προβολής.</div>}</div>
          {editing&&<div className="review-actions"><button className="primary" onClick={()=>save()}>Αποθήκευση πεδίου</button><button onClick={()=>setEditing(null)}>Ακύρωση επεξεργασίας</button></div>}
          <p className="keyboard-help"><kbd>Enter / ↓</kbd> Αποθήκευση, εξέταση και επόμενη γραμμή <kbd>↑</kbd> Προηγούμενη <kbd>Tab / Shift Tab</kbd> Διπλανό πεδίο <kbd>Esc</kbd> Ακύρωση πεδίου</p>
        </>}
        {confirm&&<div className="review-confirm" role="group" aria-label="Επιβεβαίωση αλλαγής κατάστασης"><h3>{confirm==='completed'?'Ολοκλήρωση και κλείδωμα;':'Οριστική ακύρωση συνεδρίας;'}</h3><p>{confirm==='completed'?`${session.examined.length}/${session.cohort.length} φοιτητές εξετάστηκαν. Η συνεδρία θα κλειδώσει με αυτό το αποτέλεσμα.`:'Η συνεδρία δεν θα μπορεί να συνεχιστεί. Οι ήδη αποθηκευμένες αλλαγές στους φοιτητές θα διατηρηθούν.'}</p><button onClick={()=>transition(confirm)}>Επιβεβαίωση</button><button onClick={()=>setConfirm(null)}>Επιστροφή</button></div>}
        {summary&&<div className="review-summary"><h3>Αποθηκευμένο αποτέλεσμα</h3><label>Σύγκριση <select value={scope} onChange={e=>setScope(e.target.value as typeof scope)}><option value="examined">Εξετασμένοι φοιτητές</option><option value="cohort">Ολόκληρο το σύνολο</option></select></label><div className="summary-grid"><div><small>ΦΟΙΤΗΤΕΣ</small><strong>{summary.total}</strong></div><div><small>ΕΦΕΚΘ · ΠΡΙΝ / ΜΕΤΑ</small><strong>{summary.beforeRegistered} / {summary.afterRegistered}</strong></div><div><small>ΑΛΛΑΓΕΣ ΑΥΤΗΣ ΤΗΣ ΣΥΝΕΔΡΙΑΣ</small><strong>{summary.ownChanges.length}</strong></div></div><p>Οι μετρήσεις βασίζονται στα αποθηκευμένα στιγμιότυπα. Το ιστορικό περιλαμβάνει μόνο αλλαγές που έγιναν μέσα σε αυτή τη συνεδρία.</p>{summary.ownChanges.map(c=><article className="review-change" key={c.id}><strong>{session.baseline.find(r=>r.id===c.studentId)?.surname} · {filterFields.find(f=>f[0]===c.field)?.[1]}</strong><p><del>{c.before||'Κενό'}</del> → {c.after||'Κενό'}</p></article>)}</div>}
      </section>
    </>}
  </div>;
  function cell(row:Student, field:typeof fields[number]) {
    const isEditing=editing?.id===row.id&&editing.field===field.key;
    return <td key={field.key}>{isEditing?<input ref={input} aria-label={`Συνεδρία ${field.label} ${row.surname}`} value={editing.draft} onChange={e=>setEditing({...editing,draft:e.target.value})} onKeyDown={e=>{if(e.nativeEvent.isComposing)return;if(e.key==='Escape'){e.preventDefault();setEditing(null);}if(['Enter','ArrowDown','ArrowUp','Tab'].includes(e.key)){e.preventDefault();save(e.key==='Tab'?(e.shiftKey?'left':'right'):e.key==='ArrowUp'?'up':'down');}}}/>:<button className="cell" onClick={()=>{if(editing&&!save())return;setEditing({id:row.id,field:field.key,expected:row[field.key],draft:row[field.key]});}} aria-label={`Επεξεργασία συνεδρίας ${field.label} ${row.surname}`}>{row[field.key]||'—'}</button>}</td>;
  }
}
