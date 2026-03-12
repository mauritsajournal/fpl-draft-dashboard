// Types for FPL Draft API responses — verified against real API (2026-03-12)

// === Bootstrap Static ===
export interface BootstrapPlayer {
  id: number;
  web_name: string;
  first_name: string;
  second_name: string;
  team: number;
  element_type: number; // 1=GK, 2=DEF, 3=MID, 4=FWD
  total_points: number;
  form: string; // numeric string e.g. "6.2"
  expected_goals: string; // xG as string e.g. "6.84"
  expected_assists: string; // xA as string
  expected_goal_involvements: string; // xGI as string
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  own_goals: number;
  penalties_saved: number;
  penalties_missed: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  bonus: number;
  bps: number;
  ict_index: string;
  influence: string;
  creativity: string;
  threat: string;
  starts: number;
  status: string; // "a" available, "u" unavailable, "i" injured, "d" doubtful, "s" suspended
  chance_of_playing_next_round: number | null;
  news: string;
  news_added: string | null;
  points_per_game: string;
  selected_by_percent: string;
  now_cost: number;
}

export interface BootstrapTeam {
  id: number;
  name: string;
  short_name: string;
  strength: number;
  strength_overall_home: number;
  strength_overall_away: number;
  strength_attack_home: number;
  strength_attack_away: number;
  strength_defence_home: number;
  strength_defence_away: number;
}

export interface BootstrapEvent {
  id: number;
  name: string;
  deadline_time: string;
  finished: boolean;
  is_current: boolean;
  is_next: boolean;
  is_previous: boolean;
}

export interface BootstrapResponse {
  elements: BootstrapPlayer[];
  teams: BootstrapTeam[];
  events: BootstrapEvent[];
  element_types: { id: number; singular_name: string; plural_name: string }[];
}

// === League Details ===
export interface LeagueInfo {
  id: number;
  name: string;
  scoring: string;
  draft_dt: string;
  draft_pick_time_limit: number;
  draft_status: string;
  max_entries: number;
  min_entries: number;
  start_event: number;
  ko_rounds: number;
}

export interface LeagueEntry {
  entry_id: number;
  entry_name: string;
  id: number; // league_entry id
  joined_time: string;
  player_first_name: string;
  player_last_name: string;
  short_name: string;
  waiver_pick: number;
}

export interface LeagueMatch {
  event: number;
  finished: boolean;
  league_entry_1: number; // league_entry id
  league_entry_1_points: number;
  league_entry_2: number;
  league_entry_2_points: number;
  started: boolean;
  winning_league_entry: number | null;
  winning_method: string | null;
}

export interface LeagueStanding {
  last_rank: number;
  league_entry: number;
  matches_drawn: number;
  matches_lost: number;
  matches_played: number;
  matches_won: number;
  points_against: number;
  points_for: number;
  rank: number;
  total: number; // league points (W=3, D=1, L=0)
}

export interface LeagueResponse {
  league: LeagueInfo;
  league_entries: LeagueEntry[];
  matches: LeagueMatch[];
  standings: LeagueStanding[];
}

// === Element Status ===
export interface ElementStatus {
  element: number;
  owner: number | null; // league_entry id or null if available
  status: 'a' | 'o'; // "a" = available, "o" = owned
  in_accepted_trade: boolean;
}

export interface ElementStatusResponse {
  element_status: ElementStatus[];
}

// === Entry Event Picks ===
export interface Pick {
  element: number;
  position: number; // 1-11 = starting, 12-15 = bench
  is_captain: boolean;
  is_vice_captain: boolean;
  multiplier: number;
}

export interface EntryHistory {
  event: number;
  points: number;
  total_points: number;
  rank: number | null;
  rank_sort: number | null;
  event_transfers: number;
  points_on_bench: number;
}

export interface Sub {
  element_in: number;
  element_out: number;
  event: number;
}

export interface EntryEventResponse {
  picks: Pick[];
  entry_history: EntryHistory;
  subs: Sub[];
}

// === Live Event Stats ===
export interface LivePlayerStats {
  minutes: number;
  goals_scored: number;
  assists: number;
  clean_sheets: number;
  goals_conceded: number;
  own_goals: number;
  penalties_saved: number;
  penalties_missed: number;
  yellow_cards: number;
  red_cards: number;
  saves: number;
  bonus: number;
  bps: number;
  total_points: number;
  expected_goals: string;
  expected_assists: string;
  expected_goal_involvements: string;
}

export interface LiveElement {
  stats: LivePlayerStats;
}

export interface LiveEventResponse {
  elements: Record<string, LiveElement>;
}

// === Transactions ===
export interface Transaction {
  id: number;
  entry: number; // league_entry id
  event: number;
  element_in: number;
  element_out: number;
  kind: 'w' | 'f'; // w = waiver, f = free agent
  result: 'a' | 'di' | 'do'; // a = accepted, di = rejected (higher priority), do = rejected (other)
  priority: number;
  index: number;
}

export type TransactionsResponse = Transaction[];

// === Draft Choices ===
export interface DraftChoice {
  round: number;
  pick: number;
  element: number;
  entry: number; // league_entry id
  entry_name: string;
  player_first_name: string;
  player_last_name: string;
  was_auto: boolean;
  choice_time: string;
}

export interface DraftChoicesResponse {
  choices: DraftChoice[];
}

// === Fixtures (Regular FPL API) ===
export interface Fixture {
  id: number;
  event: number | null;
  team_h: number;
  team_a: number;
  team_h_score: number | null;
  team_a_score: number | null;
  team_h_difficulty: number;
  team_a_difficulty: number;
  finished: boolean;
  kickoff_time: string | null;
  started: boolean;
}

export type FixturesResponse = Fixture[];
