import { fetchWithRetry, writeJson, readJson } from './lib/fetch-utils.js';
import { validateApiResponse, type DraftChoicesResponse, type FetchMeta } from './types/index.js';

const LEAGUE_ID = 820;
const URL = `https://draft.premierleague.com/api/draft/${LEAGUE_ID}/choices`;

export async function fetchDraft(): Promise<void> {
  const meta = readJson<FetchMeta>('meta.json');

  if (meta?.draftFetched) {
    console.log('[draft] Already fetched — skipping (draft is immutable)');
    return;
  }

  console.log('[draft] Fetching draft choices...');
  const data = await fetchWithRetry(URL, 'draft');
  const validated = validateApiResponse<DraftChoicesResponse>(
    data,
    ['choices'],
    'draft'
  );
  writeJson('draft.json', validated);
  console.log(`[draft] Got ${validated.choices.length} draft picks`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchDraft().catch(console.error);
}
