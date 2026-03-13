/**
 * Fetch ESPN Premier League data for the "Draft x PL" page.
 * Fetches team stats, rosters, and standings from ESPN's public API.
 * Data is cached in data/espn/ to avoid hammering the API.
 */
import { fetchWithRetry, writeJson, delay } from './lib/fetch-utils.js';

const ESPN_SITE = 'https://site.api.espn.com/apis/site/v2/sports/soccer/eng.1';
const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/soccer/leagues/eng.1';
const SEASON = '2025';

// FPL team ID -> ESPN team ID mapping
const FPL_TO_ESPN: Record<number, number> = {
  1: 359,   // Arsenal
  2: 362,   // Aston Villa
  3: 379,   // Burnley
  4: 349,   // Bournemouth
  5: 337,   // Brentford
  6: 331,   // Brighton
  7: 363,   // Chelsea
  8: 384,   // Crystal Palace
  9: 368,   // Everton
  10: 370,  // Fulham
  11: 357,  // Leeds
  12: 364,  // Liverpool
  13: 382,  // Man City
  14: 360,  // Man Utd
  15: 361,  // Newcastle
  16: 393,  // Nott'm Forest
  17: 366,  // Sunderland
  18: 367,  // Spurs
  19: 371,  // West Ham
  20: 380,  // Wolves
};

interface ESPNTeamStats {
  espnTeamId: number;
  fplTeamId: number;
  teamName: string;
  stats: {
    // Offensive
    goals: number;
    assists: number;
    shotsOnTarget: number;
    totalShots: number;
    shotAccuracy: number;
    penaltyGoals: number;
    headedGoals: number;
    accuratePasses: number;
    totalPasses: number;
    passAccuracy: number;
    totalCrosses: number;
    accurateCrosses: number;
    longBalls: number;
    accurateLongBalls: number;
    // Defensive
    tackles: number;
    tacklesWon: number;
    tackleSuccess: number;
    interceptions: number;
    clearances: number;
    shotsBlocked: number;
    // General
    appearances: number;
    wins: number;
    draws: number;
    losses: number;
    winPercentage: number;
    yellowCards: number;
    redCards: number;
    foulsCommitted: number;
    foulsSuffered: number;
    // Goalkeeping
    cleanSheets: number;
    goalsConceded: number;
    saves: number;
  };
}

interface ESPNPlayerInfo {
  espnId: string;
  displayName: string;
  shortName: string;
  position: string;
  jersey: string;
  nationality: string;
  espnTeamId: number;
  fplTeamId: number;
}

interface ESPNPlayerStats {
  espnId: string;
  displayName: string;
  espnTeamId: number;
  fplTeamId: number;
  stats: {
    appearances: number;
    minutes: number;
    starts: number;
    goals: number;
    headedGoals: number;
    assists: number;
    shotAssists: number;
    totalShots: number;
    shotsOnTarget: number;
    totalPasses: number;
    accuratePasses: number;
    passPercentage: number;
    accurateLongBalls: number;
    foulsCommitted: number;
    foulsSuffered: number;
    yellowCards: number;
    redCards: number;
    tacklesWon: number;
    tacklesLost: number;
    tacklePercentage: number;
    interceptions: number;
    clearances: number;
    shotsBlocked: number;
    // Goalkeeping
    cleanSheets: number;
    goalsConceded: number;
    saves: number;
  };
}

interface ESPNStandingsEntry {
  espnTeamId: number;
  fplTeamId: number;
  teamName: string;
  rank: number;
  points: number;
  wins: number;
  draws: number;
  losses: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  gamesPlayed: number;
}

function findStat(splits: any, category: string, statName: string): number {
  if (!splits?.categories) return 0;
  const cat = splits.categories.find((c: any) => c.name === category);
  if (!cat?.stats) return 0;
  // Prefer matching by name first, then abbreviation
  const stat = cat.stats.find((s: any) => s.name === statName)
    ?? cat.stats.find((s: any) => s.abbreviation === statName);
  return stat?.value ?? 0;
}

async function fetchTeamStats(fplTeamId: number, espnTeamId: number): Promise<ESPNTeamStats | null> {
  try {
    const url = `${ESPN_CORE}/seasons/${SEASON}/types/1/teams/${espnTeamId}/statistics`;
    const data = await fetchWithRetry(url, `espn-team-stats-${espnTeamId}`) as any;

    const splits = data.splits;
    if (!splits?.categories) {
      console.warn(`No stats for ESPN team ${espnTeamId}`);
      return null;
    }

    return {
      espnTeamId,
      fplTeamId,
      teamName: data.team?.displayName ?? `Team ${espnTeamId}`,
      stats: {
        goals: findStat(splits, 'offensive', 'totalGoals'),
        assists: findStat(splits, 'offensive', 'goalAssists'),
        shotsOnTarget: findStat(splits, 'offensive', 'shotsOnTarget'),
        totalShots: findStat(splits, 'offensive', 'totalShots'),
        shotAccuracy: findStat(splits, 'offensive', 'shotPct'),
        penaltyGoals: findStat(splits, 'offensive', 'penaltyKickGoals'),
        headedGoals: findStat(splits, 'offensive', 'headedGoals'),
        accuratePasses: findStat(splits, 'offensive', 'accuratePasses'),
        totalPasses: findStat(splits, 'offensive', 'totalPasses'),
        passAccuracy: findStat(splits, 'general', 'passPct'),
        totalCrosses: findStat(splits, 'offensive', 'totalCrosses'),
        accurateCrosses: findStat(splits, 'offensive', 'accurateCrosses'),
        longBalls: findStat(splits, 'offensive', 'totalLongBalls'),
        accurateLongBalls: findStat(splits, 'offensive', 'accurateLongBalls'),
        tackles: findStat(splits, 'defensive', 'totalTackles'),
        tacklesWon: findStat(splits, 'defensive', 'effectiveTackles'),
        tackleSuccess: findStat(splits, 'defensive', 'tacklePct'),
        interceptions: findStat(splits, 'defensive', 'interceptions'),
        clearances: findStat(splits, 'defensive', 'totalClearance'),
        shotsBlocked: findStat(splits, 'defensive', 'blockedShots'),
        appearances: findStat(splits, 'general', 'appearances'),
        wins: findStat(splits, 'general', 'wins'),
        draws: findStat(splits, 'general', 'draws'),
        losses: findStat(splits, 'general', 'losses'),
        winPercentage: findStat(splits, 'general', 'winPct'),
        yellowCards: findStat(splits, 'general', 'yellowCards'),
        redCards: findStat(splits, 'general', 'redCards'),
        foulsCommitted: findStat(splits, 'general', 'foulsCommitted'),
        foulsSuffered: findStat(splits, 'general', 'foulsSuffered'),
        cleanSheets: findStat(splits, 'goalKeeping', 'cleanSheet'),
        goalsConceded: findStat(splits, 'goalKeeping', 'goalsConceded'),
        saves: findStat(splits, 'goalKeeping', 'saves'),
      },
    };
  } catch (err) {
    console.error(`Failed to fetch stats for ESPN team ${espnTeamId}:`, err);
    return null;
  }
}

async function fetchTeamRoster(fplTeamId: number, espnTeamId: number): Promise<ESPNPlayerInfo[]> {
  try {
    const url = `${ESPN_SITE}/teams/${espnTeamId}/roster`;
    const data = await fetchWithRetry(url, `espn-roster-${espnTeamId}`) as any;

    const players: ESPNPlayerInfo[] = [];
    const athletes = data.athletes ?? [];

    // ESPN roster can be a flat array of athletes or grouped by position
    for (const item of athletes) {
      // If item has 'items' it's a position group; otherwise it's a direct athlete
      if (item.items && Array.isArray(item.items)) {
        for (const p of item.items) {
          players.push({
            espnId: p.id ?? '',
            displayName: p.displayName ?? p.fullName ?? '',
            shortName: p.shortName ?? '',
            position: item.position ?? p.position?.name ?? p.position?.displayName ?? 'Unknown',
            jersey: p.jersey ?? '',
            nationality: p.citizenship ?? '',
            espnTeamId,
            fplTeamId,
          });
        }
      } else {
        // Flat athlete object
        players.push({
          espnId: item.id ?? '',
          displayName: item.displayName ?? item.fullName ?? '',
          shortName: item.shortName ?? '',
          position: item.position?.name ?? item.position?.displayName ?? 'Unknown',
          jersey: item.jersey ?? '',
          nationality: item.citizenship ?? '',
          espnTeamId,
          fplTeamId,
        });
      }
    }

    return players;
  } catch (err) {
    console.error(`Failed to fetch roster for ESPN team ${espnTeamId}:`, err);
    return [];
  }
}

async function fetchPlayerStats(espnTeamId: number, fplTeamId: number, athleteId: string, displayName: string): Promise<ESPNPlayerStats | null> {
  try {
    const url = `${ESPN_CORE}/seasons/${SEASON}/types/1/teams/${espnTeamId}/athletes/${athleteId}/statistics`;
    const data = await fetchWithRetry(url, `espn-player-${athleteId}`, 1) as any;

    const splits = data.splits;
    if (!splits?.categories) return null;

    return {
      espnId: athleteId,
      displayName,
      espnTeamId,
      fplTeamId,
      stats: {
        appearances: findStat(splits, 'general', 'appearances'),
        minutes: findStat(splits, 'general', 'minutes'),
        starts: findStat(splits, 'general', 'starts'),
        goals: findStat(splits, 'offensive', 'totalGoals'),
        headedGoals: findStat(splits, 'offensive', 'headedGoals'),
        assists: findStat(splits, 'offensive', 'goalAssists'),
        shotAssists: findStat(splits, 'offensive', 'shotAssists'),
        totalShots: findStat(splits, 'offensive', 'totalShots'),
        shotsOnTarget: findStat(splits, 'offensive', 'shotsOnTarget'),
        totalPasses: findStat(splits, 'offensive', 'totalPasses'),
        accuratePasses: findStat(splits, 'offensive', 'accuratePasses'),
        passPercentage: findStat(splits, 'general', 'passPct'),
        accurateLongBalls: findStat(splits, 'offensive', 'accurateLongBalls'),
        foulsCommitted: findStat(splits, 'general', 'foulsCommitted'),
        foulsSuffered: findStat(splits, 'general', 'foulsSuffered'),
        yellowCards: findStat(splits, 'general', 'yellowCards'),
        redCards: findStat(splits, 'general', 'redCards'),
        tacklesWon: findStat(splits, 'defensive', 'effectiveTackles'),
        tacklesLost: findStat(splits, 'defensive', 'inneffectiveTackles'),
        tacklePercentage: findStat(splits, 'defensive', 'tacklePct'),
        interceptions: findStat(splits, 'defensive', 'interceptions'),
        clearances: findStat(splits, 'defensive', 'totalClearance'),
        shotsBlocked: findStat(splits, 'defensive', 'blockedShots'),
        cleanSheets: findStat(splits, 'goalKeeping', 'cleanSheet'),
        goalsConceded: findStat(splits, 'goalKeeping', 'goalsConceded'),
        saves: findStat(splits, 'goalKeeping', 'saves'),
      },
    };
  } catch {
    // Many youth/reserve players won't have stats — that's fine
    return null;
  }
}

async function fetchStandings(): Promise<ESPNStandingsEntry[]> {
  try {
    const url = `https://site.web.api.espn.com/apis/v2/sports/soccer/eng.1/standings?season=${SEASON}`;
    const data = await fetchWithRetry(url, 'espn-standings') as any;

    const entries: ESPNStandingsEntry[] = [];
    const children = data.children ?? [];

    for (const group of children) {
      const standings = group.standings?.entries ?? [];
      for (const entry of standings) {
        const teamRef = entry.team;
        const espnTeamId = parseInt(teamRef?.id ?? '0');

        // Find matching FPL team ID
        const fplTeamId = Object.entries(FPL_TO_ESPN).find(([_, eid]) => eid === espnTeamId)?.[0];

        const getStatValue = (name: string) => {
          const s = entry.stats?.find((st: any) => st.name === name || st.abbreviation === name);
          return s?.value ?? 0;
        };

        entries.push({
          espnTeamId,
          fplTeamId: fplTeamId ? parseInt(fplTeamId) : 0,
          teamName: teamRef?.displayName ?? `Team ${espnTeamId}`,
          rank: getStatValue('rank'),
          points: getStatValue('points'),
          wins: getStatValue('wins'),
          draws: getStatValue('draws') || getStatValue('ties'),
          losses: getStatValue('losses'),
          goalsFor: getStatValue('pointsFor'),
          goalsAgainst: getStatValue('pointsAgainst'),
          goalDifference: getStatValue('pointDifferential'),
          gamesPlayed: getStatValue('gamesPlayed'),
        });
      }
    }

    return entries;
  } catch (err) {
    console.error('Failed to fetch ESPN standings:', err);
    return [];
  }
}

async function main(): Promise<void> {
  console.log('=== ESPN Data Fetch ===');
  console.log(`Season: ${SEASON}`);

  // 1. Fetch standings
  console.log('\n--- Fetching standings ---');
  const standings = await fetchStandings();
  writeJson('espn/standings.json', standings);
  console.log(`  Got ${standings.length} teams in standings`);

  await delay(500);

  // 2. Fetch team stats for all 20 PL teams
  console.log('\n--- Fetching team stats ---');
  const teamStats: ESPNTeamStats[] = [];
  for (const [fplId, espnId] of Object.entries(FPL_TO_ESPN)) {
    const stats = await fetchTeamStats(parseInt(fplId), espnId);
    if (stats) teamStats.push(stats);
    await delay(300);
  }
  writeJson('espn/team-stats.json', teamStats);
  console.log(`  Got stats for ${teamStats.length} teams`);

  // 3. Fetch rosters for all 20 PL teams
  console.log('\n--- Fetching rosters ---');
  const allRosters: Record<number, ESPNPlayerInfo[]> = {};
  for (const [fplId, espnId] of Object.entries(FPL_TO_ESPN)) {
    const roster = await fetchTeamRoster(parseInt(fplId), espnId);
    allRosters[parseInt(fplId)] = roster;
    await delay(300);
  }
  writeJson('espn/rosters.json', allRosters);
  const totalPlayers = Object.values(allRosters).reduce((sum, r) => sum + r.length, 0);
  console.log(`  Got rosters for ${Object.keys(allRosters).length} teams (${totalPlayers} players)`);

  // 4. Fetch individual player stats for players we care about (owned in FPL draft)
  // We match FPL players to ESPN players first, then fetch stats only for matched ones
  console.log('\n--- Fetching player stats (owned players only) ---');
  const playerStatsResults: ESPNPlayerStats[] = [];

  // Load FPL dashboard data to know which players are owned
  const { readJson: readJsonLocal } = await import('./lib/fetch-utils.js');
  const dashboard = readJsonLocal<any>('dashboard.json');
  const ownedPlayers = dashboard?.playerStats ?? [];

  let fetchedCount = 0;
  let matchedCount = 0;

  for (const fplPlayer of ownedPlayers) {
    const teamRoster = allRosters[fplPlayer.teamId];
    if (!teamRoster) continue;

    // Try to match by name
    const espnPlayer = matchFplToEspn(fplPlayer, teamRoster);
    if (!espnPlayer) continue;

    matchedCount++;
    const stats = await fetchPlayerStats(
      espnPlayer.espnTeamId,
      fplPlayer.teamId,
      espnPlayer.espnId,
      espnPlayer.displayName
    );
    if (stats) {
      playerStatsResults.push({
        ...stats,
        // Store FPL reference for easy lookup later
        displayName: `${espnPlayer.displayName}`,
      });
      fetchedCount++;
    }
    await delay(200);
  }

  writeJson('espn/player-stats.json', playerStatsResults);
  console.log(`  Matched ${matchedCount} of ${ownedPlayers.length} FPL players to ESPN`);
  console.log(`  Got stats for ${fetchedCount} players`);

  // 5. Save a mapping file for FPL <-> ESPN player matches
  console.log('\n--- Building player mapping ---');
  const mapping: { fplId: number; fplName: string; espnId: string; espnName: string; fplTeamId: number }[] = [];

  for (const fplPlayer of [...ownedPlayers, ...(dashboard?.freeAgents?.slice(0, 50) ?? [])]) {
    const teamRoster = allRosters[fplPlayer.teamId];
    if (!teamRoster) continue;

    const espnPlayer = matchFplToEspn(fplPlayer, teamRoster);
    if (espnPlayer) {
      mapping.push({
        fplId: fplPlayer.id,
        fplName: fplPlayer.webName,
        espnId: espnPlayer.espnId,
        espnName: espnPlayer.displayName,
        fplTeamId: fplPlayer.teamId,
      });
    }
  }

  writeJson('espn/player-mapping.json', mapping);
  console.log(`  Mapped ${mapping.length} players between FPL and ESPN`);

  // 6. Save fetch timestamp
  writeJson('espn/meta.json', {
    lastFetched: new Date().toISOString(),
    season: SEASON,
    teamsWithStats: teamStats.length,
    playersMatched: matchedCount,
    playerStatsCount: fetchedCount,
  });

  console.log('\n=== ESPN Data Fetch Complete ===');
}

/** Match an FPL player to an ESPN roster player using fuzzy name matching */
function matchFplToEspn(
  fplPlayer: { webName: string; firstName: string; lastName: string; teamId: number },
  espnRoster: ESPNPlayerInfo[]
): ESPNPlayerInfo | null {
  const fplWeb = normalize(fplPlayer.webName);
  const fplFirst = normalize(fplPlayer.firstName);
  const fplLast = normalize(fplPlayer.lastName);
  const fplFull = `${fplFirst} ${fplLast}`;

  // Pass 1: Exact last name match
  for (const ep of espnRoster) {
    const espnFull = normalize(ep.displayName);
    const espnParts = espnFull.split(' ');
    const espnLast = espnParts[espnParts.length - 1];

    if (fplWeb === espnLast) return ep;
    if (fplLast === espnLast && fplFirst === espnParts[0]) return ep;
    if (fplFull === espnFull) return ep;
  }

  // Pass 2: Last name contains or webName contains
  for (const ep of espnRoster) {
    const espnFull = normalize(ep.displayName);
    const espnParts = espnFull.split(' ');
    const espnLast = espnParts[espnParts.length - 1];

    // "B.Fernandes" -> "fernandes"
    const fplWebClean = fplWeb.replace(/^[a-z]\./, '');
    if (fplWebClean.length > 3 && espnLast === fplWebClean) return ep;
    if (fplWebClean.length > 3 && espnFull.includes(fplWebClean)) return ep;

    // Handle cases like "Gabriel" matching "Gabriel Magalhães"
    if (fplWeb.length > 4 && espnParts[0] === fplWeb) return ep;
  }

  // Pass 3: Substring matching for hyphenated/compound names
  for (const ep of espnRoster) {
    const espnFull = normalize(ep.displayName);
    // "Gibbs-White" -> check if espn name contains both parts
    if (fplWeb.includes('-')) {
      const parts = fplWeb.split('-');
      if (parts.every(p => espnFull.includes(p))) return ep;
    }
    // Check if ESPN name contains the FPL last name
    if (fplLast.length > 4 && espnFull.includes(fplLast)) return ep;
  }

  return null;
}

/** Normalize a name for matching: lowercase, remove accents, trim */
function normalize(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
    .replace(/[^a-z0-9 .-]/g, '')
    .trim();
}

main().catch((err) => {
  console.error('ESPN fetch failed:', err);
  process.exit(1);
});
