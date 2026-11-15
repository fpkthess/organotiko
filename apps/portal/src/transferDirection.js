/** Resolve a transfer's direction from the signed ledger entries, never from account sorting. */
export function transferDirection(transactionId, legs, accounts) {
  const items = legs.filter(leg => leg.transaction_id === transactionId);
  if (items.length !== 2) return null;
  const debit = items.find(leg => Number(leg.delta) < 0);
  const credit = items.find(leg => Number(leg.delta) > 0);
  if (!debit || !credit || debit.account_id === credit.account_id) return null;
  const amount = -Number(debit.delta);
  if (!Number.isFinite(amount) || !Number.isFinite(Number(credit.delta)) || amount <= 0 ||
      Math.abs(amount - Number(credit.delta)) > 0.005) return null;
  const from = accounts.find(account => account.id === debit.account_id);
  const to = accounts.find(account => account.id === credit.account_id);
  if (!from || !to) return null;
  return { from: from.name, to: to.name, fromId: from.id, toId: to.id, amount };
}
