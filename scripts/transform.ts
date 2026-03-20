import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJson } from './lib/fetch-utils.js';
import { PlayerResolver } from './lib/player-resolver.js';
import { buildDraftXPL } from './lib/espn-transform.js';
import type {
  BootstrapResponse,
  LeagueResponse,
  ElementStatusResponse,
  EntryEventResponse,
  LiveEventResponse,
  Transaction,
  DraftChoicesResponse,
  Fixture,
} from './types/api.js';
import type { FetchMeta } from './types/meta.js';
import type {
  DashboardData,
  DashboardMeta,
  Standing,
  Manager,
  GameweekSnapshot,
  H2HRecord,
  PlayerStat,
  PowerRank,
  TransactionDisplay,
  DraftPickDisplay,
  Prediction,
  BenchData,
  WhatIfResult,
  CreativeStats,
  LuckIndex,
  ConsistencyScore,
  FormRating,
  ClutchScore,
  RivalryDetail,
  WeeklyAwards,
  PositionalBreakdown,
  StreakData,
  DraftValueEntry,
  RequestedStats,
  RecommendedXI,
  RecommendedPlayer,
  OpponentAvgAgainst,
  MascotteEntry,
} from './types/dashboard.js';

const DATA_DIR = path.resolve(import.meta.dirname, '../data');

function main(): void {
  console.log('=== Transform: Building dashboard.json ===');

  // Load critical data
  const league = readJson<LeagueResponse>('league.json');
  const bootstrap = readJson<BootstrapResponse>('players.json');

  if (!league || !bootstrap) {
    console.error('FATAL: league.json or players.json missing — cannot transform');
    process.exit(1);
  }

  const resolver = new PlayerResolver(bootstrap);
  const meta = readJson<FetchMeta>('meta.json');
  const fetchErrors = readJson<string[]>('fetch-errors.json') ?? [];

  // Load optional data
  const ownership = readJson<ElementStatusResponse>('ownership.json');
  const transactions = readJson<Transaction[]>('transactions.json');
  const draft = readJson<DraftChoicesResponse>('draft.json');
  const fixtures = readJson<Fixture[]>('fixtures.json');

  // Load picks and live data per GW
  const completedGws = getCompletedGameweeks(league);
  const picksMap = loadGameweekFiles<Record<string, EntryEventResponse>>('picks', completedGws);
  const liveMap = loadGameweekFiles<LiveEventResponse>('live', completedGws);

  // Determine current GW
  const currentGw = completedGws.length > 0 ? Math.max(...completedGws) : 0;

  // Events info from Draft API
  const nextGwNum = bootstrap.events.next;
  const currentGwFromApi = bootstrap.events.current;

  // Build data availability flags
  const dataAvailable = {
    standings: true,
    picks: picksMap.size > 0,
    live: liveMap.size > 0,
    transactions: transactions !== null,
    draft: draft !== null,
    fixtures: fixtures !== null,
    ownership: ownership !== null,
  };

  // Build manager lookup
  const entryMap = new Map(
    league.league_entries.map((e) => [e.id, e])
  );

  // Map entry_id -> league_entry id (they differ for some managers)
  // The ownership API returns entry_id as the owner, not league_entry id
  const entryIdToLeagueId = new Map(
    league.league_entries.map((e) => [e.entry_id, e.id])
  );

  // ---- Standings ----
  const standings = buildStandings(league, entryMap);
  console.log(`  Standings: ${standings.length} entries`);

  // ---- Managers ----
  const managers = buildManagers(league, entryMap, picksMap);
  console.log(`  Managers: ${managers.length} entries`);

  // ---- Gameweek History ----
  const gameweekHistory = buildGameweekHistory(league, entryMap, completedGws);
  console.log(`  Gameweek History: ${gameweekHistory.length} snapshots`);

  // ---- H2H Matrix ----
  const h2hMatrix = buildH2HMatrix(league);
  console.log(`  H2H Matrix: ${h2hMatrix.length} records`);

  // ---- Player Stats ----
  const playerStats = buildPlayerStats(bootstrap, ownership, resolver, entryMap, entryIdToLeagueId);
  const ownedPlayers = playerStats.filter((p) => p.owner !== null);
  const freeAgents = playerStats
    .filter((p) => p.owner === null)
    .sort((a, b) => b.totalPoints - a.totalPoints)
    .slice(0, 200);
  console.log(`  Player Stats: ${ownedPlayers.length} owned, ${freeAgents.length} free agents`);

  // ---- Power Rankings ----
  const powerRankings = buildPowerRankings(league, entryMap, picksMap, liveMap, resolver, bootstrap, fixtures, currentGw);
  console.log(`  Power Rankings: ${powerRankings.length} entries`);

  // ---- Transactions ----
  const transactionDisplays = buildTransactions(transactions, resolver, entryMap);
  console.log(`  Transactions: ${transactionDisplays.length} entries`);

  // ---- Draft Picks ----
  const draftPicks = buildDraftPicks(draft, resolver);
  console.log(`  Draft Picks: ${draftPicks.length} entries`);

  // ---- Predictions ----
  const predictions = buildPredictions(league, entryMap, entryIdToLeagueId, ownership, resolver, bootstrap, fixtures, currentGw);
  console.log(`  Predictions: ${predictions.length} entries`);

  // ---- Bench Analysis ----
  const benchAnalysis = buildBenchAnalysis(league, entryMap, picksMap, liveMap, completedGws);
  console.log(`  Bench Analysis: ${benchAnalysis.length} entries`);

  // ---- What-If Analysis ----
  const whatIf = buildWhatIf(league, entryMap, standings, completedGws);
  console.log(`  What-If Analysis: ${whatIf.length} entries`);

  // ---- Creative Stats ----
  const creativeStats = buildCreativeStats(league, entryMap, standings, managers, completedGws, h2hMatrix, ownedPlayers, draftPicks, resolver);
  console.log(`  Creative Stats: luck=${creativeStats.luckIndex.length}, consistency=${creativeStats.consistencyScores.length}, streaks=${creativeStats.streaks.length}`);

  // ---- ESPN Integration (Draft x PL) ----
  console.log('  Building Draft x PL stats...');
  const draftXPL = buildDraftXPL();
  if (draftXPL) {
    console.log(`  Draft x PL: ${draftXPL.managerProfiles.length} managers, ${draftXPL.awards.goldBoot?.name ?? 'N/A'} top scorer`);
  } else {
    console.log('  Draft x PL: skipped (ESPN data not available)');
  }

  // ---- Requested Stats (Recommended XI + Opponent Avg Against) ----
  const requestedStats = buildRequestedStats(
    league, entryMap, entryIdToLeagueId, ownership, resolver,
    bootstrap, fixtures, liveMap, picksMap, h2hMatrix, completedGws, currentGw, freeAgents,
    draftPicks, creativeStats.draftValue, ownedPlayers
  );
  if (requestedStats) {
    console.log(`  Requested Stats: ${requestedStats.recommendedXIs.length} recommended XIs, ${requestedStats.opponentAvgAgainst.length} opponent avg records, ${requestedStats.mascotte.length} mascotte entries`);
  } else {
    console.log('  Requested Stats: skipped (insufficient data)');
  }

  // ---- Assemble Dashboard ----
  const dashboard: DashboardData = {
    meta: {
      lastUpdated: new Date().toISOString(),
      currentGameweek: currentGw,
      leagueName: league.league.name,
      season: meta?.currentSeason ?? '2025-26',
      dataAvailable,
      fetchErrors,
    },
    standings,
    managers,
    gameweekHistory,
    h2hMatrix,
    playerStats: ownedPlayers.sort((a, b) => b.totalPoints - a.totalPoints),
    freeAgents,
    powerRankings,
    transactions: transactionDisplays,
    draftPicks,
    predictions,
    benchAnalysis,
    whatIf,
    creativeStats,
    draftXPL,
    requestedStats,
  };

  writeJson('dashboard.json', dashboard);
  console.log('=== Transform Complete ===');
}

// ---- Helper Functions ----

function getCompletedGameweeks(league: LeagueResponse): number[] {
  const gws = new Set<number>();
  for (const match of league.matches) {
    if (match.finished) {
      gws.add(match.event);
    }
  }
  return [...gws].sort((a, b) => a - b);
}

function loadGameweekFiles<T>(prefix: string, gws: number[]): Map<number, T> {
  const map = new Map<number, T>();
  for (const gw of gws) {
    const gwStr = String(gw).padStart(2, '0');
    const data = readJson<T>(`${prefix}/gw${gwStr}.json`);
    if (data !== null) {
      map.set(gw, data);
    }
  }
  return map;
}

function buildStandings(
  league: LeagueResponse,
  entryMap: Map<number, LeagueResponse['league_entries'][0]>
): Standing[] {
  return league.standings
    .sort((a, b) => a.rank - b.rank)
    .map((s) => {
      const entry = entryMap.get(s.league_entry);
      return {
        rank: s.rank,
        lastRank: s.last_rank,
        leagueEntryId: s.league_entry,
        entryId: entry?.entry_id ?? 0,
        teamName: entry?.entry_name ?? 'Unknown',
        playerName: entry
          ? `${entry.player_first_name} ${entry.player_last_name}`
          : 'Unknown',
        shortName: entry?.short_name ?? '???',
        played: s.matches_won + s.matches_drawn + s.matches_lost,
        won: s.matches_won,
        drawn: s.matches_drawn,
        lost: s.matches_lost,
        pointsFor: s.points_for,
        pointsAgainst: s.points_against,
        leaguePoints: s.total,
      };
    });
}

function buildManagers(
  league: LeagueResponse,
  entryMap: Map<number, LeagueResponse['league_entries'][0]>,
  picksMap: Map<number, Record<string, EntryEventResponse>>
): Manager[] {
  return league.league_entries.map((entry) => {
    const standing = league.standings.find((s) => s.league_entry === entry.id);

    // Collect GW points from matches
    const gwPoints: { gw: number; points: number }[] = [];
    for (const match of league.matches) {
      if (!match.finished) continue;
      if (match.league_entry_1 === entry.id) {
        gwPoints.push({ gw: match.event, points: match.league_entry_1_points });
      } else if (match.league_entry_2 === entry.id) {
        gwPoints.push({ gw: match.event, points: match.league_entry_2_points });
      }
    }

    // Deduplicate by gw (should be one match per GW)
    const uniqueGwPoints = [...new Map(gwPoints.map((g) => [g.gw, g])).values()]
      .sort((a, b) => a.gw - b.gw);

    const totalPoints = uniqueGwPoints.reduce((sum, g) => sum + g.points, 0);
    const count = uniqueGwPoints.length;
    const averagePoints = count > 0 ? Math.round((totalPoints / count) * 10) / 10 : 0;

    const bestGw =
      uniqueGwPoints.length > 0
        ? uniqueGwPoints.reduce((best, g) => (g.points > best.points ? g : best))
        : { gw: 0, points: 0 };

    const worstGw =
      uniqueGwPoints.length > 0
        ? uniqueGwPoints.reduce((worst, g) => (g.points < worst.points ? g : worst))
        : { gw: 0, points: 0 };

    const currentForm = uniqueGwPoints.slice(-5).map((g) => g.points);

    return {
      leagueEntryId: entry.id,
      entryId: entry.entry_id,
      teamName: entry.entry_name,
      playerName: `${entry.player_first_name} ${entry.player_last_name}`,
      shortName: entry.short_name,
      totalPoints,
      averagePoints,
      bestGw,
      worstGw,
      currentForm,
      wins: standing?.matches_won ?? 0,
      draws: standing?.matches_drawn ?? 0,
      losses: standing?.matches_lost ?? 0,
      leaguePoints: standing?.total ?? 0,
    };
  });
}

function buildGameweekHistory(
  league: LeagueResponse,
  entryMap: Map<number, LeagueResponse['league_entries'][0]>,
  completedGws: number[]
): GameweekSnapshot[] {
  const entries = league.league_entries;

  // Track cumulative points and league points per manager
  const cumPoints: Record<number, number> = {};
  const leaguePoints: Record<number, number> = {};
  for (const e of entries) {
    cumPoints[e.id] = 0;
    leaguePoints[e.id] = 0;
  }

  const snapshots: GameweekSnapshot[] = [];

  for (const gw of completedGws) {
    // Find matches for this GW
    const gwMatches = league.matches.filter((m) => m.event === gw && m.finished);

    // Update points for each manager from their match
    const gwPointsMap: Record<number, number> = {};
    for (const match of gwMatches) {
      cumPoints[match.league_entry_1] =
        (cumPoints[match.league_entry_1] ?? 0) + match.league_entry_1_points;
      cumPoints[match.league_entry_2] =
        (cumPoints[match.league_entry_2] ?? 0) + match.league_entry_2_points;

      gwPointsMap[match.league_entry_1] = match.league_entry_1_points;
      gwPointsMap[match.league_entry_2] = match.league_entry_2_points;

      // League points — infer winner from points (winning_league_entry is often null in Draft API)
      if (match.league_entry_1_points > match.league_entry_2_points) {
        leaguePoints[match.league_entry_1] = (leaguePoints[match.league_entry_1] ?? 0) + 3;
      } else if (match.league_entry_2_points > match.league_entry_1_points) {
        leaguePoints[match.league_entry_2] = (leaguePoints[match.league_entry_2] ?? 0) + 3;
      } else if (match.finished) {
        // Draw
        leaguePoints[match.league_entry_1] = (leaguePoints[match.league_entry_1] ?? 0) + 1;
        leaguePoints[match.league_entry_2] = (leaguePoints[match.league_entry_2] ?? 0) + 1;
      }
    }

    // Build standings snapshot sorted by league points (then by points for as tiebreak)
    const entryStandings = entries
      .map((e) => ({
        leagueEntryId: e.id,
        cumulativePoints: cumPoints[e.id] ?? 0,
        leaguePoints: leaguePoints[e.id] ?? 0,
        gwPoints: gwPointsMap[e.id] ?? 0,
        rank: 0,
      }))
      .sort((a, b) => {
        if (b.leaguePoints !== a.leaguePoints) return b.leaguePoints - a.leaguePoints;
        return b.cumulativePoints - a.cumulativePoints;
      });

    // Assign ranks
    entryStandings.forEach((s, i) => {
      s.rank = i + 1;
    });

    snapshots.push({
      gameweek: gw,
      standings: entryStandings,
    });
  }

  return snapshots;
}

function buildH2HMatrix(league: LeagueResponse): H2HRecord[] {
  const entries = league.league_entries;
  const records: H2HRecord[] = [];

  for (let i = 0; i < entries.length; i++) {
    for (let j = i + 1; j < entries.length; j++) {
      const a = entries[i].id;
      const b = entries[j].id;

      let wins = 0;
      let draws = 0;
      let losses = 0;
      let pointsFor = 0;
      let pointsAgainst = 0;
      const matches: { gw: number; pointsA: number; pointsB: number }[] = [];

      for (const match of league.matches) {
        if (!match.finished) continue;

        let ptsA: number | null = null;
        let ptsB: number | null = null;

        if (match.league_entry_1 === a && match.league_entry_2 === b) {
          ptsA = match.league_entry_1_points;
          ptsB = match.league_entry_2_points;
        } else if (match.league_entry_1 === b && match.league_entry_2 === a) {
          ptsA = match.league_entry_2_points;
          ptsB = match.league_entry_1_points;
        }

        if (ptsA !== null && ptsB !== null) {
          matches.push({ gw: match.event, pointsA: ptsA, pointsB: ptsB });
          pointsFor += ptsA;
          pointsAgainst += ptsB;
          if (ptsA > ptsB) wins++;
          else if (ptsA === ptsB) draws++;
          else losses++;
        }
      }

      records.push({
        managerA: a,
        managerB: b,
        wins,
        draws,
        losses,
        pointsFor,
        pointsAgainst,
        matches: matches.sort((a, b) => a.gw - b.gw),
      });
    }
  }

  return records;
}

function buildPlayerStats(
  bootstrap: BootstrapResponse,
  ownership: ElementStatusResponse | null,
  resolver: PlayerResolver,
  entryMap: Map<number, LeagueResponse['league_entries'][0]>,
  entryIdToLeagueId: Map<number, number>
): PlayerStat[] {
  const ownerMap = new Map<number, number | null>();
  if (ownership) {
    for (const es of ownership.element_status) {
      // ownership.owner is entry_id, translate to league_entry id
      const leagueId = es.owner !== null ? (entryIdToLeagueId.get(es.owner) ?? null) : null;
      ownerMap.set(es.element, leagueId);
    }
  }

  return bootstrap.elements.map((p) => {
    const ownerLeagueEntryId = ownerMap.get(p.id) ?? null;
    const ownerEntry = ownerLeagueEntryId !== null ? entryMap.get(ownerLeagueEntryId) : null;

    return {
      id: p.id,
      webName: p.web_name,
      firstName: p.first_name,
      lastName: p.second_name,
      position: resolver.getPosition(p.element_type),
      positionId: p.element_type,
      team: resolver.getTeamName(p.team),
      teamId: p.team,
      owner: ownerEntry
        ? `${ownerEntry.player_first_name} ${ownerEntry.player_last_name}`
        : null,
      ownerLeagueEntryId,
      totalPoints: p.total_points,
      form: parseFloat(p.form) || 0,
      goalsScored: p.goals_scored,
      assists: p.assists,
      xG: parseFloat(p.expected_goals) || 0,
      xA: parseFloat(p.expected_assists) || 0,
      xGI: parseFloat(p.expected_goal_involvements) || 0,
      minutes: p.minutes,
      cleanSheets: p.clean_sheets,
      bonus: p.bonus,
    };
  });
}

function buildPowerRankings(
  league: LeagueResponse,
  entryMap: Map<number, LeagueResponse['league_entries'][0]>,
  picksMap: Map<number, Record<string, EntryEventResponse>>,
  liveMap: Map<number, LiveEventResponse>,
  resolver: PlayerResolver,
  bootstrap: BootstrapResponse,
  fixtures: Fixture[] | null,
  currentGw: number
): PowerRank[] {
  if (!picksMap.size || !liveMap.size) return [];

  // Get the latest GW picks to find current squad
  const latestGw = currentGw;
  const latestPicks = picksMap.get(latestGw);
  if (!latestPicks) return [];

  const rankings: PowerRank[] = [];

  for (const entry of league.league_entries) {
    const entryPicks = latestPicks[String(entry.entry_id)];
    if (!entryPicks) continue;

    // Get starting XI player IDs
    const startingIds = entryPicks.picks
      .filter((p) => p.position <= 11)
      .map((p) => p.element);

    // Calculate form score (average form of starting XI)
    let formTotal = 0;
    let xGITotal = 0;
    let pointsTotal = 0;
    let count = 0;

    for (const pid of startingIds) {
      const player = resolver.getPlayer(pid);
      if (!player) continue;
      formTotal += parseFloat(player.form) || 0;
      xGITotal += parseFloat(player.expected_goal_involvements) || 0;
      pointsTotal += player.total_points;
      count++;
    }

    if (count === 0) continue;

    const avgForm = formTotal / count;
    const avgXGI = xGITotal / count;
    const avgPoints = pointsTotal / count;

    // Normalize to 0-100 scale (rough heuristic)
    const formScore = Math.min(avgForm * 10, 25); // max 25
    const xGIScore = Math.min(avgXGI * 2, 25); // max 25
    const pointsScore = Math.min(avgPoints / 4, 25); // max 25

    // Fixture difficulty (lower = easier = higher score)
    let fixtureScore = 15; // default middle value
    if (fixtures) {
      // This is a rough approximation — would need to map PL teams to draft entry teams
      fixtureScore = 15;
    }

    const totalScore = Math.round(formScore + xGIScore + pointsScore + fixtureScore);

    rankings.push({
      leagueEntryId: entry.id,
      teamName: entry.entry_name,
      playerName: `${entry.player_first_name} ${entry.player_last_name}`,
      score: Math.min(totalScore, 100),
      breakdown: {
        form: Math.round(formScore * 10) / 10,
        xGI: Math.round(xGIScore * 10) / 10,
        totalPoints: Math.round(pointsScore * 10) / 10,
        fixtureDifficulty: Math.round(fixtureScore * 10) / 10,
      },
    });
  }

  return rankings.sort((a, b) => b.score - a.score);
}

function buildTransactions(
  transactions: Transaction[] | null,
  resolver: PlayerResolver,
  entryMap: Map<number, LeagueResponse['league_entries'][0]>
): TransactionDisplay[] {
  if (!transactions) return [];

  return transactions.map((t) => {
    const entry = entryMap.get(t.entry);
    return {
      id: t.id,
      gameweek: t.event,
      managerName: entry
        ? `${entry.player_first_name} ${entry.player_last_name}`
        : 'Unknown',
      leagueEntryId: t.entry,
      playerIn: resolver.getName(t.element_in),
      playerInId: t.element_in,
      playerOut: resolver.getName(t.element_out),
      playerOutId: t.element_out,
      type: t.kind === 'w' ? 'waiver' as const : 'free_agent' as const,
      result: t.result === 'a' ? 'accepted' as const : 'rejected' as const,
    };
  });
}

function buildDraftPicks(
  draft: DraftChoicesResponse | null,
  resolver: PlayerResolver
): DraftPickDisplay[] {
  if (!draft) return [];

  return draft.choices.map((c) => ({
    round: c.round,
    pick: c.pick,
    playerName: resolver.getName(c.element),
    playerId: c.element,
    managerName: c.entry_name,
    leagueEntryId: c.entry,
    wasAuto: c.was_auto,
  }));
}

function buildPredictions(
  league: LeagueResponse,
  entryMap: Map<number, LeagueResponse['league_entries'][0]>,
  entryIdToLeagueId: Map<number, number>,
  ownership: ElementStatusResponse | null,
  resolver: PlayerResolver,
  bootstrap: BootstrapResponse,
  fixtures: Fixture[] | null,
  currentGw: number
): Prediction[] {
  // Find next GW matches
  const nextGw = currentGw + 1;
  const nextMatches = league.matches.filter((m) => m.event === nextGw);

  if (nextMatches.length === 0) return [];

  // Build player-to-owner mapping (translate entry_id -> league_entry id)
  const playerOwner = new Map<number, number>();
  if (ownership) {
    for (const es of ownership.element_status) {
      if (es.owner !== null) {
        const leagueId = entryIdToLeagueId.get(es.owner) ?? es.owner;
        playerOwner.set(es.element, leagueId);
      }
    }
  }

  // Group players by owner (keyed by league_entry id)
  const ownerPlayers = new Map<number, typeof bootstrap.elements>();
  for (const p of bootstrap.elements) {
    const owner = playerOwner.get(p.id);
    if (owner !== undefined) {
      const existing = ownerPlayers.get(owner) ?? [];
      existing.push(p);
      ownerPlayers.set(owner, existing);
    }
  }

  const predictions: Prediction[] = [];

  for (const entry of league.league_entries) {
    const players = ownerPlayers.get(entry.id) ?? [];

    // Sort by total_points desc and take top 11 as starting XI approximation
    const sorted = [...players].sort((a, b) => b.total_points - a.total_points);
    const startingXI = sorted.slice(0, 11);

    let totalPredicted = 0;
    const breakdown = startingXI.map((p) => {
      // Simple prediction: form * 2 (rough expected points next GW)
      const formPoints = (parseFloat(p.form) || 0) * 2;
      const xGBonus = (parseFloat(p.expected_goals) || 0) * 0.1;
      const xABonus = (parseFloat(p.expected_assists) || 0) * 0.1;
      const expected = Math.round((formPoints + xGBonus + xABonus) * 10) / 10;
      totalPredicted += expected;

      return {
        playerId: p.id,
        playerName: p.web_name,
        expectedPoints: expected,
        fixtureDifficulty: 3, // default middle difficulty
      };
    });

    // Find opponent in next match
    let opponent: Prediction['opponent'] = null;
    for (const match of nextMatches) {
      if (match.league_entry_1 === entry.id) {
        const opp = entryMap.get(match.league_entry_2);
        if (opp) {
          opponent = {
            leagueEntryId: opp.id,
            teamName: opp.entry_name,
          };
        }
      } else if (match.league_entry_2 === entry.id) {
        const opp = entryMap.get(match.league_entry_1);
        if (opp) {
          opponent = {
            leagueEntryId: opp.id,
            teamName: opp.entry_name,
          };
        }
      }
    }

    predictions.push({
      leagueEntryId: entry.id,
      teamName: entry.entry_name,
      playerName: `${entry.player_first_name} ${entry.player_last_name}`,
      predictedPoints: Math.round(totalPredicted * 10) / 10,
      playerBreakdown: breakdown,
      opponent,
    });
  }

  return predictions.sort((a, b) => b.predictedPoints - a.predictedPoints);
}

function buildBenchAnalysis(
  league: LeagueResponse,
  entryMap: Map<number, LeagueResponse['league_entries'][0]>,
  picksMap: Map<number, Record<string, EntryEventResponse>>,
  liveMap: Map<number, LiveEventResponse>,
  completedGws: number[]
): BenchData[] {
  if (!picksMap.size || !liveMap.size) return [];

  const results: BenchData[] = [];

  for (const entry of league.league_entries) {
    let totalBenchPoints = 0;
    const perGameweek: BenchData['perGameweek'] = [];

    for (const gw of completedGws) {
      const gwPicks = picksMap.get(gw);
      const gwLive = liveMap.get(gw);
      if (!gwPicks || !gwLive) continue;

      const entryPicks = gwPicks[String(entry.entry_id)];
      if (!entryPicks) continue;

      // Bench players are positions 12-15
      let benchPoints = 0;
      for (const pick of entryPicks.picks) {
        if (pick.position >= 12) {
          const playerLive = gwLive.elements[String(pick.element)];
          if (playerLive) {
            benchPoints += playerLive.stats.total_points;
          }
        }
      }

      totalBenchPoints += benchPoints;
      perGameweek.push({ gw, benchPoints });
    }

    results.push({
      leagueEntryId: entry.id,
      teamName: entry.entry_name,
      playerName: `${entry.player_first_name} ${entry.player_last_name}`,
      totalBenchPoints,
      perGameweek,
    });
  }

  return results.sort((a, b) => b.totalBenchPoints - a.totalBenchPoints);
}

function buildWhatIf(
  league: LeagueResponse,
  entryMap: Map<number, LeagueResponse['league_entries'][0]>,
  standings: Standing[],
  completedGws: number[]
): WhatIfResult[] {
  if (completedGws.length === 0) return [];

  const entries = league.league_entries;

  // Build each manager's actual GW scores
  // gwScores[leagueEntryId][gw] = points scored that GW
  const gwScores: Record<number, Record<number, number>> = {};
  for (const e of entries) {
    gwScores[e.id] = {};
  }
  for (const match of league.matches) {
    if (!match.finished) continue;
    gwScores[match.league_entry_1] = gwScores[match.league_entry_1] ?? {};
    gwScores[match.league_entry_2] = gwScores[match.league_entry_2] ?? {};
    gwScores[match.league_entry_1][match.event] = match.league_entry_1_points;
    gwScores[match.league_entry_2][match.event] = match.league_entry_2_points;
  }

  // Build each manager's actual schedule: who they faced each GW
  // schedule[leagueEntryId][gw] = opponent leagueEntryId
  const schedule: Record<number, Record<number, number>> = {};
  for (const e of entries) {
    schedule[e.id] = {};
  }
  for (const match of league.matches) {
    if (!match.finished) continue;
    schedule[match.league_entry_1][match.event] = match.league_entry_2;
    schedule[match.league_entry_2][match.event] = match.league_entry_1;
  }

  // For each manager M, simulate: what if M played schedule S (for all S)?
  // Use M's actual GW scores, but face the opponents from S's schedule.
  const results: WhatIfResult[] = [];

  for (const manager of entries) {
    const mId = manager.id;
    const mScores = gwScores[mId];
    const scheduleResults: WhatIfResult['schedules'] = [];

    for (const scheduleOwner of entries) {
      const sId = scheduleOwner.id;
      const sSchedule = schedule[sId];

      let wins = 0;
      let draws = 0;
      let losses = 0;

      for (const gw of completedGws) {
        const myPoints = mScores[gw];
        const opponentId = sSchedule[gw];
        if (myPoints === undefined || opponentId === undefined) continue;
        const opponentPoints = gwScores[opponentId]?.[gw];
        if (opponentPoints === undefined) continue;

        if (myPoints > opponentPoints) wins++;
        else if (myPoints === opponentPoints) draws++;
        else losses++;
      }

      const leaguePoints = wins * 3 + draws;
      scheduleResults.push({
        asScheduleOf: sId,
        asScheduleOfName: `${scheduleOwner.player_first_name} ${scheduleOwner.player_last_name}`,
        wins,
        draws,
        losses,
        leaguePoints,
        rank: 0, // will be computed after
      });
    }

    // Compute rank for each simulated schedule by comparing against all other managers'
    // actual league points (this is a simplification — a full simulation would re-rank everyone)
    // Instead, we rank based on the simulated league points relative to actual standings
    for (const sim of scheduleResults) {
      let rank = 1;
      for (const st of standings) {
        if (st.leagueEntryId !== mId && st.leaguePoints > sim.leaguePoints) {
          rank++;
        } else if (st.leagueEntryId !== mId && st.leaguePoints === sim.leaguePoints) {
          // Tiebreak by points for (use actual points for)
          const actualStanding = standings.find(s => s.leagueEntryId === mId);
          if (actualStanding && st.pointsFor > actualStanding.pointsFor) {
            rank++;
          }
        }
      }
      sim.rank = rank;
    }

    const actualStanding = standings.find(s => s.leagueEntryId === mId);
    const actualRank = actualStanding?.rank ?? 0;
    const actualLP = actualStanding?.leaguePoints ?? 0;

    const avgRank = scheduleResults.reduce((sum, s) => sum + s.rank, 0) / scheduleResults.length;
    const bestRank = Math.min(...scheduleResults.map(s => s.rank));
    const worstRank = Math.max(...scheduleResults.map(s => s.rank));
    const avgPoints = scheduleResults.reduce((sum, s) => sum + s.leaguePoints, 0) / scheduleResults.length;

    // Luck: positive means actual rank is better (lower number) than average simulated rank
    const luck = Math.round((avgRank - actualRank) * 10) / 10;

    results.push({
      leagueEntryId: mId,
      teamName: manager.entry_name,
      playerName: `${manager.player_first_name} ${manager.player_last_name}`,
      actualRank,
      actualLeaguePoints: actualLP,
      averageWhatIfRank: Math.round(avgRank * 10) / 10,
      bestWhatIfRank: bestRank,
      worstWhatIfRank: worstRank,
      averageWhatIfPoints: Math.round(avgPoints * 10) / 10,
      luck,
      schedules: scheduleResults,
    });
  }

  return results.sort((a, b) => b.luck - a.luck);
}

// ---- Creative Stats ----

function buildCreativeStats(
  league: LeagueResponse,
  entryMap: Map<number, LeagueResponse['league_entries'][0]>,
  standings: Standing[],
  managers: Manager[],
  completedGws: number[],
  h2hMatrix: H2HRecord[],
  ownedPlayers: PlayerStat[],
  draftPicks: DraftPickDisplay[],
  resolver: PlayerResolver,
): CreativeStats {
  const entries = league.league_entries;

  // Build GW scores per manager
  const gwScores: Record<number, Record<number, number>> = {};
  for (const e of entries) gwScores[e.id] = {};
  for (const match of league.matches) {
    if (!match.finished) continue;
    gwScores[match.league_entry_1] = gwScores[match.league_entry_1] ?? {};
    gwScores[match.league_entry_2] = gwScores[match.league_entry_2] ?? {};
    gwScores[match.league_entry_1][match.event] = match.league_entry_1_points;
    gwScores[match.league_entry_2][match.event] = match.league_entry_2_points;
  }

  // 1. Luck Index
  const luckIndex = buildLuckIndex(league, entries, entryMap, gwScores, completedGws);

  // 2. Consistency Score
  const consistencyScores = buildConsistencyScores(entries, entryMap, gwScores, completedGws);

  // 3. Form Rating
  const formRatings = buildFormRatings(entries, entryMap, gwScores, completedGws);

  // 4. Clutch Score
  const clutchScores = buildClutchScores(league, entries, entryMap);

  // 5. Rivalry Matrix
  const rivalryMatrix = buildRivalryMatrix(h2hMatrix, entryMap);

  // 6. Weekly Awards
  const weeklyAwards = buildWeeklyAwards(entries, entryMap, gwScores, completedGws);

  // 7. Positional Breakdown
  const positionalBreakdown = buildPositionalBreakdown(entries, entryMap, ownedPlayers, completedGws);

  // 8. Streaks
  const streaks = buildStreaks(league, entries, entryMap);

  // 9. Draft Value
  const draftValue = buildDraftValue(draftPicks, resolver, ownedPlayers);

  return {
    luckIndex,
    consistencyScores,
    formRatings,
    clutchScores,
    rivalryMatrix,
    weeklyAwards,
    positionalBreakdown,
    streaks,
    draftValue,
  };
}

function buildLuckIndex(
  league: LeagueResponse,
  entries: LeagueResponse['league_entries'],
  entryMap: Map<number, LeagueResponse['league_entries'][0]>,
  gwScores: Record<number, Record<number, number>>,
  completedGws: number[],
): LuckIndex[] {
  const results: LuckIndex[] = [];

  for (const entry of entries) {
    const mId = entry.id;
    let actualWins = 0;
    let expectedWins = 0;

    for (const gw of completedGws) {
      const myPoints = gwScores[mId]?.[gw];
      if (myPoints === undefined) continue;

      // Actual result from the match (winning_league_entry is often null in Draft API, so infer from points)
      const gwMatches = league.matches.filter(m => m.finished && m.event === gw);
      for (const match of gwMatches) {
        if (match.league_entry_1 === mId && match.league_entry_1_points > match.league_entry_2_points) actualWins++;
        if (match.league_entry_2 === mId && match.league_entry_2_points > match.league_entry_1_points) actualWins++;
      }

      // Expected: how many of the other 7 managers would this score beat?
      let winsIfPlayedAll = 0;
      let gamesIfPlayedAll = 0;
      for (const other of entries) {
        if (other.id === mId) continue;
        const otherPoints = gwScores[other.id]?.[gw];
        if (otherPoints === undefined) continue;
        gamesIfPlayedAll++;
        if (myPoints > otherPoints) winsIfPlayedAll++;
        else if (myPoints === otherPoints) winsIfPlayedAll += 0.5;
      }
      // Expected win rate for this GW = winsIfPlayedAll / gamesIfPlayedAll
      if (gamesIfPlayedAll > 0) {
        expectedWins += winsIfPlayedAll / gamesIfPlayedAll;
      }
    }

    const luckScore = Math.round((actualWins - expectedWins) * 10) / 10;

    results.push({
      leagueEntryId: mId,
      playerName: `${entry.player_first_name} ${entry.player_last_name}`,
      teamName: entry.entry_name,
      actualWins,
      expectedWins: Math.round(expectedWins * 10) / 10,
      luckScore,
    });
  }

  return results.sort((a, b) => b.luckScore - a.luckScore);
}

function buildConsistencyScores(
  entries: LeagueResponse['league_entries'],
  entryMap: Map<number, LeagueResponse['league_entries'][0]>,
  gwScores: Record<number, Record<number, number>>,
  completedGws: number[],
): ConsistencyScore[] {
  const results: ConsistencyScore[] = [];

  for (const entry of entries) {
    const points = completedGws
      .map(gw => gwScores[entry.id]?.[gw])
      .filter((p): p is number => p !== undefined);

    if (points.length === 0) continue;

    const mean = points.reduce((a, b) => a + b, 0) / points.length;
    const variance = points.reduce((sum, p) => sum + (p - mean) ** 2, 0) / points.length;
    const stdDev = Math.round(Math.sqrt(variance) * 10) / 10;

    let label: string;
    if (stdDev < 8) label = 'Rock Solid';
    else if (stdDev < 12) label = 'Consistent';
    else if (stdDev < 16) label = 'Streaky';
    else label = 'Wildcard';

    results.push({
      leagueEntryId: entry.id,
      playerName: `${entry.player_first_name} ${entry.player_last_name}`,
      teamName: entry.entry_name,
      stdDev,
      label,
      allPoints: points,
    });
  }

  return results.sort((a, b) => a.stdDev - b.stdDev); // most consistent first
}

function buildFormRatings(
  entries: LeagueResponse['league_entries'],
  entryMap: Map<number, LeagueResponse['league_entries'][0]>,
  gwScores: Record<number, Record<number, number>>,
  completedGws: number[],
): FormRating[] {
  const results: FormRating[] = [];

  for (const entry of entries) {
    const allPoints = completedGws
      .map(gw => gwScores[entry.id]?.[gw])
      .filter((p): p is number => p !== undefined);

    if (allPoints.length === 0) continue;

    const last5 = allPoints.slice(-5);
    const seasonAvg = allPoints.reduce((a, b) => a + b, 0) / allPoints.length;
    const formAvg = last5.reduce((a, b) => a + b, 0) / last5.length;

    let trend: 'up' | 'down' | 'stable';
    if (formAvg > seasonAvg * 1.05) trend = 'up';
    else if (formAvg < seasonAvg * 0.95) trend = 'down';
    else trend = 'stable';

    results.push({
      leagueEntryId: entry.id,
      playerName: `${entry.player_first_name} ${entry.player_last_name}`,
      teamName: entry.entry_name,
      last5Points: last5,
      formAvg: Math.round(formAvg * 10) / 10,
      seasonAvg: Math.round(seasonAvg * 10) / 10,
      trend,
    });
  }

  return results.sort((a, b) => b.formAvg - a.formAvg);
}

function buildClutchScores(
  league: LeagueResponse,
  entries: LeagueResponse['league_entries'],
  entryMap: Map<number, LeagueResponse['league_entries'][0]>,
): ClutchScore[] {
  const CLOSE_MARGIN = 5;
  const results: ClutchScore[] = [];

  for (const entry of entries) {
    let closeGames = 0;
    let closeWins = 0;
    let closeLosses = 0;

    for (const match of league.matches) {
      if (!match.finished) continue;

      let myPoints: number | null = null;
      let oppPoints: number | null = null;

      if (match.league_entry_1 === entry.id) {
        myPoints = match.league_entry_1_points;
        oppPoints = match.league_entry_2_points;
      } else if (match.league_entry_2 === entry.id) {
        myPoints = match.league_entry_2_points;
        oppPoints = match.league_entry_1_points;
      }

      if (myPoints === null || oppPoints === null) continue;
      const margin = Math.abs(myPoints - oppPoints);
      if (margin <= CLOSE_MARGIN) {
        closeGames++;
        if (myPoints > oppPoints) closeWins++;
        else if (myPoints < oppPoints) closeLosses++;
      }
    }

    const closeWinPct = closeGames > 0 ? (closeWins / closeGames) * 100 : 50;

    let label: string;
    if (closeWinPct >= 70) label = 'Clutch King';
    else if (closeWinPct >= 50) label = 'Ice Cold';
    else if (closeWinPct >= 30) label = 'Nervy';
    else label = 'Choke Artist';

    results.push({
      leagueEntryId: entry.id,
      playerName: `${entry.player_first_name} ${entry.player_last_name}`,
      teamName: entry.entry_name,
      closeGames,
      closeWins,
      closeLosses,
      closeWinPct: Math.round(closeWinPct * 10) / 10,
      label,
    });
  }

  return results.sort((a, b) => b.closeWinPct - a.closeWinPct);
}

function buildRivalryMatrix(
  h2hMatrix: H2HRecord[],
  entryMap: Map<number, LeagueResponse['league_entries'][0]>,
): RivalryDetail[] {
  const results: RivalryDetail[] = [];

  for (const rec of h2hMatrix) {
    const entryA = entryMap.get(rec.managerA);
    const entryB = entryMap.get(rec.managerB);
    if (!entryA || !entryB) continue;

    // Biggest win (from A's perspective)
    let biggestWin: string | null = null;
    let biggestWinMargin = 0;
    let closestMatch: string | null = null;
    let closestMargin = Infinity;

    for (const m of rec.matches) {
      const margin = Math.abs(m.pointsA - m.pointsB);
      if (m.pointsA > m.pointsB && margin > biggestWinMargin) {
        biggestWinMargin = margin;
        biggestWin = `${m.pointsA}-${m.pointsB} (GW${m.gw})`;
      }
      if (margin > 0 && margin < closestMargin) {
        closestMargin = margin;
        closestMatch = `${m.pointsA}-${m.pointsB} (GW${m.gw})`;
      }
    }

    results.push({
      managerA: rec.managerA,
      managerAName: `${entryA.player_first_name} ${entryA.player_last_name}`,
      managerB: rec.managerB,
      managerBName: `${entryB.player_first_name} ${entryB.player_last_name}`,
      record: `${rec.wins}-${rec.draws}-${rec.losses}`,
      biggestWin,
      closestMatch,
      pointsDiff: rec.pointsFor - rec.pointsAgainst,
    });
  }

  // Sort by total matches played (most active rivalries first)
  return results.sort((a, b) => {
    const aTotal = parseInt(a.record.split('-').reduce((sum, n) => String(parseInt(sum) + parseInt(n))));
    const bTotal = parseInt(b.record.split('-').reduce((sum, n) => String(parseInt(sum) + parseInt(n))));
    return bTotal - aTotal;
  });
}

function buildWeeklyAwards(
  entries: LeagueResponse['league_entries'],
  entryMap: Map<number, LeagueResponse['league_entries'][0]>,
  gwScores: Record<number, Record<number, number>>,
  completedGws: number[],
): WeeklyAwards {
  const motwCount: Record<number, number> = {};
  const woodenSpoonCount: Record<number, number> = {};
  const perGameweek: WeeklyAwards['perGameweek'] = [];

  for (const gw of completedGws) {
    let highest = { id: 0, points: -Infinity, name: '' };
    let lowest = { id: 0, points: Infinity, name: '' };

    for (const entry of entries) {
      const pts = gwScores[entry.id]?.[gw];
      if (pts === undefined) continue;
      const name = `${entry.player_first_name} ${entry.player_last_name}`;

      if (pts > highest.points) highest = { id: entry.id, points: pts, name };
      if (pts < lowest.points) lowest = { id: entry.id, points: pts, name };
    }

    if (highest.id > 0) {
      motwCount[highest.id] = (motwCount[highest.id] ?? 0) + 1;
      woodenSpoonCount[lowest.id] = (woodenSpoonCount[lowest.id] ?? 0) + 1;

      perGameweek.push({
        gw,
        motw: { name: highest.name, leagueEntryId: highest.id, points: highest.points },
        woodenSpoon: { name: lowest.name, leagueEntryId: lowest.id, points: lowest.points },
      });
    }
  }

  // Find the manager with most MotW and most wooden spoons
  let mostMotW: WeeklyAwards['mostMotW'] = null;
  let maxMotW = 0;
  for (const [idStr, count] of Object.entries(motwCount)) {
    if (count > maxMotW) {
      maxMotW = count;
      const id = parseInt(idStr);
      const entry = entryMap.get(id);
      mostMotW = {
        name: entry ? `${entry.player_first_name} ${entry.player_last_name}` : 'Unknown',
        leagueEntryId: id,
        count,
      };
    }
  }

  let mostWoodenSpoons: WeeklyAwards['mostWoodenSpoons'] = null;
  let maxWS = 0;
  for (const [idStr, count] of Object.entries(woodenSpoonCount)) {
    if (count > maxWS) {
      maxWS = count;
      const id = parseInt(idStr);
      const entry = entryMap.get(id);
      mostWoodenSpoons = {
        name: entry ? `${entry.player_first_name} ${entry.player_last_name}` : 'Unknown',
        leagueEntryId: id,
        count,
      };
    }
  }

  return { mostMotW, mostWoodenSpoons, perGameweek };
}

function buildPositionalBreakdown(
  entries: LeagueResponse['league_entries'],
  entryMap: Map<number, LeagueResponse['league_entries'][0]>,
  ownedPlayers: PlayerStat[],
  completedGws: number[],
): PositionalBreakdown[] {
  const gwCount = completedGws.length || 1;
  const results: PositionalBreakdown[] = [];

  for (const entry of entries) {
    const myPlayers = ownedPlayers.filter(p => p.ownerLeagueEntryId === entry.id);
    const positions: Record<string, { totalPoints: number; avgPoints: number; playerCount: number }> = {};

    for (const pos of ['GK', 'DEF', 'MID', 'FWD']) {
      const posPlayers = myPlayers.filter(p => p.position === pos);
      const totalPoints = posPlayers.reduce((sum, p) => sum + p.totalPoints, 0);
      positions[pos] = {
        totalPoints,
        avgPoints: Math.round((totalPoints / gwCount) * 10) / 10,
        playerCount: posPlayers.length,
      };
    }

    results.push({
      leagueEntryId: entry.id,
      playerName: `${entry.player_first_name} ${entry.player_last_name}`,
      teamName: entry.entry_name,
      positions,
    });
  }

  return results;
}

function buildStreaks(
  league: LeagueResponse,
  entries: LeagueResponse['league_entries'],
  entryMap: Map<number, LeagueResponse['league_entries'][0]>,
): StreakData[] {
  const results: StreakData[] = [];

  for (const entry of entries) {
    const matchResults: ('W' | 'D' | 'L')[] = [];

    // Get all finished matches for this entry, sorted by event
    const myMatches = league.matches
      .filter(m => m.finished && (m.league_entry_1 === entry.id || m.league_entry_2 === entry.id))
      .sort((a, b) => a.event - b.event);

    for (const match of myMatches) {
      // Infer winner from points (winning_league_entry is often null in Draft API)
      let myPts: number;
      let oppPts: number;
      if (match.league_entry_1 === entry.id) {
        myPts = match.league_entry_1_points;
        oppPts = match.league_entry_2_points;
      } else {
        myPts = match.league_entry_2_points;
        oppPts = match.league_entry_1_points;
      }

      if (myPts > oppPts) matchResults.push('W');
      else if (myPts === oppPts) matchResults.push('D');
      else matchResults.push('L');
    }

    // Current streak
    let currentStreak = 0;
    if (matchResults.length > 0) {
      const lastResult = matchResults[matchResults.length - 1];
      for (let i = matchResults.length - 1; i >= 0; i--) {
        if (matchResults[i] === lastResult) {
          currentStreak++;
        } else {
          break;
        }
      }
      if (lastResult === 'L') currentStreak = -currentStreak;
      if (lastResult === 'D') currentStreak = 0;
    }

    // Longest win streak
    let longestWinStreak = 0;
    let currentWin = 0;
    for (const r of matchResults) {
      if (r === 'W') {
        currentWin++;
        longestWinStreak = Math.max(longestWinStreak, currentWin);
      } else {
        currentWin = 0;
      }
    }

    // Longest loss streak
    let longestLossStreak = 0;
    let currentLoss = 0;
    for (const r of matchResults) {
      if (r === 'L') {
        currentLoss++;
        longestLossStreak = Math.max(longestLossStreak, currentLoss);
      } else {
        currentLoss = 0;
      }
    }

    results.push({
      leagueEntryId: entry.id,
      playerName: `${entry.player_first_name} ${entry.player_last_name}`,
      teamName: entry.entry_name,
      currentStreak,
      longestWinStreak,
      longestLossStreak,
    });
  }

  return results.sort((a, b) => b.currentStreak - a.currentStreak);
}

function buildDraftValue(
  draftPicks: DraftPickDisplay[],
  resolver: PlayerResolver,
  ownedPlayers: PlayerStat[],
): DraftValueEntry[] {
  if (draftPicks.length === 0) return [];

  // Create a lookup of player ID -> total points
  const playerPointsMap = new Map<number, number>();
  for (const p of ownedPlayers) {
    playerPointsMap.set(p.id, p.totalPoints);
  }

  // Also check all players from resolver for those no longer owned
  const allPlayerPoints = new Map<number, number>();
  // Merge owned player points
  for (const p of ownedPlayers) {
    allPlayerPoints.set(p.id, p.totalPoints);
  }

  const results: DraftValueEntry[] = [];

  for (const pick of draftPicks) {
    const totalPoints = allPlayerPoints.get(pick.playerId) ?? 0;

    // Value rating based on pick position vs points generated
    // Earlier picks should produce more points
    const expectedRank = pick.pick; // pick 1 should be best, etc.
    // Rank all drafted players by points to see where this pick actually ranks
    const allPickPoints = draftPicks.map(p => ({
      pick: p.pick,
      round: p.round,
      points: allPlayerPoints.get(p.playerId) ?? 0,
    }));

    // Only evaluate round 1-3 picks meaningfully
    const sameRoundPicks = allPickPoints
      .filter(p => p.round === pick.round)
      .sort((a, b) => b.points - a.points);

    const actualRankInRound = sameRoundPicks.findIndex(p => p.pick === pick.pick) + 1;
    const totalInRound = sameRoundPicks.length;
    const percentile = totalInRound > 0 ? actualRankInRound / totalInRound : 0.5;

    let valueRating: string;
    if (percentile <= 0.15) valueRating = 'Steal';
    else if (percentile <= 0.35) valueRating = 'Good Value';
    else if (percentile <= 0.65) valueRating = 'Fair';
    else if (percentile <= 0.85) valueRating = 'Overpaid';
    else valueRating = 'Bust';

    results.push({
      pick: pick.pick,
      round: pick.round,
      playerName: pick.playerName,
      playerId: pick.playerId,
      managerName: pick.managerName,
      leagueEntryId: pick.leagueEntryId,
      totalPoints,
      valueRating,
    });
  }

  return results;
}

// ---- Mascotte: rank each manager's 15th (last) draft pick ----

function buildMascotte(
  draftPicks: DraftPickDisplay[],
  draftValue: DraftValueEntry[],
  resolver: PlayerResolver,
  ownedPlayers: PlayerStat[],
  freeAgentStats: PlayerStat[],
  entryMap: Map<number, LeagueResponse['league_entries'][0]>,
  entryIdToLeagueId: Map<number, number>,
): MascotteEntry[] {
  // Filter for round 15 picks only
  const round15 = draftPicks.filter(p => p.round === 15);
  if (round15.length === 0) return [];

  // Build player points lookup from both owned and free agents
  const allPlayers = new Map<number, PlayerStat>();
  for (const p of ownedPlayers) allPlayers.set(p.id, p);
  for (const p of freeAgentStats) allPlayers.set(p.id, p);

  // Build draft value lookup by playerId
  const draftValueMap = new Map<number, string>();
  for (const dv of draftValue) {
    draftValueMap.set(dv.playerId, dv.valueRating);
  }

  const results: MascotteEntry[] = round15.map(pick => {
    // pick.leagueEntryId is actually entry_id in draft picks; resolve to league_entry id
    const leagueId = entryIdToLeagueId.get(pick.leagueEntryId) ?? pick.leagueEntryId;
    const entry = entryMap.get(leagueId) ?? entryMap.get(pick.leagueEntryId);
    const playerStat = allPlayers.get(pick.playerId);
    const bootstrapPlayer = resolver.getPlayer(pick.playerId);

    const position = playerStat?.position
      ?? (bootstrapPlayer ? resolver.getPosition(bootstrapPlayer.element_type) : 'N/A');
    const team = playerStat?.team
      ?? (bootstrapPlayer ? resolver.getTeamName(bootstrapPlayer.team) : 'Unknown');

    return {
      leagueEntryId: leagueId,
      entryId: entry?.entry_id ?? pick.leagueEntryId,
      teamName: entry?.entry_name ?? pick.managerName,
      playerName: entry?.player_first_name && entry?.player_last_name
        ? `${entry.player_first_name} ${entry.player_last_name}`
        : pick.managerName,
      mascottePlayer: resolver.getName(pick.playerId),
      mascottePlayerId: pick.playerId,
      totalPoints: playerStat?.totalPoints ?? 0,
      position,
      team,
      minutesPlayed: playerStat?.minutes ?? 0,
      valueRating: draftValueMap.get(pick.playerId) ?? 'Fair',
    };
  });

  // Sort by totalPoints descending (best mascot first)
  results.sort((a, b) => b.totalPoints - a.totalPoints);

  return results;
}

// ---- Requested Stats: Recommended XI + Opponent Avg Against ----

const VALID_FORMATIONS: [number, number, number][] = [
  [3, 4, 3], [3, 5, 2], [4, 3, 3], [4, 4, 2], [4, 5, 1], [5, 3, 2], [5, 4, 1],
];

function buildRequestedStats(
  league: LeagueResponse,
  entryMap: Map<number, LeagueResponse['league_entries'][0]>,
  entryIdToLeagueId: Map<number, number>,
  ownership: ElementStatusResponse | null,
  resolver: PlayerResolver,
  bootstrap: BootstrapResponse,
  fixtures: Fixture[] | null,
  liveMap: Map<number, LiveEventResponse>,
  picksMap: Map<number, Record<string, EntryEventResponse>>,
  h2hMatrix: H2HRecord[],
  completedGws: number[],
  currentGw: number,
  freeAgentStats: PlayerStat[],
  draftPicks: DraftPickDisplay[],
  draftValue: DraftValueEntry[],
  ownedPlayers: PlayerStat[],
): RequestedStats | null {
  if (!ownership || !fixtures || completedGws.length === 0) return null;

  // ========== Shared: compute team-level stats from live data ==========

  // Player -> team mapping
  const playerTeamMap = new Map<number, number>();
  for (const p of bootstrap.elements) {
    playerTeamMap.set(p.id, p.team);
  }

  // Team name/short lookups
  const teamNameMap = new Map<number, string>();
  const teamShortMap = new Map<number, string>();
  for (const t of bootstrap.teams) {
    teamNameMap.set(t.id, t.name);
    teamShortMap.set(t.id, t.short_name);
  }

  // Compute team goals conceded and goals scored over last 5 GWs
  const last5Gws = completedGws.slice(-5);
  const teamGoalsConceded: Record<number, number[]> = {};
  const teamGoalsScored: Record<number, number[]> = {};
  const teamCleanSheets: Record<number, number> = {};

  for (const gw of last5Gws) {
    const gwLive = liveMap.get(gw);
    if (!gwLive) continue;

    // Track per-team stats for this GW
    const gwTeamGC: Record<number, number> = {};
    const gwTeamGoals: Record<number, number> = {};
    const gwTeamCS: Record<number, boolean> = {};

    for (const [idStr, el] of Object.entries(gwLive.elements)) {
      const teamId = playerTeamMap.get(parseInt(idStr));
      if (!teamId || el.stats.minutes === 0) continue;

      // Goals conceded: take max per team (all players on same team concede same)
      gwTeamGC[teamId] = Math.max(gwTeamGC[teamId] ?? 0, el.stats.goals_conceded);
      gwTeamGoals[teamId] = (gwTeamGoals[teamId] ?? 0) + el.stats.goals_scored;
      if (el.stats.clean_sheets > 0) gwTeamCS[teamId] = true;
    }

    // Deduplicate goals scored (sum across players is correct since only scorers get credit)
    for (const [teamStr, gc] of Object.entries(gwTeamGC)) {
      const teamId = parseInt(teamStr);
      if (!teamGoalsConceded[teamId]) teamGoalsConceded[teamId] = [];
      teamGoalsConceded[teamId].push(gc);
    }
    for (const [teamStr, goals] of Object.entries(gwTeamGoals)) {
      const teamId = parseInt(teamStr);
      if (!teamGoalsScored[teamId]) teamGoalsScored[teamId] = [];
      teamGoalsScored[teamId].push(goals);
    }
    for (const teamStr of Object.keys(gwTeamCS)) {
      const teamId = parseInt(teamStr);
      teamCleanSheets[teamId] = (teamCleanSheets[teamId] ?? 0) + 1;
    }
  }

  // Average xGC per team (goals conceded per GW over last 5)
  const teamAvgGC: Record<number, number> = {};
  for (const [teamStr, gcs] of Object.entries(teamGoalsConceded)) {
    const teamId = parseInt(teamStr);
    teamAvgGC[teamId] = gcs.reduce((a, b) => a + b, 0) / gcs.length;
  }

  // Average goals scored per team over last 5
  const teamAvgGoals: Record<number, number> = {};
  for (const [teamStr, goals] of Object.entries(teamGoalsScored)) {
    const teamId = parseInt(teamStr);
    teamAvgGoals[teamId] = goals.reduce((a, b) => a + b, 0) / goals.length;
  }

  // Compute player last-5-GW points
  const playerLast5Points = new Map<number, number>();
  for (const gw of last5Gws) {
    const gwLive = liveMap.get(gw);
    if (!gwLive) continue;
    for (const [idStr, el] of Object.entries(gwLive.elements)) {
      const pid = parseInt(idStr);
      playerLast5Points.set(pid, (playerLast5Points.get(pid) ?? 0) + el.stats.total_points);
    }
  }

  // Next GW fixtures: team -> { opponentTeamId, isHome, difficulty }
  const nextGwNum = currentGw + 1;
  const nextFixtures = fixtures.filter(f => f.event === nextGwNum);
  const teamNextFixture = new Map<number, { opponent: number; isHome: boolean; difficulty: number }>();
  for (const fix of nextFixtures) {
    teamNextFixture.set(fix.team_h, {
      opponent: fix.team_a,
      isHome: true,
      difficulty: fix.team_h_difficulty,
    });
    teamNextFixture.set(fix.team_a, {
      opponent: fix.team_h,
      isHome: false,
      difficulty: fix.team_a_difficulty,
    });
  }

  // ========== T-031: Recommended XI ==========

  // Build player-to-owner mapping
  const playerOwner = new Map<number, number>();
  if (ownership) {
    for (const es of ownership.element_status) {
      if (es.owner !== null) {
        const leagueId = entryIdToLeagueId.get(es.owner) ?? es.owner;
        playerOwner.set(es.element, leagueId);
      }
    }
  }

  // Group players by owner
  const ownerPlayers = new Map<number, typeof bootstrap.elements>();
  for (const p of bootstrap.elements) {
    const owner = playerOwner.get(p.id);
    if (owner !== undefined) {
      const existing = ownerPlayers.get(owner) ?? [];
      existing.push(p);
      ownerPlayers.set(owner, existing);
    }
  }

  // Score a single player for starting XI recommendation
  function scorePlayer(p: typeof bootstrap.elements[0]): RecommendedPlayer {
    const teamId = p.team;
    const fix = teamNextFixture.get(teamId);
    const positionId = p.element_type;
    const position = resolver.getPosition(positionId);

    // 1. Fixture score (35%): lower opponent strength + lower team xGC = better
    let fixtureScore = 5; // default middle
    if (fix) {
      // Difficulty is 1-5 where 5 is hardest. Invert for score.
      const diffScore = (6 - fix.difficulty) * 2; // 2-10 range
      // Team xGC factor: lower opponent goals scored = easier
      const oppGoals = teamAvgGoals[fix.opponent] ?? 1.5;
      const xGCFactor = Math.max(0, 10 - oppGoals * 4); // 0-10 range
      fixtureScore = (diffScore + xGCFactor) / 2; // 0-10
    }

    // 2. Form score (35%): last 5 GW points
    const last5Pts = playerLast5Points.get(p.id) ?? 0;
    const formScore = Math.min(last5Pts / 5, 10); // avg pts per GW, capped at 10

    // 3. Special score (20%): CS history for GK/DEF, xGI for MID/FWD
    let specialScore = 0;
    if (positionId <= 2) {
      // GK or DEF: clean sheet probability based on team's last 5 GWs
      const csCount = teamCleanSheets[teamId] ?? 0;
      const csRate = csCount / Math.max(last5Gws.length, 1);
      // Also factor in opponent's goalscoring
      const oppGoals = fix ? (teamAvgGoals[fix.opponent] ?? 1.5) : 1.5;
      specialScore = csRate * 6 + Math.max(0, (2 - oppGoals)) * 2; // 0-10
    } else {
      // MID or FWD: xGI form
      const xGI = parseFloat(p.expected_goal_involvements) || 0;
      specialScore = Math.min(xGI * 1.5, 10); // roughly 0-10
    }

    // 4. Season score (10%): total points normalized
    const seasonScore = Math.min(p.total_points / 20, 10); // 200pts = 10

    // Weighted total
    const startScore = Math.round(
      (fixtureScore * 0.35 + formScore * 0.35 + specialScore * 0.20 + seasonScore * 0.10) * 100
    ) / 100;

    return {
      playerId: p.id,
      webName: p.web_name,
      position,
      positionId,
      team: teamNameMap.get(teamId) ?? 'Unknown',
      teamShort: teamShortMap.get(teamId) ?? '???',
      opponent: fix ? (teamNameMap.get(fix.opponent) ?? 'Unknown') : 'TBD',
      opponentShort: fix ? (teamShortMap.get(fix.opponent) ?? '???') : 'TBD',
      isHome: fix?.isHome ?? false,
      startScore,
      breakdown: {
        fixtureScore: Math.round(fixtureScore * 100) / 100,
        formScore: Math.round(formScore * 100) / 100,
        specialScore: Math.round(specialScore * 100) / 100,
        seasonScore: Math.round(seasonScore * 100) / 100,
      },
      isStarter: false, // will be set during formation optimization
      status: p.status,
    };
  }

  // Find optimal formation for a squad
  function findBestFormation(squad: RecommendedPlayer[]): { formation: string; starters: RecommendedPlayer[]; bench: RecommendedPlayer[] } {
    const gks = squad.filter(p => p.positionId === 1).sort((a, b) => b.startScore - a.startScore);
    const defs = squad.filter(p => p.positionId === 2).sort((a, b) => b.startScore - a.startScore);
    const mids = squad.filter(p => p.positionId === 3).sort((a, b) => b.startScore - a.startScore);
    const fwds = squad.filter(p => p.positionId === 4).sort((a, b) => b.startScore - a.startScore);

    let bestScore = -1;
    let bestFormation = '4-4-2';
    let bestStarters: RecommendedPlayer[] = [];

    for (const [numDef, numMid, numFwd] of VALID_FORMATIONS) {
      if (defs.length < numDef || mids.length < numMid || fwds.length < numFwd || gks.length < 1) continue;

      const starters = [
        gks[0],
        ...defs.slice(0, numDef),
        ...mids.slice(0, numMid),
        ...fwds.slice(0, numFwd),
      ];

      const totalScore = starters.reduce((sum, p) => sum + p.startScore, 0);

      if (totalScore > bestScore) {
        bestScore = totalScore;
        bestFormation = `${numDef}-${numMid}-${numFwd}`;
        bestStarters = starters;
      }
    }

    const starterIds = new Set(bestStarters.map(p => p.playerId));
    const bench = squad.filter(p => !starterIds.has(p.playerId))
      .sort((a, b) => b.startScore - a.startScore);

    // Mark starters
    for (const p of bestStarters) {
      p.isStarter = true;
    }

    return { formation: bestFormation, starters: bestStarters, bench };
  }

  const recommendedXIs: RecommendedXI[] = [];

  for (const entry of league.league_entries) {
    const players = ownerPlayers.get(entry.id) ?? [];
    if (players.length === 0) continue;

    // Score all players
    const scored = players.map(p => scorePlayer(p));

    // Find best formation
    const { formation, starters, bench } = findBestFormation(scored);
    const totalStartScore = Math.round(starters.reduce((sum, p) => sum + p.startScore, 0) * 100) / 100;

    // Transfer suggestion: find free agent who outscores weakest starter
    let transferSuggestion: RecommendedXI['transferSuggestion'] = null;
    if (freeAgentStats.length > 0 && starters.length > 0) {
      const weakestStarter = starters.reduce((min, p) => p.startScore < min.startScore ? p : min, starters[0]);

      // Find best free agent of same position
      const samePosFAs = freeAgentStats
        .filter(fa => fa.positionId === weakestStarter.positionId && fa.minutes > 0);

      if (samePosFAs.length > 0) {
        // Score the top free agents
        const topFA = samePosFAs.slice(0, 10)
          .map(fa => {
            const bp = bootstrap.elements.find(e => e.id === fa.id);
            return bp ? scorePlayer(bp) : null;
          })
          .filter((p): p is RecommendedPlayer => p !== null)
          .sort((a, b) => b.startScore - a.startScore)[0];

        if (topFA && topFA.startScore > weakestStarter.startScore) {
          transferSuggestion = {
            playerOut: weakestStarter.webName,
            playerOutScore: weakestStarter.startScore,
            playerIn: topFA.webName,
            playerInScore: topFA.startScore,
            improvement: Math.round((topFA.startScore - weakestStarter.startScore) * 100) / 100,
          };
        }
      }
    }

    recommendedXIs.push({
      leagueEntryId: entry.id,
      entryId: entry.entry_id,
      teamName: entry.entry_name,
      playerName: `${entry.player_first_name} ${entry.player_last_name}`,
      formation,
      totalStartScore,
      players: [...starters, ...bench],
      transferSuggestion,
    });
  }

  // Sort by total start score (highest first)
  recommendedXIs.sort((a, b) => b.totalStartScore - a.totalStartScore);

  // ========== T-032: Opponent Average Score Against ==========

  const opponentAvgAgainst: OpponentAvgAgainst[] = [];

  for (const entry of league.league_entries) {
    const mId = entry.id;
    const perOpponent: OpponentAvgAgainst['perOpponent'] = [];

    // Collect all opponent scores when facing this manager
    const allOpponentScores: number[] = [];

    for (const match of league.matches) {
      if (!match.finished) continue;

      let oppScore: number | undefined;
      let oppId: number | undefined;

      if (match.league_entry_1 === mId) {
        oppScore = match.league_entry_2_points;
        oppId = match.league_entry_2;
      } else if (match.league_entry_2 === mId) {
        oppScore = match.league_entry_1_points;
        oppId = match.league_entry_1;
      }

      if (oppScore !== undefined && oppId !== undefined) {
        allOpponentScores.push(oppScore);

        // Track per-opponent
        let oppRecord = perOpponent.find(r => r.opponentLeagueEntryId === oppId);
        if (!oppRecord) {
          const oppEntry = entryMap.get(oppId);
          oppRecord = {
            opponentLeagueEntryId: oppId,
            opponentName: oppEntry ? `${oppEntry.player_first_name} ${oppEntry.player_last_name}` : 'Unknown',
            avgScore: 0,
            matches: 0,
          };
          perOpponent.push(oppRecord);
        }
        oppRecord.avgScore += oppScore;
        oppRecord.matches++;
      }
    }

    // Finalize per-opponent averages
    for (const rec of perOpponent) {
      rec.avgScore = Math.round((rec.avgScore / rec.matches) * 10) / 10;
    }
    perOpponent.sort((a, b) => b.avgScore - a.avgScore);

    const avgOpponentScore = allOpponentScores.length > 0
      ? Math.round((allOpponentScores.reduce((a, b) => a + b, 0) / allOpponentScores.length) * 10) / 10
      : 0;

    opponentAvgAgainst.push({
      leagueEntryId: mId,
      entryId: entry.entry_id,
      teamName: entry.entry_name,
      playerName: `${entry.player_first_name} ${entry.player_last_name}`,
      avgOpponentScore,
      totalMatches: allOpponentScores.length,
      perOpponent,
    });
  }

  // Sort by highest opponent avg (unluckiest first)
  opponentAvgAgainst.sort((a, b) => b.avgOpponentScore - a.avgOpponentScore);

  // League average
  const leagueAvgOpponentScore = opponentAvgAgainst.length > 0
    ? Math.round(
        (opponentAvgAgainst.reduce((sum, r) => sum + r.avgOpponentScore, 0) / opponentAvgAgainst.length) * 10
      ) / 10
    : 0;

  // ========== Mascotte ==========
  const mascotte = buildMascotte(draftPicks, draftValue, resolver, ownedPlayers, freeAgentStats, entryMap, entryIdToLeagueId);

  return {
    recommendedXIs,
    opponentAvgAgainst,
    leagueAvgOpponentScore,
    mascotte,
  };
}

// Run
main();
