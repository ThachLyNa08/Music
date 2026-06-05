<template>
  <div class="bg-white dark:bg-bg-surface p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-bg-border">
    <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Top 10 Bài hát nghe nhiều nhất</h3>
    <div v-if="isEmpty" class="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-500">
      <svg class="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>
      <p class="text-sm font-medium">Chưa có dữ liệu lượt nghe</p>
    </div>
    <div v-else class="h-64">
      <Bar :data="computedChartData" :options="chartOptions" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Bar } from 'vue-chartjs';
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js';

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  }
});

const isEmpty = computed(() => !props.data || props.data.length === 0);

const computedChartData = computed(() => {
  return {
    labels: props.data.map(item => item.title),
    datasets: [
      {
        label: 'Lượt nghe',
        backgroundColor: 'rgba(99, 102, 241, 0.8)', // Indigo-500
        hoverBackgroundColor: 'rgba(79, 70, 229, 1)', // Indigo-600
        borderRadius: 4,
        data: props.data.map(item => item.listens)
      }
    ]
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: 'rgba(17, 24, 39, 0.9)',
      titleColor: '#fff',
      bodyColor: '#e5e7eb',
      padding: 10,
      cornerRadius: 8,
      displayColors: false
    }
  },
  scales: {
    y: {
      beginAtZero: true,
      grid: {
        color: 'rgba(156, 163, 175, 0.1)'
      },
      ticks: {
        color: '#9ca3af'
      }
    },
    x: {
      grid: {
        display: false
      },
      ticks: {
        color: '#9ca3af',
        maxRotation: 45,
        minRotation: 0,
        callback: function(value) {
          const label = this.getLabelForValue(value);
          return label.length > 15 ? label.substring(0, 15) + '...' : label;
        }
      }
    }
  }
};
</script>
