// Fetch state tracking — persisted in data/meta.json

export interface FetchMeta {
  lastFetchedGameweek: number;
  lastUpdated: string; // ISO timestamp
  currentSeason: string; // "2025-26"
  draftFetched: boolean;
}
