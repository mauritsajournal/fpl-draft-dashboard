<script lang="ts">
  interface WhatIfEntry {
    leagueEntryId: number;
    teamName: string;
    playerName: string;
    actualRank: number;
    actualLeaguePoints: number;
    averageWhatIfRank: number;
    bestWhatIfRank: number;
    worstWhatIfRank: number;
    averageWhatIfPoints: number;
    luck: number;
  }

  interface Props {
    data: string;
  }

  let { data }: Props = $props();
  const whatIf: WhatIfEntry[] = JSON.parse(data);

  const sorted = [...whatIf].sort((a, b) => b.luck - a.luck);

  function luckLabel(luck: number): string {
    if (luck >= 1.5) return 'Very Lucky';
    if (luck >= 0.5) return 'Lucky';
    if (luck > -0.5) return 'Neutral';
    if (luck > -1.5) return 'Unlucky';
    return 'Very Unlucky';
  }

  function luckColor(luck: number): string {
    if (luck >= 1.5) return 'text-emerald-400';
    if (luck >= 0.5) return 'text-emerald-300';
    if (luck > -0.5) return 'text-slate-400';
    if (luck > -1.5) return 'text-rose-300';
    return 'text-rose-400';
  }

  function luckBg(luck: number): string {
    if (luck >= 0.5) return 'bg-emerald-500/5';
    if (luck > -0.5) return '';
    return 'bg-rose-500/5';
  }
</script>

<div class="space-y-6">
  <!-- Summary cards -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div class="glass-card p-5" style="border-color: rgba(52, 211, 153, 0.15);">
      <div class="section-label text-emerald-400 mb-2">Luckiest Manager</div>
      <div class="text-xl font-bold text-white">{sorted[0]?.playerName}</div>
      <div class="text-sm text-slate-400 mt-2">
        Actual rank: <span class="text-white font-mono font-bold">{sorted[0]?.actualRank}</span>
        &mdash; Avg what-if: <span class="text-white font-mono font-bold">{sorted[0]?.averageWhatIfRank}</span>
      </div>
      <div class="text-sm text-emerald-300/70 mt-1">
        Would finish {sorted[0]?.averageWhatIfRank.toFixed(1)} on average across all fixture schedules
      </div>
    </div>
    <div class="glass-card p-5" style="border-color: rgba(244, 63, 94, 0.15);">
      <div class="section-label text-rose-400 mb-2">Unluckiest Manager</div>
      <div class="text-xl font-bold text-white">{sorted[sorted.length - 1]?.playerName}</div>
      <div class="text-sm text-slate-400 mt-2">
        Actual rank: <span class="text-white font-mono font-bold">{sorted[sorted.length - 1]?.actualRank}</span>
        &mdash; Avg what-if: <span class="text-white font-mono font-bold">{sorted[sorted.length - 1]?.averageWhatIfRank}</span>
      </div>
      <div class="text-sm text-rose-300/70 mt-1">
        Would finish {sorted[sorted.length - 1]?.averageWhatIfRank.toFixed(1)} on average across all fixture schedules
      </div>
    </div>
  </div>

  <!-- Full table -->
  <div class="glass-card overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-white/5 text-slate-500">
          <th class="text-left py-3 px-4 font-medium">Manager</th>
          <th class="text-center py-3 px-3 font-medium">Actual</th>
          <th class="text-center py-3 px-3 font-medium">Avg What-If</th>
          <th class="text-center py-3 px-3 font-medium hidden sm:table-cell">Best</th>
          <th class="text-center py-3 px-3 font-medium hidden sm:table-cell">Worst</th>
          <th class="text-center py-3 px-3 font-medium hidden md:table-cell">Avg Pts</th>
          <th class="text-center py-3 px-3 font-medium">Luck</th>
          <th class="text-center py-3 px-3 font-medium">Verdict</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-white/5">
        {#each sorted as entry}
          <tr class="table-row-hover {luckBg(entry.luck)} {entry.leagueEntryId === 27137 ? 'bg-emerald-500/5' : ''}">
            <td class="py-3 px-4">
              <div class="text-white font-medium">{entry.playerName}</div>
              <div class="text-xs text-slate-600">{entry.teamName}</div>
            </td>
            <td class="text-center py-3 px-3 text-white font-mono font-bold">{entry.actualRank}</td>
            <td class="text-center py-3 px-3 text-slate-300 font-mono">{entry.averageWhatIfRank}</td>
            <td class="text-center py-3 px-3 text-emerald-400 font-mono hidden sm:table-cell">{entry.bestWhatIfRank}</td>
            <td class="text-center py-3 px-3 text-rose-400 font-mono hidden sm:table-cell">{entry.worstWhatIfRank}</td>
            <td class="text-center py-3 px-3 text-slate-300 font-mono hidden md:table-cell">{entry.averageWhatIfPoints}</td>
            <td class="text-center py-3 px-3 font-mono font-semibold {luckColor(entry.luck)}">{entry.luck > 0 ? '+' : ''}{entry.luck}</td>
            <td class="text-center py-3 px-3 {luckColor(entry.luck)} text-xs font-semibold">{luckLabel(entry.luck)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Methodology -->
  <div class="glass-card-sm p-4">
    <h4 class="text-sm font-bold text-slate-400 mb-2">How it works</h4>
    <p class="text-xs text-slate-500 leading-relaxed">
      For each manager, we simulate the season using every other manager's fixture schedule.
      The manager's actual gameweek scores stay the same, but they face different opponents.
      This reveals how much the draw influenced the standings. A positive luck score means
      the manager's actual rank is better than their average simulated rank.
    </p>
  </div>
</div>
