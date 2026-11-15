export function parseEuro(value:string|number):number;
export function cents(value:number):number;
export function euroFromCents(value:number):number;
export function accountBalanceAt(legs:{transaction_id:string;account_id:string;delta:number}[],transactions:{id:string;kind:string;happened_on:string}[],accountId:string,dateExclusive:string,includeOpeningAtBoundary?:boolean):number;
export function eventResult(allocations:{transaction_id:string;event_id:string;amount:number}[],transactions:{id:string;kind:string;reversed_transaction_id:string|null}[],eventId:string):{incomeCents:number;expenseCents:number};
