import { fetchWithRetry, writeJson, readJson, delay } from './lib/fetch-utils.js';
import { validateApiResponse, type LeagueResponse, type LiveEventResponse, type FetchMeta } from './types/index.js';

/**
 * Fetch live event stats for new gameweeks only.
 * Re-fetches the current in-progress GW on every cycle.
 */
export async function fetchLive(): Promise<void> {
  console.log('[live] Checking for new gameweeks to fetch...');

  const league = readJson<LeagueResponse>('league.json');
  if (!league) {
    throw new Error('[live] league.json not found — run fetch-league first');
  }

  const meta = readJson<FetchMeta>('meta.json');
  const lastFetched = meta?.lastFetchedGameweek ?? 0;

  // Find completed and in-progress GWs
  const completedGws = new Set<number>();
  let currentGw: number | null = null;

  for (const match of league.matches) {
    if (match.finished) {
      completedGws.add(match.event);
    } else if (match.started && !match.finished) {
      currentGw = match.event;
    }
  }

  // Fetch completed GWs that are new
  const newGws = [...completedGws].filter((gw) => gw > lastFetched).sort((a, b) => a - b);

  // Also re-fetch current in-progress GW
  const gwsToFetch = [...newGws];
  if (currentGw !== null && !gwsToFetch.includes(currentGw)) {
    gwsToFetch.push(currentGw);
  }

  if (gwsToFetch.length === 0) {
    console.log('[live] No new gameweeks to fetch');
    return;
  }

  console.log(`[live] Fetching ${gwsToFetch.length} gameweek(s): ${gwsToFetch.join(', ')}`);

  for (const gw of gwsToFetch) {
    await delay(500);
    const url = `https://draft.premierleague.com/api/event/${gw}/live`;
    try {
      const data = await fetchWithRetry(url, `live-gw${gw}`);
      const validated = validateApiResponse<LiveEventResponse>(
        data,
        ['elements'],
        `live-gw${gw}`
      );
      const gwStr = String(gw).padStart(2, '0');
      writeJson(`live/gw${gwStr}.json`, validated);
      console.log(`[live] GW${gwStr}: got ${Object.keys(validated.elements).length} player stats`);
    } catch (error) {
      console.error(`[live] Failed for GW ${gw}: ${error}`);
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fetchLive().catch(console.error);
}
