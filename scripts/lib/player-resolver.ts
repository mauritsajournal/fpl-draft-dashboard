import type { BootstrapResponse, BootstrapPlayer } from '../types/api.js';

const POSITION_MAP: Record<number, string> = {
  1: 'GK',
  2: 'DEF',
  3: 'MID',
  4: 'FWD',
};

export class PlayerResolver {
  private players: Map<number, BootstrapPlayer>;
  private teams: Map<number, { name: string; shortName: string }>;

  constructor(bootstrap: BootstrapResponse) {
    this.players = new Map();
    this.teams = new Map();

    for (const p of bootstrap.elements) {
      this.players.set(p.id, p);
    }

    for (const t of bootstrap.teams) {
      this.teams.set(t.id, { name: t.name, shortName: t.short_name });
    }
  }

  getPlayer(id: number): BootstrapPlayer | undefined {
    return this.players.get(id);
  }

  getName(id: number): string {
    return this.players.get(id)?.web_name ?? `Unknown (${id})`;
  }

  getFullName(id: number): { first: string; last: string } {
    const p = this.players.get(id);
    return {
      first: p?.first_name ?? '',
      last: p?.second_name ?? '',
    };
  }

  getTeamName(teamId: number): string {
    return this.teams.get(teamId)?.name ?? `Team ${teamId}`;
  }

  getTeamShortName(teamId: number): string {
    return this.teams.get(teamId)?.shortName ?? '???';
  }

  getPosition(elementType: number): string {
    return POSITION_MAP[elementType] ?? 'UNK';
  }

  getAllPlayers(): BootstrapPlayer[] {
    return [...this.players.values()];
  }
}
