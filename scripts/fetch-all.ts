import { delay, readJson, writeJson } from './lib/fetch-utils.js';
import { fetchBootstrap } from './fetch-bootstrap.js';
import { fetchLeague } from './fetch-league.js';
import { fetchElementStatus } from './fetch-element-status.js';
import { fetchPicks } from './fetch-picks.js';
import { fetchLive } from './fetch-live.js';
import { fetchTransactions } from './fetch-transactions.js';
import { fetchDraft } from './fetch-draft.js';
import { fetchFixtures } from './fetch-fixtures.js';
import type { FetchMeta } from './types/index.js';
import type { LeagueResponse } from './types/index.js';

const errors: string[] = [];

async function runStep(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[fetch-all] FAILED: ${name} — ${msg}`);
    errors.push(`${name}: ${msg}`);
  }
}

async function main(): Promise<void> {
  console.log('=== FPL Draft Data Fetch ===');
  console.log(`Started at ${new Date().toISOString()}`);
  console.log('');

  // 1. Fetch league first (needed by picks/live to know entries and completed GWs)
  await runStep('league', fetchLeague);
  await delay(500);

  // 2. Fetch bootstrap (players)
  await runStep('bootstrap', fetchBootstrap);
  await delay(500);

  // 3. Fetch element status (ownership)
  await runStep('element-status', fetchElementStatus);
  await delay(500);

  // 4. Fetch picks (incremental by GW)
  await runStep('picks', fetchPicks);
  await delay(500);

  // 5. Fetch live event stats (incremental by GW)
  await runStep('live', fetchLive);
  await delay(500);

  // 6. Fetch transactions
  await runStep('transactions', fetchTransactions);
  await delay(500);

  // 7. Fetch draft choices (one-time)
  await runStep('draft', fetchDraft);
  await delay(500);

  // 8. Fetch fixtures
  await runStep('fixtures', fetchFixtures);

  // Update meta.json
  const meta = readJson<FetchMeta>('meta.json') ?? {
    lastFetchedGameweek: 0,
    lastUpdated: '',
    currentSeason: '2025-26',
    draftFetched: false,
  };

  // Determine highest completed GW from league data
  const league = readJson<LeagueResponse>('league.json');
  if (league) {
    const completedGws = league.matches
      .filter((m) => m.finished)
      .map((m) => m.event);
    const maxGw = completedGws.length > 0 ? Math.max(...completedGws) : 0;
    meta.lastFetchedGameweek = maxGw;
  }

  meta.lastUpdated = new Date().toISOString();

  // Check if draft was fetched
  const draftData = readJson('draft.json');
  if (draftData !== null) {
    meta.draftFetched = true;
  }

  writeJson('meta.json', meta);

  console.log('');
  console.log('=== Fetch Complete ===');
  if (errors.length > 0) {
    console.log(`Errors (${errors.length}):`);
    for (const err of errors) {
      console.log(`  - ${err}`);
    }
    // Write errors for transform step to pick up
    writeJson('fetch-errors.json', errors);
  } else {
    console.log('All endpoints fetched successfully');
  }
}

main().catch((error) => {
  console.error('Fatal error in fetch-all:', error);
  process.exit(1);
});
