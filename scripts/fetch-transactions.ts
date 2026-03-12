import { fetchWithRetry, writeJson } from './lib/fetch-utils.js';

const LEAGUE_ID = 820;
const URL = `https://draft.premierleague.com/api/draft/league/${LEAGUE_ID}/transactions`;

interface TransactionsResponse {
  transactions: unknown[];
}

export async function fetchTransactions(): Promise<void> {
  console.log('[transactions] Fetching transaction history...');
  const data = await fetchWithRetry(URL, 'transactions') as TransactionsResponse;

  // API returns { transactions: [...] }
  const transactions = data?.transactions;
  if (!Array.isArray(transactions)) {
    throw new Error('[transactions] Expected { transactions: [...] } response');
  }

  writeJson('transactions.json', transactions);
  console.log(`[transactions] Got ${transactions.length} transactions`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchTransactions().catch(console.error);
}
