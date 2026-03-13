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
  } from 'chart.js';

  Chart.register(
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
  let canvas: HTMLCanvasElement;
  let chart: Chart | null = $state(null);

  const COLORS = [
    '#34d399', '#22d3ee', '#f43f5e', '#60a5fa',
    '#fb923c', '#a78bfa', '#fbbf24', '#f472b6',
  ];

  onMount(() => {
    const parsed = JSON.parse(data);

    chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: parsed.labels,
        datasets: parsed.datasets.map((ds: any, i: number) => ({
          label: ds.label,
          data: ds.data,
          borderColor: COLORS[i % COLORS.length],
          backgroundColor: COLORS[i % COLORS.length],
          borderWidth: 3,
          pointRadius: 4,
          pointHoverRadius: 8,
          pointBorderWidth: 2,
          pointBorderColor: '#0b0e1a',
          pointHoverBorderColor: '#fff',
          pointHoverBorderWidth: 2,
          tension: 0.35,
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
              color: '#64748b',
              boxWidth: 10,
              boxHeight: 10,
              padding: 16,
              font: { size: 12, family: 'Inter, system-ui, sans-serif', weight: 'bold' as any },
              usePointStyle: true,
              pointStyle: 'circle',
            },
          },
          tooltip: {
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            titleColor: '#fff',
            bodyColor: '#94a3b8',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            borderWidth: 1,
            padding: 14,
            cornerRadius: 8,
            titleFont: { size: 13, weight: 'bold' as const, family: 'Inter, system-ui, sans-serif' },
            bodyFont: { size: 12, family: 'Inter, system-ui, sans-serif' },
            callbacks: {
              label: function(ctx: any) {
                return `${ctx.dataset.label}: #${ctx.parsed.y}`;
              },
            },
          },
        },
        scales: {
          x: {
            ticks: { color: '#475569', font: { size: 10, family: 'Inter, system-ui, sans-serif' } },
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
            border: { color: 'rgba(255, 255, 255, 0.05)' },
          },
          y: {
            reverse: true,
            min: 1,
            max: 8,
            ticks: {
              stepSize: 1,
              color: '#475569',
              font: { size: 11, family: 'Inter, system-ui, sans-serif' },
              callback: function(value: any) {
                return '#' + value;
              },
            },
            grid: { color: 'rgba(255, 255, 255, 0.03)' },
            border: { color: 'rgba(255, 255, 255, 0.05)' },
          },
        },
      },
    });

    return () => {
      chart?.destroy();
    };
  });
</script>

<div class="glass-card p-5 relative" style="height: 480px">
  {#if !chart}
    <div class="absolute inset-0 flex items-center justify-center">
      <div class="flex flex-col items-center gap-3">
        <div class="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
        <span class="text-sm text-slate-500">Loading bump chart...</span>
      </div>
    </div>
  {/if}
  <canvas bind:this={canvas} class={!chart ? 'opacity-0' : 'opacity-100 transition-opacity duration-500'}></canvas>
</div>
