import { fetchWithRetry, writeJson } from './lib/fetch-utils.js';
import { validateApiResponse, type BootstrapResponse } from './types/index.js';

const URL = 'https://draft.premierleague.com/api/bootstrap-static';

export async function fetchBootstrap(): Promise<void> {
  console.log('[bootstrap] Fetching player data...');
  const data = await fetchWithRetry(URL, 'bootstrap');
  const validated = validateApiResponse<BootstrapResponse>(data, ['elements', 'teams', 'events'], 'bootstrap');
  writeJson('players.json', validated);
  console.log(`[bootstrap] Got ${validated.elements.length} players, ${validated.teams.length} teams`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchBootstrap().catch(console.error);
}
