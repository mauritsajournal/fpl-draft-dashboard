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

<div class="glass-card-sm flex items-center gap-3 px-4 py-3">
  <span class="text-sm text-slate-400 whitespace-nowrap font-medium">{label}</span>

  <button
    onclick={prev}
    disabled={currentGw <= minGw}
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
      min={minGw}
      max={maxGw}
      value={currentGw}
      oninput={onInput}
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
