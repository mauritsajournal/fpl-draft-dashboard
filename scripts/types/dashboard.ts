// Dashboard data types — pre-computed structures for rendering

export interface DashboardMeta {
  lastUpdated: string;
  currentGameweek: number;
  leagueName: string;
  season: string;
  dataAvailable: {
    standings: boolean;
    picks: boolean;
    live: boolean;
    transactions: boolean;
    draft: boolean;
    fixtures: boolean;
    ownership: boolean;
  };
  fetchErrors: string[];
}

export interface Standing {
  rank: number;
  lastRank: number;
  leagueEntryId: number;
  entryId: number;
  teamName: string;
  playerName: string;
  shortName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  leaguePoints: number;
}

export interface Manager {
  leagueEntryId: number;
  entryId: number;
  teamName: string;
  playerName: string;
  shortName: string;
  totalPoints: number;
  averagePoints: number;
  bestGw: { gw: number; points: number };
  worstGw: { gw: number; points: number };
  currentForm: number[]; // last 5 GW points
  wins: number;
  draws: number;
  losses: number;
  leaguePoints: number;
}

export interface GameweekSnapshot {
  gameweek: number;
  standings: {
    leagueEntryId: number;
    rank: number;
    cumulativePoints: number;
    leaguePoints: number;
    gwPoints: number;
  }[];
}

export interface H2HRecord {
  managerA: number; // leagueEntryId
  managerB: number;
  wins: number;
  draws: number;
  losses: number;
  pointsFor: number;
  pointsAgainst: number;
  matches: {
    gw: number;
    pointsA: number;
    pointsB: number;
  }[];
}

export interface PlayerStat {
  id: number;
  webName: string;
  firstName: string;
  lastName: string;
  position: string; // GK, DEF, MID, FWD
  positionId: number;
  team: string;
  teamId: number;
  owner: string | null; // manager name or null if free agent
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

export interface PowerRank {
  leagueEntryId: number;
  teamName: string;
  playerName: string;
  score: number; // 0-100
  breakdown: {
    form: number;
    xGI: number;
    totalPoints: number;
    fixtureDifficulty: number;
  };
}

export interface TransactionDisplay {
  id: number;
  gameweek: number;
  managerName: string;
  leagueEntryId: number;
  playerIn: string;
  playerInId: number;
  playerOut: string;
  playerOutId: number;
  type: 'waiver' | 'free_agent';
  result: 'accepted' | 'rejected';
}

export interface DraftPickDisplay {
  round: number;
  pick: number;
  playerName: string;
  playerId: number;
  managerName: string;
  leagueEntryId: number;
  wasAuto: boolean;
}

export interface Prediction {
  leagueEntryId: number;
  teamName: string;
  playerName: string;
  predictedPoints: number;
  playerBreakdown: {
    playerId: number;
    playerName: string;
    expectedPoints: number;
    fixtureDifficulty: number;
  }[];
  opponent: {
    leagueEntryId: number;
    teamName: string;
  } | null;
}

export interface BenchData {
  leagueEntryId: number;
  teamName: string;
  playerName: string;
  totalBenchPoints: number;
  perGameweek: {
    gw: number;
    benchPoints: number;
  }[];
}

export interface WhatIfResult {
  leagueEntryId: number;
  teamName: string;
  playerName: string;
  actualRank: number;
  actualLeaguePoints: number;
  averageWhatIfRank: number;
  bestWhatIfRank: number;
  worstWhatIfRank: number;
  averageWhatIfPoints: number;
  luck: number; // positive = lucky (actual rank better than average what-if), negative = unlucky
  schedules: {
    asScheduleOf: number; // leagueEntryId whose schedule was used
    asScheduleOfName: string;
    wins: number;
    draws: number;
    losses: number;
    leaguePoints: number;
    rank: number;
  }[];
}

export interface DashboardData {
  meta: DashboardMeta;
  standings: Standing[];
  managers: Manager[];
  gameweekHistory: GameweekSnapshot[];
  h2hMatrix: H2HRecord[];
  playerStats: PlayerStat[];
  freeAgents: PlayerStat[];
  powerRankings: PowerRank[];
  transactions: TransactionDisplay[];
  draftPicks: DraftPickDisplay[];
  predictions: Prediction[];
  benchAnalysis: BenchData[];
  whatIf: WhatIfResult[];
}
