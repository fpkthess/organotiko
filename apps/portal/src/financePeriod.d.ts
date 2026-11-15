export type FinanceMovement={id:string;kind:string;register_id:string|null;happened_on:string;created_at:string};
export function newestMovementFirst<T extends FinanceMovement>(a:T,b:T):number;
export function getMonthlyRegisterMovements<T extends FinanceMovement>(transactions:readonly T[],month:string):Map<string,T[]>;
export function depositAvailableChangeForMonth(transactions:readonly {id:string;kind:string;happened_on:string}[],legs:readonly {transaction_id:string;account_id:string;delta:number}[],accounts:readonly {id:string;is_deposit:boolean}[],month:string,reversedIds?:ReadonlySet<string|null>):number;
