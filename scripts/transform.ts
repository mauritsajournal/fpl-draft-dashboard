import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJson } from './lib/fetch-utils.js';
import { PlayerResolver } from './lib/player-resolver.js';
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
  const playerStats = buildPlayerStats(bootstrap, ownership, resolver, entryMap);
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
  const predictions = buildPredictions(league, entryMap, ownership, resolver, bootstrap, fixtures, currentGw);
  console.log(`  Predictions: ${predictions.length} entries`);

  // ---- Bench Analysis ----
  const benchAnalysis = buildBenchAnalysis(league, entryMap, picksMap, liveMap, completedGws);
  console.log(`  Bench Analysis: ${benchAnalysis.length} entries`);

  // ---- What-If Analysis ----
  const whatIf = buildWhatIf(league, entryMap, standings, completedGws);
  console.log(`  What-If Analysis: ${whatIf.length} entries`);

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
        played: s.matches_played,
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

      // League points
      if (match.winning_league_entry === match.league_entry_1) {
        leaguePoints[match.league_entry_1] = (leaguePoints[match.league_entry_1] ?? 0) + 3;
      } else if (match.winning_league_entry === match.league_entry_2) {
        leaguePoints[match.league_entry_2] = (leaguePoints[match.league_entry_2] ?? 0) + 3;
      } else if (match.winning_league_entry === null && match.finished) {
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
  entryMap: Map<number, LeagueResponse['league_entries'][0]>
): PlayerStat[] {
  const ownerMap = new Map<number, number | null>();
  if (ownership) {
    for (const es of ownership.element_status) {
      ownerMap.set(es.element, es.owner);
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

  // Build player-to-owner mapping
  const playerOwner = new Map<number, number>();
  if (ownership) {
    for (const es of ownership.element_status) {
      if (es.owner !== null) {
        playerOwner.set(es.element, es.owner);
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

// Run
main();
