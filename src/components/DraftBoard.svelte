<script lang="ts">
  interface Player {
    id: string; rank: number; name: string; country: string; flag: string;
    group: string; pos: string; tier: number; priority: string;
    setPieces: string; expectedPts: number | null; clubStats: string; notes: string;
    teamStrength: number | null; expectedGames: number | null;
    pen: boolean; fk: boolean; corner: boolean;
  }
  interface Tier { tier: number; name: string; rounds: string; }
  interface Props { data: string; }

  const { data }: Props = $props();
  const parsed = JSON.parse(data) as { tiers: Tier[]; players: Player[] };
  const tiers = parsed.tiers;
  const players = parsed.players;

  const STORAGE_KEY = 'wc-draft-taken-v1';
  const POS = ['GK', 'DEF', 'MID', 'FWD'] as const;

  function loadTaken(): Record<string, boolean> {
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
      if (!raw) return {};
      const arr = JSON.parse(raw) as string[];
      return Object.fromEntries(arr.map((id) => [id, true]));
    } catch { return {}; }
  }

  let taken = $state<Record<string, boolean>>(loadTaken());
  let query = $state('');
  let posFilter = $state<'ALL' | 'GK' | 'DEF' | 'MID' | 'FWD'>('ALL');
  let hideTaken = $state(false);
  let compact = $state(false);
  let showResetConfirm = $state(false);

  // Persist taken set
  $effect(() => {
    try {
      const ids = Object.keys(taken).filter((id) => taken[id]);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {}
  });

  function norm(s: string): string {
    return (s || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase();
  }
  const nq = $derived(norm(query.trim()));

  function matches(p: Player): boolean {
    if (!nq) return false;
    return (
      norm(p.name).includes(nq) ||
      norm(p.country).includes(nq) ||
      norm(p.clubStats).includes(nq) ||
      norm(p.pos).includes(nq) ||
      ('group ' + p.group).toLowerCase().includes(nq) ||
      norm(p.group) === nq
    );
  }

  // Players passing the (position) filter, grouped by tier
  const visible = $derived(
    players.filter((p) => (posFilter === 'ALL' || p.pos === posFilter) && (!hideTaken || !taken[p.id]))
  );
  const byTier = $derived(
    tiers.map((t) => ({ ...t, players: visible.filter((p) => p.tier === t.tier) })).filter((t) => t.players.length)
  );

  // Counters
  const takenCount = $derived(players.filter((p) => taken[p.id]).length);
  const remaining = $derived(players.length - takenCount);
  const remainingByPos = $derived(
    Object.fromEntries(POS.map((pos) => [pos, players.filter((p) => p.pos === pos && !taken[p.id]).length]))
  );
  const matchCount = $derived(nq ? players.filter(matches).length : 0);

  function toggle(p: Player) {
    taken = { ...taken, [p.id]: !taken[p.id] };
  }
  function onKey(e: KeyboardEvent, p: Player) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(p); }
  }
  function doReset() {
    taken = {};
    showResetConfirm = false;
  }

  // Auto-scroll to first search match
  let boardEl: HTMLElement | undefined = $state();
  $effect(() => {
    if (!nq || !boardEl) return;
    const first = players.find(matches);
    if (!first) return;
    const el = boardEl.querySelector(`[data-pid="${first.id}"]`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  // Styling helpers
  function posBorder(pos: string): string {
    return pos === 'GK' ? 'border-l-amber-400' : pos === 'DEF' ? 'border-l-blue-400'
      : pos === 'MID' ? 'border-l-emerald-400' : 'border-l-rose-400';
  }
  function posText(pos: string): string {
    return pos === 'GK' ? 'text-amber-300' : pos === 'DEF' ? 'text-blue-300'
      : pos === 'MID' ? 'text-emerald-300' : 'text-rose-300';
  }
  function posBg(pos: string): string {
    return pos === 'GK' ? 'bg-amber-400/15 text-amber-300' : pos === 'DEF' ? 'bg-blue-400/15 text-blue-300'
      : pos === 'MID' ? 'bg-emerald-400/15 text-emerald-300' : 'bg-rose-400/15 text-rose-300';
  }
  function prioBadge(prio: string): string {
    if (prio.startsWith('TOP')) return 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/30';
    if (prio.startsWith('HIGH')) return 'bg-orange-500/20 text-orange-300 ring-1 ring-orange-500/30';
    if (prio.startsWith('MED')) return 'bg-amber-500/15 text-amber-300 ring-1 ring-amber-500/25';
    return 'bg-slate-500/15 text-slate-400 ring-1 ring-slate-500/20';
  }
  function prioShort(prio: string): string {
    return prio.replace(' PRIO', '');
  }
</script>

<!-- Sticky control bar -->
<div class="sticky top-[60px] z-30 glass-card mb-6 p-3 sm:p-4">
  <div class="flex flex-col gap-3">
    <!-- Search + reset -->
    <div class="flex gap-2 items-center">
      <div class="relative flex-1">
        <svg class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        <input
          type="text"
          bind:value={query}
          placeholder="Zoek speler, land of club… (licht op)"
          class="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-9 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-fpl-cyan/50 focus:border-transparent"
        />
        {#if query}
          <button onclick={() => (query = '')} class="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white" aria-label="Wis zoekopdracht">✕</button>
        {/if}
      </div>
      <button
        onclick={() => (showResetConfirm = true)}
        class="shrink-0 px-3 py-2 rounded-lg text-sm font-medium bg-rose-500/10 text-rose-300 ring-1 ring-rose-500/30 hover:bg-rose-500/20 transition-colors"
      >
        ↺ Reset
      </button>
    </div>

    {#if nq}
      <div class="text-xs text-fpl-cyan -mt-1">{matchCount} treffer(s) opgelicht voor “{query}”.</div>
    {/if}

    <!-- Filters + counters -->
    <div class="flex flex-wrap items-center gap-2">
      <div class="flex gap-1 rounded-lg bg-white/5 p-1">
        {#each ['ALL', ...POS] as p}
          <button
            onclick={() => (posFilter = p as any)}
            class:list={['px-2.5 py-1 rounded-md text-xs font-semibold transition-colors', posFilter === p ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white']}
          >{p === 'ALL' ? 'Alle' : p}</button>
        {/each}
      </div>

      <label class="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
        <input type="checkbox" bind:checked={hideTaken} class="accent-fpl-green" /> Verberg gepakt
      </label>
      <label class="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
        <input type="checkbox" bind:checked={compact} class="accent-fpl-green" /> Compact
      </label>

      <div class="flex-1"></div>

      <!-- Remaining counters -->
      <div class="flex items-center gap-2 text-xs">
        <span class="text-slate-400"><span class="text-white font-bold tabular-nums">{remaining}</span> beschikbaar · <span class="text-slate-500 tabular-nums">{takenCount}</span> gepakt</span>
        <span class="hidden sm:flex gap-1.5">
          {#each POS as pos}
            <span class:list={['px-1.5 py-0.5 rounded tabular-nums', posBg(pos)]}>{pos} {remainingByPos[pos]}</span>
          {/each}
        </span>
      </div>
    </div>
  </div>
</div>

<!-- Board -->
<div bind:this={boardEl} class="space-y-8">
  {#if byTier.length === 0}
    <div class="glass-card p-10 text-center text-slate-400">Geen spelers voor deze filter.</div>
  {/if}

  {#each byTier as t}
    {@const tierRemaining = t.players.filter((p) => !taken[p.id]).length}
    <section>
      <div class="flex items-baseline gap-3 mb-3">
        <h2 class="text-lg font-bold text-white">
          <span class="text-fpl-green">Tier {t.tier}</span> · {t.name}
        </h2>
        <span class="text-xs text-slate-500">{t.rounds}</span>
        <div class="flex-1 h-px bg-gradient-to-r from-white/10 to-transparent"></div>
        <span class="text-xs text-slate-500 tabular-nums">{tierRemaining}/{t.players.length} over</span>
      </div>

      <div class:list={compact ? 'space-y-1.5' : 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3'}>
        {#each t.players as p (p.id)}
          {@const isTaken = !!taken[p.id]}
          {@const isMatch = matches(p)}
          {@const isDim = !!nq && !isMatch}
          <div
            data-pid={p.id}
            role="button"
            tabindex="0"
            onclick={() => toggle(p)}
            onkeydown={(e) => onKey(e, p)}
            class:list={[
              'group relative cursor-pointer rounded-xl border border-white/8 border-l-4 transition-all duration-200',
              compact ? 'px-3 py-2 flex items-center gap-3' : 'p-3',
              posBorder(p.pos),
              isTaken ? 'bg-white/[0.02] opacity-40 grayscale' : 'bg-white/[0.04] hover:bg-white/[0.07] hover:border-white/15',
              isMatch ? 'ring-2 ring-fpl-cyan shadow-[0_0_24px_rgba(4,245,255,0.35)] z-10' : '',
              isDim ? 'opacity-20' : '',
            ]}
          >
            {#if compact}
              <span class="text-slate-600 text-xs tabular-nums w-6 shrink-0">#{p.rank}</span>
              <span class="text-base shrink-0">{p.flag}</span>
              <span class:list={['font-semibold text-sm truncate', isTaken ? 'line-through text-slate-500' : 'text-white']}>{p.name}</span>
              <span class:list={['text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0', posBg(p.pos)]}>{p.pos}</span>
              <span class="text-xs text-slate-500 hidden sm:inline truncate">{p.country} · G{p.group}</span>
              <div class="flex-1"></div>
              <span class="flex gap-1 shrink-0">
                {#if p.pen}<span class="text-[9px] font-bold px-1 rounded bg-fpl-pink/20 text-fpl-pink">PEN</span>{/if}
                {#if p.fk}<span class="text-[9px] font-bold px-1 rounded bg-fpl-blue/20 text-fpl-blue">FK</span>{/if}
                {#if p.corner}<span class="text-[9px] font-bold px-1 rounded bg-fpl-cyan/20 text-fpl-cyan">COR</span>{/if}
              </span>
              <span class="text-fpl-cyan font-bold text-sm tabular-nums w-12 text-right shrink-0">{p.expectedPts ?? '—'}</span>
            {:else}
              <!-- Card header -->
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="flex items-center gap-1.5">
                    <span class="text-slate-600 text-[11px] tabular-nums">#{p.rank}</span>
                    <span class="text-lg leading-none">{p.flag}</span>
                    <span class:list={['font-bold truncate', isTaken ? 'line-through text-slate-500' : 'text-white']}>{p.name}</span>
                  </div>
                  <div class="text-xs text-slate-500 mt-0.5 truncate">{p.country} · Groep {p.group}</div>
                </div>
                <div class="text-right shrink-0">
                  <div class="text-xl font-extrabold text-fpl-cyan tabular-nums leading-none">{p.expectedPts ?? '—'}</div>
                  <div class="text-[10px] text-slate-600 mt-0.5">xPts</div>
                </div>
              </div>

              <!-- Badges -->
              <div class="flex flex-wrap items-center gap-1.5 mt-2.5">
                <span class:list={['text-[10px] font-bold px-1.5 py-0.5 rounded', posBg(p.pos)]}>{p.pos}</span>
                <span class:list={['text-[10px] font-bold px-1.5 py-0.5 rounded', prioBadge(p.priority)]}>{prioShort(p.priority)}</span>
                {#if p.pen}<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-fpl-pink/20 text-fpl-pink">PEN</span>{/if}
                {#if p.fk}<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-fpl-blue/20 text-fpl-blue">FK</span>{/if}
                {#if p.corner}<span class="text-[10px] font-bold px-1.5 py-0.5 rounded bg-fpl-cyan/20 text-fpl-cyan">COR</span>{/if}
                {#if p.teamStrength}<span class="text-[10px] text-slate-500 ml-auto">💪 {p.teamStrength} · 🗓 {p.expectedGames}</span>{/if}
              </div>

              {#if p.setPieces && p.setPieces !== 'None' && p.setPieces !== 'N/A'}
                <div class="text-[11px] text-slate-400 mt-2 truncate">⚽ {p.setPieces}</div>
              {/if}

              {#if p.notes}
                <details class="mt-2" onclick={(e) => e.stopPropagation()}>
                  <summary class="text-[11px] text-slate-500 hover:text-slate-300 cursor-pointer select-none">Notities</summary>
                  <div class="text-[11px] text-slate-400 mt-1 leading-relaxed">{p.notes}</div>
                  {#if p.clubStats}<div class="text-[11px] text-slate-500 mt-1 italic">{p.clubStats}</div>{/if}
                </details>
              {/if}

              {#if isTaken}
                <div class="absolute top-2 right-2 text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/30 text-rose-200 rotate-6">GEPAKT</div>
              {/if}
            {/if}
          </div>
        {/each}
      </div>
    </section>
  {/each}
</div>

<!-- Reset confirm modal -->
{#if showResetConfirm}
  <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onclick={() => (showResetConfirm = false)} role="presentation">
    <div class="glass-card max-w-sm w-full p-6" onclick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
      <div class="text-4xl mb-3">⚠️</div>
      <h3 class="text-lg font-bold text-white mb-1">Weet je het zeker?</h3>
      <p class="text-sm text-slate-400 mb-5">
        Hiermee worden alle <span class="text-rose-300 font-semibold">{takenCount}</span> gemarkeerde spelers teruggezet naar
        <span class="text-fpl-green font-semibold">beschikbaar</span>. Dit kan niet ongedaan worden gemaakt.
      </p>
      <div class="flex gap-2">
        <button onclick={() => (showResetConfirm = false)} class="flex-1 px-4 py-2 rounded-lg text-sm font-medium bg-white/5 text-slate-300 hover:bg-white/10 transition-colors">Annuleren</button>
        <button onclick={doReset} class="flex-1 px-4 py-2 rounded-lg text-sm font-bold bg-rose-500/20 text-rose-200 ring-1 ring-rose-500/40 hover:bg-rose-500/30 transition-colors">Ja, reset bord</button>
      </div>
    </div>
  </div>
{/if}
