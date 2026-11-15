import {useEffect,useState} from 'react';
import {ShieldCheck,LogIn,LogOut} from 'lucide-react';
import {supabase} from './backend';
export default function Authentication({onReady}:{onReady:()=>void}){
 const [phase,setPhase]=useState<'checking'|'login'|'setup'|'verify'>('checking');
 const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [code,setCode]=useState('');
 const [factorId,setFactorId]=useState('');const [qr,setQr]=useState('');const [secret,setSecret]=useState('');
 const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 async function determine(){
  if(!supabase)return;
  const {data:session}=await supabase.auth.getSession();
  if(!session.session){setPhase('login');return;}
  const [{data:aal,error:aerr},{data:factors,error:ferr}]=await Promise.all([supabase.auth.mfa.getAuthenticatorAssuranceLevel(),supabase.auth.mfa.listFactors()]);
  if(aerr||ferr){setMessage(aerr?.message||ferr?.message||'Σφάλμα Auth');setPhase('login');return;}
  if(aal?.currentLevel==='aal2'){onReady();return;}
  const verified=factors?.totp?.find(f=>f.status==='verified');
  if(verified){setFactorId(verified.id);setPhase('verify');return;}
  setPhase('setup');
 }
 useEffect(()=>{void determine();},[]);
 async function login(e:React.FormEvent){e.preventDefault();if(!supabase)return;setBusy(true);setMessage('');try{
  const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error;await determine();
 }catch(err){setMessage((err as Error).message)}finally{setBusy(false)}}
 async function enroll(){if(!supabase)return;setBusy(true);setMessage('');try{
  const {data,error}=await supabase.auth.mfa.enroll({factorType:'totp',friendlyName:'Organotiko'});
  if(error)throw error;setFactorId(data.id);setQr(data.totp.qr_code);setSecret(data.totp.secret);
 }catch(err){setMessage((err as Error).message)}finally{setBusy(false)}}
 async function verify(){if(!supabase)return;setBusy(true);setMessage('');try{
  const {error}=await supabase.auth.mfa.challengeAndVerify({factorId,code:code.trim()});if(error)throw error;
  setCode('');await determine();
 }catch(err){setMessage((err as Error).message)}finally{setBusy(false)}}
 async function signOut(){await supabase?.auth.signOut();setPhase('login');setCode('');setQr('');setPassword('');}
 return <main className="auth-screen"><section className="auth-panel"><div className="auth-brand"><ShieldCheck size={25}/><strong>Οργανωτικό</strong></div>
 <p className="small muted">Ασφαλής σύνδεση δοκιμαστικού περιβάλλοντος</p>
 {phase==='checking'&&<p>Έλεγχος σύνδεσης…</p>}
 {phase==='login'&&<form onSubmit={login} className="stack"><label>Email λογαριασμού<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username"/></label><label>Κωδικός<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label><button disabled={busy} className="primary" type="submit"><LogIn size={16}/> Είσοδος</button><p className="small muted">Το username login και η κεντρική διαχείριση λογαριασμών θα προστεθούν πριν την παραγωγή.</p></form>}
 {phase==='setup'&&<div className="stack"><h3>Ενεργοποίηση Authenticator</h3><p className="small">Η πρόσβαση στο Οργανωτικό απαιτεί TOTP.</p>{!qr?<button onClick={enroll} disabled={busy}>Δημιουργία QR κωδικού</button>:<><img src={qr} width={180} height={180} alt="QR για Authenticator"/><p className="small">Εναλλακτικό μυστικό: <code>{secret}</code></p><label>6ψήφιος κωδικός<input autoComplete="one-time-code" value={code} onChange={e=>setCode(e.target.value)} inputMode="numeric"/></label><button onClick={verify} disabled={busy||code.length<6}>Επαλήθευση</button></>}{<button className="ghost" onClick={signOut}><LogOut size={15}/> Αποσύνδεση</button>}</div>}
 {phase==='verify'&&<div className="stack"><h3>Έλεγχος δύο παραγόντων</h3><label>Κωδικός Authenticator<input autoFocus autoComplete="one-time-code" inputMode="numeric" value={code} onChange={e=>setCode(e.target.value)}/></label><button className="primary" onClick={verify} disabled={busy||code.length<6}>Επιβεβαίωση</button><button className="ghost" onClick={signOut}><LogOut size={15}/> Αποσύνδεση</button></div>}
 {message&&<p role="alert" className="error">{message}</p>}
 </section></main>;
}
