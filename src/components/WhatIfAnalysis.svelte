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

  // Sort by luck descending (luckiest first)
  const sorted = [...whatIf].sort((a, b) => b.luck - a.luck);

  function luckLabel(luck: number): string {
    if (luck >= 1.5) return 'Very Lucky';
    if (luck >= 0.5) return 'Lucky';
    if (luck > -0.5) return 'Neutral';
    if (luck > -1.5) return 'Unlucky';
    return 'Very Unlucky';
  }

  function luckColor(luck: number): string {
    if (luck >= 1.5) return 'text-green-400';
    if (luck >= 0.5) return 'text-green-300';
    if (luck > -0.5) return 'text-gray-400';
    if (luck > -1.5) return 'text-red-300';
    return 'text-red-400';
  }

  function luckBg(luck: number): string {
    if (luck >= 0.5) return 'bg-green-500/10';
    if (luck > -0.5) return '';
    return 'bg-red-500/10';
  }

  function rankDiff(actual: number, avg: number): string {
    const diff = avg - actual;
    if (diff > 0) return `+${diff.toFixed(1)}`;
    if (diff < 0) return diff.toFixed(1);
    return '0';
  }
</script>

<div class="space-y-6">
  <!-- Summary cards: luckiest and unluckiest -->
  <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
    <div class="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
      <div class="text-xs text-green-400 uppercase tracking-wide mb-1">Luckiest Manager</div>
      <div class="text-lg font-bold text-white">{sorted[0]?.playerName}</div>
      <div class="text-sm text-gray-400 mt-1">
        Actual rank: <span class="text-white font-mono">{sorted[0]?.actualRank}</span>
        &mdash; Average what-if rank: <span class="text-white font-mono">{sorted[0]?.averageWhatIfRank}</span>
      </div>
      <div class="text-sm text-green-300 mt-1">
        Would finish {sorted[0]?.averageWhatIfRank.toFixed(1)} on average across all fixture schedules
      </div>
    </div>
    <div class="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
      <div class="text-xs text-red-400 uppercase tracking-wide mb-1">Unluckiest Manager</div>
      <div class="text-lg font-bold text-white">{sorted[sorted.length - 1]?.playerName}</div>
      <div class="text-sm text-gray-400 mt-1">
        Actual rank: <span class="text-white font-mono">{sorted[sorted.length - 1]?.actualRank}</span>
        &mdash; Average what-if rank: <span class="text-white font-mono">{sorted[sorted.length - 1]?.averageWhatIfRank}</span>
      </div>
      <div class="text-sm text-red-300 mt-1">
        Would finish {sorted[sorted.length - 1]?.averageWhatIfRank.toFixed(1)} on average across all fixture schedules
      </div>
    </div>
  </div>

  <!-- Full table -->
  <div class="bg-fpl-card rounded-lg border border-white/5 overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-white/10 text-gray-400">
          <th class="text-left py-3 px-4">Manager</th>
          <th class="text-center py-3 px-3">Actual Rank</th>
          <th class="text-center py-3 px-3">Avg What-If</th>
          <th class="text-center py-3 px-3">Best</th>
          <th class="text-center py-3 px-3">Worst</th>
          <th class="text-center py-3 px-3">Avg Pts</th>
          <th class="text-center py-3 px-3">Luck</th>
          <th class="text-center py-3 px-3">Verdict</th>
        </tr>
      </thead>
      <tbody>
        {#each sorted as entry}
          <tr class="border-b border-white/5 {luckBg(entry.luck)} {entry.leagueEntryId === 27137 ? 'ring-1 ring-fpl-green/30' : ''}">
            <td class="py-3 px-4">
              <div class="text-white font-medium">{entry.playerName}</div>
              <div class="text-xs text-gray-500">{entry.teamName}</div>
            </td>
            <td class="text-center py-3 px-3 text-white font-mono font-bold">{entry.actualRank}</td>
            <td class="text-center py-3 px-3 text-gray-300 font-mono">{entry.averageWhatIfRank}</td>
            <td class="text-center py-3 px-3 text-green-400 font-mono">{entry.bestWhatIfRank}</td>
            <td class="text-center py-3 px-3 text-red-400 font-mono">{entry.worstWhatIfRank}</td>
            <td class="text-center py-3 px-3 text-gray-300 font-mono">{entry.averageWhatIfPoints}</td>
            <td class="text-center py-3 px-3 font-mono {luckColor(entry.luck)}">{entry.luck > 0 ? '+' : ''}{entry.luck}</td>
            <td class="text-center py-3 px-3 {luckColor(entry.luck)} text-xs font-medium">{luckLabel(entry.luck)}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  </div>

  <!-- Methodology -->
  <div class="bg-fpl-card/50 rounded-lg p-4 border border-white/5">
    <h4 class="text-sm font-bold text-gray-400 mb-2">How it works</h4>
    <p class="text-xs text-gray-500 leading-relaxed">
      For each manager, we simulate the season using every other manager's fixture schedule.
      The manager's actual gameweek scores stay the same, but they face different opponents.
      This reveals how much the draw influenced the standings. A positive luck score means
      the manager's actual rank is better than their average simulated rank — they benefited
      from the fixture schedule.
    </p>
  </div>
</div>
