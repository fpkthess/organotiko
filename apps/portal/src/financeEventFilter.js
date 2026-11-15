/** Apply a selected event only to the already month-scoped transaction list. */
export function filterByEvent(movements, allocations, selectedEvent) {
  if (!selectedEvent) return movements;
  const ids = new Set(allocations.filter(a => a.event_id === selectedEvent).map(a => a.transaction_id));
  return movements.filter(t => ids.has(t.id));
}

/** A partially allocated payment contributes only its share to a selected event. */
export function allocatedAmount(tx, allocations, selectedEvent) {
  if (!selectedEvent) return Number(tx.amount);
  return allocations.filter(a => a.transaction_id === tx.id && a.event_id === selectedEvent)
    .reduce((sum, a) => sum + Number(a.amount), 0);
}
