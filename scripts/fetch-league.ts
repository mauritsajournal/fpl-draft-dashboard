import { fetchWithRetry, writeJson } from './lib/fetch-utils.js';
import { validateApiResponse, type LeagueResponse } from './types/index.js';

const LEAGUE_ID = 820;
const URL = `https://draft.premierleague.com/api/league/${LEAGUE_ID}/details`;

export async function fetchLeague(): Promise<void> {
  console.log('[league] Fetching league details...');
  const data = await fetchWithRetry(URL, 'league');
  const validated = validateApiResponse<LeagueResponse>(
    data,
    ['league', 'league_entries', 'matches', 'standings'],
    'league'
  );
  writeJson('league.json', validated);
  console.log(`[league] Got ${validated.league_entries.length} entries, ${validated.matches.length} matches`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchLeague().catch(console.error);
}
