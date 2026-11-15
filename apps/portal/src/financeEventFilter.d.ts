export interface EventTransaction { id:string; amount:number }
export interface EventAllocation { transaction_id:string; event_id:string; amount:number }
export function filterByEvent<T extends EventTransaction>(movements:T[], allocations:EventAllocation[], selectedEvent:string):T[];
export function allocatedAmount(tx:EventTransaction, allocations:EventAllocation[], selectedEvent:string):number;
