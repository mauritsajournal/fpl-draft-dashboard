import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Load real dashboard data for integration-style tests
const DATA_DIR = path.resolve(import.meta.dirname, '../data');
const dashboardPath = path.join(DATA_DIR, 'dashboard.json');

const hasDashboard = fs.existsSync(dashboardPath);
const dashboard = hasDashboard
  ? JSON.parse(fs.readFileSync(dashboardPath, 'utf-8'))
  : null;

describe.skipIf(!hasDashboard)('dashboard.json structure', () => {
  it('has all required top-level keys', () => {
    const keys = Object.keys(dashboard);
    expect(keys).toContain('meta');
    expect(keys).toContain('standings');
    expect(keys).toContain('managers');
    expect(keys).toContain('gameweekHistory');
    expect(keys).toContain('h2hMatrix');
    expect(keys).toContain('playerStats');
    expect(keys).toContain('freeAgents');
    expect(keys).toContain('powerRankings');
    expect(keys).toContain('transactions');
    expect(keys).toContain('draftPicks');
    expect(keys).toContain('predictions');
    expect(keys).toContain('benchAnalysis');
  });

  it('meta has correct structure', () => {
    const meta = dashboard.meta;
    expect(meta.leagueName).toBe('FC Driegangendiner');
    expect(meta.currentGameweek).toBeGreaterThan(0);
    expect(meta.season).toBe('2025-26');
    expect(meta.dataAvailable).toBeDefined();
    expect(meta.dataAvailable.standings).toBe(true);
  });
});

describe.skipIf(!hasDashboard)('standings calculation', () => {
  it('has exactly 8 entries', () => {
    expect(dashboard.standings).toHaveLength(8);
  });

  it('ranks are 1-8', () => {
    const ranks = dashboard.standings.map((s: any) => s.rank);
    expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('W + D + L is consistent across all entries', () => {
    // Note: API's matches_played = total scheduled (38), not actual played
    // So we check W+D+L consistency instead
    const firstTotal = dashboard.standings[0].won + dashboard.standings[0].drawn + dashboard.standings[0].lost;
    for (const s of dashboard.standings) {
      expect(s.won + s.drawn + s.lost).toBe(firstTotal);
    }
  });

  it('league points are consistent (W*3 + D*1)', () => {
    for (const s of dashboard.standings) {
      expect(s.leaguePoints).toBe(s.won * 3 + s.drawn);
    }
  });

  it('standings are sorted by league points descending', () => {
    for (let i = 0; i < dashboard.standings.length - 1; i++) {
      expect(dashboard.standings[i].leaguePoints)
        .toBeGreaterThanOrEqual(dashboard.standings[i + 1].leaguePoints);
    }
  });

  it('every entry has valid team name and player name', () => {
    for (const s of dashboard.standings) {
      expect(s.teamName).toBeTruthy();
      expect(s.playerName).toBeTruthy();
      expect(s.entryId).toBeGreaterThan(0);
    }
  });
});

describe.skipIf(!hasDashboard)('managers', () => {
  it('has 8 managers', () => {
    expect(dashboard.managers).toHaveLength(8);
  });

  it('each manager has valid stats', () => {
    for (const m of dashboard.managers) {
      expect(m.totalPoints).toBeGreaterThan(0);
      expect(m.averagePoints).toBeGreaterThan(0);
      expect(m.bestGw.points).toBeGreaterThanOrEqual(m.worstGw.points);
      expect(m.currentForm).toBeInstanceOf(Array);
      expect(m.currentForm.length).toBeLessThanOrEqual(5);
    }
  });

  it('wins + draws + losses matches standings', () => {
    for (const m of dashboard.managers) {
      const standing = dashboard.standings.find(
        (s: any) => s.leagueEntryId === m.leagueEntryId
      );
      if (standing) {
        expect(m.wins).toBe(standing.won);
        expect(m.draws).toBe(standing.drawn);
        expect(m.losses).toBe(standing.lost);
      }
    }
  });
});

describe.skipIf(!hasDashboard)('H2H matrix', () => {
  it('has correct number of pairs (8 choose 2 = 28)', () => {
    expect(dashboard.h2hMatrix).toHaveLength(28);
  });

  it('each record has valid structure', () => {
    for (const rec of dashboard.h2hMatrix) {
      expect(rec.managerA).toBeDefined();
      expect(rec.managerB).toBeDefined();
      expect(rec.wins + rec.draws + rec.losses).toBeGreaterThanOrEqual(0);
      expect(rec.matches).toBeInstanceOf(Array);
    }
  });

  it('W + D + L equals number of H2H matches', () => {
    for (const rec of dashboard.h2hMatrix) {
      expect(rec.wins + rec.draws + rec.losses).toBe(rec.matches.length);
    }
  });

  it('points sum matches pointsFor/Against', () => {
    for (const rec of dashboard.h2hMatrix) {
      const pf = rec.matches.reduce((sum: number, m: any) => sum + m.pointsA, 0);
      const pa = rec.matches.reduce((sum: number, m: any) => sum + m.pointsB, 0);
      expect(rec.pointsFor).toBe(pf);
      expect(rec.pointsAgainst).toBe(pa);
    }
  });
});

describe.skipIf(!hasDashboard)('gameweek history', () => {
  it('has entries for each completed GW', () => {
    expect(dashboard.gameweekHistory.length).toBe(dashboard.meta.currentGameweek);
  });

  it('each snapshot has 8 standings entries', () => {
    for (const snap of dashboard.gameweekHistory) {
      expect(snap.standings).toHaveLength(8);
    }
  });

  it('ranks are 1-8 in each snapshot', () => {
    for (const snap of dashboard.gameweekHistory) {
      const ranks = snap.standings.map((s: any) => s.rank).sort((a: number, b: number) => a - b);
      expect(ranks).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    }
  });

  it('cumulative points are non-decreasing', () => {
    for (const entry of dashboard.managers) {
      const entryHistory = dashboard.gameweekHistory.map((snap: any) =>
        snap.standings.find((s: any) => s.leagueEntryId === entry.leagueEntryId)
      ).filter(Boolean);

      for (let i = 1; i < entryHistory.length; i++) {
        expect(entryHistory[i].cumulativePoints)
          .toBeGreaterThanOrEqual(entryHistory[i - 1].cumulativePoints);
      }
    }
  });
});

describe.skipIf(!hasDashboard)('player stats', () => {
  it('owned players are all assigned to a manager', () => {
    for (const p of dashboard.playerStats) {
      expect(p.owner).toBeTruthy();
      expect(p.ownerLeagueEntryId).toBeGreaterThan(0);
    }
  });

  it('free agents have no owner', () => {
    for (const p of dashboard.freeAgents) {
      expect(p.owner).toBeNull();
    }
  });

  it('players have valid position', () => {
    const validPositions = ['GK', 'DEF', 'MID', 'FWD'];
    for (const p of [...dashboard.playerStats, ...dashboard.freeAgents.slice(0, 20)]) {
      expect(validPositions).toContain(p.position);
    }
  });
});

describe.skipIf(!hasDashboard)('bench analysis', () => {
  it('has 8 entries', () => {
    expect(dashboard.benchAnalysis).toHaveLength(8);
  });

  it('bench points are non-negative', () => {
    for (const b of dashboard.benchAnalysis) {
      expect(b.totalBenchPoints).toBeGreaterThanOrEqual(0);
    }
  });

  it('per-gameweek bench points sum to total', () => {
    for (const b of dashboard.benchAnalysis) {
      const sum = b.perGameweek.reduce((s: number, g: any) => s + g.benchPoints, 0);
      expect(sum).toBe(b.totalBenchPoints);
    }
  });
});

describe.skipIf(!hasDashboard)('transactions', () => {
  it('has transactions', () => {
    expect(dashboard.transactions.length).toBeGreaterThan(0);
  });

  it('each transaction has valid fields', () => {
    for (const t of dashboard.transactions.slice(0, 20)) {
      expect(t.playerIn).toBeTruthy();
      expect(t.playerOut).toBeTruthy();
      expect(['waiver', 'free_agent']).toContain(t.type);
      expect(['accepted', 'rejected']).toContain(t.result);
    }
  });
});

describe.skipIf(!hasDashboard)('draft picks', () => {
  it('has 120 picks (15 rounds x 8 teams)', () => {
    expect(dashboard.draftPicks).toHaveLength(120);
  });

  it('picks have valid round and pick numbers', () => {
    for (const p of dashboard.draftPicks) {
      expect(p.round).toBeGreaterThanOrEqual(1);
      expect(p.round).toBeLessThanOrEqual(15);
      expect(p.playerName).toBeTruthy();
    }
  });
});

describe.skipIf(!hasDashboard)('power rankings', () => {
  it('has 8 entries', () => {
    expect(dashboard.powerRankings).toHaveLength(8);
  });

  it('scores are between 0 and 100', () => {
    for (const r of dashboard.powerRankings) {
      expect(r.score).toBeGreaterThanOrEqual(0);
      expect(r.score).toBeLessThanOrEqual(100);
    }
  });

  it('rankings are sorted by score descending', () => {
    for (let i = 0; i < dashboard.powerRankings.length - 1; i++) {
      expect(dashboard.powerRankings[i].score)
        .toBeGreaterThanOrEqual(dashboard.powerRankings[i + 1].score);
    }
  });
});
