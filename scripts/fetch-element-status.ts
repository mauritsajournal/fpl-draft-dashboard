import { fetchWithRetry, writeJson } from './lib/fetch-utils.js';
import { validateApiResponse, type ElementStatusResponse } from './types/index.js';

const LEAGUE_ID = 820;
const URL = `https://draft.premierleague.com/api/league/${LEAGUE_ID}/element-status`;

export async function fetchElementStatus(): Promise<void> {
  console.log('[element-status] Fetching ownership data...');
  const data = await fetchWithRetry(URL, 'element-status');
  const validated = validateApiResponse<ElementStatusResponse>(
    data,
    ['element_status'],
    'element-status'
  );
  writeJson('ownership.json', validated);
  console.log(`[element-status] Got ${validated.element_status.length} element statuses`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchElementStatus().catch(console.error);
}
