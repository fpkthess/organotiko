import {CalendarDays,Check,ContactRound,ExternalLink,History, X} from 'lucide-react';
import type {Student} from '@organotiko/domain';
import {annualKey,fieldLabels,legacyEvents} from './model';
import type {AnnualMap,EventMap} from './model';
type Props={student:Student;annual:AnnualMap;events:EventMap;year:string;onClose:()=>void;onTable:()=>void};
export default function StudentProfile({student:s,annual,events,year,onClose,onTable}:Props){
 const years=[...new Set([year,'2025-26','2024-25','2023-24'])];
 return <div className="drawer-screen" role="dialog" aria-modal="true" aria-label="Καρτέλα φοιτητή"><div className="drawer-shadow" onClick={onClose}/><aside className="profile-drawer">
  <div className="drawer-header"><div className="profile-avatar"><ContactRound size={27}/></div><div><span className="muted small">ΚΑΡΤΕΛΑ ΦΟΙΤΗΤΗ</span><h2>{s.surname} {s.name}</h2><p>{s.department||'Χωρίς τμήμα'} · {s.yearCode||'—'} έτος</p></div><button className="icon-button" onClick={onClose} aria-label="Κλείσιμο καρτέλας"><X size={20}/></button></div>
  <div className="profile-content">
   <div className="profile-tags"><span className={s.efRegistered?'good':'quiet'}>{s.efRegistered?<Check size={13}/>:null} ΕΦΕΚΘ {s.efRegistered?'ΝΑΙ':'ΟΧΙ'}</span><span>Μέλος {s.member?'ΝΑΙ':'ΟΧΙ'}</span><span>Bluepass {s.bluepass?'ΝΑΙ':'ΟΧΙ'}</span></div>
   <section><h3>Στοιχεία</h3><dl className="details-grid">{(['university','department','yearCode','entryYear','nucleus1','nucleus2','phoneCy','phoneGr','uniqueNumber'] as const).map(k=><div key={k}><dt>{fieldLabels[k]}</dt><dd>{String(s[k]??'—')||'—'}</dd></div>)}</dl></section>
   <section><h3><CalendarDays size={17}/> Εγγραφές ΕΦΕΚΘ ανά έτος</h3><table className="detail-table"><thead><tr><th>Έτος</th><th>Πρόθεση</th><th>Πηγή</th><th>Ημερομηνία</th></tr></thead><tbody>{years.map(y=>{const r=annual[annualKey(s.id,y)];return <tr key={y}><td>{y}</td><td>{y===year&&s.efRegistered?'—':r?.intentCode||'—'}</td><td>{r?.registrationSource||'—'}</td><td>{r?.registeredOn||'—'}</td></tr>})}</tbody></table></section>
   <section><h3><History size={17}/> ΑΓΣ · ΒΓΣ · Εκλογές</h3><table className="detail-table"><thead><tr><th>Γεγονός</th><th>Πρόθεση</th><th>Αποτέλεσμα</th></tr></thead><tbody>{legacyEvents.filter(e=>events[s.id]?.[e]?.intent||events[s.id]?.[e]?.actual).map(e=><tr key={e}><td>{e}</td><td>{events[s.id]?.[e]?.intent||'—'}</td><td>{events[s.id]?.[e]?.actual||'—'}</td></tr>)}{!legacyEvents.some(e=>events[s.id]?.[e]?.intent||events[s.id]?.[e]?.actual)&&<tr><td colSpan={3} className="muted">Δεν υπάρχουν καταχωρισμένα ιστορικά γεγονότα.</td></tr>}</tbody></table></section>
   <section><h3>Πληροφορίες</h3><div className="notes-preview">{s.notes||'Δεν υπάρχουν σημειώσεις.'}</div><p className="muted small">Οι εκδόσεις σημειώσεων και το πλήρες audit παραμένουν υπό ανάπτυξη.</p></section>
  </div><div className="drawer-footer"><button className="primary" onClick={()=>{onClose();onTable()}}><ExternalLink size={16}/> Άνοιγμα στον πίνακα</button><button onClick={onClose}>Κλείσιμο</button></div>
 </aside></div>;
}
