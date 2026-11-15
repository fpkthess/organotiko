import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
 Activity, AlertCircle, ArrowLeft, ArrowRight, Bell, CalendarDays, Check, Pencil,
 Clock3, ClipboardList, Columns3, LayoutDashboard,
 ListChecks, LogOut, Menu, Plus, RefreshCw, Search, Send,
 Settings2, Shield, Trash2, UserPlus, Users, X, Eye, EyeOff, ChevronDown, UserRound, Sparkles, MessageSquareText, Wallet
} from 'lucide-react';
import { authEmailForUsername, configured, dateFmt, initials, normalizedUsername, priorityLabel, relativeDay, roleLabel, safeError, statusLabel, supabase } from './lib';
import type { Assignee, Audit, CheckItem, Comment, Notice, Page, Profile, Task, TaskPriority, TaskStatus, Team, TeamMember, Event, EventTaskTemplate, EventKindDefinition } from './types';
import EventsPage from './EventsPage';
import SmsPage, {type SmsSection} from './SmsPage';
import FinancePage from './FinancePage';

type Data = { profiles: Profile[]; teams: Team[]; memberships: TeamMember[]; tasks: Task[]; assignees: Assignee[]; notifications: Notice[]; audits: Audit[]; events: Event[]; templates: EventTaskTemplate[]; eventKinds: EventKindDefinition[] };
const empty: Data = { profiles: [],teams: [],memberships: [],tasks: [],assignees: [],notifications: [],audits: [],events: [],templates: [],eventKinds: [] };
const nav: {page: Page; label: string; icon: typeof LayoutDashboard}[] = [
 {page:'overview',label:'Επισκόπηση',icon:LayoutDashboard},
 {page:'mine',label:'Οι εργασίες μου',icon:ListChecks},
 {page:'tasks',label:'Όλες οι εργασίες',icon:ClipboardList},
 {page:'calendar',label:'Ημερολόγιο',icon:CalendarDays},
 {page:'events',label:'Πρόγραμμα',icon:Sparkles},
 {page:'finance',label:'Οικονομική Διαχείριση',icon:Wallet},
 {page:'teams',label:'Ομάδες',icon:Users},
 {page:'people',label:'Στελέχη',icon:UserPlus},
 {page:'activity',label:'Audit Log',icon:Shield},
 {page:'sms',label:'Μηνύματα SMS',icon:MessageSquareText}
];
const monthName = (d: Date) => new Intl.DateTimeFormat('el-GR', {month:'long',year:'numeric'}).format(d);
const todayLocal = () => new Date().toLocaleDateString('sv-SE');
const datetimeLocal = (value:string|null) => {
 if (!value) return '';
 const d=new Date(value);
 if (Number.isNaN(d.getTime())) return '';
 const pad=(n:number)=>String(n).padStart(2,'0');
 return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

function IconButton({children,onClick,title,variant='subtle'}:{children:ReactNode;onClick:()=>void;title:string;variant?:string}) {
 return <button className={'icon-btn '+variant} onClick={onClick} type="button" title={title} aria-label={title}>{children}</button>;
}
function Pill({children,tone='neutral'}:{children:ReactNode;tone?:string}) {return <span className={'pill '+tone}>{children}</span>}
function Avatar({name}:{name:string}) {return <span className="avatar" title={name}>{initials(name)}</span>}
function Modal({title,children,onClose,wide=false}:{title:string;children:ReactNode;onClose:()=>void;wide?:boolean}) {
 return <div className="modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
   <section className={'modal '+(wide?'wide':'')} role="dialog" aria-modal="true" aria-label={title}>
    <header className="modal-head"><h2>{title}</h2><IconButton title="Κλείσιμο" onClick={onClose}><X size={19}/></IconButton></header>
    <div className="modal-body">{children}</div>
   </section>
  </div>;
}

// Replace public/protoporia-logo.png with the official Thessaloniki logo when provided.
// Until then, a typographic fallback is shown (never a different campus' emblem).
function BrandMark({size='normal'}:{size?:'normal'|'large'}) {
 const [hasLogo,setHasLogo]=useState(true);
 return <span className={'protoporia-mark '+(size==='large'?'mark-large':'')} aria-label="Πρωτοπορία Θεσσαλονίκης">
  {hasLogo?<img src="/protoporia-logo.png" alt="Λογότυπο Πρωτοπορίας Θεσσαλονίκης" onError={()=>setHasLogo(false)}/>:<span className="mark-fallback" aria-hidden="true">Π</span>}
 </span>;
}

function Login({onMessage}:{onMessage:(v:string)=>void}) {
 const [username,setUsername]=useState('');
 const [password,setPassword]=useState('');
 const [passwordVisible,setPasswordVisible]=useState(false);
 const [busy,setBusy]=useState(false);
 async function submit(e:FormEvent) {e.preventDefault();setBusy(true);
  try {
   const email=authEmailForUsername(username);
   const {error}=await supabase.auth.signInWithPassword({email,password});
   if(error) onMessage('Δεν ήταν δυνατή η σύνδεση. Έλεγξε username και κωδικό.');
   else {const {data}=await supabase.auth.getSession();if(data.session)void fetch('/api/audit/security',{method:'POST',headers:{authorization:`Bearer ${data.session.access_token}`,'content-type':'application/json'},body:JSON.stringify({event:'login'})}).catch(()=>null);}
  } catch {onMessage('Έλεγξε το username και τον κωδικό.');}
  finally {setBusy(false);}
 }
 return <div className="login-page">
  <div className="login-card">
   <div className="login-identity">
    <BrandMark size="large"/>
    <span className="brand-kicker">ΦΠΚ ΠΡΩΤΟΠΟΡΙΑ ΘΕΣΣΑΛΟΝΙΚΗΣ</span>
   </div>
   <h1>Portal</h1>
   <p className="login-subtitle">Σύνδεση στον οργανωτικό χώρο της Πρωτοπορίας.</p>
   <form className="form-stack" onSubmit={submit}>
    <label htmlFor="login-username">Username<input id="login-username" type="text" required value={username} onChange={e=>setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" spellCheck={false}/></label>
    <label htmlFor="login-password">Κωδικός πρόσβασης
     <span className="password-input-wrap"><input id="login-password" type={passwordVisible?'text':'password'} required value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/>
      <button type="button" className="password-toggle" aria-label={passwordVisible?'Απόκρυψη κωδικού':'Εμφάνιση κωδικού'} onClick={()=>setPasswordVisible(v=>!v)}>{passwordVisible?<EyeOff size={19}/>:<Eye size={19}/>}</button>
     </span>
    </label>
    <button className="btn primary full login-submit" disabled={busy} type="submit">{busy?'Σύνδεση…':'Σύνδεση'} <ArrowRight size={18}/></button>
   </form>
  </div>
 </div>;
}

export default function App() {
 const [session,setSession]=useState<Session|null>(null);
 const [checked,setChecked]=useState(false);
 const [profile,setProfile]=useState<Profile|null>(null);
 // Auth session and application profile load independently. Never treat a pending
 // profile query as evidence that the user lacks a profile.
 const [profileGate,setProfileGate]=useState<{userId:string;status:'ready'|'missing'|'error'}|null>(null);
 const profileRequest=useRef(0);
 const [data,setData]=useState<Data>(empty);
 const [page,setPage]=useState<Page>('overview');
 const [smsSection,setSmsSection]=useState<SmsSection>('overview');
 const [financeEvent,setFinanceEvent]=useState<string|null>(null);
 const [smsExpanded,setSmsExpanded]=useState(false);
 const [selected,setSelected]=useState<string|null>(null);
 const [createOpen,setCreateOpen]=useState(false);
 const [mobileOpen,setMobileOpen]=useState(false);
 const [busy,setBusy]=useState(false);
 const [loading,setLoading]=useState(false);
 const [toast,setToast]=useState('');
 const [passwordOpen,setPasswordOpen]=useState(false);
 const [accountOpen,setAccountOpen]=useState(false);
 const notify=useCallback((s:string)=>setToast(s),[]);
 useEffect(()=>{ if(!toast)return;const id=setTimeout(()=>setToast(''),7000);return()=>clearTimeout(id);},[toast]);
 useEffect(()=>{
  let active=true;
  void supabase.auth.getSession().then(({data:s})=>{if(active){setSession(s.session);setChecked(true);}});
  const {data:subscription}=supabase.auth.onAuthStateChange((_event,next)=>{if(active){setSession(next);setChecked(true);}});
  return ()=>{active=false;subscription.subscription.unsubscribe();};
 },[]);
 const refresh=useCallback(async()=>{
  const userId=session?.user.id;
  if(!userId)return;
  const request=++profileRequest.current;
  const isCurrent=()=>request===profileRequest.current;
  setLoading(true);
  try {
   const p=await supabase.from('profiles').select('*').eq('id',userId).maybeSingle();
   if(!isCurrent())return;
   if(p.error)throw p.error;
   if(!p.data){
    setProfile(null);setData(empty);setProfileGate({userId,status:'missing'});
    return;
   }
   if(!p.data.active){
    setProfile(p.data as Profile);setData(empty);setProfileGate({userId,status:'ready'});
    return;
   }
   const [profiles,teams,memberships,tasks,notifications,events,templates,eventKinds]=await Promise.all([
    supabase.from('profiles').select('*').order('full_name'),
    supabase.from('teams').select('*').order('name'),
    supabase.from('team_members').select('*'),
    supabase.from('tasks').select('*').order('created_at',{ascending:false}).limit(500),
    supabase.from('notifications').select('*').order('created_at',{ascending:false}).limit(40),
    supabase.from('events').select('*').order('starts_at',{ascending:true}).limit(500),
    supabase.from('event_task_templates').select('*').order('created_at',{ascending:true}).limit(500),
    supabase.from('event_kinds').select('*').order('sort_order',{ascending:true}).limit(200)
   ]);
   for(const q of [profiles,teams,memberships,tasks,notifications,events,templates])if(q.error)throw q.error;
   // event_kinds is created in migration 012; legacy UI remains usable before migration.
   const tt=(tasks.data || []) as Task[];
   // Even if the main Events list is paginated, fetch every event referenced by loaded tasks.
   const knownEvents=(events.data||[]) as Event[];
   const knownIds=new Set(knownEvents.map(e=>e.id));
   const missingIds=[...new Set(tt.map(t=>t.event_id).filter((id):id is string=>!!id&&!knownIds.has(id)))];
   const extraEventPages=await Promise.all(Array.from({length:Math.ceil(missingIds.length/60)},(_,i)=>
    supabase.from('events').select('*').in('id',missingIds.slice(i*60,(i+1)*60))));
   for(const r of extraEventPages)if(r.error)throw r.error;
   const allEvents=[...knownEvents,...extraEventPages.flatMap(r=>(r.data||[]) as Event[])].sort((a,b)=>a.starts_at.localeCompare(b.starts_at));
   const assignees=tt.length ? await supabase.from('task_assignees').select('*').in('task_id',tt.map(t=>t.id)) : {data:[],error:null};
   if(assignees.error)throw assignees.error;
   const audits=(p.data.role==='admin')?await supabase.from('audit_log').select('*').order('created_at',{ascending:false}).limit(150):{data:[],error:null};
   if(audits.error)throw audits.error;
   if(!isCurrent())return;
   setProfile(p.data as Profile);
   setData({profiles:(profiles.data||[]) as Profile[],teams:(teams.data||[]) as Team[],memberships:(memberships.data||[]) as TeamMember[],tasks:tt,assignees:(assignees.data||[]) as Assignee[],notifications:(notifications.data||[]) as Notice[],audits:(audits.data||[]) as Audit[],events:allEvents,templates:(templates.data||[]) as EventTaskTemplate[],eventKinds:(eventKinds.data||[]) as EventKindDefinition[]});
   setProfileGate({userId,status:'ready'});
  } catch(e){
   if(isCurrent()){
    notify('Αποτυχία φόρτωσης: '+safeError(e));
    // A failed network request is not the same as a missing Supabase profile.
    setProfileGate(previous=>previous?.userId===userId&&previous.status==='ready'
     ?previous:{userId,status:'error'});
   }
  }
  finally{if(isCurrent())setLoading(false);}
 },[session?.user.id,notify]);
 useEffect(()=>{
  if(!session?.user.id){
   // Forget cached data after sign-out; old in-flight responses are invalidated.
   profileRequest.current+=1;
   setProfile(null);setData(empty);setProfileGate(null);
   return;
  }
  void refresh();
 },[refresh]);
 async function execute(work:()=>Promise<void>, success:string){setBusy(true);try{await work();notify(success);await refresh();return true;}catch(e){notify('Σφάλμα: '+safeError(e));return false;}finally{setBusy(false);}}
 const isAdmin=profile?.role==='admin';
 const canAccessAllTasks=isAdmin||profile?.role==='leadership';
 const allManager=canAccessAllTasks;
 const canViewAudit=isAdmin;
 const canUseSms=isAdmin||!!profile?.sms_access;
 const canUseFinance=!!profile?.active&&(isAdmin||profile?.role==='leadership'||!!profile?.finance_manager);
 const managedTeams=useMemo(()=>allManager?data.teams:data.teams.filter(t=>profile?.role==='coordinator'&&data.memberships.some(m=>m.team_id===t.id&&m.user_id===profile.id&&m.access==='coordinator')),[data.teams,data.memberships,allManager,profile]);
 const canManageEvents=isAdmin||profile?.role==='leadership';
 const eventManagedTeams=useMemo(()=>canManageEvents?data.teams:[],[data.teams,canManageEvents]);
 const taskCreationTeams=useMemo(()=>managedTeams.length?managedTeams:data.teams.filter(t=>data.memberships.some(m=>m.team_id===t.id&&m.user_id===profile?.id)),[data.teams,data.memberships,managedTeams,profile?.id]);
 const taskAssignees=useCallback((id:string)=>data.assignees.filter(a=>a.task_id===id).map(a=>a.user_id),[data.assignees]);
 const person=(id:string)=>data.profiles.find(p=>p.id===id)?.full_name||'Άγνωστο στέλεχος';
 const teamName=(id:string)=>data.teams.find(t=>t.id===id)?.name||'Ομάδα';
 const taskOpen=data.tasks.find(t=>t.id===selected)||null;
 const mine=data.tasks.filter(t=>taskAssignees(t.id).includes(profile?.id||''));
 const visibleTasks=allManager?data.tasks:mine;
 const visibleUrgent=visibleTasks.filter(t=>t.status!=='done'&&t.due_at&&relativeDay(t.due_at));
 useEffect(()=>{if(profile&&((!['admin','leadership'].includes(profile.role)&&['tasks','teams'].includes(page))||(profile.role!=='admin'&&page==='activity')||(!canUseFinance&&page==='finance')))setPage('mine');},[profile,page,canUseFinance]);
 const menu=nav.filter(x=>x.page!=='activity'||canViewAudit).filter(x=>x.page!=='people'||isAdmin).filter(x=>x.page!=='sms'||canUseSms).filter(x=>x.page!=='finance'||canUseFinance).filter(x=>x.page!=='tasks'||canAccessAllTasks).filter(x=>x.page!=='teams'||canAccessAllTasks);
 if(!configured)return <div className="setup-screen"><div className="setup-box"><Settings2 size={30}/><h1>Πρώτη ρύθμιση</h1><p>Συμπλήρωσε τα <code>VITE_SUPABASE_URL</code> και <code>VITE_SUPABASE_ANON_KEY</code> στο <code>.env</code> και κάνε νέο build. Δεν έχει δημοσιευτεί ακόμη βάση δεδομένων.</p></div></div>;
 if(!checked)return <div className="centered-loading"><RefreshCw className="spin"/> Φόρτωση εφαρμογής…</div>;
 if(!session)return <><Login onMessage={notify}/>{toast&&<div className="toast"><AlertCircle size={18}/>{toast}</div>}</>;
 if(!profileGate || profileGate.userId!==session.user.id)
  return <div className="centered-loading" role="status" aria-live="polite"><RefreshCw className="spin"/> Φόρτωση Portal…</div>;
 if(profileGate.status==='error')
  return <div className="setup-screen"><div className="setup-box"><AlertCircle/><h2>Αδυναμία φόρτωσης προφίλ</h2><p>Η σύνδεση ολοκληρώθηκε, αλλά δεν ήταν δυνατή η φόρτωση των στοιχείων. Δοκίμασε ξανά.</p><button className="btn" onClick={()=>void refresh()}>Επανάληψη</button><button className="btn ghost" onClick={()=>void supabase.auth.signOut()}>Αποσύνδεση</button></div></div>;
 if(profileGate.status==='missing' || !profile)return <div className="setup-screen"><div className="setup-box"><Shield/><h2>Δεν βρέθηκε προφίλ</h2><p>Ο λογαριασμός δεν έχει ενεργοποιηθεί ακόμη. Ζήτησε από τον Admin να ολοκληρώσει τη ρύθμιση.</p><button className="btn" onClick={()=>void refresh()}>Ανανέωση</button><button className="btn ghost" onClick={()=>void supabase.auth.signOut()}>Αποσύνδεση</button></div></div>;
 if(!profile.active)return <div className="setup-screen"><div className="setup-box"><Shield/><h2>Ο λογαριασμός είναι ανενεργός</h2><button className="btn" onClick={()=>void supabase.auth.signOut()}>Αποσύνδεση</button></div></div>;
 return <div className="app-shell">
  <aside className={'sidebar '+(mobileOpen?'mobile-open':'')}>
   <div className="side-brand"><BrandMark/><div><strong>PROTOPORIA</strong><small>PORTAL</small></div><IconButton title="Κλείσιμο μενού" onClick={()=>setMobileOpen(false)}><X className="mobile-only" size={20}/></IconButton></div>
   <div className="side-section-title">ΠΛΟΗΓΗΣΗ</div>
   <nav className="side-nav">{menu.map(item=>{const Icon=item.icon;return <button type="button" key={item.page} className={page===item.page?'nav-active':''} onClick={()=>{setPage(item.page);if(item.page==='sms')setSmsExpanded(v=>!v);setMobileOpen(false);setAccountOpen(false);}}><Icon size={19}/><span>{item.label}</span>{item.page==='sms'&&<span aria-hidden="true">{smsExpanded?'▾':'▸'}</span>}{item.page==='mine'&&mine.filter(t=>t.status!=='done').length>0&&<span className="side-count">{mine.filter(t=>t.status!=='done').length}</span>}</button>})}{canUseSms&&smsExpanded&&<div className="sms-side-subnav">{([
    ['overview','Επισκόπηση SMS'],['compose','Νέα αποστολή'],['contacts','Παραλήπτες'],
    ...((isAdmin||profile?.sms_manage_settings)?[['exclusions','Εξαιρέσεις']]:[]),...(isAdmin?[['senders','Sender IDs']]:[]),['history','Καμπάνιες & Ιστορικό']
   ] as [SmsSection,string][]).map(([id,label])=><button type="button" key={id} className={page==='sms'&&smsSection===id?'selected':''} onClick={()=>{setPage('sms');setSmsSection(id);setMobileOpen(false);}}>{label}</button>)}</div>}</nav>
   
  </aside>
  {mobileOpen&&<div className="mobile-veil" onClick={()=>setMobileOpen(false)}/>}
  <main className="main-area">
   <header className="topbar"><div className="topbar-left"><IconButton title="Άνοιγμα μενού" onClick={()=>setMobileOpen(true)}><Menu size={21}/></IconButton><div className="breadcrumb"><span className="breadcrumb-home">Πρωτοπορία <span>/</span></span><strong>{nav.find(n=>n.page===page)?.label}</strong></div></div>
    <div className="topbar-right"><IconButton title="Ανανέωση δεδομένων" onClick={()=>void refresh()}><RefreshCw size={18} className={loading?'spin':''}/></IconButton><div className="notif-anchor"><IconButton title="Ειδοποιήσεις" onClick={()=>setPage('mine')}><Bell size={19}/>{data.notifications.some(n=>!n.read_at)&&<span className="bell-dot"/>}</IconButton></div>
     <div className="account-anchor">
      <button type="button" className="account-trigger" aria-expanded={accountOpen} aria-haspopup="menu" onClick={()=>setAccountOpen(v=>!v)}>
       <Avatar name={profile.full_name||profile.username}/><span className="account-name">{profile.full_name||profile.username}</span><ChevronDown size={16}/>
      </button>
      {accountOpen&&<><button type="button" className="account-dismiss" aria-label="Κλείσιμο μενού λογαριασμού" onClick={()=>setAccountOpen(false)}/><div className="account-menu" role="menu">
       <div className="account-menu-head"><strong>{profile.full_name||profile.username}</strong><span>@{profile.username} · {profile.position_title||roleLabel[profile.role]}</span></div>
       <button type="button" role="menuitem" onClick={()=>{setAccountOpen(false);setPasswordOpen(true);}}><UserRound size={18}/> Αλλαγή κωδικού</button>
       <button type="button" role="menuitem" onClick={()=>{setAccountOpen(false);void supabase.auth.signOut();}}><LogOut size={18}/> Αποσύνδεση</button>
      </div></>}
     </div>
    </div>
   </header>
   <div className="content">
    {page==='overview'&&<><div className="heading-row"><div><p className="eyebrow">ΚΕΝΤΡΙΚΗ ΕΠΙΣΚΟΠΗΣΗ</p><h1>Καλή συνέχεια, {profile.full_name.split(' ')[0]||'στέλεχος'} <span className="heading-wave">✦</span></h1><p className="page-sub">Εργασίες για check · Πρόγραμμα για τις δράσεις της ομάδας.</p></div>{taskCreationTeams.length>0&&<div className="heading-actions">{canManageEvents&&<button className="btn secondary" onClick={()=>setPage('events')}><CalendarDays size={18}/> Νέα εκδήλωση</button>}<button className="btn primary" onClick={()=>setCreateOpen(true)}><Plus size={18}/> Νέα εργασία</button></div>}</div>
      <div className="stats-grid"><Stats name={isAdmin?'Ανοιχτές εργασίες':'Οι εκκρεμότητές μου'} value={visibleTasks.filter(t=>t.status!=='done').length} icon={<ClipboardList size={22}/>} color="blue"/><Stats name="Για σήμερα" value={visibleTasks.filter(t=>t.due_at&&new Date(t.due_at).toLocaleDateString('sv-SE')===todayLocal()&&t.status!=='done').length} icon={<Clock3 size={22}/>} color="cyan"/><Stats name="Καθυστερημένες" value={visibleUrgent.length} icon={<AlertCircle size={22}/>} color="rose"/></div>
      <div className="dashboard-grid"><section className="panel"><PanelTitle title="Εργασίες που χρειάζονται προσοχή" subtitle="Εκκρεμότητες και κοντινές προθεσμίες"/><div className="list-cards">{[...visibleTasks].filter(t=>t.status!=='done').sort((a,b)=>(a.due_at||'9999').localeCompare(b.due_at||'9999')).slice(0,7).map(t=><TaskLine key={t.id} task={t} team={teamName(t.team_id)} users={taskAssignees(t.id).map(person)} event={data.events.find(e=>e.id===t.event_id)} onClick={()=>setSelected(t.id)}/>)}{visibleTasks.filter(t=>t.status!=='done').length===0&&<Empty title="Όλα τακτοποιημένα!" detail="Δεν υπάρχουν ανοιχτές εργασίες."/>}</div></section>
      <section className="panel"><PanelTitle title="Η δική μου ημέρα" subtitle="Τι έχεις να ολοκληρώσεις"/><div className="small-summary"><strong>{mine.filter(t=>t.status!=='done').length}</strong><span>ενεργές προσωπικές εργασίες</span></div><div className="list-cards compact">{mine.filter(t=>t.status!=='done').slice(0,4).map(t=><TaskLine key={t.id} task={t} team={teamName(t.team_id)} event={data.events.find(e=>e.id===t.event_id)} onClick={()=>setSelected(t.id)}/>)}</div><button className="btn ghost full" onClick={()=>setPage('mine')}>Όλες οι εργασίες μου <ArrowRight size={16}/></button>
       <div className="divider-space"/><PanelTitle title="Τελευταίες ειδοποιήσεις" subtitle="Νέες αναθέσεις και σχόλια"/>{data.notifications.slice(0,4).map(n=><button className="notification-line" key={n.id} onClick={()=>{if(n.task_id)setSelected(n.task_id);void supabase.rpc('mark_notification_read',{p_id:n.id}).then(()=>refresh());}}><Bell size={16}/><span>{n.message}</span>{!n.read_at&&<span className="tiny-dot"/>}</button>)}{!data.notifications.length&&<p className="muted small-pad">Δεν υπάρχουν ειδοποιήσεις.</p>}</section></div>
     </>}
    {(page==='mine'||(page==='tasks'&&canAccessAllTasks))&&<TaskDirectory tasks={page==='mine'?mine:data.tasks} teams={data.teams} events={data.events} assignees={taskAssignees} person={person} setSelected={setSelected} onNew={()=>setCreateOpen(true)} canCreate={taskCreationTeams.length>0} mine={page==='mine'}/>}
    {page==='calendar'&&<CalendarPage tasks={data.tasks} events={data.events} onEvent={()=>setPage('events')} setSelected={setSelected} teamName={teamName}/>}
    {page==='events'&&<EventsPage data={data} managedTeams={eventManagedTeams} canUseFinance={canUseFinance} onOpenFinance={(id)=>{setFinanceEvent(id);setPage('finance');}} isAdmin={!!isAdmin} canCreate={eventManagedTeams.length>0} busy={busy} execute={execute} person={person} onTask={setSelected}/>} 
    {page==='teams'&&canAccessAllTasks&&<TeamsPage data={data} profile={profile} managedTeams={managedTeams} execute={execute} busy={busy} person={person} onNewTask={()=>setCreateOpen(true)}/>}
    {page==='people'&&isAdmin&&<PeoplePage data={data} execute={execute} busy={busy} currentId={profile.id}/>}
    {page==='activity'&&canViewAudit&&<AuditPage audits={data.audits} person={person}/>}
    {page==='finance'&&canUseFinance&&<FinancePage events={data.events} profiles={data.profiles} isAdmin={!!isAdmin} selectedEvent={financeEvent} onClearEvent={()=>setFinanceEvent(null)}/>}
    {page==='sms'&&canUseSms&&<SmsPage accessToken={session.access_token} isAdmin={!!isAdmin} section={smsSection} onSection={setSmsSection}/>}
    
   </div>
  </main>
  <nav className="mobile-dock" aria-label="Γρήγορη πλοήγηση">
   <button type="button" className={page==='overview'?'selected':''} onClick={()=>{setPage('overview');setMobileOpen(false);}}><LayoutDashboard size={21}/><span>Αρχική</span></button>
   <button type="button" className={page==='mine'?'selected':''} onClick={()=>{setPage('mine');setMobileOpen(false);}}><ListChecks size={21}/><span>Εργασίες</span></button>
   <button type="button" className={page==='calendar'?'selected':''} onClick={()=>{setPage('calendar');setMobileOpen(false);}}><CalendarDays size={21}/><span>Πλάνο</span></button>
   <button type="button" onClick={()=>setMobileOpen(true)}><Menu size={21}/><span>Μενού</span></button>
  </nav>
  {createOpen&&taskCreationTeams.length>0&&<CreateTask teams={taskCreationTeams} data={data} selfOnly={profile.role==='member'} selfId={profile.id} busy={busy} close={()=>setCreateOpen(false)} execute={async(fn,msg)=>{const ok=await execute(fn,msg);if(ok)setCreateOpen(false);return ok;}}/>}
  {taskOpen&&<TaskDetail key={taskOpen.id} task={taskOpen} data={data} person={person} teamName={teamName} canManage={managedTeams.some(t=>t.id===taskOpen.team_id)} onClose={()=>setSelected(null)} execute={execute} busy={busy} taskAssignees={taskAssignees(taskOpen.id)}/>}
  {passwordOpen&&<PasswordChange close={()=>setPasswordOpen(false)} notify={notify}/>}
  {toast&&<div className="toast" role="status"><AlertCircle size={18}/><span>{toast}</span><IconButton title="Κλείσιμο" onClick={()=>setToast('')}><X size={16}/></IconButton></div>}
 </div>;
}

function Stats({name,value,icon,color}:{name:string;value:number;icon:ReactNode;color:string}){return <div className={'stat-card '+color}><div className="stat-top"><span>{name}</span><span className="stat-icon">{icon}</span></div><div className="stat-value">{value}</div></div>}
function PanelTitle({title,subtitle}:{title:string;subtitle:string}){return <div className="panel-head"><h2>{title}</h2><p>{subtitle}</p></div>}
function Empty({title,detail}:{title:string;detail:string}){return <div className="empty"><ClipboardList size={30}/><strong>{title}</strong><p>{detail}</p></div>}
const eventStageName: Record<Event['stage'],string> = {planning:'Σε προγραμματισμό',confirmed:'Επιβεβαιωμένη',cancelled:'Ακυρωμένη'};
function LinkedEventTag({task,event}:{task:Task;event?:Event}) {
 if(!task.event_id)return null;
 return <span className={'task-linked-event-tag'+(event?.stage==='cancelled'?' cancelled':'')} title={event?.title||'Συνδεδεμένη εκδήλωση'}>
   <CalendarDays size={13}/><span>Εκδήλωση: {event?.title||'Συνδεδεμένη εκδήλωση'}</span>
   {event?.stage==='cancelled'&&<span className="event-cancelled-suffix">· Ακυρωμένη</span>}
  </span>;
}
function TaskLine({task,team,users=[],event,onClick}:{task:Task;team:string;users?:string[];event?:Event;onClick:()=>void}) {return <button type="button" className="task-line" onClick={onClick}><span className={'task-mark '+task.status}/><span className="task-info"><strong>{task.title}</strong><small>{team}{users.length?' · '+users.join(', '):''}</small><LinkedEventTag task={task} event={event}/></span><span className="task-trailing"><Pill tone={task.priority==='urgent'?'danger':task.priority==='high'?'warn':'neutral'}>{priorityLabel[task.priority]}</Pill><small className={task.status!=='done'&&relativeDay(task.due_at)?'overdue':''}>{dateFmt(task.due_at)}</small></span><ArrowRight size={17}/></button>}

function TaskDirectory({tasks,teams,events,assignees,person,setSelected,onNew,canCreate,mine}:{tasks:Task[];teams:Team[];events:Event[];assignees:(id:string)=>string[];person:(id:string)=>string;setSelected:(v:string)=>void;onNew:()=>void;canCreate:boolean;mine:boolean}) {
 const [filter,setFilter]=useState('');const [status,setStatus]=useState('all');const [team,setTeam]=useState('all');const [board,setBoard]=useState(false);
 const eventById=useMemo(()=>new Map(events.map(event=>[event.id,event])),[events]);
 const sorted=useMemo(()=>tasks.filter(t=>(status==='all'||t.status===status)&&(team==='all'||t.team_id===team)&&(`${t.title} ${t.description}`).toLocaleLowerCase('el').includes(filter.toLocaleLowerCase('el'))).sort((a,b)=>(a.due_at||'9999').localeCompare(b.due_at||'9999')),[tasks,status,team,filter]);
 return <><div className="heading-row"><div><p className="eyebrow">TASK MANAGEMENT</p><h1>{mine?'Οι εργασίες μου':'Όλες οι εργασίες'}</h1><p className="page-sub">{mine?'Όλα όσα έχουν ανατεθεί σε εσένα.':'Οργάνωση εργασιών ανά ομάδα, υπεύθυνο και προθεσμία.'}</p></div>{canCreate&&<button className="btn primary" onClick={onNew}><Plus size={18}/> Νέα εργασία</button>}</div>
  <section className="panel"><div className="filter-row"><div className="search-field"><Search size={18}/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Αναζήτηση εργασίας..."/></div><select aria-label="Κατάσταση" value={status} onChange={e=>setStatus(e.target.value)}><option value="all">Όλες οι καταστάσεις</option>{Object.entries(statusLabel).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select><select aria-label="Ομάδα" value={team} onChange={e=>setTeam(e.target.value)}><option value="all">Όλες οι ομάδες</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select><button className={'btn '+(board?'primary':'ghost')} onClick={()=>setBoard(!board)}><Columns3 size={17}/>{board?'Λίστα':'Kanban'}</button></div>
   {board?<div className="kanban">{(Object.keys(statusLabel) as TaskStatus[]).map(s=><div className="kanban-col" key={s}><h3>{statusLabel[s]} {s!=='done'&&<span>{sorted.filter(t=>t.status===s).length}</span>}</h3>{sorted.filter(t=>t.status===s).map(t=><button key={t.id} className="kanban-card" onClick={()=>setSelected(t.id)}><div className="kanban-tag"><Pill tone={t.priority==='urgent'?'danger':t.priority==='high'?'warn':'neutral'}>{priorityLabel[t.priority]}</Pill></div><strong>{t.title}</strong><small>{teams.find(team=>team.id===t.team_id)?.name}</small><LinkedEventTag task={t} event={t.event_id?eventById.get(t.event_id):undefined}/><div className="kanban-card-foot"><span><CalendarDays size={14}/> {dateFmt(t.due_at)}</span><span>{assignees(t.id).length} <Users size={13}/></span></div></button>)}{!sorted.some(t=>t.status===s)&&<p className="muted small-pad">Καμία εργασία</p>}</div>)}</div>:
    <div className="directory-list">{sorted.map(t=><TaskLine key={t.id} task={t} team={teams.find(team=>team.id===t.team_id)?.name||''} event={t.event_id?eventById.get(t.event_id):undefined} users={assignees(t.id).map(person)} onClick={()=>setSelected(t.id)}/>)}{sorted.length===0&&<Empty title="Δεν βρέθηκαν εργασίες" detail="Δοκίμασε άλλα φίλτρα ή δημιούργησε νέα εργασία."/>}</div>}
   <div className="list-footer">Ταξινόμηση ανά προθεσμία</div>
  </section></>;
}

function CreateTask({teams,data,selfOnly,selfId,busy,close,execute}:{teams:Team[];data:Data;selfOnly:boolean;selfId:string;busy:boolean;close:()=>void;execute:(f:()=>Promise<void>,s:string)=>Promise<boolean>}) {
 const [teamId,setTeamId]=useState(teams[0]?.id||'');const [title,setTitle]=useState('');const [description,setDescription]=useState('');const [priority,setPriority]=useState<TaskPriority>('normal');const [due,setDue]=useState('');const [review,setReview]=useState(false);const [selected,setSelected]=useState<string[]>(selfOnly?[selfId]:[]);
 const members=data.memberships.filter(m=>m.team_id===teamId&&(!selfOnly||m.user_id===selfId)).map(m=>data.profiles.find(p=>p.id===m.user_id)).filter((p):p is Profile=>!!p&&p.active);
 async function submit(e:FormEvent){e.preventDefault();if(!selected.length){alert('Επίλεξε τουλάχιστον έναν υπεύθυνο.');return;}
  await execute(async()=>{const {error}=await supabase.rpc('create_task',{p_team_id:teamId,p_title:title,p_description:description,p_priority:priority,p_due_at:due?new Date(due).toISOString():null,p_review_required:review,p_assignees:selected});if(error)throw error;},'Η εργασία δημιουργήθηκε και ανατέθηκε.');
 }
 return <Modal title="Δημιουργία νέας εργασίας" onClose={close} wide><form onSubmit={e=>void submit(e)} className="form-stack"><div className="two-cols"><label>Ομάδα<select value={teamId} onChange={e=>{setTeamId(e.target.value);setSelected(selfOnly?[selfId]:[]);}} required>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Προτεραιότητα<select value={priority} onChange={e=>setPriority(e.target.value as TaskPriority)}><option value="low">Χαμηλή</option><option value="normal">Κανονική</option><option value="high">Υψηλή</option><option value="urgent">Επείγουσα</option></select></label></div><label>Τίτλος εργασίας<input value={title} onChange={e=>setTitle(e.target.value)} minLength={3} maxLength={180} required placeholder="π.χ. Προετοιμασία αφίσας εκδήλωσης"/></label><label>Περιγραφή<textarea rows={4} value={description} maxLength={5000} onChange={e=>setDescription(e.target.value)} placeholder="Τι ακριβώς πρέπει να γίνει;"/></label><div className="two-cols"><label>Προθεσμία<input type="datetime-local" value={due} onChange={e=>setDue(e.target.value)}/></label><label className="checkbox-label"><input type="checkbox" checked={review} onChange={e=>setReview(e.target.checked)}/><span>Απαιτείται έγκριση ολοκλήρωσης</span></label></div><div><div className="field-title">Ανάθεση σε στελέχη <small>({selected.length} επιλεγμένα)</small></div><div className="people-selector">{members.map(p=><button className={'person-choice '+(selected.includes(p.id)?'chosen':'')} key={p.id} type="button" onClick={()=>{if(!selfOnly)setSelected(prev=>prev.includes(p.id)?prev.filter(x=>x!==p.id):[...prev,p.id]);}}><Avatar name={p.full_name}/><span>{p.full_name}</span>{selected.includes(p.id)?<Check size={18}/>:<Plus size={16}/>}</button>)}{!members.length&&<p className="muted">Πρόσθεσε πρώτα μέλη στην ομάδα από τη Διαχείριση Ομάδων.</p>}</div></div><div className="form-actions"><button className="btn ghost" type="button" onClick={close}>Ακύρωση</button><button className="btn primary" disabled={busy||!selected.length||!teamId} type="submit"><Check size={17}/> Δημιουργία εργασίας</button></div></form></Modal>;
}

function TaskDetail({task,data,person,teamName,canManage,onClose,execute,busy,taskAssignees}:{task:Task;data:Data;person:(id:string)=>string;teamName:(id:string)=>string;canManage:boolean;onClose:()=>void;execute:(f:()=>Promise<void>,s:string)=>Promise<boolean>;busy:boolean;taskAssignees:string[]}) {
 const [checklist,setChecklist]=useState<CheckItem[]>([]);const [comments,setComments]=useState<Comment[]>([]);const [newItem,setNewItem]=useState('');const [comment,setComment]=useState('');const [newAssignee,setNewAssignee]=useState('');
 const [editing,setEditing]=useState(false);
 const [editTitle,setEditTitle]=useState(task.title);
 const [editDescription,setEditDescription]=useState(task.description);
 const [editPriority,setEditPriority]=useState<TaskPriority>(task.priority);
 const [editDue,setEditDue]=useState(datetimeLocal(task.due_at));
 const [editReview,setEditReview]=useState(task.review_required);
 const resetEdit=()=>{setEditTitle(task.title);setEditDescription(task.description);setEditPriority(task.priority);setEditDue(datetimeLocal(task.due_at));setEditReview(task.review_required);setEditing(false);};
 const submitEdit=async(e:FormEvent)=>{
  e.preventDefault();
  const date=editDue?new Date(editDue):null;
  if (date && Number.isNaN(date.getTime())) return;
  const ok=await execute(async()=>{
   const {error}=await supabase.rpc('edit_task_details',{
    p_task_id:task.id,p_title:editTitle,p_description:editDescription,p_priority:editPriority,
    p_due_at:date?date.toISOString():null,p_review_required:editReview
   });
   if(error)throw error;
  },'Οι αλλαγές στην εργασία αποθηκεύτηκαν.');
  if(ok)setEditing(false);
 };
 const deleteTask=async()=>{
  const linked=task.event_id?' Η εργασία είναι συνδεδεμένη με εκδήλωση.':'';
  if(!window.confirm(`Να διαγραφεί ΟΡΙΣΤΙΚΑ η εργασία «${task.title}»;\n\nΘα διαγραφούν και οι αναθέσεις, οι υποεργασίες, τα σχόλια και οι ειδοποιήσεις της.${linked}\n\nΗ διαγραφή δεν αναιρείται.`))return;
  const ok=await execute(async()=>{
   const {error}=await supabase.rpc('delete_task_record',{p_task_id:task.id});
   if(error)throw error;
  },'Η εργασία διαγράφηκε οριστικά.');
  if(ok)onClose();
 };
 const loadDetail=useCallback(async()=>{const [a,b]=await Promise.all([supabase.from('task_checklist').select('*').eq('task_id',task.id).order('sort_order'),supabase.from('task_comments').select('*').eq('task_id',task.id).order('created_at',{ascending:true})]);if(!a.error)setChecklist((a.data||[]) as CheckItem[]);if(!b.error)setComments((b.data||[]) as Comment[]);},[task.id]);
 useEffect(()=>{void loadDetail();},[loadDetail]);
 const changeStatus=async(s:TaskStatus)=>execute(async()=>{const {error}=await supabase.rpc('set_task_status',{p_task_id:task.id,p_status:s});if(error)throw error;},'Η κατάσταση ενημερώθηκε.');
 const addCheck=async()=>{if(!newItem.trim())return;await execute(async()=>{const {error}=await supabase.from('task_checklist').insert({task_id:task.id,title:newItem.trim(),sort_order:checklist.length});if(error)throw error;},'Προστέθηκε υποεργασία.');setNewItem('');await loadDetail();};
 const toggleCheck=async(c:CheckItem)=>{await execute(async()=>{const {error}=await supabase.rpc('toggle_checklist',{p_item_id:c.id,p_done:!c.is_done});if(error)throw error;},'Ενημερώθηκε η υποεργασία.');await loadDetail();};
 const addComment=async()=>{if(!comment.trim())return;await execute(async()=>{const {data:res}=await supabase.auth.getUser();if(!res.user)throw Error('Δεν υπάρχει συνεδρία.');const {error}=await supabase.from('task_comments').insert({task_id:task.id,user_id:res.user.id,body:comment.trim()});if(error)throw error;},'Το σχόλιο αποθηκεύτηκε.');setComment('');await loadDetail();};
 const members=data.memberships.filter(m=>m.team_id===task.team_id).map(m=>data.profiles.find(p=>p.id===m.user_id)).filter((p):p is Profile=>!!p&&p.active);
 const linkedEvent=task.event_id?data.events.find(e=>e.id===task.event_id):undefined;
 return <Modal title="Λεπτομέρειες εργασίας" onClose={onClose} wide><div className="detail-body">
  {canManage&&<div className="form-actions task-management-actions">
    <button type="button" className="btn secondary" disabled={busy} onClick={()=>{if(editing)resetEdit();else{setEditTitle(task.title);setEditDescription(task.description);setEditPriority(task.priority);setEditDue(datetimeLocal(task.due_at));setEditReview(task.review_required);setEditing(true);}}}><Pencil size={16}/>{editing?'Ακύρωση επεξεργασίας':'Επεξεργασία εργασίας'}</button>
    <button type="button" className="btn danger" disabled={busy} onClick={()=>void deleteTask()}><Trash2 size={16}/> Διαγραφή εργασίας</button>
  </div>}
  {canManage&&editing&&<form className="form-stack panel task-edit-form" onSubmit={e=>void submitEdit(e)}>
    <h3>Επεξεργασία βασικών στοιχείων</h3>
    <label>Τίτλος εργασίας<input value={editTitle} onChange={e=>setEditTitle(e.target.value)} minLength={3} maxLength={180} required placeholder="Τίτλος εργασίας"/></label>
    <label>Περιγραφή<textarea rows={4} value={editDescription} onChange={e=>setEditDescription(e.target.value)} maxLength={5000} placeholder="Περιγραφή εργασίας"/></label>
    <div className="two-cols"><label>Προτεραιότητα<select value={editPriority} onChange={e=>setEditPriority(e.target.value as TaskPriority)}>
      <option value="low">Χαμηλή</option><option value="normal">Κανονική</option><option value="high">Υψηλή</option><option value="urgent">Επείγουσα</option>
    </select></label><label>Προθεσμία<input type="datetime-local" value={editDue} onChange={e=>setEditDue(e.target.value)}/></label></div>
    <label className="checkbox-label"><input type="checkbox" checked={editReview} onChange={e=>setEditReview(e.target.checked)}/><span>Απαιτείται έγκριση ολοκλήρωσης</span></label>
    <div className="form-actions"><button type="button" className="btn ghost" onClick={resetEdit}>Άκυρο</button><button type="submit" className="btn primary" disabled={busy||editTitle.trim().length<3}><Check size={16}/> Αποθήκευση αλλαγών</button></div>
  </form>}
  <div className="detail-top"><div><div className="detail-pills"><Pill tone="blue">{teamName(task.team_id)}</Pill><Pill tone={task.priority==='urgent'?'danger':task.priority==='high'?'warn':'neutral'}>{priorityLabel[task.priority]}</Pill></div><h2>{task.title}</h2><p>{task.description||'Δεν έχει καταχωριστεί περιγραφή.'}</p></div><div className="detail-due"><CalendarDays size={18}/><span>Προθεσμία <strong>{dateFmt(task.due_at,{dateStyle:'medium',timeStyle:'short'})}</strong></span></div></div>
  {task.event_id&&<section className={'task-linked-event-panel'+(linkedEvent?.stage==='cancelled'?' cancelled':'')} aria-label="Συνδεδεμένη εκδήλωση">
   <span className="task-linked-event-icon"><CalendarDays size={20}/></span>
   <div className="task-linked-event-info">
    <small>ΣΥΝΔΕΔΕΜΕΝΗ ΕΚΔΗΛΩΣΗ</small>
    <strong>{linkedEvent?.title||'Συνδεδεμένη εκδήλωση'}</strong>
    {linkedEvent?<span>{dateFmt(linkedEvent.starts_at,{dateStyle:'medium',timeStyle:'short'})} · {eventStageName[linkedEvent.stage]}</span>:<span>Τα στοιχεία της εκδήλωσης δεν είναι διαθέσιμα.</span>}
   </div>
  </section>}
  <div className="detail-block"><h3>Κατάσταση εργασίας</h3>
  {task.status!=='done'&&<button className="btn primary task-complete-cta" disabled={busy} onClick={()=>void changeStatus(task.review_required&&!canManage?'in_review':'done')}><Check size={18}/>{task.review_required&&!canManage?'Υποβολή για έλεγχο':'✓ Ολοκλήρωσα την εργασία'}</button>}
  {task.status==='done'&&<p className="task-complete-note"><Check size={17}/> Η εργασία έχει ολοκληρωθεί. Ο υπεύθυνος ομάδας μπορεί να την επαναφέρει αν χρειάζεται.</p>}
  <div className="status-actions">{(Object.keys(statusLabel) as TaskStatus[]).map(s=><button disabled={busy||task.status===s} key={s} onClick={()=>void changeStatus(s)} className={'status-action '+(task.status===s?'selected':'')}>{s===task.status?<Check size={16}/>:<span className="status-circle"/>}{statusLabel[s]}</button>)}</div>{task.review_required&&<p className="hint"><Shield size={15}/> Η ολοκλήρωση απαιτεί έγκριση από Admin ή Coordinator.</p>}</div>
  <div className="detail-block"><h3>Υπεύθυνοι</h3><div className="assigned-list">{taskAssignees.map(id=><span className="assigned-person" key={id}><Avatar name={person(id)}/>{person(id)}{canManage&&<button title="Αφαίρεση ανάθεσης" disabled={busy||taskAssignees.length<=1} onClick={()=>void execute(async()=>{const {error}=await supabase.from('task_assignees').delete().eq('task_id',task.id).eq('user_id',id);if(error)throw error;},'Ο υπεύθυνος αφαιρέθηκε.')}><X size={14}/></button>}</span>)}</div>{canManage&&<div className="inline-form"><select value={newAssignee} onChange={e=>setNewAssignee(e.target.value)}><option value="">Προσθήκη υπευθύνου…</option>{members.filter(p=>!taskAssignees.includes(p.id)).map(p=><option value={p.id} key={p.id}>{p.full_name}</option>)}</select><button className="btn secondary" disabled={!newAssignee||busy} onClick={()=>void execute(async()=>{const {error}=await supabase.from('task_assignees').insert({task_id:task.id,user_id:newAssignee});if(error)throw error;setNewAssignee('');},'Προστέθηκε υπεύθυνος.')}><Plus size={16}/> Προσθήκη</button></div>}</div>
  <div className="detail-block"><h3>Υποεργασίες <span className="count-muted">{checklist.filter(c=>c.is_done).length}/{checklist.length}</span></h3>{checklist.length>0&&<div className="progress"><div style={{width:`${checklist.filter(c=>c.is_done).length/checklist.length*100}%`}}/></div>}<div className="check-list">{checklist.map(c=><button key={c.id} className={'check-item '+(c.is_done?'complete':'')} onClick={()=>void toggleCheck(c)}><span className="check-box">{c.is_done&&<Check size={14}/>}</span>{c.title}</button>)}</div>{canManage&&<div className="inline-form"><input value={newItem} maxLength={250} onChange={e=>setNewItem(e.target.value)} placeholder="Νέα υποεργασία…"/><button className="btn secondary" disabled={busy||newItem.trim().length<2} onClick={()=>void addCheck()}><Plus size={16}/> Προσθήκη</button></div>}</div>
  <div className="detail-block"><h3>Σχόλια <span className="count-muted">{comments.length}</span></h3><div className="comments">{comments.map(c=><div className="comment" key={c.id}><Avatar name={person(c.user_id)}/><div><div className="comment-name"><strong>{person(c.user_id)}</strong><small>{dateFmt(c.created_at,{dateStyle:'short',timeStyle:'short'})}</small></div><p>{c.body}</p></div></div>)}{!comments.length&&<p className="muted">Δεν υπάρχουν σχόλια ακόμη.</p>}</div><textarea value={comment} rows={3} maxLength={3000} onChange={e=>setComment(e.target.value)} placeholder="Γράψε μια ενημέρωση ή ένα σχόλιο…"/><button className="btn primary" disabled={busy||!comment.trim()} onClick={()=>void addComment()}><Send size={16}/> Δημοσίευση</button></div>
 </div></Modal>;
}

function CalendarPage({tasks,events,onEvent,setSelected,teamName}:{tasks:Task[];events:Event[];onEvent:()=>void;setSelected:(v:string)=>void;teamName:(id:string)=>string}) {
 const [month,setMonth]=useState(()=>new Date(new Date().getFullYear(),new Date().getMonth(),1));
 const year=month.getFullYear(), m=month.getMonth(); const offset=(new Date(year,m,1).getDay()+6)%7; const total=new Date(year,m+1,0).getDate();
 const days=Array.from({length:Math.ceil((offset+total)/7)*7},(_,i)=>i-offset+1);
 const byEventDay=(d:number)=>events.filter(e=>new Date(e.starts_at).getFullYear()===year&&new Date(e.starts_at).getMonth()===m&&new Date(e.starts_at).getDate()===d);
 const byDay=(d:number)=>tasks.filter(t=>t.due_at&&new Date(t.due_at).getFullYear()===year&&new Date(t.due_at).getMonth()===m&&new Date(t.due_at).getDate()===d);
 return <><div className="heading-row"><div><p className="eyebrow">TEAM CALENDAR</p><h1>Ημερολόγιο</h1><p className="page-sub">Δράσεις της ομάδας και προσωπικές προθεσμίες σε ένα σημείο. Οι δράσεις δεν απαιτούν check.</p></div></div><section className="panel calendar-panel"><div className="calendar-bar"><h2>{monthName(month)}</h2><div className="bar-actions"><button className="btn ghost" onClick={()=>setMonth(new Date())}>Σήμερα</button><IconButton title="Προηγούμενος μήνας" onClick={()=>setMonth(new Date(year,m-1,1))}><ArrowLeft size={19}/></IconButton><IconButton title="Επόμενος μήνας" onClick={()=>setMonth(new Date(year,m+1,1))}><ArrowRight size={19}/></IconButton></div></div><div className="calendar-grid">{['Δευ','Τρι','Τετ','Πεμ','Παρ','Σαβ','Κυρ'].map(d=><span className="weekday" key={d}>{d}</span>)}{days.map((d,i)=><div key={i} className={'calendar-day '+(d<1||d>total?'outside':'')+(new Date().getFullYear()===year&&new Date().getMonth()===m&&new Date().getDate()===d?' current':'')}><span className="day-number">{d>=1&&d<=total?d:''}</span>{d>=1&&d<=total&&byEventDay(d).slice(0,2).map(e=><button key={e.id} className={"calendar-task event-item "+e.stage} onClick={onEvent} title={e.title}>{e.title}</button>)}{d>=1&&d<=total&&byDay(d).slice(0,2).map(t=><button key={t.id} className={'calendar-task '+t.status} onClick={()=>setSelected(t.id)} title={t.title+' · '+teamName(t.team_id)}>{t.title}</button>)}{d>=1&&d<=total&&byDay(d).length>3&&<small>+{byDay(d).length-3} ακόμη</small>}</div>)}</div></section></>;
}

function TeamsPage({data,profile,managedTeams,execute,busy,person,onNewTask}:{data:Data;profile:Profile;managedTeams:Team[];execute:(f:()=>Promise<void>,s:string)=>Promise<boolean>;busy:boolean;person:(id:string)=>string;onNewTask:()=>void}) {
 const [teamId,setTeamId]=useState('');const [newTeam,setNewTeam]=useState('');const [description,setDescription]=useState('');const [newMember,setNewMember]=useState('');const [access,setAccess]=useState<'member'|'coordinator'>('member');const [open,setOpen]=useState(false);
 const team=data.teams.find(t=>t.id===teamId)||data.teams[0];
 const teamPeople=team?data.memberships.filter(m=>m.team_id===team.id):[];
 const available=data.profiles.filter(p=>p.active&&!teamPeople.some(m=>m.user_id===p.id));
 const admin=profile.role==='admin';
 return <><div className="heading-row"><div><p className="eyebrow">TEAM MANAGEMENT</p><h1>Ομάδες & Συντονισμός</h1><p className="page-sub">Ο Admin αποφασίζει ακριβώς ποιες ομάδες συντονίζει κάθε Coordinator.</p></div>{admin&&<button className="btn primary" onClick={()=>setOpen(true)}><Plus size={18}/> Νέα ομάδα</button>}</div>
 <div className="teams-layout"><section className="panel team-browser"><PanelTitle title="Οργανωτικές ομάδες" subtitle={`${data.teams.length} ομάδες`}/><div className="team-cards">{data.teams.map(t=><button className={'team-choice '+(team?.id===t.id?'selected':'')} key={t.id} onClick={()=>setTeamId(t.id)}><span className="team-color" style={{background:t.color}}/><span><strong>{t.name}</strong><small>{data.memberships.filter(m=>m.team_id===t.id).length} στελέχη · {data.tasks.filter(task=>task.team_id===t.id&&task.status!=='done').length} ανοιχτές</small></span><ArrowRight size={17}/></button>)}{!data.teams.length&&<Empty title="Δεν υπάρχουν ομάδες" detail="Ο Admin μπορεί να δημιουργήσει την πρώτη οργανωτική ομάδα."/>}</div></section>
 <section className="panel team-detail">{team?<><div className="team-head"><div><h2>{team.name}</h2><p>{team.description||'Δεν υπάρχει περιγραφή.'}</p></div>{managedTeams.some(t=>t.id===team.id)&&<button className="btn ghost" onClick={onNewTask}><Plus size={17}/> Εργασία</button>}</div><h3 className="section-sub">Μέλη ομάδας ({teamPeople.length})</h3><div className="members-list">{teamPeople.map(m=><div className="member-row" key={m.user_id}><Avatar name={person(m.user_id)}/><div className="member-info"><strong>{person(m.user_id)}</strong><small>{data.profiles.find(p=>p.id===m.user_id)?.username}</small></div><Pill tone={m.access==='coordinator'?'blue':'neutral'}>{m.access==='coordinator'?'Συντονιστής':'Μέλος'}</Pill>{admin&&<><select className="role-mini" value={m.access} aria-label="Δικαίωμα ομάδας" onChange={e=>void execute(async()=>{const {error}=await supabase.from('team_members').update({access:e.target.value}).eq('team_id',team.id).eq('user_id',m.user_id);if(error)throw error;},'Το δικαίωμα ομάδας ενημερώθηκε.')}><option value="member">Member</option>{['coordinator','leadership','admin'].includes(data.profiles.find(p=>p.id===m.user_id)?.role||'')&&<option value="coordinator">Coordinator</option>}</select><IconButton title="Αφαίρεση μέλους από την ομάδα" onClick={()=>{if(window.confirm(`Αφαίρεση του/της ${person(m.user_id)} από την ομάδα;`))void execute(async()=>{const {error}=await supabase.from('team_members').delete().eq('team_id',team.id).eq('user_id',m.user_id);if(error)throw error;},'Το στέλεχος αφαιρέθηκε από την ομάδα.')}}><Trash2 size={16}/></IconButton></>}</div>)}{!teamPeople.length&&<p className="muted">Δεν έχουν προστεθεί μέλη.</p>}</div>
 {admin&&<div className="add-member"><h3>Προσθήκη στελέχους στην ομάδα</h3><div className="inline-form"><select value={newMember} onChange={e=>{setNewMember(e.target.value);setAccess('member');}}><option value="">Επιλογή στελέχους…</option>{available.map(p=><option value={p.id} key={p.id}>{p.full_name} — {roleLabel[p.role]}</option>)}</select><select className="role-select" value={access} onChange={e=>setAccess(e.target.value as 'member'|'coordinator')}><option value="member">Μέλος</option>{['coordinator','leadership','admin'].includes(data.profiles.find(p=>p.id===newMember)?.role||'')&&<option value="coordinator">Συντονιστής</option>}</select><button className="btn primary" disabled={!newMember||busy} onClick={()=>void execute(async()=>{const {error}=await supabase.from('team_members').insert({team_id:team.id,user_id:newMember,access});if(error)throw error;setNewMember('');},'Το στέλεχος προστέθηκε στην ομάδα.')}><Plus size={16}/> Προσθήκη</button></div><p className="hint">Για να ορίσεις κάποιον Συντονιστή, άλλαξε πρώτα τον συνολικό του ρόλο στη σελίδα «Στελέχη».</p></div>}</>:<Empty title="Επίλεξε μια ομάδα" detail="Δες τα μέλη και τις οργανωτικές αρμοδιότητες."/>}</section></div>
 {open&&<Modal title="Δημιουργία ομάδας" onClose={()=>setOpen(false)}><form className="form-stack" onSubmit={e=>{e.preventDefault();void execute(async()=>{const {error}=await supabase.from('teams').insert({name:newTeam.trim(),description:description.trim(),created_by:profile.id});if(error)throw error;},'Η ομάδα δημιουργήθηκε.').then(ok=>{if(ok){setNewTeam('');setDescription('');setOpen(false);}});}}><label>Όνομα ομάδας<input value={newTeam} minLength={2} maxLength={80} required onChange={e=>setNewTeam(e.target.value)} placeholder="π.χ. Επικοινωνία"/></label><label>Περιγραφή<textarea value={description} rows={3} onChange={e=>setDescription(e.target.value)} placeholder="Οι αρμοδιότητες της ομάδας…"/></label><div className="form-actions"><button type="button" className="btn ghost" onClick={()=>setOpen(false)}>Άκυρο</button><button className="btn primary" disabled={busy}>Δημιουργία</button></div></form></Modal>}
 </>;
}

function PeoplePage({data,execute,busy,currentId}:{data:Data;execute:(f:()=>Promise<void>,s:string)=>Promise<boolean>;busy:boolean;currentId?:string}) {
 const [createOpen,setCreateOpen]=useState(false);
 const [name,setName]=useState(''); const [username,setUsername]=useState('');const [password,setPassword]=useState('');
 const [createRole,setCreateRole]=useState<Profile['role']>('member');const [position,setPosition]=useState('');
 const [deleteTarget,setDeleteTarget]=useState<Profile|null>(null);
 const [resetTarget,setResetTarget]=useState<Profile|null>(null);const [resetPassword,setResetPassword]=useState('');
 const [rightsTarget,setRightsTarget]=useState<Profile|null>(null);
 const [rights,setRights]=useState({sms_access:false,sms_manage_contacts:false,sms_manage_settings:false,finance_manager:false});
 const [filter,setFilter]=useState('');
 const people=data.profiles.filter(p=>(p.full_name+' '+p.username).toLocaleLowerCase('el').includes(filter.toLocaleLowerCase('el')));
 const adminRequest=async(path:string,input:object)=>{
  const {data:session}=await supabase.auth.getSession();const token=session.session?.access_token;
  if(!token)throw Error('Η συνεδρία έληξε.');
  const res=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(input)});
  const out=await res.json().catch(()=>({}));if(!res.ok)throw Error(out.error||'Η ενέργεια απέτυχε.');
 };
 const createUser=async(e:FormEvent)=>{
  e.preventDefault();
  const ok=await execute(()=>adminRequest('/api/users/create',{name,username:normalizedUsername(username),password,role:createRole,position_title:position}),'Ο λογαριασμός δημιουργήθηκε.');
  if(ok){setCreateOpen(false);setName('');setUsername('');setPassword('');setCreateRole('member');setPosition('');}
 };
 const resetUserPassword=async(e:FormEvent)=>{
  e.preventDefault();if(!resetTarget)return;
  const ok=await execute(()=>adminRequest('/api/users/reset-password',{userId:resetTarget.id,password:resetPassword}),'Ο κωδικός επαναφέρθηκε. Ενημέρωσε ιδιωτικά το στέλεχος.');
  if(ok){setResetTarget(null);setResetPassword('');}
 };
 return <>
  <div className="heading-row"><div><p className="eyebrow">USER MANAGEMENT</p><h1>Διαχείριση στελεχών</h1><p className="page-sub">Username, προσωπικοί κωδικοί, ρόλοι και ενεργοί λογαριασμοί — χωρίς προσωπικό email.</p></div><button className="btn primary" onClick={()=>setCreateOpen(true)}><UserPlus size={18}/> Νέο στέλεχος</button></div>
  <section className="panel"><div className="filter-row"><div className="search-field"><Search size={18}/><input placeholder="Αναζήτηση ονόματος ή username…" value={filter} onChange={e=>setFilter(e.target.value)}/></div><span className="muted">{people.length} χρήστες</span></div>
   <div className="people-table-wrapper"><table className="people-table"><thead><tr><th>Στέλεχος</th><th>Πρόσβαση / Ιδιότητα</th><th>Ομάδες</th><th>Δικαιώματα</th><th>Κωδικός</th><th>Λογαριασμός</th><th>Διαγραφή</th></tr></thead><tbody>{people.map(p=><tr key={p.id}><td><div className="table-person"><Avatar name={p.full_name}/><div><strong>{p.full_name||'Χωρίς όνομα'}</strong><small>@{p.username}</small></div></div></td><td><select className="table-select" disabled={busy||p.id===currentId} value={p.role} onChange={e=>void execute(async()=>{const {error}=await supabase.from('profiles').update({role:e.target.value}).eq('id',p.id);if(error)throw error;},'Ο ρόλος ενημερώθηκε.')}><option value="member">Στέλεχος</option><option value="coordinator">Συντονιστής</option><option value="leadership">Ηγεσία</option><option value="admin">Admin</option></select><input className="position-field" aria-label="Ιδιότητα στελέχους" maxLength={100} placeholder="" defaultValue={p.position_title||''} key={p.id+'-position'} disabled={busy} onBlur={e=>{const v=e.target.value.trim();if(v!==p.position_title)void execute(async()=>{const {error}=await supabase.from('profiles').update({position_title:v}).eq('id',p.id);if(error)throw error;},'Η ιδιότητα ενημερώθηκε.');}}/></td><td>{data.memberships.filter(m=>m.user_id===p.id).length}</td><td><button className="btn ghost" type="button" disabled={busy} onClick={()=>{setRightsTarget(p);setRights({sms_access:p.sms_access||false,sms_manage_contacts:p.sms_manage_contacts||false,sms_manage_settings:p.sms_manage_settings||false,finance_manager:p.finance_manager||false});}}>Ρυθμίσεις</button></td><td><button className="btn ghost" type="button" disabled={busy||p.id===currentId} onClick={()=>{setResetTarget(p);setResetPassword('');}}>Επαναφορά</button></td><td><button className={'toggle '+(p.active?'on':'')} disabled={busy||p.id===currentId} onClick={()=>void execute(async()=>{const {error}=await supabase.from('profiles').update({active:!p.active}).eq('id',p.id);if(error)throw error;},p.active?'Ο λογαριασμός απενεργοποιήθηκε.':'Ο λογαριασμός ενεργοποιήθηκε.')}>{p.active?'Ενεργός':'Ανενεργός'}</button></td><td><button type="button" className="btn ghost" disabled={busy||p.id===currentId} onClick={()=>setDeleteTarget(p)} aria-label={'Διαγραφή χρήστη '+p.username}><Trash2 size={16}/> Διαγραφή</button></td></tr>)}</tbody></table></div>
  </section>
  {createOpen&&<Modal title="Δημιουργία λογαριασμού στελέχους" onClose={()=>setCreateOpen(false)}><form className="form-stack" onSubmit={e=>void createUser(e)}><p className="muted">Επίλεξε πρόσβαση και οργανωτική ιδιότητα. Ο χρήστης θα συνδέεται μόνο με username και password.</p><label>Ονοματεπώνυμο<input value={name} onChange={e=>setName(e.target.value)} minLength={2} maxLength={100} required /></label><label>Username<input value={username} onChange={e=>setUsername(e.target.value)} minLength={3} maxLength={32} pattern="[a-zA-Z][a-zA-Z0-9._-]{2,31}" required autoCapitalize="none" spellCheck={false} /></label><label>Επίπεδο πρόσβασης<select value={createRole} onChange={e=>setCreateRole(e.target.value as Profile['role'])}><option value="member">Στέλεχος</option><option value="coordinator">Συντονιστής</option><option value="leadership">Ηγεσία</option><option value="admin">Admin</option></select></label><label>Οργανωτική ιδιότητα (ελεύθερη)<input value={position} maxLength={100} onChange={e=>setPosition(e.target.value)} /></label><label>Αρχικός κωδικός<input type="password" value={password} onChange={e=>setPassword(e.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required /></label><div className="form-actions"><button className="btn ghost" type="button" onClick={()=>setCreateOpen(false)}>Άκυρο</button><button className="btn primary" disabled={busy} type="submit"><UserPlus size={17}/> Δημιουργία χρήστη</button></div></form></Modal>}
  {rightsTarget&&<Modal title={'Δικαιώματα — @'+rightsTarget.username} onClose={()=>setRightsTarget(null)}><form className="form-stack" onSubmit={e=>{e.preventDefault();void execute(async()=>{const {error}=await supabase.from('profiles').update(rights).eq('id',rightsTarget.id);if(error)throw error;},'Τα δικαιώματα ενημερώθηκαν.').then(ok=>{if(ok)setRightsTarget(null);});}}>
   <p className="muted">Τα δικαιώματα του ρόλου είναι μόνιμα επιλεγμένα και δεν αλλάζουν εδώ. Μόνο η αλλαγή ρόλου μπορεί να τα μεταβάλει. Το Audit Log είναι αποκλειστικά για Admin.</p>
   <label className="permissions-row"><input type="checkbox" checked={['admin','leadership'].includes(rightsTarget.role)} disabled readOnly/><span>Όλες οι εργασίες (δικαίωμα ρόλου)</span></label>
   <label className="permissions-row"><input type="checkbox" checked={['admin','leadership'].includes(rightsTarget.role)} disabled readOnly/><span>Δημιουργία και διαχείριση εκδηλώσεων (δικαίωμα ρόλου)</span></label>
   <label className="permissions-row"><input type="checkbox" checked={['admin','leadership'].includes(rightsTarget.role)} disabled readOnly/><span>Προβολή και διαχείριση ομάδων (δικαίωμα ρόλου)</span></label>
   <label className="permissions-row"><input type="checkbox" checked={rightsTarget.role==='admin'} disabled readOnly/><span>Διαχείριση χρηστών και ρόλων (μόνο Admin)</span></label>
   <label className="permissions-row"><input type="checkbox" checked={rightsTarget.role==='admin'} disabled readOnly/><span>Προβολή Audit Log (μόνο Admin)</span></label>
   <label className="permissions-row"><input type="checkbox" checked={rightsTarget.role==='admin'||rights.sms_access} disabled={rightsTarget.role==='admin'} onChange={e=>setRights(v=>({...v,sms_access:e.target.checked,sms_manage_contacts:e.target.checked?v.sms_manage_contacts:false,sms_manage_settings:e.target.checked?v.sms_manage_settings:false}))}/><span>Πρόσβαση στα Μηνύματα SMS</span></label>
   <label className="permissions-row"><input type="checkbox" checked={rightsTarget.role==='admin'||(rights.sms_access&&rights.sms_manage_contacts)} disabled={rightsTarget.role==='admin'||!rights.sms_access} onChange={e=>setRights(v=>({...v,sms_manage_contacts:e.target.checked}))}/><span>Εισαγωγή / επεξεργασία παραληπτών SMS</span></label>
   <label className="permissions-row"><input type="checkbox" checked={rightsTarget.role==='admin'||(rights.sms_access&&rights.sms_manage_settings)} disabled={rightsTarget.role==='admin'||!rights.sms_access} onChange={e=>setRights(v=>({...v,sms_manage_settings:e.target.checked}))}/><span>Διαχείριση SMS εξαιρέσεων</span></label>
   <label className="permissions-row"><input type="checkbox" checked={rightsTarget.role==='admin'||rightsTarget.role==='leadership'||rights.finance_manager} disabled={rightsTarget.role==='admin'||rightsTarget.role==='leadership'} onChange={e=>setRights(v=>({...v,finance_manager:e.target.checked}))}/><span>Οικονομικός Διαχειριστής — πρόσβαση μόνο στην Οικονομική Διαχείριση, χωρίς αναβάθμιση ρόλου</span></label>
   <label className="permissions-row"><input type="checkbox" checked={rightsTarget.role==='admin'} disabled readOnly/><span>Διαχείριση Sender IDs (μόνο Admin)</span></label>
   <div className="form-actions"><button className="btn ghost" type="button" onClick={()=>setRightsTarget(null)}>Άκυρο</button><button className="btn primary" disabled={busy}>Αποθήκευση</button></div></form></Modal>}
  {deleteTarget&&<Modal title={'Οριστική διαγραφή — @'+deleteTarget.username} onClose={()=>setDeleteTarget(null)}><div className="form-stack"><p>Ο λογαριασμός θα διαγραφεί οριστικά από το Portal και το Supabase Auth. Η ενέργεια δεν αναιρείται.</p><p className="muted">Αν το στέλεχος έχει ανατεθειμένες εργασίες ή καταχωρισμένες εκδηλώσεις, θα χρειαστεί πρώτα να μεταφέρεις αυτές τις ευθύνες.</p><div className="form-actions"><button type="button" className="btn ghost" onClick={()=>setDeleteTarget(null)}>Άκυρο</button><button type="button" disabled={busy} className="btn danger" onClick={()=>{const target=deleteTarget;void execute(()=>adminRequest('/api/users/delete',{userId:target.id}),'Το στέλεχος διαγράφηκε.').then(ok=>{if(ok)setDeleteTarget(null);});}}><Trash2 size={17}/> Οριστική διαγραφή</button></div></div></Modal>}
  {resetTarget&&<Modal title={'Επαναφορά κωδικού — @'+resetTarget.username} onClose={()=>setResetTarget(null)}><form className="form-stack" onSubmit={e=>void resetUserPassword(e)}><p className="muted">Θα οριστεί νέος κωδικός για το συγκεκριμένο στέλεχος, χωρίς email. Μην στείλεις τον κωδικό σε ομαδική συνομιλία.</p><label>Νέος προσωρινός κωδικός<input type="password" value={resetPassword} onChange={e=>setResetPassword(e.target.value)} minLength={12} maxLength={128} autoComplete="new-password" required/></label><div className="form-actions"><button type="button" className="btn ghost" onClick={()=>setResetTarget(null)}>Άκυρο</button><button className="btn primary" type="submit" disabled={busy}>Αποθήκευση νέου κωδικού</button></div></form></Modal>}
 </>;
}

function AuditPage({audits:initial,person}:{audits:Audit[];person:(id:string)=>string}) {
 const [rows,setRows]=useState<Audit[]>(initial);const [filter,setFilter]=useState('');const [kind,setKind]=useState('');const [offset,setOffset]=useState(0);const [more,setMore]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 const load=useCallback(async()=>{setBusy(true);setError('');
  let q=supabase.from('audit_log').select('*').order('created_at',{ascending:false}).range(offset,offset+74);
  if(kind)q=q.eq('entity_type',kind);
  const r=await q;setBusy(false);if(r.error){setError(r.error.message);return;}setRows((r.data||[]) as Audit[]);setMore((r.data||[]).length===75);
 },[offset,kind]);
 useEffect(()=>{void load();},[load]);
 const visible=rows.filter(a=>(person(a.actor_id||'')+' '+a.entity_type+' '+a.action+' '+JSON.stringify(a.details)).toLocaleLowerCase('el').includes(filter.toLocaleLowerCase('el')));
 const entity:Record<string,string>={tasks:'Εργασία',profiles:'Λογαριασμός',teams:'Ομάδα',team_members:'Μέλος ομάδας',task_assignees:'Ανάθεση',task_checklist:'Checklist',task_comments:'Σχόλιο',events:'Πρόγραμμα',sms_campaign:'Καμπάνια SMS',sms_sender:'Sender ID',sms_exclusion:'SMS εξαίρεση',sms_contacts:'Παραλήπτες SMS',user_account:'Χρήστης'};
 const actions:Record<string,string>={insert:'Δημιουργία',update:'Αλλαγή',delete:'Διαγραφή',created:'Δημιουργία λογαριασμού',password_reset:'Επαναφορά κωδικού',self_password_changed:'Αλλαγή προσωπικού κωδικού',self_login:'Σύνδεση',create:'Δημιουργία καμπάνιας',finished:'Ολοκλήρωση καμπάνιας',cancel:'Ακύρωση',import:'Εισαγωγή αρχείου',enable:'Ενεργοποίηση',disable:'Απενεργοποίηση',archive:'Αρχειοθέτηση',upsert:'Προσθήκη / ενημέρωση',remove:'Αφαίρεση'};
 return <><div className="heading-row"><div><p className="eyebrow">ΚΕΝΤΡΙΚΟΣ ΕΛΕΓΧΟΣ</p><h1>Audit Log</h1><p className="page-sub">Μόνιμο ενιαίο ιστορικό σημαντικών αλλαγών και SMS ενεργειών. Χωρίς κωδικούς, tokens και πλήρη τηλέφωνα στα στοιχεία ελέγχου.</p></div></div><section className="panel"><div className="filter-row"><div className="search-field"><Search size={18}/><input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Αναζήτηση στην τρέχουσα σελίδα"/></div><select value={kind} onChange={e=>{setKind(e.target.value);setOffset(0);}}><option value="">Όλες οι ενότητες</option>{Object.entries(entity).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select><button className="btn secondary" disabled={busy} onClick={()=>void load()}><RefreshCw size={16}/> Ανανέωση</button></div>{error&&<p role="alert">{error}</p>}<div className="audit-rows">{visible.map(a=><div className="audit-row" key={a.id}><span className="audit-icon"><Activity size={18}/></span><div><strong>{entity[a.entity_type]||a.entity_type} · {actions[a.action]||a.action}</strong><p>{a.actor_id?person(a.actor_id):'Ενέργεια συστήματος'} · {a.entity_id||'—'}</p><small>{JSON.stringify(a.details)}</small></div><time>{dateFmt(a.created_at,{dateStyle:'medium',timeStyle:'short'})}</time></div>)}{!visible.length&&<Empty title="Δεν υπάρχουν καταγραφές" detail="Άλλαξε φίλτρα ή σελίδα."/>}</div><div className="sms-button-row"><button className="btn secondary" disabled={offset===0||busy} onClick={()=>setOffset(v=>Math.max(0,v-75))}>Προηγούμενα</button><span>Σελίδα {Math.floor(offset/75)+1}</span><button className="btn secondary" disabled={!more||busy} onClick={()=>setOffset(v=>v+75)}>Επόμενα</button></div></section></>;
}
function PasswordChange({close,notify}:{close:()=>void;notify:(v:string)=>void}) {
 const [pass,setPass]=useState(''); const [busy,setBusy]=useState(false);
 return <Modal title="Αλλαγή κωδικού πρόσβασης" onClose={close}><form className="form-stack" onSubmit={async e=>{e.preventDefault();setBusy(true);const {error}=await supabase.auth.updateUser({password:pass});setBusy(false);if(error)notify('Η αλλαγή κωδικού απέτυχε: '+error.message);else{const {data}=await supabase.auth.getSession();if(data.session)void fetch('/api/audit/security',{method:'POST',headers:{authorization:`Bearer ${data.session.access_token}`,'content-type':'application/json'},body:JSON.stringify({event:'password_changed'})}).catch(()=>null);notify('Ο κωδικός ενημερώθηκε επιτυχώς.');close();}}}><p className="muted">Άλλαξε τον προσωρινό κωδικό που σου έδωσε ο Admin. Χρησιμοποίησε τουλάχιστον 12 χαρακτήρες.</p><label>Νέος κωδικός<input type="password" value={pass} minLength={12} required onChange={e=>setPass(e.target.value)} autoComplete="new-password"/></label><div className="form-actions"><button className="btn ghost" onClick={close} type="button">Άκυρο</button><button className="btn primary" disabled={busy}>Αποθήκευση</button></div></form></Modal>;
}
