<script lang="ts">
  interface Match {
    event: number;
    entry1: number;
    entry1Name: string;
    entry1Team: string;
    entry1Points: number;
    entry2: number;
    entry2Name: string;
    entry2Team: string;
    entry2Points: number;
    winner: number | null;
  }

  interface Props {
    matches: string;
    maxGw: number;
  }

  let { matches, maxGw }: Props = $props();

  const allMatches: Match[] = JSON.parse(matches);
  let currentGw = $state(maxGw);

  $effect(() => {
    if (currentGw < 1) currentGw = 1;
    if (currentGw > maxGw) currentGw = maxGw;
  });

  let gwMatches = $derived(allMatches.filter(m => m.event === currentGw));

  function prev() {
    if (currentGw > 1) currentGw--;
  }

  function next() {
    if (currentGw < maxGw) currentGw++;
  }
</script>

<div class="space-y-4">
  <!-- Slider -->
  <div class="glass-card-sm flex items-center gap-3 px-4 py-3">
    <span class="text-sm text-slate-400 whitespace-nowrap font-medium">Gameweek</span>

    <button
      onclick={prev}
      disabled={currentGw <= 1}
      class="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-400 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
      aria-label="Previous gameweek"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
      </svg>
    </button>

    <div class="flex items-center gap-2 flex-1 min-w-0">
      <input
        type="range"
        min="1"
        max={maxGw}
        bind:value={currentGw}
        class="flex-1 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-emerald-400 [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:shadow-emerald-400/30"
      />
      <span class="text-lg font-bold text-emerald-400 tabular-nums min-w-[3ch] text-center">
        {currentGw}
      </span>
    </div>

    <button
      onclick={next}
      disabled={currentGw >= maxGw}
      class="w-8 h-8 flex items-center justify-center rounded-lg bg-white/5 text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-400 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
      aria-label="Next gameweek"
    >
      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
      </svg>
    </button>
  </div>

  <!-- Match Results -->
  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
    {#each gwMatches as match}
      <div class="glass-card-sm p-4">
        <div class="flex items-center justify-between gap-2">
          <!-- Manager 1 -->
          <div class="flex-1 text-left {match.entry1Points > match.entry2Points ? 'opacity-100' : 'opacity-50'}">
            <div class="text-sm font-semibold text-white">{match.entry1Name}</div>
            <div class="text-xs text-slate-600">{match.entry1Team}</div>
          </div>

          <!-- Score -->
          <div class="flex items-center gap-2 px-3">
            <span class="text-xl font-extrabold tabular-nums {match.entry1Points > match.entry2Points ? 'text-emerald-400' : match.entry1Points === match.entry2Points ? 'text-slate-400' : 'text-slate-600'}">
              {match.entry1Points}
            </span>
            <span class="text-slate-700 text-xs font-medium">v</span>
            <span class="text-xl font-extrabold tabular-nums {match.entry2Points > match.entry1Points ? 'text-emerald-400' : match.entry2Points === match.entry1Points ? 'text-slate-400' : 'text-slate-600'}">
              {match.entry2Points}
            </span>
          </div>

          <!-- Manager 2 -->
          <div class="flex-1 text-right {match.entry2Points > match.entry1Points ? 'opacity-100' : 'opacity-50'}">
            <div class="text-sm font-semibold text-white">{match.entry2Name}</div>
            <div class="text-xs text-slate-600">{match.entry2Team}</div>
          </div>
        </div>
      </div>
    {/each}

    {#if gwMatches.length === 0}
      <div class="col-span-full text-center py-8 text-slate-500">
        No matches found for Gameweek {currentGw}
      </div>
    {/if}
  </div>
</div>
