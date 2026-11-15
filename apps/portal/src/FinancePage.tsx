import {useCallback,useEffect,useMemo,useState,type FormEvent,type ReactNode} from 'react';
import {ArrowDownLeft,ArrowLeftRight,ArrowUpRight,CalendarDays,ChevronDown,ChevronUp,Download,FileText,Landmark,LockKeyhole,Pencil,Plus,RefreshCw,RotateCcw,Trash2,Wallet,X} from 'lucide-react';
import {supabase,dateFmt} from './lib';
import type {Event,Profile} from './types';
import {parseEuro,accountBalanceAt,eventResult} from './financeMath.js';
import {getMonthlyRegisterMovements,depositAvailableChangeForMonth} from './financePeriod.js';
import {filterByEvent,allocatedAmount} from './financeEventFilter.js';
import {transferDirection} from './transferDirection.js';

type Account={id:string;code:'cash'|'bank'|'revolut'|'deposit';name:string;is_deposit:boolean;sort_order:number};
type Category={id:string;direction:'income'|'expense';name:string;active:boolean};
type Direction='income'|'expense';
type Register={id:string;direction:Direction;title:string;category_id:string|null;description:string;created_at:string};
type Transaction={id:string;kind:Direction|'transfer'|'opening'|'reversal';register_id:string|null;amount:number;happened_on:string;note:string;reversed_transaction_id:string|null;created_at:string};
type Leg={transaction_id:string;account_id:string;delta:number};
type Allocation={transaction_id:string;event_id:string;amount:number};
type Expected={id:string;direction:Direction;title:string;amount:number|null;expected_on:string|null;account_id:string|null;register_id:string|null;event_id:string|null;status:'pending'|'settled'|'cancelled';beneficiary:string;note:string;settled_transaction_id:string|null};
type Close={month_start:string;snapshot:Record<string,unknown>;closed_at:string};
type Reconcile={id:string;account_id:string;happened_on:string;actual_balance:number;created_at:string;note:string};
type Audit={id:number;actor_id:string;action:string;entity_kind:string;entity_id:string;details:unknown;happened_at:string};
type FinanceData={accounts:Account[];categories:Category[];registers:Register[];transactions:Transaction[];legs:Leg[];allocations:Allocation[];expected:Expected[];closes:Close[];reconciliations:Reconcile[];audit:Audit[]};
const initial:FinanceData={accounts:[],categories:[],registers:[],transactions:[],legs:[],allocations:[],expected:[],closes:[],reconciliations:[],audit:[]};
const eur=(n:number)=>new Intl.NumberFormat('el-GR',{style:'currency',currency:'EUR'}).format(Math.round(n*100)/100);
const today=()=>new Date().toLocaleDateString('sv-SE');
const monthStart=(v:string)=>v.slice(0,7)+'-01';
const nextMonth=(m:string)=>{const d=new Date(m+'T12:00:00');d.setMonth(d.getMonth()+1);return d.toLocaleDateString('sv-SE');};
const monthTitle=(m:string)=>new Intl.DateTimeFormat('el-GR',{month:'long',year:'numeric'}).format(new Date(m+'T12:00:00'));
const toEuro=parseEuro;
const downloadable=(name:string,rows:(string|number)[][])=>{const csv='\uFEFF'+rows.map(r=>r.map(v=>{const cell=String(v??'');const safe=typeof v==='string'&&/^[\s]*[=+@-]/.test(cell)?'\''+cell:cell;return '"'+safe.replaceAll('"','""')+'"';}).join(';')).join('\r\n');const href=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=href;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(href),500);};
async function getAll(table:string){const result:unknown[]=[];for(let n=0;n<15;n++){
 let query=supabase.from(table).select('*');
 if(table==='finance_legs')query=query.order('transaction_id').order('account_id');
 else if(table==='finance_allocations')query=query.order('transaction_id').order('event_id');
 else if(table==='finance_month_closes')query=query.order('month_start');
 else query=query.order('id');
 const {data,error}=await query.range(n*500,n*500+499);if(error)throw error;result.push(...(data||[]));if((data||[]).length<500)return result;}throw Error('Πάρα πολλές εγγραφές. Χρειάζεται σελιδοποίηση.');}
const inputLabel=(title:string,child:ReactNode)=><label className="finance-label">{title}{child}</label>;

export default function FinancePage({events,profiles,isAdmin,selectedEvent,onClearEvent}:{events:Event[];profiles:Profile[];isAdmin:boolean;selectedEvent:string|null;onClearEvent:()=>void}){
 const [data,setData]=useState<FinanceData>(initial);
 const [busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[success,setSuccess]=useState('');
 const [tab,setTab]=useState<'overview'|'registers'|'expected'|'transfers'|'months'|'audit'|'settings'>('registers');
 const [month,setMonth]=useState(monthStart(today())),[search,setSearch]=useState('');
 const [registerFilter,setRegisterFilter]=useState<'all'|Direction>('all');
 const [eventFilter,setEventFilter]=useState<string>(selectedEvent||'');
 const [form,setForm]=useState<'new'|'edit'|'editPayment'|'payment'|'transfer'|'expected'|'opening'|'reconcile'|'settle'|null>(null);
 const [registerId,setRegisterId]=useState<string|null>(null),[expectedId,setExpectedId]=useState<string|null>(null),[editingExpected,setEditingExpected]=useState<string|null>(null);
 const [editingRegisterId,setEditingRegisterId]=useState<string|null>(null),[editingTransactionId,setEditingTransactionId]=useState<string|null>(null);
 const [direction,setDirection]=useState<Direction>('expense'),[title,setTitle]=useState(''),[description,setDescription]=useState(''),[category,setCategory]=useState('');
 const [amount,setAmount]=useState(''),[date,setDate]=useState(today()),[account,setAccount]=useState(''),[toAccount,setToAccount]=useState(''),[note,setNote]=useState('');
 const [splits,setSplits]=useState<{event_id:string;amount:string}[]>([]);
 const [expectedEvent,setExpectedEvent]=useState(''),[expectedRegister,setExpectedRegister]=useState(''),[beneficiary,setBeneficiary]=useState(''),[categoryName,setCategoryName]=useState(''),[categoryDirection,setCategoryDirection]=useState<Direction>('expense');
 const [cancelExpectedTarget,setCancelExpectedTarget]=useState<Expected|null>(null);
 const [deleteTransferTarget,setDeleteTransferTarget]=useState<Transaction|null>(null);
 const [deleteTarget,setDeleteTarget]=useState<Register|null>(null);
 const [deleteConfirmation,setDeleteConfirmation]=useState(''),[deleteReason,setDeleteReason]=useState('');
 const load=useCallback(async()=>{setLoading(true);setError('');try{
  const tables=['finance_accounts','finance_categories','finance_registers','finance_transactions','finance_legs','finance_allocations','finance_expected','finance_month_closes','finance_reconciliations','finance_audit'];
  const all=await Promise.all(tables.map(getAll));
  setData({accounts:(all[0] as Account[]).sort((a,b)=>a.sort_order-b.sort_order),categories:all[1] as Category[],registers:all[2] as Register[],transactions:all[3] as Transaction[],legs:all[4] as Leg[],allocations:all[5] as Allocation[],expected:all[6] as Expected[],closes:all[7] as Close[],reconciliations:all[8] as Reconcile[],audit:(all[9] as Audit[]).sort((a,b)=>b.id-a.id)});
 }catch(e){setError(e instanceof Error?e.message:String(e));}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 useEffect(()=>{setEventFilter(selectedEvent||'');if(selectedEvent){setTab('registers');setSearch('');}},[selectedEvent]);
 const run=async(fn:()=>Promise<unknown>,msg:string)=>{setBusy(true);setError('');setSuccess('');try{await fn();await load();setSuccess(msg);setForm(null);return true;}catch(e){setError(e instanceof Error?e.message:String(e));return false;}finally{setBusy(false);}};
 const visibleExpected=useMemo(()=>data.expected.filter(e=>e.status!=='cancelled'),[data.expected]);
 const initializedAccounts=useMemo(()=>new Set(data.audit.filter(a=>a.action==='opening'&&a.entity_kind==='account').map(a=>a.entity_id)),[data.audit]);
 const fullyInitialized=data.accounts.length===4 && data.accounts.every(a=>initializedAccounts.has(a.id));
 const reversed=useMemo(()=>new Set(data.transactions.filter(t=>t.reversed_transaction_id).map(t=>t.reversed_transaction_id)),[data.transactions]);
 // Monthly financial postings: registers stay permanent, but the list and sums follow the selected accounting month.
 const monthTransactions=useMemo(()=>data.transactions.filter(t=>t.happened_on.startsWith(month.slice(0,7))),[data.transactions,month]);
 const monthRegisterMovements=useMemo(()=>getMonthlyRegisterMovements(data.transactions,month),[data.transactions,month]);
 const registersWithMovements=useMemo(()=>new Set(data.transactions.filter(t=>t.register_id&&(t.kind==='income'||t.kind==='expense')).map(t=>t.register_id)),[data.transactions]);
 const txAccount=(txId:string)=>{
  const transaction=data.transactions.find(t=>t.id===txId);
  if(transaction?.kind==='transfer'){
   const movement=transferDirection(txId,data.legs,data.accounts);
   return movement?`${movement.from} → ${movement.to}`:'Μη αναγνωρίσιμη κατεύθυνση';
  }
  return data.legs.filter(l=>l.transaction_id===txId).map(l=>data.accounts.find(a=>a.id===l.account_id)?.name||'Λογαριασμός').join(' → ');
 };
 const matchingMovements=(id:string)=>filterByEvent(monthRegisterMovements.get(id)||[],data.allocations,eventFilter);
 const monthlyRegisterTotal=(id:string)=>matchingMovements(id).filter(t=>!reversed.has(t.id))
  .reduce((s,t)=>s+allocatedAmount(t,data.allocations,eventFilter),0);
 const totals=useMemo(()=>{
  const balance=(a:Account,until:string,withFirstOpening=false)=>accountBalanceAt(data.legs,data.transactions,a.id,until,withFirstOpening);
  const next=nextMonth(month);
  const actual=(kind:Direction)=>monthTransactions.filter(t=>t.kind===kind&&!reversed.has(t.id)).reduce((s,t)=>s+Number(t.amount),0);
  const accounts=data.accounts.map(a=>({...a,opening:balance(a,month,true),closing:balance(a,next)}));
  return {accounts,income:actual('income'),expense:actual('expense'),availableOpen:accounts.filter(a=>!a.is_deposit).reduce((s,a)=>s+a.opening,0),availableClose:accounts.filter(a=>!a.is_deposit).reduce((s,a)=>s+a.closing,0),expectedIncome:data.expected.filter(e=>e.status==='pending'&&e.direction==='income'&&e.amount!=null).reduce((s,e)=>s+Number(e.amount),0),expectedExpense:data.expected.filter(e=>e.status==='pending'&&e.direction==='expense'&&e.amount!=null).reduce((s,e)=>s+Number(e.amount),0),expectedUnknown:data.expected.filter(e=>e.status==='pending'&&e.amount==null).length};
 },[data,month,monthTransactions,reversed]);
 const fiscalMonths=useMemo(()=>{
  const y=Number(month.slice(0,4)),m=Number(month.slice(5,7)),start=m>=6?y:y-1;
  return Array.from({length:12},(_,i)=>{const d=new Date(start,5+i,1,12);const key=d.toLocaleDateString('sv-SE');const next=nextMonth(key);
   const mtx=data.transactions.filter(t=>t.happened_on>=key&&t.happened_on<next&& !reversed.has(t.id));
   const inc=mtx.filter(t=>t.kind==='income').reduce((a,t)=>a+Math.round(Number(t.amount)*100),0)/100;
   const exp=mtx.filter(t=>t.kind==='expense').reduce((a,t)=>a+Math.round(Number(t.amount)*100),0)/100;
   const avail=data.accounts.filter(a=>!a.is_deposit).reduce((a,x)=>a+accountBalanceAt(data.legs,data.transactions,x.id,next),0);
   return {key,name:monthTitle(key),income:inc,expense:exp,net:inc-exp,depositDelta:depositAvailableChangeForMonth(data.transactions,data.legs,data.accounts,key,reversed),available:avail,closed:data.closes.some(c=>c.month_start===key)};});
 },[month,data,reversed]);
 // Sum only transfers between deposit and available accounts *within the selected month*.
 // Deposit receipts/expenses and all prior-month transfers are not included.
 const monthlyDepositDelta=useMemo(()=>depositAvailableChangeForMonth(data.transactions,data.legs,data.accounts,month,reversed),[data.transactions,data.legs,data.accounts,month,reversed]);
 const eventTotals=useMemo(()=>{if(!eventFilter)return null;
  const currentIds=new Set(monthTransactions.filter(t=>t.kind!=='reversal'&&!reversed.has(t.id)).map(t=>t.id));
  const effective=eventResult(data.allocations.filter(a=>currentIds.has(a.transaction_id)),data.transactions,eventFilter);
  return {income:effective.incomeCents/100,expense:effective.expenseCents/100};
 },[eventFilter,data.allocations,data.transactions,monthTransactions,reversed]);
 // Newest accounting date first, then posting timestamp; NEVER sort historical records by import time.
 // Include a truly empty register only in the month it was created, not in every month.
 const visibleRegs=data.registers.filter(r=>{
  const movements=monthRegisterMovements.get(r.id)||[];
  if(!movements.length && (registersWithMovements.has(r.id)||r.created_at.slice(0,7)!==month.slice(0,7)))return false;
  if(registerFilter!=='all'&&r.direction!==registerFilter)return false;
  if(eventFilter&&!matchingMovements(r.id).length)return false;
  return (r.title+' '+r.description+' '+(data.categories.find(c=>c.id===r.category_id)?.name||'')).toLocaleLowerCase('el').includes(search.toLocaleLowerCase('el'));
 }).sort((a,b)=>{
  const aTx=matchingMovements(a.id)[0],bTx=matchingMovements(b.id)[0];
  const aDay=aTx?.happened_on||a.created_at.slice(0,10),bDay=bTx?.happened_on||b.created_at.slice(0,10);
  return bDay.localeCompare(aDay) || (bTx?.created_at||b.created_at).localeCompare(aTx?.created_at||a.created_at) || b.id.localeCompare(a.id);
 });
 const openedMonths=useMemo(()=>new Set(data.closes.map(x=>x.month_start)),[data.closes]);
 const earliestUnclosedMonth=useMemo(()=>{
  const pending=[...new Set(data.transactions.map(t=>monthStart(t.happened_on)))].filter(m=>!openedMonths.has(m)).sort();
  return pending[0]||null;
 },[data.transactions,openedMonths]);
 const locked=(day:string)=>data.closes.some(c=>c.month_start>=monthStart(day));
 const reset=()=>{setAmount('');setNote('');setDate(today());setSplits([]);setAccount(data.accounts.find(a=>!a.is_deposit)?.id||'');setToAccount(data.accounts.find(a=>a.code==='bank')?.id||'');setError('');};
 const openPayment=(reg:Register)=>{reset();if(eventFilter)setSplits([{event_id:eventFilter,amount:''}]);setRegisterId(reg.id);setDirection(reg.direction);setForm('payment');};
 const openNew=(kind:Direction)=>{reset();setEditingRegisterId(null);setEditingTransactionId(null);setDirection(kind);setTitle('');setDescription('');setCategory('');setForm('new');};
 // Prefill the same fields as creation. In a multi-payment register, header editing
 // modifies only metadata; each posted movement has its own Edit button.
 const activeRegisterMovements=(id:string)=>data.transactions.filter(t=>t.register_id===id&&(t.kind==='income'||t.kind==='expense')&&!reversed.has(t.id));
 const prefillEdit=(reg:Register,tx:Transaction|null,mode:'edit'|'editPayment')=>{
  reset();setRegisterId(reg.id);setEditingRegisterId(reg.id);setEditingTransactionId(tx?.id||null);
  setDirection(reg.direction);setTitle(reg.title);setDescription(reg.description);setCategory(reg.category_id||'');
  if(tx){setAmount(String(tx.amount).replace('.',','));setDate(tx.happened_on);setNote(tx.note);
   setAccount(data.legs.find(l=>l.transaction_id===tx.id)?.account_id||'');
   setSplits(data.allocations.filter(a=>a.transaction_id===tx.id).map(a=>({event_id:a.event_id,amount:String(a.amount).replace('.',',')})));
  }else{setAmount('');setNote('');setSplits([]);}
  setForm(mode);
 };
 const openEditRegister=(reg:Register)=>{
  const movements=activeRegisterMovements(reg.id);
  prefillEdit(reg,movements.length===1?movements[0]:null,'edit');
 };
 const openEditPayment=(reg:Register,tx:Transaction)=>prefillEdit(reg,tx,'editPayment');
 const rpc=async(name:string,payload:Record<string,unknown>)=>{const {data:result,error:rpcError}=await supabase.rpc(name,payload);if(rpcError)throw rpcError;return result as string;};
 const sendNew=async(e:FormEvent)=>{e.preventDefault();
  const firstAmount=amount.trim()===''?null:toEuro(amount);
  if(firstAmount!==null&&(!Number.isFinite(firstAmount)||firstAmount<=0)){setError('Συμπλήρωσε έγκυρο πρώτο ποσό ή άφησέ το κενό.');return;}
  if(firstAmount!==null&&(!account||!date)){setError('Συμπλήρωσε ημερομηνία και λογαριασμό για την πρώτη κίνηση.');return;}
  const ok=await run(async()=>{const id=await rpc('finance_create_register_with_first_payment',{
    p_direction:direction,p_title:title,p_category:category||null,p_description:description,
    p_first_amount:firstAmount,p_date:firstAmount===null?null:date,p_account:firstAmount===null?null:account,
    p_event:firstAmount!==null&&eventFilter?eventFilter:null
  });setRegisterId(id);},firstAmount===null?'Η συγκεντρωτική εγγραφή δημιουργήθηκε.':'Η εγγραφή και η πρώτη κίνηση αποθηκεύτηκαν.');
  if(ok)setTab('registers');
 };
 const sendEdit=async(e:FormEvent)=>{e.preventDefault();
  if(!editingRegisterId)return;
  const value=amount.trim()===''?null:toEuro(amount);
  if(value!==null&&(!Number.isFinite(value)||value<=0||!account||!date)){
   setError('Συμπλήρωσε έγκυρο ποσό, ημερομηνία και λογαριασμό.');return;
  }
  const allocations=splits.map(s=>({event_id:s.event_id,amount:toEuro(s.amount)}));
  if(allocations.some(a=>!a.event_id||!Number.isFinite(a.amount)||a.amount<=0)
   || new Set(allocations.map(a=>a.event_id)).size!==allocations.length
   || (value!==null&&allocations.reduce((sum,a)=>sum+Math.round(a.amount*100),0)>Math.round(value*100))){
    setError('Έλεγξε τον επιμερισμό σε εκδηλώσεις: έγκυρα ποσά, χωρίς διπλότυπα και χωρίς υπέρβαση.');return;
  }
  if(editingTransactionId&&value===null&&!window.confirm('Να αφαιρεθεί λογιστικά αυτή η πληρωμή; Θα διατηρηθεί ως αντιλογισμένη στο ιστορικό.'))return;
  const completed=await run(()=>rpc('finance_edit_entry',{
   p_register:editingRegisterId,p_direction:direction,p_title:title,p_category:category||null,
   p_description:description,p_transaction:editingTransactionId,p_amount:value,
   p_date:value===null?null:date,p_account:value===null?null:account,p_note:note,p_allocations:value===null?[]:allocations
  }),'Η εγγραφή ενημερώθηκε με ασφαλές ιστορικό αλλαγών.');
  if(completed)setTab('registers');
 };
 const sendPayment=async(e:FormEvent)=>{e.preventDefault();if(!registerId)return;if(!Number.isFinite(toEuro(amount))||toEuro(amount)<=0){setError('Γράψε σωστό ποσό, π.χ. 1.250,50 ή 1250,50.');return;}const allocations=splits.map(s=>({event_id:s.event_id,amount:s.event_id===eventFilter&&splits.length===1&&!s.amount.trim()?toEuro(amount):toEuro(s.amount)}));
 if(allocations.some(s=>!s.event_id||!Number.isFinite(s.amount)||s.amount<=0)||new Set(allocations.map(s=>s.event_id)).size!==allocations.length||allocations.reduce((n,s)=>n+Math.round(s.amount*100),0)>Math.round(toEuro(amount)*100)){
  setError('Συμπλήρωσε σωστά όλες τις εκδηλώσεις και τα επιμέρους ποσά χωρίς διπλότυπα. Η κατανομή δεν μπορεί να υπερβαίνει το συνολικό ποσό.');return;
 }
 await run(async()=>{
  const posted=await rpc('finance_post',{p_kind:direction,p_date:date,p_amount:toEuro(amount),p_account:account,p_to_account:null,p_register:registerId,p_note:note,p_allocations:allocations});void posted;
 },'Το ποσό προστέθηκε στην εγγραφή, με πλήρες ιστορικό.');};
 const sendTransfer=async(e:FormEvent)=>{e.preventDefault();if(!Number.isFinite(toEuro(amount))||toEuro(amount)<=0){setError('Γράψε σωστό ποσό, π.χ. 1.250,50.');return;}await run(()=>rpc('finance_post',{p_kind:'transfer',p_date:date,p_amount:toEuro(amount),p_account:account,p_to_account:toAccount,p_register:null,p_note:note,p_allocations:[]}), 'Η μεταφορά ολοκληρώθηκε χωρίς να θεωρηθεί έσοδο ή έξοδο.');};
 const sendExpected=async(e:FormEvent)=>{e.preventDefault();const value=amount.trim()===''?null:toEuro(amount);if(value!==null&&(!Number.isFinite(value)||value<=0)){setError('Γράψε θετικό ποσό ή άφησέ το κενό αν δεν το γνωρίζεις.');return;}await run(()=>rpc('finance_expected_write',{p_id:editingExpected,p_direction:direction,p_title:title,p_amount:value,p_date:date||null,p_account:account||null,p_register:expectedRegister||null,p_event:expectedEvent||null,p_note:note,p_status:'pending',p_beneficiary:beneficiary}),editingExpected?'Το αναμενόμενο ενημερώθηκε.':'Το αναμενόμενο καταχωρίστηκε.');};
 const sendOpening=async(e:FormEvent)=>{e.preventDefault();if(!Number.isFinite(toEuro(amount))||toEuro(amount)<0){setError('Γράψε σωστό αρχικό υπόλοιπο (επιτρέπεται 0).');return;}await run(()=>rpc('finance_opening',{p_date:date,p_account:account,p_amount:toEuro(amount)}),'Το αρχικό υπόλοιπο αποθηκεύτηκε.');};
 const sendReconcile=async(e:FormEvent)=>{e.preventDefault();if(!Number.isFinite(toEuro(amount))){setError('Γράψε σωστό πραγματικό υπόλοιπο.');return;}await run(()=>rpc('finance_reconcile',{p_account:account,p_date:date,p_actual:toEuro(amount),p_note:note}),'Ο έλεγχος υπολοίπου καταγράφηκε χωρίς αυτόματη διόρθωση.');};
 const reverse=async(t:Transaction)=>{const reason=window.prompt('Αιτιολογία αντιλογισμού (τουλάχιστον 5 χαρακτήρες):');if(!reason)return;await run(()=>rpc('finance_reverse',{p_transaction:t.id,p_reason:reason}),'Η συναλλαγή αντιλογίστηκε και το ιστορικό διατηρήθηκε.');};
 // Transfer deletion is independent of a reversal: the server deletes both signed legs
 // atomically after verifying the month is open, Admin rights and all dependencies.
 const openDeleteTransfer=(t:Transaction)=>{
  if(!isAdmin||busy||locked(t.happened_on))return;
  setError('');
  setDeleteTransferTarget(t);
 };
 const deleteTransfer=async()=>{
  const target=deleteTransferTarget;
  if(!target||!isAdmin||busy||locked(target.happened_on))return;
  const completed=await run(()=>rpc('finance_delete_transfer',{p_transaction:target.id,p_confirmation:'ΔΙΑΓΡΑΦΗ'}),'Η μεταφορά διαγράφηκε οριστικά και ενημερώθηκαν τα υπόλοιπα.');
  if(completed)setDeleteTransferTarget(null);
 };
 // One atomic Admin-only RPC removes the entire umbrella register and all of its payment/reversal legs.
 // No direct client DELETE calls, so failed authorization or closed-month checks cannot partially alter balances.
 const openPermanentDelete=(reg:Register)=>{setDeleteTarget(reg);setDeleteConfirmation('');setDeleteReason('');setError('');};
 const permanentlyDelete=async(e:FormEvent)=>{e.preventDefault();if(!deleteTarget||!isAdmin||deleteConfirmation!=='ΔΙΑΓΡΑΦΗ'||deleteReason.trim().length<5)return;
  const id=deleteTarget.id;
  const completed=await run(()=>rpc('finance_delete_register',{p_register:id,p_confirmation:deleteConfirmation,p_reason:deleteReason.trim()}),
   'Η εγγραφή και όλες οι συνδεδεμένες οικονομικές κινήσεις διαγράφηκαν οριστικά. Το audit log διατηρήθηκε.');
  if(completed){setRegisterId(current=>current===id?null:current);setDeleteTarget(null);setDeleteConfirmation('');setDeleteReason('');}
 };
 const sendSettle=async(e:FormEvent)=>{e.preventDefault();if(!expectedId)return;const value=toEuro(amount);if(!Number.isFinite(value)||value<=0){setError('Συμπλήρωσε το πραγματικό ποσό πριν την καταχώριση.');return;}await run(()=>rpc('finance_settle_expected_amount',{p_id:expectedId,p_date:date,p_account:account,p_amount:value,p_note:note}),'Το πραγματικό ποσό καταχωρίστηκε μία φορά.');};
 const exportMonth=()=>downloadable(`PROTOPORIA-Οικονομικά-${month.slice(0,7)}.csv`,[['Ημερομηνία','Τύπος','Εγγραφή','Ποσό','Λογαριασμοί','Περιγραφή','Αντιλογισμένο'],...monthTransactions.filter(t=>t.kind!=='reversal').sort((a,b)=>a.happened_on.localeCompare(b.happened_on)).map(t=>[t.happened_on,t.kind,data.registers.find(r=>r.id===t.register_id)?.title||'',t.amount,txAccount(t.id),t.note,reversed.has(t.id)?'Ναι':'Όχι'])]);
 const exportFiscal=()=>downloadable(`PROTOPORIA-Ετήσια-Στατιστικά-${fiscalMonths[0]?.key.slice(0,4)||''}.csv`,[['Μήνας','Έσοδα','Έξοδα','Καθαρό αποτέλεσμα','Μεταβολή από καταθετικό','Διαθέσιμο κλεισίματος','Κλειδωμένος'],...fiscalMonths.map(x=>[x.name,x.income,x.expense,x.net,x.depositDelta,x.available,x.closed?'Ναι':'Όχι'])]);
 const selectedRegister=data.registers.find(r=>r.id===registerId);
 return <div className="finance-page">
  <div className="heading-row"><div><p className="eyebrow">ΟΙΚΟΝΟΜΙΚΗ ΔΙΑΧΕΙΡΙΣΗ</p><h1>Ταμείο & Οικονομικά</h1></div><button className="btn ghost" type="button" onClick={()=>void load()}><RefreshCw size={16}/> Ανανέωση</button></div>
  {error&&<div className="finance-alert finance-error" role="alert">{error}<button onClick={()=>setError('')} aria-label="Κλείσιμο"><X size={16}/></button></div>}
  {success&&<div className="finance-alert">{success}<button onClick={()=>setSuccess('')} aria-label="Κλείσιμο"><X size={16}/></button></div>}
  {loading?<div className="panel">Φόρτωση οικονομικών…</div>:<>
  {!fullyInitialized&&<div className="finance-alert finance-warn"><LockKeyhole size={17}/> Δεν έχουν αρχικοποιηθεί και οι τέσσερις λογαριασμοί από τα Excel. Τα μηδενικά που εμφανίζονται ΔΕΝ είναι επιβεβαιωμένα υπόλοιπα. Μην καταχωρίσεις κινήσεις πριν οριστεί κοινή ημερομηνία εκκίνησης και αρχικά υπόλοιπα για όλους. {isAdmin&&<button className="btn secondary" onClick={()=>{reset();setForm('opening');}}>Ορισμός αρχικού υπολοίπου</button>}</div>}
  <nav className="finance-tabs" aria-label="Οικονομικές ενότητες">{([['registers','Έσοδα / Έξοδα'],['expected','Αναμενόμενα'],['transfers','Μεταφορές'],['overview','Επισκόπηση'],['months','Μηνιαίο κλείσιμο'],['audit','Ιστορικό'],...(isAdmin?[['settings','Ρυθμίσεις'] as const]:[])] as const).map(([key,label])=><button key={key} type="button" className={tab===key?'selected':''} onClick={()=>setTab(key)}>{label}</button>)}</nav>
  {tab!=='expected'&&tab!=='settings'&&<div className="finance-month-head"><div><small>Επιλεγμένος μήνας</small><input type="month" value={month.slice(0,7)} onChange={e=>setMonth(e.target.value+'-01')}/></div><span className="finance-lock"><LockKeyhole size={14}/>{openedMonths.has(month)?'Κλειδωμένος μήνας':'Ανοιχτός μήνας'}</span><button className="btn ghost" onClick={exportMonth}><Download size={16}/> Εξαγωγή CSV / Excel</button></div>}
  {tab==='overview'&&<>
   <div className="finance-head-card"><small>ΓΕΝΙΚΟ ΔΙΑΘΕΣΙΜΟ • {monthTitle(month)}</small><strong>{eur(totals.availableClose)}</strong><span>Μετρητά + Τράπεζα + Revolut</span></div>
   <div className="finance-accounts">{totals.accounts.map(a=><article className={'finance-account '+(a.is_deposit?'finance-deposit':'')} key={a.id}><div className="finance-account-name">{a.code==='cash'?<Wallet/>:a.is_deposit?<LockKeyhole/>:<Landmark/>}{a.name}</div><strong>{eur(a.closing)}</strong><div className="finance-account-foot"><span>Άνοιγμα {eur(a.opening)}</span><span>Κλείσιμο {eur(a.closing)}</span></div></article>)}</div>
   <div className="finance-summary"><article><ArrowDownLeft size={19}/><small>Πραγματικά έσοδα</small><strong className="finance-positive">{eur(totals.income)}</strong></article><article><ArrowUpRight size={19}/><small>Πραγματικά έξοδα</small><strong>{eur(totals.expense)}</strong></article><article><ArrowLeftRight size={19}/><small>Καθαρό αποτέλεσμα</small><strong>{eur(totals.income-totals.expense)}</strong></article><article><Wallet size={19}/><small>Μεταβολή από/προς καταθετικό · {monthTitle(month)}</small><strong>{eur(monthlyDepositDelta)}</strong></article></div>
   <section className="panel"><h2>Έναρξη και κλείσιμο {monthTitle(month)}</h2><div className="finance-scroll"><table className="finance-table"><thead><tr><th>Λογαριασμός</th><th>Υπόλοιπο έναρξης</th><th>Υπόλοιπο κλεισίματος</th><th>Μεταβολή</th></tr></thead><tbody>{totals.accounts.map(a=><tr key={a.id}><td>{a.name}</td><td>{eur(a.opening)}</td><td>{eur(a.closing)}</td><td>{eur(a.closing-a.opening)}</td></tr>)}<tr className="finance-total"><td>Γενικό διαθέσιμο (χωρίς καταθετικό)</td><td>{eur(totals.availableOpen)}</td><td>{eur(totals.availableClose)}</td><td>{eur(totals.availableClose-totals.availableOpen)}</td></tr></tbody></table></div><p className="muted">Οι μεταφορές μεταξύ λογαριασμών δεν είναι λειτουργικά έσοδα ή έξοδα. Η μεταβολή του διαθεσίμου μπορεί να διαφέρει από το καθαρό αποτέλεσμα λόγω καταθετικού.</p></section>
   <section className="panel"><div className="finance-actionbar"><h2>Μηνιαία στατιστικά οικονομικού έτους</h2><button type="button" className="btn ghost" onClick={exportFiscal}><Download size={15}/> Εξαγωγή έτους (CSV / Excel)</button></div><p className="muted">Ιούνιος έως Μάιος, όπως στα ιστορικά Excel. Στον υπολογισμό εσόδων/εξόδων δεν περιλαμβάνονται μεταφορές ή αντιλογισμένες κινήσεις.</p><div className="finance-scroll"><table className="finance-table"><thead><tr><th>Μήνας</th><th>Έσοδα</th><th>Έξοδα</th><th>Καθαρό</th><th>Από/προς καταθετικό</th><th>Διαθέσιμο κλεισίματος</th><th>Κατάσταση</th></tr></thead><tbody>{fiscalMonths.map(r=><tr key={r.key} className={r.key===month?'finance-selected-month':''}><td><button className="finance-month-link" onClick={()=>setMonth(r.key)}>{r.name}</button></td><td>{eur(r.income)}</td><td>{eur(r.expense)}</td><td>{eur(r.net)}</td><td>{eur(r.depositDelta)}</td><td>{eur(r.available)}</td><td>{r.closed?'Κλειδωμένος':'Ανοιχτός'}</td></tr>)}</tbody></table></div></section>
   <section className="panel"><h2>Αναμενόμενα συνολικά</h2><div className="finance-row"><span>Έσοδα προς είσπραξη</span><strong>{eur(totals.expectedIncome)}</strong></div><div className="finance-row"><span>Έξοδα προς πληρωμή</span><strong>{eur(totals.expectedExpense)}</strong></div>{totals.expectedUnknown>0&&<div className="finance-row"><span>Χωρίς γνωστό ποσό</span><strong>{totals.expectedUnknown}</strong></div>}<p className="muted">Εκκρεμότητες όλων των ημερομηνιών. Τα άγνωστα ποσά δεν περιλαμβάνονται στα αθροίσματα.</p></section>
  </>}
  {tab==='registers'&&<>
   <section className="finance-compact-balances" aria-label={'Υπόλοιπα λογαριασμών στο τέλος '+monthTitle(month)}>
    <div className="finance-compact-balance finance-compact-total"><small>Γενικό διαθέσιμο</small><strong>{eur(totals.availableClose)}</strong></div>
    {totals.accounts.map(a=><div className="finance-compact-balance" key={a.id}><small>{a.name}{a.is_deposit?' · εκτός διαθεσίμου':''}</small><strong>{eur(a.closing)}</strong></div>)}
   </section>
   <div className="finance-actionbar finance-register-toolbar"><input aria-label="Αναζήτηση οικονομικής εγγραφής" placeholder="Αναζήτηση εγγραφής…" value={search} onChange={e=>setSearch(e.target.value)}/><button className="btn secondary" onClick={()=>openNew('income')}><Plus size={17}/> Νέο έσοδο</button><button className="btn primary" onClick={()=>openNew('expense')}><Plus size={17}/> Νέο έξοδο</button></div>
   <div className="finance-event-filter"><label htmlFor="finance-event-filter"><CalendarDays size={14}/> Εκδήλωση</label><select id="finance-event-filter" aria-label="Φίλτρο εκδήλωσης για έσοδα και έξοδα" value={eventFilter} onChange={e=>{setEventFilter(e.target.value);setRegisterId(null);}}><option value="">Όλες οι εκδηλώσεις</option>{[...events].sort((a,b)=>b.starts_at.localeCompare(a.starts_at)).map(e=><option key={e.id} value={e.id}>{e.title} · {dateFmt(e.starts_at)}</option>)}</select>{eventFilter&&<button type="button" className="btn ghost" onClick={()=>{setEventFilter('');setRegisterId(null);onClearEvent();}}>Καθαρισμός</button>}</div>
   {eventTotals&&<div className="finance-summary"><article><small>Έσοδα εκδήλωσης</small><strong>{eur(eventTotals.income)}</strong></article><article><small>Έξοδα εκδήλωσης</small><strong>{eur(eventTotals.expense)}</strong></article><article><small>Αποτέλεσμα εκδήλωσης</small><strong>{eur(eventTotals.income-eventTotals.expense)}</strong></article></div>}
   <p className="muted">Κινήσεις {monthTitle(month)} · νεότερες πρώτα. {eventFilter?"Τα ποσά δείχνουν μόνο το μερίδιο της επιλεγμένης εκδήλωσης.":"Τα ποσά αφορούν μόνο τον επιλεγμένο μήνα."}</p>
   <div className="finance-register-filters" role="group" aria-label="Φιλτράρισμα εσόδων και εξόδων">
    {([['all','Όλα'],['income','Έσοδα'],['expense','Έξοδα']] as const).map(([key,label])=><button key={key} type="button" className={'finance-filter-chip'+(registerFilter===key?' selected':'')} aria-pressed={registerFilter===key} onClick={()=>{setRegisterFilter(key);setRegisterId(null);}}>{label}</button>)}
    <span className="finance-register-count">{visibleRegs.length} εγγραφές</span>
   </div>
   <section className="finance-register-list" aria-label="Οικονομικές εγγραφές">{visibleRegs.map(r=>{
    const movements=matchingMovements(r.id);
    const activeMovements=movements.filter(t=>!reversed.has(t.id));
    const lastMovement=activeMovements[0]||movements[0];
    const categoryName=data.categories.find(c=>c.id===r.category_id)?.name;
    const expanded=registerId===r.id;
    return <article className={'finance-register finance-register-compact'+(expanded?' is-expanded':'')} key={r.id}>
     <div className="finance-register-summary">
      <span className={'finance-register-kind '+r.direction} aria-label={r.direction==='income'?'Έσοδο':'Έξοδο'} title={r.direction==='income'?'Έσοδο':'Έξοδο'}>{r.direction==='income'?<ArrowDownLeft size={16}/>:<ArrowUpRight size={16}/>}</span>
      <button type="button" className="finance-register-name" aria-expanded={expanded} aria-controls={'finance-details-'+r.id} onClick={()=>setRegisterId(expanded?null:r.id)}>
       <strong>{r.title}</strong>
       <span className="finance-register-meta">{lastMovement?dateFmt(lastMovement.happened_on):'Χωρίς κίνηση'}{categoryName?' · '+categoryName:''}{activeMovements.length>1?' · '+activeMovements.length+' κινήσεις':''}</span>
      </button>
      <strong className={'finance-register-amount '+r.direction}>{eur(monthlyRegisterTotal(r.id))}</strong>
      <div className="finance-register-inline-actions">
       <button className="btn ghost finance-register-add" type="button" title="Προσθήκη ποσού στην ίδια εγγραφή" aria-label={'Προσθήκη ποσού στην εγγραφή '+r.title} onClick={()=>openPayment(r)}><Plus size={15}/><span className="finance-add-label">Προσθήκη</span></button>
       <button className="btn ghost finance-register-edit" type="button" title="Πλήρης επεξεργασία εγγραφής" aria-label={'Επεξεργασία εγγραφής '+r.title} disabled={busy} onClick={()=>openEditRegister(r)}><Pencil size={15}/><span className="finance-add-label">Επεξεργασία</span></button>
       {isAdmin&&<button className="btn ghost finance-register-delete" type="button" title="Οριστική διαγραφή ολόκληρου του εσόδου/εξόδου" aria-label={'Οριστική διαγραφή εγγραφής '+r.title} disabled={busy} onClick={()=>openPermanentDelete(r)}><Trash2 size={15}/><span className="finance-add-label">Διαγραφή</span></button>}
       <button className="btn ghost finance-expand-button" type="button" aria-expanded={expanded} aria-controls={'finance-details-'+r.id} aria-label={(expanded?'Απόκρυψη κινήσεων: ':'Προβολή κινήσεων: ')+r.title} title={expanded?'Απόκρυψη κινήσεων':'Προβολή κινήσεων'} onClick={()=>setRegisterId(expanded?null:r.id)}>{expanded?<ChevronUp size={16}/>:<ChevronDown size={16}/> }<span className="finance-expand-label">{expanded?'Απόκρυψη':'Κινήσεις'}</span></button>
      </div>
     </div>
     {expanded&&<div className="finance-detail" id={'finance-details-'+r.id}>
      {r.description&&<p className="finance-register-description">{r.description}</p>}
      <div className="finance-detail-heading"><h3>Κινήσεις {monthTitle(month)}</h3><span>{movements.length} στον μήνα</span></div>
      {movements.map(t=><div className="finance-transaction" key={t.id}><div><strong>{eur(allocatedAmount(t,data.allocations,eventFilter))} {reversed.has(t.id)&&<span className="finance-reversed">Αντιλογισμένο</span>}</strong><small>{dateFmt(t.happened_on)} · {txAccount(t.id)}{t.note?' · '+t.note:''}</small>{data.allocations.filter(a=>a.transaction_id===t.id).map(a=><small key={a.event_id}>↳ {events.find(e=>e.id===a.event_id)?.title||'Εκδήλωση'}: {eur(a.amount)}</small>)}</div><div className="finance-tx-actions">{!reversed.has(t.id)&&<button className="btn ghost" type="button" disabled={busy||locked(t.happened_on)} onClick={()=>openEditPayment(r,t)}><Pencil size={15}/> Επεξεργασία</button>}{!reversed.has(t.id)&&<button className="btn ghost" disabled={busy||locked(t.happened_on)} onClick={()=>void reverse(t)}><RotateCcw size={15}/> Αντιλογισμός</button>}</div></div>)}
      {movements.length===0&&<p className="muted">Δεν έχουν καταχωριστεί κινήσεις για τον επιλεγμένο μήνα.</p>}
     </div>}
    </article>;
   })}{visibleRegs.length===0&&<div className="panel"><p className="muted">Δεν υπάρχουν έσοδα ή έξοδα για τον επιλεγμένο μήνα με αυτά τα φίλτρα.</p></div>}</section>
  </>}
  {tab==='expected'&&<><div className="finance-actionbar"><h2>Αναμενόμενα έσοδα & έξοδα</h2><button className="btn primary" onClick={()=>{reset();setTitle('');setDirection('income');setExpectedEvent('');setExpectedRegister('');setBeneficiary('');setEditingExpected(null);setDate('');setAccount('');setForm('expected');}}><Plus size={17}/> Νέα πρόβλεψη</button></div><section className="panel finance-scroll finance-expected-list"><table className="finance-table"><thead><tr><th>Πότε</th><th>Περιγραφή</th><th>Είδος</th><th>Ποσό</th><th>Κατάσταση</th><th></th></tr></thead><tbody>{[...visibleExpected].sort((a,b)=>(a.expected_on||'9999-12-31').localeCompare(b.expected_on||'9999-12-31')).map(p=><tr key={p.id}><td data-label="Ημερομηνία">{p.expected_on?dateFmt(p.expected_on):'Απροσδιόριστο'}</td><td data-label="Περιγραφή">{p.title}<small>{p.beneficiary?'Προς: '+p.beneficiary+' · ':''}{events.find(e=>e.id===p.event_id)?.title||p.note}</small></td><td data-label="Είδος">{p.direction==='income'?'Έσοδο':'Έξοδο'}</td><td data-label="Ποσό">{p.amount==null?'Άγνωστο':eur(p.amount)}</td><td data-label="Κατάσταση">{p.status==='pending'?'Εκκρεμεί':p.status==='settled'?'Πραγματοποιήθηκε':'Ακυρώθηκε'}</td><td className="finance-expected-actions">{p.status==='pending'&&<button className="btn ghost" disabled={busy} onClick={()=>{reset();setEditingExpected(p.id);setDirection(p.direction);setTitle(p.title);setAmount(p.amount==null?'':String(p.amount).replace('.',','));setDate(p.expected_on||'');setAccount(p.account_id||'');setExpectedRegister(p.register_id||'');setExpectedEvent(p.event_id||'');setBeneficiary(p.beneficiary);setNote(p.note);setForm('expected');}}>Επεξεργασία</button>}{p.status==='pending'&&<button className="btn secondary" disabled={busy} onClick={()=>{reset();setExpectedId(p.id);setAmount(p.amount==null?'':String(p.amount));setDate(today());setAccount(p.account_id||data.accounts[0]?.id||'');setForm('settle');}}>Πραγματοποίηση</button>}{p.status==='pending'&&<button className="btn ghost" disabled={busy} onClick={()=>setCancelExpectedTarget(p)}>Ακύρωση</button>}</td></tr>)}{!visibleExpected.length&&<tr><td colSpan={6}>Δεν υπάρχουν αναμενόμενα ποσά.</td></tr>}</tbody></table></section><p className="muted">Πάτησε «Πραγματοποίηση» για να καταχωριστεί αυτόματα πραγματική κίνηση και να κλείσει η πρόβλεψη, χωρίς διπλομέτρηση.</p></>}
  {tab==='transfers'&&<><div className="finance-actionbar"><h2>Εσωτερικές μεταφορές</h2><button className="btn primary" onClick={()=>{reset();setForm('transfer');}}><ArrowLeftRight size={17}/> Νέα μεταφορά</button></div><section className="panel finance-transfers-panel"><p>Μετρητά ↔ Τράπεζα ↔ Revolut ↔ Καταθετικός · {monthTitle(month)}</p>{[...monthTransactions].filter(t=>t.kind==='transfer').sort((a,b)=>b.happened_on.localeCompare(a.happened_on)||b.created_at.localeCompare(a.created_at)).map(t=><div className="finance-row finance-transfer-row" key={t.id}><div className="finance-transfer-detail"><strong>{dateFmt(t.happened_on)} · {txAccount(t.id)}</strong>{t.note&&<small>{t.note}</small>}</div><div className="finance-transfer-actions"><strong className="finance-transfer-amount">{eur(t.amount)}</strong>{reversed.has(t.id)?<small>Αντιλογισμένη</small>:isAdmin&&<button className="icon-btn finance-transfer-delete" type="button" disabled={busy||locked(t.happened_on)} title={locked(t.happened_on)?'Ο μήνας είναι κλειδωμένος· άνοιξέ τον πριν τη διαγραφή.':'Οριστική διαγραφή μεταφοράς'} aria-label={`Διαγραφή μεταφοράς ${eur(t.amount)}: ${txAccount(t.id)}`} onClick={()=>openDeleteTransfer(t)}><Trash2 size={16}/></button>}</div></div>)}</section></>}
  {tab==='months'&&<><section className="panel"><h2>Μηνιαίο κλείσιμο</h2><p>Το κλείσιμο αποθηκεύει στιγμιότυπο λογαριασμών και κλειδώνει τις κινήσεις του μήνα. Κλείνουν μόνο προηγούμενοι μήνες και με χρονολογική σειρά. Για διορθώσεις απαιτείται επαναφορά από Admin με αιτιολογία.</p>{earliestUnclosedMonth&&earliestUnclosedMonth<monthStart(today())&&<div className="finance-close-guide"><span>Πρώτος μήνας για κλείσιμο: <strong>{monthTitle(earliestUnclosedMonth)}</strong></span><button type="button" className="btn secondary" onClick={()=>setMonth(earliestUnclosedMonth)}>Μετάβαση στον μήνα</button></div>}<div className="finance-row"><div><strong>{monthTitle(month)}</strong><small>{openedMonths.has(month)?'Ο μήνας είναι κλειδωμένος':month>=monthStart(today())?'Ο τρέχων μήνας κλείνει από την 1η ημέρα του επόμενου.':earliestUnclosedMonth&&month>earliestUnclosedMonth?'Πρέπει να κλείσεις πρώτα τον '+monthTitle(earliestUnclosedMonth)+'.':'Έτοιμος για έλεγχο και κλείσιμο.'}</small></div>{openedMonths.has(month)?isAdmin&&<button className="btn danger" onClick={()=>{const why=window.prompt('Αιτιολογία επαναφοράς μήνα:');if(why)void run(()=>rpc('finance_reopen_month',{p_month:month,p_reason:why}),'Ο μήνας άνοιξε ξανά.');}}>Άνοιγμα μήνα</button>:<button className="btn primary" disabled={busy||month>=monthStart(today())||!!(earliestUnclosedMonth&&month>earliestUnclosedMonth)} onClick={()=>{if(window.confirm('Οριστικό κλείσιμο μήνα; Οι καταχωρίσεις του θα κλειδωθούν.'))void run(()=>rpc('finance_close_month',{p_month:month}),'Ο μήνας κλειδώθηκε και αποθηκεύτηκε το στιγμιότυπο.');}}><LockKeyhole size={16}/> Κλείσιμο μήνα</button>}</div></section><section className="panel"><h2>Συμφωνία πραγματικών υπολοίπων</h2><p>Καταχώρισε την πραγματική καταμέτρηση για έλεγχο. Η διαφορά δεν αλλάζει αυτόματα το λογιστικό υπόλοιπο.</p><button className="btn secondary" onClick={()=>{reset();setForm('reconcile');}}>Νέος έλεγχος λογαριασμού</button>{[...data.reconciliations].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,30).map(r=><div className="finance-row" key={r.id}><span>{dateFmt(r.happened_on)} · {data.accounts.find(a=>a.id===r.account_id)?.name||'Λογαριασμός'}<small>{r.note}</small></span><div><strong>{eur(r.actual_balance)}</strong><small>Διαφορά: {eur(Number(r.actual_balance)-accountBalanceAt(data.legs,data.transactions,r.account_id,new Date(new Date(r.happened_on+'T12:00:00').getTime()+86400000).toLocaleDateString('sv-SE')))}</small></div></div>)}</section>{isAdmin&&<section className="panel"><h2>Υπόλοιπα εκκίνησης</h2><p>Τα ποσά του Excel δεν εισάγονται αυτόματα. Το αρχικό υπόλοιπο ορίζεται μία φορά ανά λογαριασμό πριν από τις πρώτες κινήσεις.</p><button className="btn secondary" onClick={()=>{reset();setForm('opening');}}>Ορισμός αρχικού υπολοίπου</button></section>}</>}
  {tab==='settings'&&isAdmin&&<section className="panel finance-settings-panel">
   <div className="finance-actionbar"><h2>Κατηγορίες εσόδων & εξόδων</h2></div>
   <div className="finance-settings-groups">{(['income','expense'] as Direction[]).map(d=><div className="finance-category-group" key={d}><h3>{d==='income'?'Έσοδα':'Έξοδα'}</h3>{data.categories.filter(c=>c.direction===d).sort((a,b)=>a.name.localeCompare(b.name,'el')).map(c=><FinanceCategoryEditor key={c.id} category={c} busy={busy} onSave={(name,active)=>run(()=>rpc('finance_category_admin',{p_id:c.id,p_direction:c.direction,p_name:name,p_active:active}),'Η κατηγορία ενημερώθηκε.')} />)}</div>)}</div>
   <form className="finance-category-add" onSubmit={e=>{e.preventDefault();void run(()=>rpc('finance_category_admin',{p_id:null,p_direction:categoryDirection,p_name:categoryName.trim(),p_active:true}),'Η κατηγορία προστέθηκε.').then(ok=>{if(ok)setCategoryName('');});}}><h3>Νέα κατηγορία</h3><div className="finance-category-add-controls"><select aria-label="Είδος κατηγορίας" value={categoryDirection} onChange={e=>setCategoryDirection(e.target.value as Direction)}><option value="income">Έσοδο</option><option value="expense">Έξοδο</option></select><input aria-label="Ονομασία κατηγορίας" placeholder="Ονομασία" value={categoryName} onChange={e=>setCategoryName(e.target.value)} minLength={2} maxLength={100} required/><button className="btn primary" disabled={busy||categoryName.trim().length<2}><Plus size={16}/> Προσθήκη</button></div></form>
  </section>}
  {tab==='audit'&&<section className="panel"><h2>Ιστορικό οικονομικών αλλαγών</h2>{data.audit.slice(0,150).map(a=><div className="finance-row" key={a.id}><div><strong>{a.action} · {a.entity_kind}</strong><small>{dateFmt(a.happened_at,{dateStyle:'short',timeStyle:'short'})} · {profiles.find(p=>p.id===a.actor_id)?.full_name||a.actor_id||'Σύστημα'}<details className="finance-audit-detail"><summary>Αλλαγές / λεπτομέρειες</summary><pre>{JSON.stringify(a.details,null,2)}</pre></details></small></div><FileText size={17}/></div>)}{!data.audit.length&&<p>Δεν υπάρχουν ακόμη καταχωρίσεις.</p>}</section>}
  </>}
  {deleteTransferTarget&&<div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target&&!busy)setDeleteTransferTarget(null);}}>
   <section className="modal finance-modal-compact" role="dialog" aria-modal="true" aria-labelledby="delete-transfer-title" aria-describedby="delete-transfer-warning">
    <header className="modal-head"><h2 id="delete-transfer-title">Οριστική διαγραφή μεταφοράς</h2><button type="button" className="icon-btn" disabled={busy} onClick={()=>setDeleteTransferTarget(null)} aria-label="Κλείσιμο παραθύρου διαγραφής"><X size={18}/></button></header>
    <div className="modal-body finance-transfer-confirm">
     <strong>{txAccount(deleteTransferTarget.id)}</strong>
     <p className="finance-transfer-confirm-summary"><strong>{eur(deleteTransferTarget.amount)}</strong> · {dateFmt(deleteTransferTarget.happened_on)}</p>
     <p className="finance-alert finance-warn" id="delete-transfer-warning"><Trash2 size={17}/> Η μεταφορά θα διαγραφεί οριστικά και τα υπόλοιπα των δύο λογαριασμών θα υπολογιστούν ξανά. Η διαγραφή καταγράφεται στο Ιστορικό.</p>
     <div className="form-actions"><button className="btn ghost" type="button" disabled={busy} onClick={()=>setDeleteTransferTarget(null)}>Άκυρο</button><button className="btn danger" type="button" disabled={busy} onClick={()=>void deleteTransfer()}><Trash2 size={16}/> {busy?'Διαγραφή…':'Οριστική διαγραφή'}</button></div>
    </div>
   </section>
  </div>}
  {cancelExpectedTarget&&<div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target&&!busy)setCancelExpectedTarget(null);}}>
   <section className="modal finance-modal-compact" role="dialog" aria-modal="true" aria-labelledby="cancel-expected-title">
    <header className="modal-head"><h2 id="cancel-expected-title">Ακύρωση αναμενόμενου {cancelExpectedTarget.direction==='income'?'εσόδου':'εξόδου'}</h2><button type="button" className="icon-btn" disabled={busy} onClick={()=>setCancelExpectedTarget(null)} aria-label="Κλείσιμο"><X size={18}/></button></header>
    <div className="modal-body"><p><strong>{cancelExpectedTarget.title}</strong></p><p className="finance-alert finance-warn">Η ακύρωση θα διαγράψει οριστικά την πρόβλεψη από τα Αναμενόμενα. Δεν αλλάζει καμία πραγματική πληρωμή ή υπόλοιπο. Η ενέργεια θα καταγραφεί στο Ιστορικό.</p>
     <div className="form-actions"><button type="button" className="btn ghost" disabled={busy} onClick={()=>setCancelExpectedTarget(null)}>Επιστροφή</button><button type="button" className="btn danger" disabled={busy} onClick={()=>{const p=cancelExpectedTarget;if(!p)return;void run(()=>rpc('finance_expected_cancel_delete',{p_id:p.id}),'Το αναμενόμενο ακυρώθηκε και διαγράφηκε.').then(ok=>{if(ok)setCancelExpectedTarget(null);});}}><Trash2 size={16}/> {busy?'Ακύρωση…':'Ακύρωση και διαγραφή'}</button></div>
    </div>
   </section>
  </div>}
  {deleteTarget&&<div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target&&!busy)setDeleteTarget(null);}}>
   <section className="modal finance-modal-compact" role="dialog" aria-modal="true" aria-labelledby="finance-permanent-delete-title" aria-describedby="finance-permanent-delete-warning">
    <header className="modal-head"><h2 id="finance-permanent-delete-title">Οριστική διαγραφή {deleteTarget.direction==='income'?'εσόδου':'εξόδου'}</h2><button type="button" className="icon-btn" disabled={busy} onClick={()=>setDeleteTarget(null)} aria-label="Κλείσιμο παραθύρου διαγραφής"><X size={18}/></button></header>
    <div className="modal-body"><form className="form-stack finance-delete-form" onSubmit={e=>void permanentlyDelete(e)}>
     <strong className="finance-delete-title">{deleteTarget.title}</strong>
     <p className="finance-alert finance-warn" id="finance-permanent-delete-warning"><LockKeyhole size={17}/> Προσοχή: θα διαγραφεί ολόκληρη η εγγραφή και ΟΛΕΣ οι πληρωμές της από όλους τους μήνες, ακόμη και όσες έχουν αντιλογιστεί. Τα διαθέσιμα υπόλοιπα και τα στατιστικά θα υπολογιστούν ξανά. Η ενέργεια δεν αναιρείται από την εφαρμογή· αποθηκεύεται πλήρες audit.</p>
     <p className="muted">{data.transactions.filter(t=>t.register_id===deleteTarget.id).length} αρχικές οικονομικές κινήσεις, συν τυχόν αντιλογισμοί. Δεν διαγράφονται κινήσεις κλειδωμένων μηνών, ούτε εγγραφές με συνδεδεμένα Αναμενόμενα .</p>
     {inputLabel('Αιτιολογία (τουλάχιστον 5 χαρακτήρες)',<textarea aria-label="Αιτιολογία οριστικής διαγραφής" maxLength={500} rows={2} required minLength={5} value={deleteReason} onChange={e=>setDeleteReason(e.target.value)} placeholder="Γιατί διαγράφεται αυτή η εγγραφή;"/>)}
     {inputLabel('Πληκτρολόγησε ΔΙΑΓΡΑΦΗ για επιβεβαίωση',<input aria-label="Επιβεβαίωση οριστικής διαγραφής" autoComplete="off" spellCheck={false} value={deleteConfirmation} onChange={e=>setDeleteConfirmation(e.target.value)} placeholder="ΔΙΑΓΡΑΦΗ" required/>)}
     <div className="form-actions"><button className="btn ghost" type="button" disabled={busy} onClick={()=>setDeleteTarget(null)}>Άκυρο</button><button type="submit" className="btn danger" disabled={busy||!isAdmin||deleteConfirmation!=='ΔΙΑΓΡΑΦΗ'||deleteReason.trim().length<5}><Trash2 size={16}/> {busy?'Διαγραφή…':'Οριστική διαγραφή'}</button></div>
    </form></div>
   </section>
  </div>}
  {form&&<div className="modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)setForm(null);}}><section className={'modal '+((form==='new'||form==='edit'||form==='editPayment'||form==='payment')?'finance-modal-compact':'wide')} role="dialog" aria-modal="true" aria-label="Οικονομική καταχώριση"><header className="modal-head"><h2>{{new:direction==='income'?'Νέο έσοδο':'Νέο έξοδο',edit:direction==='income'?'Επεξεργασία εσόδου':'Επεξεργασία εξόδου',editPayment:'Επεξεργασία κίνησης',payment:'Προσθήκη ποσού',transfer:'Μεταφορά χρημάτων',expected:editingExpected?'Επεξεργασία αναμενόμενου ποσού':'Νέο αναμενόμενο ποσό',opening:'Αρχικό υπόλοιπο',reconcile:'Έλεγχος πραγματικού υπολοίπου',settle:'Πραγματοποίηση πρόβλεψης'}[form]}</h2><button className="icon-btn" onClick={()=>setForm(null)} aria-label="Κλείσιμο"><X size={18}/></button></header><div className="modal-body">
   <form className={'form-stack '+((form==='new'||form==='edit'||form==='editPayment'||form==='payment')?'finance-form-tight':'')} onSubmit={e=>void (form==='new'?sendNew(e):(form==='edit'||form==='editPayment')?sendEdit(e):form==='payment'?sendPayment(e):form==='transfer'?sendTransfer(e):form==='expected'?sendExpected(e):form==='opening'?sendOpening(e):form==='reconcile'?sendReconcile(e):sendSettle(e))}>
    {form==='settle'&&<p className="muted">Συμπλήρωσε το πραγματικό ποσό για να καταχωριστεί η κίνηση.</p>}
    {form==='payment'&&<p className="muted finance-form-context">{selectedRegister?.title} · {selectedRegister?.direction==='income'?'Έσοδο':'Έξοδο'}</p>}
    {form==='expected'&&<>{inputLabel('Τύπος',<select value={direction} onChange={e=>{setDirection(e.target.value as Direction);setCategory('');setExpectedRegister('');}}><option value="income">Έσοδο</option><option value="expense">Έξοδο</option></select>)}{inputLabel('Τίτλος',<input value={title} minLength={2} maxLength={200} required onChange={e=>setTitle(e.target.value)} placeholder="π.χ. Εγγραφές ΕΦΕΚΘ"/>)}</>}
    {(form==='edit'||form==='editPayment')&&<>
      {inputLabel('Τύπος',<select value={direction} disabled={activeRegisterMovements(editingRegisterId||'').length>1} onChange={e=>{setDirection(e.target.value as Direction);setCategory('');}}><option value="income">Έσοδο</option><option value="expense">Έξοδο</option></select>)}
      {inputLabel('Τίτλος εγγραφής',<input value={title} minLength={2} maxLength={200} required onChange={e=>setTitle(e.target.value)}/>)}
      <div className="finance-form-grid">{inputLabel('Κατηγορία',<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Χωρίς κατηγορία</option>{data.categories.filter(c=>(c.active||c.id===category)&&c.direction===direction).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>)}</div>
      {inputLabel('Περιγραφή εγγραφής',<textarea maxLength={3000} rows={2} value={description} onChange={e=>setDescription(e.target.value)}/>)}
      {(editingTransactionId||activeRegisterMovements(editingRegisterId||'').length===0)&&<>
        <div className="finance-form-grid">{inputLabel('Ημερομηνία πληρωμής',<input type="date" value={date} required={amount.trim()!==''} onChange={e=>setDate(e.target.value)}/>)}
          {inputLabel('Ποσό (€) · προαιρετικό',<input inputMode="decimal" value={amount} placeholder="Κενό για αφαίρεση πληρωμής" onChange={e=>setAmount(e.target.value)}/>)}</div>
        {inputLabel('Λογαριασμός',<select value={account} required={amount.trim()!==''} disabled={amount.trim()===''} onChange={e=>setAccount(e.target.value)}><option value="">Επίλεξε λογαριασμό</option>{data.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>)}
        {inputLabel('Σημείωση πληρωμής',<textarea maxLength={2000} rows={2} value={note} onChange={e=>setNote(e.target.value)}/>)}
        <details className="finance-alloc-box finance-alloc-collapsible" open={splits.length>0?true:undefined}><summary>Επιμερισμός σε εκδηλώσεις (προαιρετικός)</summary><button className="btn ghost" type="button" onClick={()=>setSplits(v=>[...v,{event_id:'',amount:''}])}><Plus size={15}/> Προσθήκη εκδήλωσης</button>{splits.map((a,i)=><div className="finance-split" key={i}><select value={a.event_id} aria-label={'Εκδήλωση '+(i+1)} onChange={e=>setSplits(v=>v.map((s,j)=>j===i?{...s,event_id:e.target.value}:s))}><option value="">Επίλεξε εκδήλωση</option>{events.map(event=><option key={event.id} value={event.id}>{event.title}</option>)}</select><input value={a.amount} inputMode="decimal" aria-label={'Ποσό εκδήλωσης '+(i+1)} onChange={e=>setSplits(v=>v.map((s,j)=>j===i?{...s,amount:e.target.value}:s))}/><button className="icon-btn" type="button" aria-label="Αφαίρεση επιμερισμού" onClick={()=>setSplits(v=>v.filter((_,j)=>j!==i))}><X size={16}/></button></div>)}</details>
        {editingTransactionId&&<p className="muted">Αλλαγές στο ποσό, την ημερομηνία ή τον λογαριασμό γίνονται με ασφαλή αντιλογισμό και νέα κίνηση. Η αρχική εγγραφή παραμένει στο ιστορικό.</p>}
      </>}
      {!editingTransactionId&&activeRegisterMovements(editingRegisterId||'').length>1&&<p className="finance-alert">Η εγγραφή έχει πολλές πληρωμές. Μπορείς να αλλάξεις τον τίτλο, την κατηγορία και την περιγραφή εδώ. Για αλλαγή συγκεκριμένου ποσού άνοιξε την εγγραφή και επίλεξε «Επεξεργασία» στην αντίστοιχη κίνηση.</p>}
    </>}
    {form==='new'&&<>
      {inputLabel('Τίτλος εγγραφής',<input value={title} minLength={2} maxLength={200} required onChange={e=>setTitle(e.target.value)} placeholder="π.χ. Εγγραφές ΕΦΕΚΘ"/>)}
      <div className="finance-form-grid">{inputLabel('Κατηγορία',<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">Χωρίς κατηγορία</option>{data.categories.filter(c=>c.active&&c.direction===direction).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>)}
        {inputLabel('Ημερομηνία πρώτης κίνησης',<input type="date" value={date} required={amount.trim()!==''} onChange={e=>setDate(e.target.value)}/>)}</div>
      <div className="finance-form-grid">{inputLabel('Πρώτο ποσό (€) · προαιρετικό',<input inputMode="decimal" value={amount} placeholder="Άφησε κενό για μόνο την εγγραφή" onChange={e=>setAmount(e.target.value)}/>)}
        {inputLabel('Λογαριασμός',<select value={account} required={amount.trim()!==''} disabled={amount.trim()===''} onChange={e=>setAccount(e.target.value)}><option value="">Επίλεξε λογαριασμό</option>{data.accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select>)}</div>
      <details className="finance-optional-details"><summary>Περιγραφή (προαιρετικά)</summary><textarea aria-label="Περιγραφή εγγραφής" maxLength={3000} rows={2} value={description} onChange={e=>setDescription(e.target.value)} placeholder="Πρόσθετες πληροφορίες"/></details>
      <p className="finance-inline-hint">Μπορείς να δημιουργήσεις μόνο την εγγραφή ή να καταχωρίσεις και την πρώτη κίνηση. Η ημερομηνία αφορά την κίνηση, όχι την εγγραφή χωρίς ποσό.</p>
    </>}
    {form!=='new'&&form!=='edit'&&form!=='editPayment'&&<div className="two-cols">{inputLabel(form==='expected'?'Πιθανή ημερομηνία (προαιρετικά)':'Ημερομηνία',<input type="date" value={date} required={form!=='expected'} onChange={e=>setDate(e.target.value)}/>)}{inputLabel(form==='expected'?'Πιθανό ποσό (€) — προαιρετικά':form==='settle'?'Πραγματικό ποσό (€)':form==='reconcile'?'Πραγματικό υπόλοιπο (€)':'Ποσό (€)',<input inputMode="decimal" value={amount} required={form!=='expected'} placeholder={form==='expected'?'Άφησε κενό αν δεν το γνωρίζεις':'0,00'} onChange={e=>setAmount(e.target.value)} />)}</div>}
    {(form==='payment'||form==='transfer'||form==='opening'||form==='reconcile'||form==='settle')&&<div className="two-cols">{inputLabel(form==='transfer'?'Από λογαριασμό':'Λογαριασμός',<select required value={account} onChange={e=>setAccount(e.target.value)}>{data.accounts.map(a=><option value={a.id} key={a.id}>{a.name}{form==='opening'&&initializedAccounts.has(a.id)?' (ήδη ορίστηκε)':''}</option>)}</select>)}{form==='transfer'&&inputLabel('Προς λογαριασμό',<select required value={toAccount} onChange={e=>setToAccount(e.target.value)}>{data.accounts.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select>)}</div>}
    {form==='expected'&&<>{inputLabel('Προαιρετικά: λογαριασμός',<select value={account} onChange={e=>setAccount(e.target.value)}><option value="">Χωρίς επιλογή</option>{data.accounts.map(a=><option value={a.id} key={a.id}>{a.name}</option>)}</select>)}{inputLabel('Σύνδεση με συγκεντρωτική εγγραφή',<select value={expectedRegister} onChange={e=>setExpectedRegister(e.target.value)}><option value="">Χωρίς σύνδεση</option>{data.registers.filter(r=>r.direction===direction).map(r=><option key={r.id} value={r.id}>{r.title}</option>)}</select>)}{direction==='expense'&&inputLabel('Επιστροφή προς στέλεχος / δικαιούχο (προαιρετικά)',<input maxLength={180} value={beneficiary} onChange={e=>setBeneficiary(e.target.value)} placeholder="π.χ. Όνομα στελέχους"/>)}{inputLabel('Εκδήλωση (προαιρετικά)',<select value={expectedEvent} onChange={e=>setExpectedEvent(e.target.value)}><option value="">Καμία</option>{events.map(e=><option value={e.id} key={e.id}>{e.title}</option>)}</select>)}</>}
    {form==='payment'&&<details className="finance-alloc-box finance-alloc-collapsible" open={eventFilter?true:undefined}><summary>Επιμερισμός σε εκδηλώσεις (προαιρετικός)</summary><div className="finance-actionbar"><button className="btn ghost" type="button" onClick={()=>setSplits(v=>[...v,{event_id:'',amount:''}])}><Plus size={15}/> Εκδήλωση</button></div><p className="muted">Μπορείς να μοιράσεις το ποσό σε περισσότερες εκδηλώσεις. Το άθροισμα δεν επιτρέπεται να υπερβαίνει την κίνηση.</p>{splits.map((s,i)=><div className="finance-split" key={i}><select aria-label={'Εκδήλωση '+(i+1)} value={s.event_id} onChange={e=>setSplits(v=>v.map((q,j)=>j===i?{...q,event_id:e.target.value}:q))}><option value="">Επίλεξε εκδήλωση</option>{events.map(e=><option key={e.id} value={e.id}>{e.title}</option>)}</select><input aria-label={'Ποσό εκδήλωσης '+(i+1)} placeholder="Ποσό €" value={s.amount} inputMode="decimal" onChange={e=>setSplits(v=>v.map((q,j)=>j===i?{...q,amount:e.target.value}:q))}/><button className="icon-btn" aria-label="Αφαίρεση" type="button" onClick={()=>setSplits(v=>v.filter((_,j)=>j!==i))}><X size={16}/></button></div>)}{eventFilter&&splits.length===1&&splits[0].event_id===eventFilter&&!splits[0].amount&&<p className="muted">Αν αφήσεις κενό το ποσό επιμερισμού, ολόκληρη η κίνηση θα συνδεθεί αυτόματα με αυτή την εκδήλωση.</p>}{splits.length>0&&<strong>Κατανομή: {eur(splits.reduce((n,s)=>n+(s.event_id===eventFilter&&splits.length===1&&!s.amount?(toEuro(amount)||0):(toEuro(s.amount)||0)),0))} / {eur(toEuro(amount)||0)}</strong>}</details>}
    {form==='payment'?<details className="finance-optional-details"><summary>Σημείωση (προαιρετικά)</summary><textarea aria-label="Σημείωση κίνησης" rows={2} value={note} maxLength={2000} onChange={e=>setNote(e.target.value)}/></details>:form!=='new'&&form!=='edit'&&form!=='editPayment'&&form!=='opening'&&inputLabel('Σημειώσεις / αιτιολογία',<textarea rows={2} value={note} maxLength={2000} onChange={e=>setNote(e.target.value)}/>)}
    {form==='opening'&&<p className="finance-alert finance-warn">Προσοχή: Διάλεξε την πρώτη ημέρα του μήνα και βάλε τα αρχικά υπόλοιπα του ίδιου σημείου εκκίνησης για όλους τους λογαριασμούς (και 0 εάν δεν υπήρχε τότε λογαριασμός). Μην βάλεις τρέχοντα ποσά που έχουν ήδη καταχωριστεί στις κινήσεις. Αρχικοποιημένοι: {initializedAccounts.size}/4.</p>}
    {form==='transfer'&&<p className="muted">Η μεταφορά αφαιρεί από τον πρώτο και προσθέτει στον δεύτερο λογαριασμό. Δεν εμφανίζεται στα λειτουργικά έσοδα ή έξοδα.</p>}
    <div className="form-actions"><button className="btn ghost" type="button" onClick={()=>setForm(null)}>Άκυρο</button><button className="btn primary" type="submit" disabled={busy||form==='transfer'&&account===toAccount||form==='payment'&&(!registerId||splits.some(s=>!s.event_id||(!s.amount&&!(eventFilter&&splits.length===1&&s.event_id===eventFilter))))}>{busy?'Αποθήκευση…':form==='payment'?'Προσθήκη ποσού':'Αποθήκευση'}</button></div>
   </form>
  </div></section></div>}
 </div>;
}

function FinanceCategoryEditor({category,busy,onSave}:{category:Category;busy:boolean;onSave:(name:string,active:boolean)=>Promise<boolean>}){
 const [name,setName]=useState(category.name);
 useEffect(()=>setName(category.name),[category.name]);
 const changed=name.trim()!==category.name;
 return <div className={'finance-category-item '+(!category.active?'finance-category-inactive':'')}>
  <input aria-label={'Όνομα κατηγορίας '+category.name} value={name} minLength={2} maxLength={100} disabled={busy} onChange={e=>setName(e.target.value)}/>
  <button className="btn secondary finance-category-save" type="button" disabled={busy||!changed||name.trim().length<2} onClick={()=>void onSave(name.trim(),category.active)}>Αποθήκευση</button>
  <button className={'finance-category-toggle '+(category.active?'is-on':'')} type="button" role="switch" aria-checked={category.active} aria-label={'Ενεργή κατηγορία '+category.name} disabled={busy} onClick={()=>void onSave(category.name,!category.active)}><span/></button>
 </div>;
}
