/** Financial logic is pure and works in integer cents to avoid floating-point drift. */
export function parseEuro(value) {
 const s=String(value??'').trim().replace(/\s/g,'');
 if(!s || s.startsWith('-'))return Number.NaN;
 let fixed;
 if(/^\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(s)) fixed=s.replaceAll('.','').replace(',','.');
 else if(/^\d+(?:[.,]\d{1,2})?$/.test(s))fixed=s.replace(',','.');
 else return Number.NaN;
 const n=Number(fixed);
 return Number.isSafeInteger(Math.round(n*100))?Math.round(n*100)/100:Number.NaN;
}
export const cents=n=>Math.round(Number(n)*100);
export const euroFromCents=n=>n/100;
/** Sum all legs up to dateExclusive. An opening posted on the month's first day counts as that month's opening. */
export function accountBalanceAt(legs,transactions,accountId,dateExclusive,includeOpeningAtBoundary=false){
 const byId=new Map(transactions.map(t=>[t.id,t]));
 return euroFromCents(legs.reduce((sum,l)=>{
  const tx=byId.get(l.transaction_id);
  if(l.account_id!==accountId||!tx)return sum;
  if(tx.happened_on<dateExclusive || (includeOpeningAtBoundary&&tx.happened_on===dateExclusive&&tx.kind==='opening'))return sum+cents(l.delta);
  return sum;
 },0));
}
/** A reversal contributes negative allocation and has the same original economic direction. */
export function eventResult(allocations,transactions,eventId){
 const txById=new Map(transactions.map(t=>[t.id,t]));
 return allocations.filter(a=>a.event_id===eventId).reduce((r,a)=>{
  const tx=txById.get(a.transaction_id);if(!tx)return r;
  const kind=tx.kind==='reversal'?txById.get(tx.reversed_transaction_id)?.kind:tx.kind;
  if(kind==='income')r.incomeCents+=cents(a.amount);
  if(kind==='expense')r.expenseCents+=cents(a.amount);
  return r;
 },{incomeCents:0,expenseCents:0});
}
