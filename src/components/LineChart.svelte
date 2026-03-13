<script lang="ts">
  import { onMount } from 'svelte';
  import {
    Chart,
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Tooltip,
    Legend,
    Filler,
  } from 'chart.js';

  Chart.register(
    LineController,
    LineElement,
    PointElement,
    LinearScale,
    CategoryScale,
    Tooltip,
    Legend,
    Filler
  );

  interface Props {
    data: string;
    title?: string;
    yReverse?: boolean;
  }

  let { data, title = '', yReverse = false }: Props = $props();
  let canvas: HTMLCanvasElement;
  let chart: Chart | null = $state(null);

  const COLORS = [
    '#00ff87', '#04f5ff', '#e90052', '#2dbaff',
    '#ff6384', '#ffcd56', '#9966ff', '#ff9f40',
  ];

  onMount(() => {
    const parsed = JSON.parse(data);
    // Expected format: { labels: string[], datasets: { label, data }[] }

    chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: parsed.labels,
        datasets: parsed.datasets.map((ds: any, i: number) => ({
          label: ds.label,
          data: ds.data,
          borderColor: COLORS[i % COLORS.length],
          backgroundColor: COLORS[i % COLORS.length] + '20',
          borderWidth: 2,
          pointRadius: 2,
          pointHoverRadius: 5,
          tension: 0.2,
          fill: false,
        })),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index',
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: '#9ca3af',
              boxWidth: 12,
              padding: 15,
              font: { size: 11 },
            },
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
            reverse: yReverse,
            ticks: { color: '#6b7280', font: { size: 10 } },
            grid: { color: '#ffffff10' },
          },
        },
      },
    });

    return () => {
      chart?.destroy();
    };
  });
</script>

{#if title}
  <h3 class="text-lg font-bold text-white mb-3">{title}</h3>
{/if}
<div class="bg-fpl-card rounded-lg p-4 border border-white/5 relative" style="height: 400px">
  {#if !chart}
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="flex flex-col items-center gap-3">
        <div class="w-8 h-8 border-2 border-fpl-green/30 border-t-fpl-green rounded-full animate-spin"></div>
        <span class="text-sm text-gray-500">Loading chart...</span>
      </div>
    </div>
  {/if}
  <canvas bind:this={canvas} class={!chart ? 'opacity-0' : 'opacity-100 transition-opacity duration-300'}></canvas>
</div>
