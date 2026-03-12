import { fetchWithRetry, writeJson } from './lib/fetch-utils.js';

const LEAGUE_ID = 820;
const URL = `https://draft.premierleague.com/api/draft/league/${LEAGUE_ID}/transactions`;

export async function fetchTransactions(): Promise<void> {
  console.log('[transactions] Fetching transaction history...');
  const data = await fetchWithRetry(URL, 'transactions');

  if (!Array.isArray(data)) {
    throw new Error('[transactions] Expected array response');
  }

  writeJson('transactions.json', data);
  console.log(`[transactions] Got ${data.length} transactions`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchTransactions().catch(console.error);
}
