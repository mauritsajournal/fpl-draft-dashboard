/**
 * Transform ESPN + FPL data into combined statistics for the "Draft x PL" page.
 * Computes 15 creative statistics combining real-world PL data with FPL draft data.
 */
import { readJson } from './fetch-utils.js';

// ---- Types ----

interface ESPNTeamStats {
  espnTeamId: number;
  fplTeamId: number;
  teamName: string;
  stats: Record<string, number>;
}

interface ESPNPlayerStats {
  espnId: string;
  displayName: string;
  espnTeamId: number;
  fplTeamId: number;
  stats: Record<string, number>;
}

interface ESPNStanding {
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

interface PlayerMapping {
  fplId: number;
  fplName: string;
  espnId: string;
  espnName: string;
  fplTeamId: number;
}

interface FPLPlayerStat {
  id: number;
  webName: string;
  firstName: string;
  lastName: string;
  position: string;
  positionId: number;
  team: string;
  teamId: number;
  owner: string | null;
  ownerLeagueEntryId: number | null;
  totalPoints: number;
  form: number;
  goalsScored: number;
  assists: number;
  xG: number;
  xA: number;
  xGI: number;
  minutes: number;
  cleanSheets: number;
  bonus: number;
}

interface FPLManager {
  leagueEntryId: number;
  entryId: number;
  teamName: string;
  playerName: string;
  shortName: string;
  totalPoints: number;
  averagePoints: number;
  wins: number;
  draws: number;
  losses: number;
  leaguePoints: number;
}

interface FPLStanding {
  rank: number;
  leagueEntryId: number;
  teamName: string;
  playerName: string;
  leaguePoints: number;
  pointsFor: number;
}

// ---- Output Types (exported for dashboard.json) ----

export interface ManagerESPNProfile {
  leagueEntryId: number;
  managerName: string;
  teamName: string;
  fantasyRank: number;
  fantasyPoints: number;
  // Aggregated ESPN stats for owned squad
  squadStats: {
    totalGoals: number;
    totalAssists: number;
    totalShots: number;
    shotsOnTarget: number;
    shotAccuracy: number;
    totalPasses: number;
    accuratePasses: number;
    passAccuracy: number;
    foulsCommitted: number;
    foulsSuffered: number;
    yellowCards: number;
    redCards: number;
    totalCards: number;
    tacklesWon: number;
    tacklesLost: number;
    interceptions: number;
    clearances: number;
    shotsBlocked: number;
    cleanSheets: number;
    goalsConceded: number;
    saves: number;
    totalMinutes: number;
    appearances: number;
    headedGoals: number;
    // Derived
    goalInvolvement: number; // goals + assists
    minutesPerGoalInvolvement: number;
    disciplinaryPoints: number; // yellows * 1 + reds * 3
    shotAssists: number;
  };
  // Per-PL-team breakdown
  plTeamDistribution: { teamName: string; fplTeamId: number; plRank: number; playerCount: number }[];
  // Player details
  players: {
    fplName: string;
    espnName: string;
    plTeam: string;
    plTeamRank: number;
    fplPoints: number;
    espnGoals: number;
    espnAssists: number;
    espnMinutes: number;
    espnYellows: number;
    espnReds: number;
    espnFouls: number;
    espnPasses: number;
    espnPassPct: number;
    espnShots: number;
    espnShotsOnTarget: number;
    espnTackles: number;
    espnInterceptions: number;
    espnCleanSheets: number;
    position: string;
    isBenchwarmer: boolean; // 0 minutes
  }[];
}

export interface DraftXPLStats {
  // Header data
  lastUpdated: string;
  season: string;
  plMatchday: number;

  // Manager profiles with aggregated ESPN data
  managerProfiles: ManagerESPNProfile[];

  // ---- STAT 1: Real vs Fantasy ----
  // Compare avg PL rank of a manager's players' teams vs their fantasy rank
  realVsFantasy: {
    leagueEntryId: number;
    managerName: string;
    fantasyRank: number;
    avgPlTeamRank: number;
    weightedPlRank: number; // weighted by minutes
    rankDelta: number; // fantasy rank - weighted PL rank (positive = overperforming)
    verdict: string;
  }[];

  // ---- STAT 2: Card Collector ----
  cardCollector: {
    leagueEntryId: number;
    managerName: string;
    yellows: number;
    reds: number;
    totalCards: number;
    disciplinaryPoints: number;
    dirtiest3: { name: string; yellows: number; reds: number }[];
    title: string;
  }[];

  // ---- STAT 3: Pass Master vs Long Ball Larry ----
  passStyle: {
    leagueEntryId: number;
    managerName: string;
    passAccuracy: number;
    totalPasses: number;
    accuratePasses: number;
    longBallRatio: number;
    style: string; // "Tiki-Taka", "Balanced", "Route One"
    title: string;
  }[];

  // ---- STAT 4: Shooting Efficiency ----
  shootingEfficiency: {
    leagueEntryId: number;
    managerName: string;
    totalShots: number;
    shotsOnTarget: number;
    goals: number;
    shotAccuracy: number; // SOT / total shots
    conversionRate: number; // goals / total shots
    shotsPerGoal: number;
    title: string;
  }[];

  // ---- STAT 5: Defensive Wall ----
  defensiveWall: {
    leagueEntryId: number;
    managerName: string;
    tacklesWon: number;
    interceptions: number;
    clearances: number;
    shotsBlocked: number;
    defensiveActions: number; // sum of all
    cleanSheets: number;
    goalsConceded: number;
    title: string;
  }[];

  // ---- STAT 6: Foul Merchant ----
  foulMerchant: {
    leagueEntryId: number;
    managerName: string;
    foulsCommitted: number;
    foulsSuffered: number;
    foulRatio: number; // committed/suffered
    dirtiest: { name: string; fouls: number }[];
    title: string;
  }[];

  // ---- STAT 7: The Benchwarmer Index ----
  benchwarmerIndex: {
    leagueEntryId: number;
    managerName: string;
    totalPlayers: number;
    playersWithMinutes: number;
    playersWithZeroMinutes: number;
    avgMinutesPerPlayer: number;
    ghosts: { name: string; team: string }[];
    title: string;
  }[];

  // ---- STAT 8: Team Diversity ----
  teamDiversity: {
    leagueEntryId: number;
    managerName: string;
    uniqueTeams: number;
    maxFromOneTeam: number;
    maxTeamName: string;
    diversityScore: number;
    distribution: { team: string; count: number; plRank: number }[];
    title: string;
  }[];

  // ---- STAT 9: Big Club Bias ----
  bigClubBias: {
    leagueEntryId: number;
    managerName: string;
    top6Count: number;
    top6Pct: number;
    bottom6Count: number;
    totalPlayers: number;
    title: string;
  }[];

  // ---- STAT 10: Goal Involvement Kings ----
  goalInvolvement: {
    leagueEntryId: number;
    managerName: string;
    totalGoalInvolvements: number;
    goals: number;
    assists: number;
    minsPerGI: number;
    topContributors: { name: string; goals: number; assists: number; gi: number }[];
    title: string;
  }[];

  // ---- STAT 11: The Chaos Index ----
  chaosIndex: {
    leagueEntryId: number;
    managerName: string;
    chaosScore: number; // cards + fouls committed + own goals
    yellows: number;
    reds: number;
    fouls: number;
    title: string;
  }[];

  // ---- STAT 12: Minutes Monster ----
  minutesMonster: {
    leagueEntryId: number;
    managerName: string;
    totalMinutes: number;
    avgMinutesPerPlayer: number;
    ironMan: { name: string; minutes: number } | null;
    title: string;
  }[];

  // ---- STAT 13: Fantasy vs Reality ----
  // Which managers' players have the most real goals+assists but lowest fantasy points?
  fantasyVsReality: {
    leagueEntryId: number;
    managerName: string;
    realGI: number; // ESPN goals + assists
    fantasyPoints: number; // FPL total points
    pointsPerRealGI: number;
    overperformers: { name: string; fplPts: number; realGI: number }[];
    underperformers: { name: string; fplPts: number; realGI: number }[];
    title: string;
  }[];

  // ---- STAT 14: Draft Pick Hit Rate ----
  draftHitRate: {
    round: number;
    picks: {
      pick: number;
      playerName: string;
      managerName: string;
      leagueEntryId: number;
      fplPoints: number;
      espnGoals: number;
      espnAssists: number;
      espnMinutes: number;
      rating: string; // "Star", "Hit", "Miss", "Bust"
    }[];
    avgPoints: number;
  }[];

  // ---- STAT 15: Awards Ceremony ----
  awards: {
    goldBoot: { name: string; manager: string; goals: number } | null;
    playmaker: { name: string; manager: string; assists: number } | null;
    ironMan: { name: string; manager: string; minutes: number } | null;
    cardMagnet: { name: string; manager: string; cards: number } | null;
    ghostPlayer: { name: string; manager: string; team: string }[];
    passKing: { name: string; manager: string; passes: number } | null;
    tackleKing: { name: string; manager: string; tackles: number } | null;
    shotShy: { name: string; manager: string; minutes: number; shots: number } | null;
    foulKing: { name: string; manager: string; fouls: number } | null;
    cleanSheetKing: { name: string; manager: string; cleanSheets: number } | null;
  };
}

// ---- Main transform function ----

export function buildDraftXPL(): DraftXPLStats | null {
  // Load ESPN data
  const teamStats = readJson<ESPNTeamStats[]>('espn/team-stats.json');
  const espnStandings = readJson<ESPNStanding[]>('espn/standings.json');
  const playerStats = readJson<ESPNPlayerStats[]>('espn/player-stats.json');
  const playerMapping = readJson<PlayerMapping[]>('espn/player-mapping.json');
  const espnMeta = readJson<{ lastFetched: string; season: string }>('espn/meta.json');

  if (!teamStats || !espnStandings || !playerStats || !playerMapping || !espnMeta) {
    console.log('  ESPN data not available — skipping Draft x PL stats');
    return null;
  }

  // Load FPL data
  const dashboard = readJson<any>('dashboard.json');
  if (!dashboard) {
    console.log('  dashboard.json not available — skipping Draft x PL stats');
    return null;
  }

  const fplPlayers: FPLPlayerStat[] = dashboard.playerStats ?? [];
  const fplManagers: FPLManager[] = dashboard.managers ?? [];
  const fplStandings: FPLStanding[] = dashboard.standings ?? [];
  const draftPicks = dashboard.draftPicks ?? [];

  // Build lookup maps
  const espnPlayerMap = new Map<string, ESPNPlayerStats>();
  for (const p of playerStats) {
    espnPlayerMap.set(p.espnId, p);
  }

  const fplToEspnMap = new Map<number, PlayerMapping>();
  for (const m of playerMapping) {
    fplToEspnMap.set(m.fplId, m);
  }

  const espnStandingsMap = new Map<number, ESPNStanding>();
  for (const s of espnStandings) {
    espnStandingsMap.set(s.fplTeamId, s);
  }

  const espnTeamStatsMap = new Map<number, ESPNTeamStats>();
  for (const t of teamStats) {
    espnTeamStatsMap.set(t.fplTeamId, t);
  }

  // Build manager profiles
  const managerProfiles = buildManagerProfiles(
    fplManagers, fplStandings, fplPlayers, fplToEspnMap, espnPlayerMap, espnStandingsMap
  );

  // Compute stats
  const result: DraftXPLStats = {
    lastUpdated: espnMeta.lastFetched,
    season: espnMeta.season,
    plMatchday: Math.max(...espnStandings.map(s => s.gamesPlayed), 0),
    managerProfiles,
    realVsFantasy: computeRealVsFantasy(managerProfiles),
    cardCollector: computeCardCollector(managerProfiles),
    passStyle: computePassStyle(managerProfiles, fplPlayers, fplToEspnMap, espnPlayerMap, espnTeamStatsMap),
    shootingEfficiency: computeShootingEfficiency(managerProfiles),
    defensiveWall: computeDefensiveWall(managerProfiles),
    foulMerchant: computeFoulMerchant(managerProfiles),
    benchwarmerIndex: computeBenchwarmerIndex(managerProfiles),
    teamDiversity: computeTeamDiversity(managerProfiles),
    bigClubBias: computeBigClubBias(managerProfiles, espnStandings),
    goalInvolvement: computeGoalInvolvement(managerProfiles),
    chaosIndex: computeChaosIndex(managerProfiles),
    minutesMonster: computeMinutesMonster(managerProfiles),
    fantasyVsReality: computeFantasyVsReality(managerProfiles),
    draftHitRate: computeDraftHitRate(draftPicks, fplPlayers, fplToEspnMap, espnPlayerMap),
    awards: computeAwards(managerProfiles),
  };

  return result;
}

// ---- Profile builder ----

function buildManagerProfiles(
  managers: FPLManager[],
  standings: FPLStanding[],
  fplPlayers: FPLPlayerStat[],
  mapping: Map<number, PlayerMapping>,
  espnPlayers: Map<string, ESPNPlayerStats>,
  espnStandings: Map<number, ESPNStanding>,
): ManagerESPNProfile[] {
  return managers.map(m => {
    const standing = standings.find(s => s.leagueEntryId === m.leagueEntryId);
    const ownedPlayers = fplPlayers.filter(p => p.ownerLeagueEntryId === m.leagueEntryId);

    const players = ownedPlayers.map(fp => {
      const map = mapping.get(fp.id);
      const espn = map ? espnPlayers.get(map.espnId) : null;
      const plStanding = espnStandings.get(fp.teamId);

      return {
        fplName: fp.webName,
        espnName: map?.espnName ?? fp.webName,
        plTeam: fp.team,
        plTeamRank: plStanding?.rank ?? 20,
        fplPoints: fp.totalPoints,
        espnGoals: espn?.stats.goals ?? 0,
        espnAssists: espn?.stats.assists ?? 0,
        espnMinutes: espn?.stats.minutes ?? 0,
        espnYellows: espn?.stats.yellowCards ?? 0,
        espnReds: espn?.stats.redCards ?? 0,
        espnFouls: espn?.stats.foulsCommitted ?? 0,
        espnPasses: espn?.stats.totalPasses ?? 0,
        espnPassPct: espn?.stats.passPercentage ?? 0,
        espnShots: espn?.stats.totalShots ?? 0,
        espnShotsOnTarget: espn?.stats.shotsOnTarget ?? 0,
        espnTackles: (espn?.stats.tacklesWon ?? 0) + (espn?.stats.tacklesLost ?? 0),
        espnInterceptions: espn?.stats.interceptions ?? 0,
        espnCleanSheets: espn?.stats.cleanSheets ?? 0,
        position: fp.position,
        isBenchwarmer: (espn?.stats.minutes ?? 0) === 0 && (espn?.stats.appearances ?? 0) === 0,
      };
    });

    // Aggregate squad stats
    const squadStats = {
      totalGoals: sum(players, p => p.espnGoals),
      totalAssists: sum(players, p => p.espnAssists),
      totalShots: sum(players, p => p.espnShots),
      shotsOnTarget: sum(players, p => p.espnShotsOnTarget),
      shotAccuracy: 0,
      totalPasses: sum(players, p => p.espnPasses),
      accuratePasses: 0, // not per-player
      passAccuracy: 0,
      foulsCommitted: sum(players, p => p.espnFouls),
      foulsSuffered: 0,
      yellowCards: sum(players, p => p.espnYellows),
      redCards: sum(players, p => p.espnReds),
      totalCards: sum(players, p => p.espnYellows) + sum(players, p => p.espnReds),
      tacklesWon: 0,
      tacklesLost: 0,
      interceptions: sum(players, p => p.espnInterceptions),
      clearances: 0,
      shotsBlocked: 0,
      cleanSheets: sum(players, p => p.espnCleanSheets),
      goalsConceded: 0,
      saves: 0,
      totalMinutes: sum(players, p => p.espnMinutes),
      appearances: 0,
      headedGoals: 0,
      goalInvolvement: sum(players, p => p.espnGoals) + sum(players, p => p.espnAssists),
      minutesPerGoalInvolvement: 0,
      disciplinaryPoints: sum(players, p => p.espnYellows) + sum(players, p => p.espnReds) * 3,
      shotAssists: 0,
    };

    // Fill in computed fields from per-player ESPN data
    let totalAccPasses = 0;
    let totalTacklesWon = 0;
    let totalTacklesLost = 0;
    let totalClearances = 0;
    let totalShotsBlocked = 0;
    let totalSaves = 0;
    let totalGoalsConceded = 0;
    let totalFoulsSuffered = 0;
    let totalApps = 0;
    let totalHeadedGoals = 0;
    let totalShotAssists = 0;

    for (const fp of ownedPlayers) {
      const map = mapping.get(fp.id);
      const espn = map ? espnPlayers.get(map.espnId) : null;
      if (!espn) continue;
      totalAccPasses += espn.stats.accuratePasses ?? 0;
      totalTacklesWon += espn.stats.tacklesWon ?? 0;
      totalTacklesLost += espn.stats.tacklesLost ?? 0;
      totalClearances += espn.stats.clearances ?? 0;
      totalShotsBlocked += espn.stats.shotsBlocked ?? 0;
      totalSaves += espn.stats.saves ?? 0;
      totalGoalsConceded += espn.stats.goalsConceded ?? 0;
      totalFoulsSuffered += espn.stats.foulsSuffered ?? 0;
      totalApps += espn.stats.appearances ?? 0;
      totalHeadedGoals += espn.stats.headedGoals ?? 0;
      totalShotAssists += espn.stats.shotAssists ?? 0;
    }

    squadStats.accuratePasses = totalAccPasses;
    squadStats.tacklesWon = totalTacklesWon;
    squadStats.tacklesLost = totalTacklesLost;
    squadStats.clearances = totalClearances;
    squadStats.shotsBlocked = totalShotsBlocked;
    squadStats.saves = totalSaves;
    squadStats.goalsConceded = totalGoalsConceded;
    squadStats.foulsSuffered = totalFoulsSuffered;
    squadStats.appearances = totalApps;
    squadStats.headedGoals = totalHeadedGoals;
    squadStats.shotAssists = totalShotAssists;

    if (squadStats.totalShots > 0) {
      squadStats.shotAccuracy = squadStats.shotsOnTarget / squadStats.totalShots;
    }
    if (squadStats.totalPasses > 0) {
      squadStats.passAccuracy = totalAccPasses / squadStats.totalPasses;
    }
    if (squadStats.goalInvolvement > 0) {
      squadStats.minutesPerGoalInvolvement = squadStats.totalMinutes / squadStats.goalInvolvement;
    }

    // PL team distribution
    const teamMap = new Map<number, { teamName: string; count: number; plRank: number }>();
    for (const p of players) {
      const existing = teamMap.get(0); // dummy
      const fplTeamId = ownedPlayers.find(fp => fp.webName === p.fplName)?.teamId ?? 0;
      if (!teamMap.has(fplTeamId)) {
        teamMap.set(fplTeamId, { teamName: p.plTeam, count: 0, plRank: p.plTeamRank });
      }
      teamMap.get(fplTeamId)!.count++;
    }

    const plTeamDistribution = Array.from(teamMap.entries())
      .map(([fplTeamId, data]) => ({ ...data, fplTeamId }))
      .sort((a, b) => b.count - a.count);

    return {
      leagueEntryId: m.leagueEntryId,
      managerName: m.playerName,
      teamName: m.teamName,
      fantasyRank: standing?.rank ?? 8,
      fantasyPoints: standing?.pointsFor ?? 0,
      squadStats,
      plTeamDistribution,
      players,
    };
  });
}

// ---- Stat Computers ----

function computeRealVsFantasy(profiles: ManagerESPNProfile[]) {
  return profiles.map(p => {
    const playersWithMinutes = p.players.filter(pl => pl.espnMinutes > 0);
    const totalMinutes = sum(playersWithMinutes, pl => pl.espnMinutes);
    const weightedRank = totalMinutes > 0
      ? sum(playersWithMinutes, pl => pl.plTeamRank * pl.espnMinutes) / totalMinutes
      : sum(p.players, pl => pl.plTeamRank) / (p.players.length || 1);

    const avgRank = p.players.length > 0
      ? sum(p.players, pl => pl.plTeamRank) / p.players.length
      : 20;

    const rankDelta = weightedRank - p.fantasyRank;
    let verdict = '';
    if (rankDelta > 3) verdict = 'Punching above weight';
    else if (rankDelta > 1) verdict = 'Slight overperformer';
    else if (rankDelta > -1) verdict = 'Right on track';
    else if (rankDelta > -3) verdict = 'Could do better';
    else verdict = 'Underperforming';

    return {
      leagueEntryId: p.leagueEntryId,
      managerName: p.managerName,
      fantasyRank: p.fantasyRank,
      avgPlTeamRank: round2(avgRank),
      weightedPlRank: round2(weightedRank),
      rankDelta: round2(rankDelta),
      verdict,
    };
  }).sort((a, b) => b.rankDelta - a.rankDelta);
}

function computeCardCollector(profiles: ManagerESPNProfile[]) {
  return profiles.map(p => {
    const dirtiest3 = [...p.players]
      .map(pl => ({ name: pl.fplName, yellows: pl.espnYellows, reds: pl.espnReds }))
      .sort((a, b) => (b.yellows + b.reds * 3) - (a.yellows + a.reds * 3))
      .slice(0, 3);

    const dp = p.squadStats.disciplinaryPoints;
    let title = '';
    if (dp >= 30) title = 'Dirty Dozen';
    else if (dp >= 20) title = 'Yellow Fever';
    else if (dp >= 10) title = 'Light Touch';
    else title = 'Fair Play Award';

    return {
      leagueEntryId: p.leagueEntryId,
      managerName: p.managerName,
      yellows: p.squadStats.yellowCards,
      reds: p.squadStats.redCards,
      totalCards: p.squadStats.totalCards,
      disciplinaryPoints: dp,
      dirtiest3,
      title,
    };
  }).sort((a, b) => b.disciplinaryPoints - a.disciplinaryPoints);
}

function computePassStyle(
  profiles: ManagerESPNProfile[],
  fplPlayers: FPLPlayerStat[],
  mapping: Map<number, PlayerMapping>,
  espnPlayers: Map<string, ESPNPlayerStats>,
  teamStats: Map<number, ESPNTeamStats>,
) {
  return profiles.map(p => {
    // Compute long ball ratio from team-level data
    const ownedPlayers = fplPlayers.filter(fp => fp.ownerLeagueEntryId === p.leagueEntryId);
    let totalLongBalls = 0;
    let totalTeamPasses = 0;

    // Use unique teams' long ball stats weighted by # of players from that team
    const teamCounts = new Map<number, number>();
    for (const fp of ownedPlayers) {
      teamCounts.set(fp.teamId, (teamCounts.get(fp.teamId) ?? 0) + 1);
    }

    for (const [teamId, count] of teamCounts) {
      const ts = teamStats.get(teamId);
      if (ts) {
        totalLongBalls += (ts.stats.longBalls ?? 0) * (count / ownedPlayers.length);
        totalTeamPasses += (ts.stats.totalPasses ?? 0) * (count / ownedPlayers.length);
      }
    }

    const longBallRatio = totalTeamPasses > 0 ? totalLongBalls / totalTeamPasses : 0;

    const passAcc = p.squadStats.passAccuracy;
    let style = '';
    let title = '';
    if (passAcc >= 0.87) { style = 'Tiki-Taka'; title = 'The Artisan'; }
    else if (passAcc >= 0.83) { style = 'Controlled'; title = 'The Strategist'; }
    else if (passAcc >= 0.78) { style = 'Balanced'; title = 'The Pragmatist'; }
    else { style = 'Route One'; title = 'Long Ball Larry'; }

    return {
      leagueEntryId: p.leagueEntryId,
      managerName: p.managerName,
      passAccuracy: round2(passAcc * 100),
      totalPasses: p.squadStats.totalPasses,
      accuratePasses: p.squadStats.accuratePasses,
      longBallRatio: round2(longBallRatio * 100),
      style,
      title,
    };
  }).sort((a, b) => b.passAccuracy - a.passAccuracy);
}

function computeShootingEfficiency(profiles: ManagerESPNProfile[]) {
  return profiles.map(p => {
    const s = p.squadStats;
    const shotAcc = s.totalShots > 0 ? s.shotsOnTarget / s.totalShots : 0;
    const conv = s.totalShots > 0 ? s.totalGoals / s.totalShots : 0;
    const spg = s.totalGoals > 0 ? s.totalShots / s.totalGoals : 0;

    let title = '';
    if (conv >= 0.15) title = 'Clinical Finisher';
    else if (conv >= 0.10) title = 'Sharp Shooter';
    else if (conv >= 0.07) title = 'Average Joe';
    else title = 'Spray and Pray';

    return {
      leagueEntryId: p.leagueEntryId,
      managerName: p.managerName,
      totalShots: s.totalShots,
      shotsOnTarget: s.shotsOnTarget,
      goals: s.totalGoals,
      shotAccuracy: round2(shotAcc * 100),
      conversionRate: round2(conv * 100),
      shotsPerGoal: round2(spg),
      title,
    };
  }).sort((a, b) => b.conversionRate - a.conversionRate);
}

function computeDefensiveWall(profiles: ManagerESPNProfile[]) {
  return profiles.map(p => {
    const s = p.squadStats;
    const defensiveActions = s.tacklesWon + s.interceptions + s.clearances + s.shotsBlocked;

    let title = '';
    if (defensiveActions >= 200) title = 'The Great Wall';
    else if (defensiveActions >= 150) title = 'Solid Rock';
    else if (defensiveActions >= 100) title = 'Dependable';
    else title = 'Paper Thin';

    return {
      leagueEntryId: p.leagueEntryId,
      managerName: p.managerName,
      tacklesWon: s.tacklesWon,
      interceptions: s.interceptions,
      clearances: s.clearances,
      shotsBlocked: s.shotsBlocked,
      defensiveActions,
      cleanSheets: s.cleanSheets,
      goalsConceded: s.goalsConceded,
      title,
    };
  }).sort((a, b) => b.defensiveActions - a.defensiveActions);
}

function computeFoulMerchant(profiles: ManagerESPNProfile[]) {
  return profiles.map(p => {
    const s = p.squadStats;
    const ratio = s.foulsSuffered > 0 ? s.foulsCommitted / s.foulsSuffered : 0;

    const dirtiest = [...p.players]
      .map(pl => ({ name: pl.fplName, fouls: pl.espnFouls }))
      .sort((a, b) => b.fouls - a.fouls)
      .filter(pl => pl.fouls > 0)
      .slice(0, 3);

    let title = '';
    if (s.foulsCommitted >= 200) title = 'The Enforcer';
    else if (s.foulsCommitted >= 150) title = 'Persistent Offender';
    else if (s.foulsCommitted >= 100) title = 'Bit Feisty';
    else title = 'Squeaky Clean';

    return {
      leagueEntryId: p.leagueEntryId,
      managerName: p.managerName,
      foulsCommitted: s.foulsCommitted,
      foulsSuffered: s.foulsSuffered,
      foulRatio: round2(ratio),
      dirtiest,
      title,
    };
  }).sort((a, b) => b.foulsCommitted - a.foulsCommitted);
}

function computeBenchwarmerIndex(profiles: ManagerESPNProfile[]) {
  return profiles.map(p => {
    const total = p.players.length;
    const withMinutes = p.players.filter(pl => !pl.isBenchwarmer).length;
    const zeroMinutes = p.players.filter(pl => pl.isBenchwarmer).length;
    const avgMins = total > 0 ? sum(p.players, pl => pl.espnMinutes) / total : 0;

    const ghosts = p.players
      .filter(pl => pl.isBenchwarmer)
      .map(pl => ({ name: pl.fplName, team: pl.plTeam }));

    let title = '';
    if (zeroMinutes === 0) title = 'All Business';
    else if (zeroMinutes <= 2) title = 'Lean Squad';
    else if (zeroMinutes <= 4) title = 'Dead Weight';
    else title = 'Ghost Squad';

    return {
      leagueEntryId: p.leagueEntryId,
      managerName: p.managerName,
      totalPlayers: total,
      playersWithMinutes: withMinutes,
      playersWithZeroMinutes: zeroMinutes,
      avgMinutesPerPlayer: Math.round(avgMins),
      ghosts,
      title,
    };
  }).sort((a, b) => b.playersWithZeroMinutes - a.playersWithZeroMinutes);
}

function computeTeamDiversity(profiles: ManagerESPNProfile[]) {
  return profiles.map(p => {
    const dist = p.plTeamDistribution;
    const uniqueTeams = dist.length;
    const maxTeam = dist[0];

    const diversityScore = uniqueTeams > 0
      ? (uniqueTeams / 20) * 100 * (1 - (maxTeam?.count ?? 0) / (p.players.length || 1))
      : 0;

    let title = '';
    if (uniqueTeams >= 12) title = 'The Diversifier';
    else if (uniqueTeams >= 8) title = 'Well Spread';
    else if (uniqueTeams >= 5) title = 'Cluster Picker';
    else title = 'All In';

    return {
      leagueEntryId: p.leagueEntryId,
      managerName: p.managerName,
      uniqueTeams,
      maxFromOneTeam: maxTeam?.count ?? 0,
      maxTeamName: maxTeam?.teamName ?? '--',
      diversityScore: round2(diversityScore),
      distribution: dist.map(d => ({ team: d.teamName, count: d.count, plRank: d.plRank })),
      title,
    };
  }).sort((a, b) => b.uniqueTeams - a.uniqueTeams);
}

function computeBigClubBias(profiles: ManagerESPNProfile[], standings: ESPNStanding[]) {
  const top6Teams = standings.sort((a, b) => a.rank - b.rank).slice(0, 6).map(s => s.fplTeamId);
  const bottom6Teams = standings.slice(-6).map(s => s.fplTeamId);

  return profiles.map(p => {
    const playerFplIds = p.players.map(pl => {
      const dist = p.plTeamDistribution.find(d => d.teamName === pl.plTeam);
      return dist?.fplTeamId ?? 0;
    });

    let top6Count = 0;
    let bottom6Count = 0;
    for (const pl of p.players) {
      const teamDist = p.plTeamDistribution.find(d => d.teamName === pl.plTeam);
      const fplTeamId = teamDist?.fplTeamId ?? 0;
      if (top6Teams.includes(fplTeamId)) top6Count++;
      if (bottom6Teams.includes(fplTeamId)) bottom6Count++;
    }

    const pct = p.players.length > 0 ? (top6Count / p.players.length) * 100 : 0;

    let title = '';
    if (pct >= 60) title = 'Big Club Merchant';
    else if (pct >= 40) title = 'Star Chaser';
    else if (pct >= 20) title = 'Balanced Portfolio';
    else title = 'Underdog Lover';

    return {
      leagueEntryId: p.leagueEntryId,
      managerName: p.managerName,
      top6Count,
      top6Pct: round2(pct),
      bottom6Count,
      totalPlayers: p.players.length,
      title,
    };
  }).sort((a, b) => b.top6Pct - a.top6Pct);
}

function computeGoalInvolvement(profiles: ManagerESPNProfile[]) {
  return profiles.map(p => {
    const s = p.squadStats;
    const gi = s.goalInvolvement;
    const minsPerGI = gi > 0 ? s.totalMinutes / gi : 9999;

    const topContributors = [...p.players]
      .map(pl => ({ name: pl.fplName, goals: pl.espnGoals, assists: pl.espnAssists, gi: pl.espnGoals + pl.espnAssists }))
      .sort((a, b) => b.gi - a.gi)
      .filter(pl => pl.gi > 0)
      .slice(0, 5);

    let title = '';
    if (gi >= 60) title = 'Goal Machine';
    else if (gi >= 40) title = 'Sharp Outfit';
    else if (gi >= 20) title = 'Getting There';
    else title = 'Toothless';

    return {
      leagueEntryId: p.leagueEntryId,
      managerName: p.managerName,
      totalGoalInvolvements: gi,
      goals: s.totalGoals,
      assists: s.totalAssists,
      minsPerGI: Math.round(minsPerGI),
      topContributors,
      title,
    };
  }).sort((a, b) => b.totalGoalInvolvements - a.totalGoalInvolvements);
}

function computeChaosIndex(profiles: ManagerESPNProfile[]) {
  return profiles.map(p => {
    const s = p.squadStats;
    const chaosScore = s.yellowCards * 2 + s.redCards * 5 + s.foulsCommitted;

    let title = '';
    if (chaosScore >= 250) title = 'Agent of Chaos';
    else if (chaosScore >= 180) title = 'Chaos Merchant';
    else if (chaosScore >= 120) title = 'Bit Disruptive';
    else title = 'Zen Master';

    return {
      leagueEntryId: p.leagueEntryId,
      managerName: p.managerName,
      chaosScore,
      yellows: s.yellowCards,
      reds: s.redCards,
      fouls: s.foulsCommitted,
      title,
    };
  }).sort((a, b) => b.chaosScore - a.chaosScore);
}

function computeMinutesMonster(profiles: ManagerESPNProfile[]) {
  return profiles.map(p => {
    const total = p.squadStats.totalMinutes;
    const avg = p.players.length > 0 ? total / p.players.length : 0;
    const ironMan = [...p.players].sort((a, b) => b.espnMinutes - a.espnMinutes)[0];

    let title = '';
    if (avg >= 1500) title = 'Nailed On';
    else if (avg >= 1000) title = 'First Choice';
    else if (avg >= 500) title = 'Squad Rotation';
    else title = 'Bench Fillers';

    return {
      leagueEntryId: p.leagueEntryId,
      managerName: p.managerName,
      totalMinutes: total,
      avgMinutesPerPlayer: Math.round(avg),
      ironMan: ironMan ? { name: ironMan.fplName, minutes: ironMan.espnMinutes } : null,
      title,
    };
  }).sort((a, b) => b.totalMinutes - a.totalMinutes);
}

function computeFantasyVsReality(profiles: ManagerESPNProfile[]) {
  return profiles.map(p => {
    const realGI = p.squadStats.goalInvolvement;
    const fplPts = p.fantasyPoints;
    const ptsPerGI = realGI > 0 ? fplPts / realGI : 0;

    const playersWithData = p.players.filter(pl => pl.espnGoals > 0 || pl.espnAssists > 0 || pl.fplPoints > 10);
    const sorted = [...playersWithData].sort((a, b) => {
      const aRatio = (a.espnGoals + a.espnAssists) > 0 ? a.fplPoints / (a.espnGoals + a.espnAssists) : 0;
      const bRatio = (b.espnGoals + b.espnAssists) > 0 ? b.fplPoints / (b.espnGoals + b.espnAssists) : 0;
      return bRatio - aRatio;
    });

    const overperformers = sorted.slice(0, 3).map(pl => ({
      name: pl.fplName,
      fplPts: pl.fplPoints,
      realGI: pl.espnGoals + pl.espnAssists,
    }));

    const underperformers = sorted.slice(-3).reverse().map(pl => ({
      name: pl.fplName,
      fplPts: pl.fplPoints,
      realGI: pl.espnGoals + pl.espnAssists,
    }));

    let title = '';
    if (ptsPerGI >= 25) title = 'Fantasy Wizard';
    else if (ptsPerGI >= 18) title = 'Good Returns';
    else if (ptsPerGI >= 12) title = 'Fair Exchange';
    else title = 'Reality Check';

    return {
      leagueEntryId: p.leagueEntryId,
      managerName: p.managerName,
      realGI,
      fantasyPoints: fplPts,
      pointsPerRealGI: round2(ptsPerGI),
      overperformers,
      underperformers,
      title,
    };
  }).sort((a, b) => b.pointsPerRealGI - a.pointsPerRealGI);
}

function computeDraftHitRate(
  draftPicks: any[],
  fplPlayers: FPLPlayerStat[],
  mapping: Map<number, PlayerMapping>,
  espnPlayers: Map<string, ESPNPlayerStats>,
) {
  const rounds = new Map<number, any[]>();

  for (const pick of draftPicks) {
    if (!rounds.has(pick.round)) rounds.set(pick.round, []);

    const fpl = fplPlayers.find(p => p.id === pick.playerId);
    const map = fpl ? mapping.get(fpl.id) : null;
    const espn = map ? espnPlayers.get(map.espnId) : null;

    const pts = fpl?.totalPoints ?? 0;
    let rating = '';
    if (pts >= 100) rating = 'Star';
    else if (pts >= 60) rating = 'Hit';
    else if (pts >= 30) rating = 'Miss';
    else rating = 'Bust';

    rounds.get(pick.round)!.push({
      pick: pick.pick,
      playerName: pick.playerName,
      managerName: pick.managerName,
      leagueEntryId: pick.leagueEntryId,
      fplPoints: pts,
      espnGoals: espn?.stats.goals ?? 0,
      espnAssists: espn?.stats.assists ?? 0,
      espnMinutes: espn?.stats.minutes ?? 0,
      rating,
    });
  }

  return Array.from(rounds.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([round, picks]) => ({
      round,
      picks: picks.sort((a: any, b: any) => a.pick - b.pick),
      avgPoints: picks.length > 0 ? round2(sum(picks, (p: any) => p.fplPoints) / picks.length) : 0,
    }));
}

function computeAwards(profiles: ManagerESPNProfile[]) {
  const allPlayers = profiles.flatMap(p =>
    p.players.map(pl => ({ ...pl, manager: p.managerName }))
  );

  const byGoals = [...allPlayers].sort((a, b) => b.espnGoals - a.espnGoals);
  const byAssists = [...allPlayers].sort((a, b) => b.espnAssists - a.espnAssists);
  const byMinutes = [...allPlayers].sort((a, b) => b.espnMinutes - a.espnMinutes);
  const byCards = [...allPlayers].sort((a, b) => (b.espnYellows + b.espnReds) - (a.espnYellows + a.espnReds));
  const byPasses = [...allPlayers].sort((a, b) => b.espnPasses - a.espnPasses);
  const byTackles = [...allPlayers].sort((a, b) => b.espnTackles - a.espnTackles);
  const byFouls = [...allPlayers].sort((a, b) => b.espnFouls - a.espnFouls);
  const byCleanSheets = [...allPlayers].sort((a, b) => b.espnCleanSheets - a.espnCleanSheets);

  const ghostPlayers = allPlayers.filter(p => p.isBenchwarmer).slice(0, 5).map(p => ({
    name: p.fplName,
    manager: p.manager,
    team: p.plTeam,
  }));

  // Shot shy: most minutes with fewest shots
  const shotShy = [...allPlayers]
    .filter(p => p.espnMinutes > 500)
    .sort((a, b) => (a.espnShots / (a.espnMinutes || 1)) - (b.espnShots / (b.espnMinutes || 1)))[0];

  return {
    goldBoot: byGoals[0] ? { name: byGoals[0].fplName, manager: byGoals[0].manager, goals: byGoals[0].espnGoals } : null,
    playmaker: byAssists[0] ? { name: byAssists[0].fplName, manager: byAssists[0].manager, assists: byAssists[0].espnAssists } : null,
    ironMan: byMinutes[0] ? { name: byMinutes[0].fplName, manager: byMinutes[0].manager, minutes: byMinutes[0].espnMinutes } : null,
    cardMagnet: byCards[0] ? { name: byCards[0].fplName, manager: byCards[0].manager, cards: byCards[0].espnYellows + byCards[0].espnReds } : null,
    ghostPlayer: ghostPlayers,
    passKing: byPasses[0] ? { name: byPasses[0].fplName, manager: byPasses[0].manager, passes: byPasses[0].espnPasses } : null,
    tackleKing: byTackles[0] ? { name: byTackles[0].fplName, manager: byTackles[0].manager, tackles: byTackles[0].espnTackles } : null,
    shotShy: shotShy ? { name: shotShy.fplName, manager: shotShy.manager, minutes: shotShy.espnMinutes, shots: shotShy.espnShots } : null,
    foulKing: byFouls[0] ? { name: byFouls[0].fplName, manager: byFouls[0].manager, fouls: byFouls[0].espnFouls } : null,
    cleanSheetKing: byCleanSheets[0] ? { name: byCleanSheets[0].fplName, manager: byCleanSheets[0].manager, cleanSheets: byCleanSheets[0].espnCleanSheets } : null,
  };
}

// ---- Helpers ----

function sum<T>(arr: T[], fn: (item: T) => number): number {
  return arr.reduce((acc, item) => acc + fn(item), 0);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
