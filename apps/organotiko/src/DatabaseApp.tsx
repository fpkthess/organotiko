import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import type { Student } from '@organotiko/domain';
import { App } from './App';
import { TotpEnrollment } from './components/TotpEnrollment';
import { database, configurationError, loadStudents } from './database';

export function DatabaseApp(){
 const [session,setSession]=useState<Session|null>(null);
 const [checking,setChecking]=useState(true);
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [code,setCode]=useState('');
 const [factor,setFactor]=useState('');const [needsMfa,setNeedsMfa]=useState(false);
 const [rows,setRows]=useState<Student[]|null>(null);const [error,setError]=useState('');const [busy,setBusy]=useState(false);const [reload,setReload]=useState(0);
 useEffect(()=>{
  if(!database){setChecking(false);return;}
  let active=true;
  database.auth.getSession().then(({data,error})=>{if(active){setSession(data.session);setChecking(false);if(error)setError('Η συνεδρία δεν είναι διαθέσιμη. Συνδεθείτε ξανά.');}});
  const {data:{subscription}}=database.auth.onAuthStateChange((_event,next)=>{setSession(next);setChecking(false);setRows(null);setError('');});
  return()=>{active=false;subscription.unsubscribe();};
 },[]);
 useEffect(()=>{
  setRows(null);setFactor('');setNeedsMfa(false);setCode('');
  if(!session||!database)return;
  const controller=new AbortController();
  async function read(){
   try{
    const {data,error}=await database!.auth.mfa.getAuthenticatorAssuranceLevel();
    if(error)throw new Error('Αποτυχία ελέγχου ταυτότητας. Συνδεθείτε ξανά.');
    if(controller.signal.aborted)return;
    if(data.currentLevel!=='aal2'){
     const {data:factors,error}=await database!.auth.mfa.listFactors();
     if(error)throw new Error('Αποτυχία ελέγχου TOTP.');
     if(controller.signal.aborted)return;
     setFactor(factors.totp.find(f=>f.status==='verified')?.id||'');setNeedsMfa(true);return;
    }
    const next=await loadStudents(controller.signal);
    if(!controller.signal.aborted)setRows(next);
   }catch(e){if(!controller.signal.aborted)setError((e as Error).message);}
  }
  void read();return()=>controller.abort();
 },[session,reload]);
 async function signOut(){setRows(null);setError('');const result=await database!.auth.signOut({scope:'local'});if(result.error)setError('Η αποσύνδεση απέτυχε. Επαναλάβετε.');else setSession(null);}
 if(rows)return <><div className="database-session"><span>Supabase · Μόνο ανάγνωση</span><button onClick={()=>{setError('');setRows(null);setReload(v=>v+1);}}>Ανανέωση δεδομένων</button><button onClick={()=>void signOut()}>Αποσύνδεση</button></div><App databaseRows={rows}/></>;
 return <main className="auth-screen"><section className="auth-card"><span className="brand-symbol">ο.</span><h1>Οργανωτικό</h1>
 {configurationError?<><p role="alert">{configurationError}</p><p>Η σύνδεση δεν έχει ρυθμιστεί. Δεν φορτώνονται δοκιμαστικές εγγραφές.</p></>:checking?<p role="status">Έλεγχος συνεδρίας…</p>:!session?<form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const {error}=await database!.auth.signInWithPassword({email,password});if(error)setError('Η σύνδεση απέτυχε. Ελέγξτε τα στοιχεία σας.');else setPassword('');}catch{setError('Η υπηρεσία σύνδεσης δεν είναι διαθέσιμη.');}finally{setBusy(false);}}}>
 <label>Email<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>
 <label>Κωδικός πρόσβασης<input type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label><button className="primary" disabled={busy}>Σύνδεση</button><p>Χρησιμοποιήστε λογαριασμό που έχει δημιουργηθεί από τη διαχείριση χρηστών.</p></form>:needsMfa?factor?<form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const {error}=await database!.auth.mfa.challengeAndVerify({factorId:factor,code});if(error)setError('Ο κωδικός TOTP δεν επαληθεύτηκε.');else{setCode('');setReload(v=>v+1);}}catch{setError('Αποτυχία επαλήθευσης TOTP.');}finally{setBusy(false);}}}><label>Κωδικός εφαρμογής Authenticator<input autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={e=>setCode(e.target.value)}/></label><button className="primary" disabled={busy}>Επαλήθευση TOTP</button></form>:<TotpEnrollment key={session.user.id} onVerified={()=>{setError('');setReload(v=>v+1);}}/>:!error?<p role="status">Φόρτωση δεδομένων…</p>:null}
 {error&&<p role="alert">{error}</p>}
 {session&&<div className="auth-actions"><button onClick={()=>{setError('');setReload(v=>v+1);}}>Επανάληψη</button><button onClick={()=>void signOut()}>Αποσύνδεση</button></div>}
 </section></main>;
}
