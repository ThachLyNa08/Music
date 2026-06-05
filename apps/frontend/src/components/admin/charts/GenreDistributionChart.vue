<template>
  <div class="bg-white dark:bg-bg-surface p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-bg-border">
    <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-4">Tỷ lệ theo Thể loại</h3>
    <div v-if="isEmpty" class="flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-500">
      <svg class="w-12 h-12 mb-3 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z"/></svg>
      <p class="text-sm font-medium">Chưa có dữ liệu thể loại</p>
    </div>
    <div v-else class="h-64 flex justify-center">
      <Doughnut :data="computedChartData" :options="chartOptions" />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Doughnut } from 'vue-chartjs';
import { Chart as ChartJS, Title, Tooltip, Legend, ArcElement } from 'chart.js';

ChartJS.register(Title, Tooltip, Legend, ArcElement);

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  }
});

const isEmpty = computed(() => !props.data || props.data.length === 0);

const computedChartData = computed(() => {
  return {
    labels: props.data.map(item => item.label),
    datasets: [
      {
        data: props.data.map(item => item.count),
        backgroundColor: [
          '#6366f1', // Indigo
          '#10b981', // Emerald
          '#f59e0b', // Amber
          '#ec4899', // Pink
          '#8b5cf6', // Violet
          '#06b6d4', // Cyan
          '#ef4444', // Red
          '#3b82f6', // Blue
          '#14b8a6', // Teal
          '#f97316'  // Orange
        ],
        borderWidth: 0,
        hoverOffset: 4
      }
    ]
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'right',
      labels: {
        color: '#9ca3af',
        usePointStyle: true,
        padding: 20
      }
    },
    tooltip: {
      backgroundColor: 'rgba(17, 24, 39, 0.9)',
      titleColor: '#fff',
      bodyColor: '#e5e7eb',
      padding: 10,
      cornerRadius: 8
    }
  },
  cutout: '70%'
};
</script>
