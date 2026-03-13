<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  interface Props {
    minGw?: number;
    maxGw: number;
    initialGw?: number;
    label?: string;
  }

  let { minGw = 1, maxGw, initialGw, label = 'Gameweek' }: Props = $props();

  const dispatch = createEventDispatcher<{ change: number }>();

  let currentGw = $state(initialGw ?? maxGw);

  function prev() {
    if (currentGw > minGw) {
      currentGw--;
      dispatch('change', currentGw);
    }
  }

  function next() {
    if (currentGw < maxGw) {
      currentGw++;
      dispatch('change', currentGw);
    }
  }

  function onInput(e: Event) {
    const target = e.target as HTMLInputElement;
    currentGw = parseInt(target.value, 10);
    dispatch('change', currentGw);
  }
</script>

<div class="flex items-center gap-3 bg-fpl-card rounded-lg px-4 py-2 border border-white/5">
  <span class="text-sm text-gray-400 whitespace-nowrap">{label}</span>

  <button
    onclick={prev}
    disabled={currentGw <= minGw}
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
      min={minGw}
      max={maxGw}
      value={currentGw}
      oninput={onInput}
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
