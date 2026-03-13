<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Chart,
    BarController,
    BarElement,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Tooltip,
    Legend,
  } from 'chart.js';

  Chart.register(
    BarController,
    BarElement,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Tooltip,
    Legend
  );

  interface Props {
    data: string;
  }

  let { data }: Props = $props();
  let barCanvas: HTMLCanvasElement;
  let lineCanvas: HTMLCanvasElement;
  let barChart: Chart | null = $state(null);
  let lineChart: Chart | null = $state(null);

  const COLORS = [
    '#34d399', '#22d3ee', '#f43f5e', '#60a5fa',
    '#fb923c', '#a78bfa', '#fbbf24', '#f472b6',
  ];

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index' as const, intersect: false },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: '#64748b', boxWidth: 10, boxHeight: 10, padding: 16, font: { size: 11 }, usePointStyle: true, pointStyle: 'circle' as const },
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        titleColor: '#fff',
        bodyColor: '#94a3b8',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
      },
    },
    scales: {
      x: {
        ticks: { color: '#475569', font: { size: 10 } },
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        border: { color: 'rgba(255, 255, 255, 0.05)' },
      },
      y: {
        ticks: { color: '#475569', font: { size: 10 } },
        grid: { color: 'rgba(255, 255, 255, 0.03)' },
        border: { color: 'rgba(255, 255, 255, 0.05)' },
      },
    },
  };

  onMount(() => {
    const benchData = JSON.parse(data);
    const managers = benchData.managers;
    const labels = benchData.labels;

    lineChart = new Chart(lineCanvas, {
      type: 'line',
      data: {
        labels,
        datasets: managers.map((m: any, i: number) => {
          let cumulative = 0;
          const cumulativeData = m.perGw.map((pts: number) => {
            cumulative += pts;
            return cumulative;
          });
          return {
            label: m.name,
            data: cumulativeData,
            borderColor: COLORS[i % COLORS.length],
            backgroundColor: COLORS[i % COLORS.length] + '15',
            borderWidth: 2.5,
            pointRadius: 0,
            pointHoverRadius: 6,
            tension: 0.3,
            fill: false,
          };
        }),
      },
      options: chartOptions,
    });

    barChart = new Chart(barCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: managers.map((m: any, i: number) => ({
          label: m.name,
          data: m.perGw,
          backgroundColor: COLORS[i % COLORS.length] + '60',
          borderColor: COLORS[i % COLORS.length],
          borderWidth: 1,
          borderRadius: 4,
        })),
      },
      options: {
        ...chartOptions,
        scales: {
          ...chartOptions.scales,
          x: { ...chartOptions.scales.x, stacked: false },
          y: { ...chartOptions.scales.y, stacked: false },
        },
      },
    });

    return () => {
      barChart?.destroy();
      lineChart?.destroy();
    };
  });
</script>

<div class="space-y-8">
  <!-- Rankings table -->
  <div>
    <h3 class="text-lg font-bold text-white mb-3">Bench Points Lost -- Season Total</h3>
    <div class="glass-card overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-white/5 text-slate-500">
            <th class="text-left py-3 px-4 font-medium">#</th>
            <th class="text-left py-3 px-4 font-medium">Manager</th>
            <th class="text-right py-3 px-4 font-medium">Total Bench Pts</th>
            <th class="text-right py-3 px-4 font-medium">Avg / GW</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-white/5">
          {#each JSON.parse(data).managers.sort((a: any, b: any) => b.totalBenchPoints - a.totalBenchPoints) as manager, i}
            <tr class="table-row-hover {manager.isMaurits ? 'bg-emerald-500/5' : ''}">
              <td class="py-3 px-4 text-slate-500">{i + 1}</td>
              <td class="py-3 px-4 text-white font-medium">{manager.name}</td>
              <td class="py-3 px-4 text-right font-mono text-emerald-400 font-semibold">{manager.totalBenchPoints}</td>
              <td class="py-3 px-4 text-right font-mono text-slate-400">{(manager.totalBenchPoints / manager.perGw.length).toFixed(1)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="text-xs text-slate-600 mt-2">Total points scored by players in bench positions (12-15). Does not simulate auto-substitution rules.</p>
  </div>

  <!-- Cumulative line chart -->
  <div>
    <h3 class="text-lg font-bold text-white mb-3">Cumulative Bench Points Lost</h3>
    <div class="glass-card p-5 relative" style="height: 420px">
      {#if !lineChart}
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="flex flex-col items-center gap-3">
            <div class="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
            <span class="text-sm text-slate-500">Loading chart...</span>
          </div>
        </div>
      {/if}
      <canvas bind:this={lineCanvas} class={!lineChart ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'}></canvas>
    </div>
  </div>

  <!-- Per-GW bar chart -->
  <div>
    <h3 class="text-lg font-bold text-white mb-3">Bench Points Per Gameweek</h3>
    <div class="glass-card p-5 relative" style="height: 420px">
      {#if !barChart}
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="flex flex-col items-center gap-3">
            <div class="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
            <span class="text-sm text-slate-500">Loading chart...</span>
          </div>
        </div>
      {/if}
      <canvas bind:this={barCanvas} class={!barChart ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'}></canvas>
    </div>
  </div>
</div>
