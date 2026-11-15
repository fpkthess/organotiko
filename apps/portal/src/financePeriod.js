/** Monthly grouping is based on the actual accounting date, not the DB insertion/import timestamp. */
export function newestMovementFirst(a,b){
 return b.happened_on.localeCompare(a.happened_on) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id);
}
export function getMonthlyRegisterMovements(transactions,month){
 const prefix=month.slice(0,7);
 const result=new Map();
 for(const tx of transactions){
  if(!tx.register_id || (tx.kind!=='income'&&tx.kind!=='expense') || !tx.happened_on.startsWith(prefix))continue;
  if(!result.has(tx.register_id))result.set(tx.register_id,[]);
  result.get(tx.register_id).push(tx);
 }
 for(const values of result.values())values.sort(newestMovementFirst);
 return result;
}
/** Positive = money enters available accounts from deposit; negative = money goes into deposit. */
export function depositAvailableChangeForMonth(transactions,legs,accounts,month,reversedIds=new Set()){
 const accountIds=new Set(accounts.filter(a=>a.is_deposit).map(a=>a.id));
 const transferIds=new Set(transactions.filter(t=>t.kind==='transfer'&&t.happened_on.startsWith(month.slice(0,7))&&!reversedIds.has(t.id)).map(t=>t.id));
 let depositCents=0;
 for(const leg of legs){
  if(accountIds.has(leg.account_id)&&transferIds.has(leg.transaction_id))depositCents+=Math.round(Number(leg.delta)*100);
 }
 return depositCents===0?0:-depositCents/100;
}
