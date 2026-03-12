import { fetchWithRetry, writeJson } from './lib/fetch-utils.js';

const URL = 'https://fantasy.premierleague.com/api/fixtures/';

export async function fetchFixtures(): Promise<void> {
  console.log('[fixtures] Fetching PL fixtures...');
  const data = await fetchWithRetry(URL, 'fixtures');

  if (!Array.isArray(data)) {
    throw new Error('[fixtures] Expected array response');
  }

  writeJson('fixtures.json', data);
  console.log(`[fixtures] Got ${data.length} fixtures`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchFixtures().catch(console.error);
}
