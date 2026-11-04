import { useRef, useState } from 'react';
import { database } from '../database';

/** Enrollment secrets live only in this mounted component, never browser storage/logs. */
export function TotpEnrollment({onVerified}:{onVerified:()=>void}){
 const [pending,setPending]=useState<{id:string;qr:string;secret:string}|null>(null);
 const [code,setCode]=useState('');const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const inFlight=useRef(false);
 async function start(){
  if(inFlight.current||pending)return;
  inFlight.current=true;setBusy(true);setError('');
  try{
   const {data,error}=await database!.auth.mfa.enroll({factorType:'totp',friendlyName:`Organotiko ${crypto.randomUUID()}`,issuer:'Organotiko'});
   if(error)throw new Error('Η ενεργοποίηση TOTP απέτυχε. Ελέγξτε ότι επιτρέπεται στο Supabase Auth.');
   setPending({id:data.id,qr:data.totp.qr_code,secret:data.totp.secret});
  }catch(e){setError((e as Error).message);}finally{inFlight.current=false;setBusy(false);}
 }
 async function verify(){
  if(!pending||inFlight.current)return;
  inFlight.current=true;setBusy(true);setError('');
  try{
   const {error}=await database!.auth.mfa.challengeAndVerify({factorId:pending.id,code});
   if(error)throw new Error('Ο κωδικός δεν επαληθεύτηκε. Ελέγξτε τον τρέχοντα κωδικό και την ώρα της συσκευής σας.');
   setCode('');setPending(null);onVerified();
  }catch(e){setError((e as Error).message);}finally{inFlight.current=false;setBusy(false);}
 }
 async function cancel(){
  if(!pending||inFlight.current)return;
  inFlight.current=true;setBusy(true);setError('');
  try{
   // This control exists only for the unverified factor created in this component.
   const {error}=await database!.auth.mfa.unenroll({factorId:pending.id});
   if(error)throw new Error('Δεν ολοκληρώθηκε η ακύρωση. Επαναλάβετε.');
   setPending(null);setCode('');
  }catch(e){setError((e as Error).message);}finally{inFlight.current=false;setBusy(false);}
 }
 return <section aria-label="Ενεργοποίηση Authenticator"><h2>Προστατέψτε τον λογαριασμό σας</h2>
 <p>Προσθέστε το Οργανωτικό στην εφαρμογή Authenticator της συσκευής σας. Απαιτείται επαλήθευση πριν από την πρόσβαση στα δεδομένα.</p>
 {!pending?<button className="primary" disabled={busy} onClick={()=>void start()}>Ρύθμιση Authenticator</button>:<>
 <img className="totp-qr" src={pending.qr.startsWith('data:image/')?pending.qr:`data:image/svg+xml;charset=utf-8,${encodeURIComponent(pending.qr)}`} alt="QR ενεργοποίησης Authenticator"/>
 <details><summary>Χειροκίνητη εισαγωγή κλειδιού</summary><code className="totp-secret">{pending.secret}</code></details>
 <p>Σαρώστε το QR και εισαγάγετε τον εξαψήφιο κωδικό της εφαρμογής. Το κλειδί εμφανίζεται μόνο κατά τη ρύθμιση.</p>
 <form onSubmit={e=>{e.preventDefault();void verify();}}><label>Κωδικός Authenticator<input autoFocus autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} required value={code} disabled={busy} onChange={e=>setCode(e.target.value)}/></label><button className="primary" disabled={busy}>Ενεργοποίηση και συνέχεια</button></form>
 <button disabled={busy} onClick={()=>void cancel()}>Ακύρωση ρύθμισης</button></>}
 {busy&&<p role="status">Παρακαλώ περιμένετε…</p>}{error&&<p role="alert">{error}</p>}
 </section>;
}
