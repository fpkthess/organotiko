export function transferDirection(
  transactionId: string,
  legs: Array<{transaction_id: string; account_id: string; delta: number}>,
  accounts: Array<{id: string; name: string}>
): {from: string; to: string; fromId: string; toId: string; amount: number} | null;
