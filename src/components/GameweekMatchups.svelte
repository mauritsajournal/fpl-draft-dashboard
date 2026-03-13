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
    // keep currentGw in bounds
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
  <div class="flex items-center gap-3 bg-fpl-card rounded-lg px-4 py-2 border border-white/5">
    <span class="text-sm text-gray-400 whitespace-nowrap">Gameweek</span>

    <button
      onclick={prev}
      disabled={currentGw <= 1}
      class="w-8 h-8 flex items-center justify-center rounded bg-fpl-surface text-white hover:bg-fpl-green hover:text-fpl-purple disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
        class="flex-1 h-1.5 bg-fpl-surface rounded-full appearance-none cursor-pointer accent-fpl-green [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-fpl-green [&::-webkit-slider-thumb]:cursor-pointer"
      />
      <span class="text-lg font-bold text-fpl-green tabular-nums min-w-[3ch] text-center">
        {currentGw}
      </span>
    </div>

    <button
      onclick={next}
      disabled={currentGw >= maxGw}
      class="w-8 h-8 flex items-center justify-center rounded bg-fpl-surface text-white hover:bg-fpl-green hover:text-fpl-purple disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
      <div class="bg-fpl-card rounded-lg p-4 border border-white/5">
        <div class="flex items-center justify-between gap-2">
          <!-- Manager 1 -->
          <div class="flex-1 text-left {match.entry1Points > match.entry2Points ? 'opacity-100' : 'opacity-60'}">
            <div class="text-sm font-bold text-white">{match.entry1Name}</div>
            <div class="text-xs text-gray-500">{match.entry1Team}</div>
          </div>

          <!-- Score -->
          <div class="flex items-center gap-2 px-3">
            <span class="text-xl font-bold {match.entry1Points > match.entry2Points ? 'text-fpl-green' : match.entry1Points === match.entry2Points ? 'text-gray-400' : 'text-gray-500'}">
              {match.entry1Points}
            </span>
            <span class="text-gray-600 text-xs">v</span>
            <span class="text-xl font-bold {match.entry2Points > match.entry1Points ? 'text-fpl-green' : match.entry2Points === match.entry1Points ? 'text-gray-400' : 'text-gray-500'}">
              {match.entry2Points}
            </span>
          </div>

          <!-- Manager 2 -->
          <div class="flex-1 text-right {match.entry2Points > match.entry1Points ? 'opacity-100' : 'opacity-60'}">
            <div class="text-sm font-bold text-white">{match.entry2Name}</div>
            <div class="text-xs text-gray-500">{match.entry2Team}</div>
          </div>
        </div>
      </div>
    {/each}

    {#if gwMatches.length === 0}
      <div class="col-span-full text-center py-8 text-gray-500">
        No matches found for Gameweek {currentGw}
      </div>
    {/if}
  </div>
</div>
