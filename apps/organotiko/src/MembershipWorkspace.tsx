import {useMemo,useState} from 'react';
import {Link2,Search,ShieldCheck,Ticket,Users} from 'lucide-react';
import type {Student} from '@organotiko/domain';
import {proposeSourceMatches} from '@organotiko/domain';

type Source='members'|'bluepass';
type Mode=Source|'matching';
export default function MembershipWorkspace({mode,students,onProfile,onNavigate}:{mode:Mode;students:Student[];onProfile:(person:Student)=>void;onNavigate:(mode:Mode)=>void}){
 const [source,setSource]=useState<Source>('members');
 const [external,setExternal]=useState({sourceId:'',name:'',surname:'',phone:''});
 const [searched,setSearched]=useState(false);
 const [query,setQuery]=useState('');
 const items=useMemo(()=>searched&&external.name.trim()&&external.surname.trim()&&external.sourceId.trim()
  ?proposeSourceMatches(students,[{sourceId:external.sourceId,sourceSystem:source,name:external.name,surname:external.surname,phone:external.phone}])[0]
  :null,[searched,external,source,students]);
 const title=mode==='members'?'Μέλη Πρωτοπορίας':mode==='bluepass'?'Bluepass':'Αντιστοίχιση εγγραφών';
 const Icon=mode==='members'?Users:mode==='bluepass'?Ticket:Link2;
 return <section className="panel page-padding" style={{display:'grid',gap:20}}>
  <div className="row space wrap"><div className="row" style={{gap:12}}><Icon size={25}/><h2 style={{margin:0}}>{title}</h2></div><div className="row wrap"><button onClick={()=>onNavigate('members')}>Μέλη</button><button onClick={()=>onNavigate('bluepass')}>Bluepass</button><button onClick={()=>onNavigate('matching')}>Αντιστοίχιση</button></div></div>
  {mode!=='matching'?<>
   <div className="development-banner"><ShieldCheck size={21}/><div><strong>Η πραγματική διαχείριση {mode==='members'?'Μελών':'Bluepass'} δεν έχει μεταφερθεί ακόμη.</strong><p>Προέρχεται από το ξεχωριστό dashboard ιστοσελίδας, όχι από το υπάρχον Portal. Δεν διαθέτουμε ακόμη τον κώδικά του, τις ροές εγκρίσεων και το schema της βάσης. Δεν εμφανίζουμε ψεύτικες αιτήσεις ή μη επιβεβαιωμένα στοιχεία.</p></div></div>
   <div className="row wrap"><button className="primary" onClick={()=>onNavigate('matching')}><Link2 size={17}/> Προεπισκόπηση αντιστοίχισης</button></div>
   <div className="stack"><h3>Τι θα ενσωματωθεί εδώ</h3><p>Η υφιστάμενη λίστα, οι αιτήσεις, η έγκριση/απόρριψη, τα ιστορικά και οι υπόλοιπες πραγματικές λειτουργίες του αρχικού συστήματος, μετά από επιθεώρηση του πηγαίου κώδικα και των δικαιωμάτων.</p><p className="muted small">Τα Analytics Μελών και Bluepass παραμένουν ξεχωριστές κατηγορίες του κεντρικού Analytics. Το checkbox στον πίνακα δεν αποτελεί απόδειξη αντιστοίχισης όσο δεν υπάρχει επιβεβαιωμένος σύνδεσμος.</p></div>
  </>:<>
    <div className="development-banner"><ShieldCheck size={21}/><div><strong>Προεπισκόπηση αντιστοίχισης — χωρίς αλλαγή εγγραφών</strong><p>Μόνο συνθετικά ή δοκιμαστικά στοιχεία. Οι προτάσεις γίνονται από όνομα/επώνυμο ή τηλέφωνο. Δεν συνδέονται αυτόματα πρόσωπα και δεν ενεργοποιείται το ΜΕΛΟΣ ή BLUEPASS.</p></div></div>
    <form className="form-grid" onSubmit={e=>{e.preventDefault();setSearched(true)}}>
      <label>Πηγή<select value={source} onChange={e=>{setSource(e.target.value as Source);setSearched(false)}}><option value="members">Μέλη</option><option value="bluepass">Bluepass</option></select></label>
      <label>ID εγγραφής από πηγή *<input required value={external.sourceId} onChange={e=>{setExternal(x=>({...x,sourceId:e.target.value}));setSearched(false)}} placeholder="π.χ. TEST-M001"/></label>
      <label>Όνομα *<input required value={external.name} onChange={e=>{setExternal(x=>({...x,name:e.target.value}));setSearched(false)}}/></label>
      <label>Επώνυμο *<input required value={external.surname} onChange={e=>{setExternal(x=>({...x,surname:e.target.value}));setSearched(false)}}/></label>
      <label>Τηλέφωνο (προαιρετικό)<input value={external.phone} onChange={e=>{setExternal(x=>({...x,phone:e.target.value}));setSearched(false)}}/></label>
      <div className="row form-span"><button type="submit" className="primary"><Search size={17}/> Αναζήτηση πιθανών αντιστοιχίσεων</button></div>
    </form>
    {items&&<div className="stack"><div className="row space"><h3>Προτάσεις προς ανθρώπινο έλεγχο</h3><strong>{items.candidates.length} αποτελέσματα</strong></div>
      <input aria-label="Φίλτρο αποτελεσμάτων" placeholder="Φίλτρο προτάσεων" value={query} onChange={e=>setQuery(e.target.value)}/>
      {items.candidates.length===0?<p>Δεν βρέθηκε πιθανή αντιστοίχιση. Δεν δημιουργείται αυτόματα νέο πρόσωπο.</p>:<div className="report-table-scroll"><table className="detail-table full-width"><thead><tr><th>Φοιτητής</th><th>Κριτήριο</th><th>Ενέργεια</th></tr></thead><tbody>{items.candidates.filter(x=>(x.surname+' '+x.name).toLocaleUpperCase('el-GR').includes(query.toLocaleUpperCase('el-GR'))).slice(0,30).map(candidate=><tr key={candidate.studentId}><td>{candidate.surname} {candidate.name}</td><td>{[candidate.sameName?'Ίδιο ονοματεπώνυμο':'',candidate.samePhone?'Ίδιο τηλέφωνο':''].filter(Boolean).join(' · ')}</td><td><button type="button" onClick={()=>{const s=students.find(x=>x.id===candidate.studentId);if(s)onProfile(s)}}>Καρτέλα φοιτητή</button></td></tr>)}</tbody></table></div>}
      <p className="muted small">Η τελική επιβεβαίωση ή απόρριψη, τα ελεγχόμενα links στη Supabase και ο έλεγχος διπλοεγγραφών ενεργοποιούνται μόνο μετά την πραγματική ενοποίηση πηγών.</p>
    </div>}
  </>}
 </section>;
}
