import { fetchWithRetry, writeJson, readJson, delay } from './lib/fetch-utils.js';
import { validateApiResponse, type LeagueResponse, type EntryEventResponse, type FetchMeta } from './types/index.js';

/**
 * Fetch picks for all managers for new gameweeks only.
 * Uses meta.json to track which GWs have been fetched.
 */
export async function fetchPicks(): Promise<void> {
  console.log('[picks] Checking for new gameweeks to fetch...');

  const league = readJson<LeagueResponse>('league.json');
  if (!league) {
    throw new Error('[picks] league.json not found — run fetch-league first');
  }

  const meta = readJson<FetchMeta>('meta.json');
  const lastFetched = meta?.lastFetchedGameweek ?? 0;

  // Find completed gameweeks from matches
  const completedGws = new Set<number>();
  for (const match of league.matches) {
    if (match.finished) {
      completedGws.add(match.event);
    }
  }

  const newGws = [...completedGws].filter((gw) => gw > lastFetched).sort((a, b) => a - b);

  if (newGws.length === 0) {
    console.log('[picks] No new gameweeks to fetch');
    return;
  }

  console.log(`[picks] Fetching GW ${newGws[0]}-${newGws[newGws.length - 1]} (${newGws.length} GWs)`);

  const entries = league.league_entries;

  for (const gw of newGws) {
    const gwPicks: Record<string, EntryEventResponse> = {};

    for (const entry of entries) {
      await delay(200);
      const url = `https://draft.premierleague.com/api/entry/${entry.entry_id}/event/${gw}`;
      try {
        const data = await fetchWithRetry(url, `picks-${entry.entry_id}-gw${gw}`);
        const validated = validateApiResponse<EntryEventResponse>(
          data,
          ['picks', 'entry_history'],
          `picks-${entry.entry_id}-gw${gw}`
        );
        gwPicks[String(entry.entry_id)] = validated;
      } catch (error) {
        console.error(`[picks] Failed for entry ${entry.entry_id} GW ${gw}: ${error}`);
        // Continue with other entries
      }
    }

    const gwStr = String(gw).padStart(2, '0');
    writeJson(`picks/gw${gwStr}.json`, gwPicks);
    console.log(`[picks] GW${gwStr}: fetched ${Object.keys(gwPicks).length}/${entries.length} entries`);

    await delay(1000); // delay between GWs
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchPicks().catch(console.error);
}
