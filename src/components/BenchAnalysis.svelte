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
  let barChart: Chart | null = null;
  let lineChart: Chart | null = null;

  const COLORS = [
    '#00ff87', '#04f5ff', '#e90052', '#2dbaff',
    '#ff6384', '#ffcd56', '#9966ff', '#ff9f40',
  ];

  onMount(() => {
    const benchData = JSON.parse(data);
    // benchData: { labels: string[], managers: { name, totalBenchPoints, perGw: number[] }[] }

    const managers = benchData.managers;
    const labels = benchData.labels;

    // Cumulative bench points line chart
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
            backgroundColor: COLORS[i % COLORS.length] + '20',
            borderWidth: 2,
            pointRadius: 2,
            pointHoverRadius: 5,
            tension: 0.2,
            fill: false,
          };
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#9ca3af', boxWidth: 12, padding: 15, font: { size: 11 } },
          },
          tooltip: {
            backgroundColor: '#16213e',
            titleColor: '#fff',
            bodyColor: '#9ca3af',
            borderColor: '#ffffff20',
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            ticks: { color: '#6b7280', font: { size: 10 } },
            grid: { color: '#ffffff10' },
          },
          y: {
            ticks: { color: '#6b7280', font: { size: 10 } },
            grid: { color: '#ffffff10' },
          },
        },
      },
    });

    // Per-GW bar chart (stacked)
    barChart = new Chart(barCanvas, {
      type: 'bar',
      data: {
        labels,
        datasets: managers.map((m: any, i: number) => ({
          label: m.name,
          data: m.perGw,
          backgroundColor: COLORS[i % COLORS.length] + '90',
          borderColor: COLORS[i % COLORS.length],
          borderWidth: 1,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: { color: '#9ca3af', boxWidth: 12, padding: 15, font: { size: 11 } },
          },
          tooltip: {
            backgroundColor: '#16213e',
            titleColor: '#fff',
            bodyColor: '#9ca3af',
            borderColor: '#ffffff20',
            borderWidth: 1,
          },
        },
        scales: {
          x: {
            stacked: false,
            ticks: { color: '#6b7280', font: { size: 10 } },
            grid: { color: '#ffffff10' },
          },
          y: {
            stacked: false,
            ticks: { color: '#6b7280', font: { size: 10 } },
            grid: { color: '#ffffff10' },
          },
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
    <h3 class="text-lg font-bold text-white mb-3">Bench Points Lost — Season Total</h3>
    <div class="bg-fpl-card rounded-lg border border-white/5 overflow-hidden">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-white/10 text-gray-400">
            <th class="text-left py-2 px-4">#</th>
            <th class="text-left py-2 px-4">Manager</th>
            <th class="text-right py-2 px-4">Total Bench Pts</th>
            <th class="text-right py-2 px-4">Avg / GW</th>
          </tr>
        </thead>
        <tbody>
          {#each JSON.parse(data).managers.sort((a: any, b: any) => b.totalBenchPoints - a.totalBenchPoints) as manager, i}
            <tr class="border-b border-white/5 {manager.isMaurits ? 'bg-fpl-green/10' : ''}">
              <td class="py-2 px-4 text-gray-400">{i + 1}</td>
              <td class="py-2 px-4 text-white">{manager.name}</td>
              <td class="py-2 px-4 text-right font-mono text-fpl-green">{manager.totalBenchPoints}</td>
              <td class="py-2 px-4 text-right font-mono text-gray-400">{(manager.totalBenchPoints / manager.perGw.length).toFixed(1)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
    <p class="text-xs text-gray-500 mt-2">Total points scored by players in bench positions (12-15). Does not simulate auto-substitution rules.</p>
  </div>

  <!-- Cumulative line chart -->
  <div>
    <h3 class="text-lg font-bold text-white mb-3">Cumulative Bench Points Lost</h3>
    <div class="bg-fpl-card rounded-lg p-4 border border-white/5 relative" style="height: 400px">
      {#if !lineChart}
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="flex flex-col items-center gap-3">
            <div class="w-8 h-8 border-2 border-fpl-green/30 border-t-fpl-green rounded-full animate-spin"></div>
            <span class="text-sm text-gray-500">Loading chart...</span>
          </div>
        </div>
      {/if}
      <canvas bind:this={lineCanvas} class={!lineChart ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}></canvas>
    </div>
  </div>

  <!-- Per-GW bar chart -->
  <div>
    <h3 class="text-lg font-bold text-white mb-3">Bench Points Per Gameweek</h3>
    <div class="bg-fpl-card rounded-lg p-4 border border-white/5 relative" style="height: 400px">
      {#if !barChart}
        <div class="absolute inset-0 flex items-center justify-center">
          <div class="flex flex-col items-center gap-3">
            <div class="w-8 h-8 border-2 border-fpl-green/30 border-t-fpl-green rounded-full animate-spin"></div>
            <span class="text-sm text-gray-500">Loading chart...</span>
          </div>
        </div>
      {/if}
      <canvas bind:this={barCanvas} class={!barChart ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}></canvas>
    </div>
  </div>
</div>
