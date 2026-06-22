<template>
  <div class="bg-white rounded-[18px] border border-gray-200 shadow-sm overflow-hidden flex flex-col w-full donut-card">
    <div class="px-6 pt-6 pb-2">
      <h3 class="text-lg font-bold text-gray-900 m-0">{{ title }}</h3>
      <p v-if="description" class="text-sm text-gray-500 mt-1">{{ description }}</p>
    </div>

    <div class="flex-1 flex flex-col justify-center pb-6">
      <div v-if="isEmpty" class="flex flex-col items-center justify-center h-[280px] text-gray-400">
        <svg class="w-12 h-12 mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z" />
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z" />
        </svg>
        <p class="text-sm font-medium">{{ emptyText }}</p>
      </div>

      <div v-else class="flex flex-col items-center w-full">
        <!-- Chart Area -->
        <div class="relative mx-auto w-full max-w-[220px] aspect-square flex items-center justify-center chart-wrapper">
          <Doughnut :data="chartData" :options="chartOptions" />
          
          <!-- Center Label Overlay -->
          <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            <span class="text-[2.5rem] font-extrabold text-gray-900 tabular-nums leading-none tracking-tight">{{ centerLabel }}</span>
            <span class="text-[13px] text-gray-500 mt-2 font-medium">{{ centerSubLabel }}</span>
          </div>
        </div>

        <!-- Custom Legend -->
        <div class="mt-8 flex flex-wrap justify-center gap-x-5 gap-y-3.5 px-4 w-full">
          <div v-for="(item, index) in normalizedData" :key="index" class="flex items-center">
            <span class="w-2.5 h-2.5 rounded-full mr-2.5 shrink-0" :style="{ backgroundColor: colors[index % colors.length] }"></span>
            <span class="text-[13px] font-medium text-gray-600 truncate max-w-[140px] uppercase tracking-wide">{{ item.label }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue';
import { Doughnut } from 'vue-chartjs';
import { Chart as ChartJS, Tooltip, Legend, ArcElement } from 'chart.js';

ChartJS.register(Tooltip, Legend, ArcElement);

const props = defineProps({
  title: { type: String, required: true },
  description: { type: String, default: '' },
  data: { type: Array, default: () => [] },
  nameKey: { type: String, default: 'label' },
  valueKey: { type: String, default: 'value' },
  centerLabel: { type: [String, Number], default: '' },
  centerSubLabel: { type: String, default: '' },
  emptyText: { type: String, default: 'Chưa có dữ liệu thể loại.' }
});

const normalizedData = computed(() => {
  return props.data.map(item => ({
    label: item[props.nameKey] || 'Khác',
    value: Number(item[props.valueKey]) || 0
  })).filter(item => item.value > 0);
});

const isEmpty = computed(() => normalizedData.value.length === 0);
const totalValue = computed(() => normalizedData.value.reduce((sum, item) => sum + item.value, 0));

const colors = [
  '#8b5cf6', // purple
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f97316', // orange
  '#ef4444', // red
  '#ec4899', // pink
  '#06b6d4', // cyan
];

const chartData = computed(() => {
  return {
    labels: normalizedData.value.map(item => item.label),
    datasets: [
      {
        data: normalizedData.value.map(item => item.value),
        backgroundColor: colors.slice(0, normalizedData.value.length),
        borderWidth: 3,
        borderColor: '#ffffff',
        hoverOffset: 4,
        borderRadius: 5,
        spacing: 0,
      }
    ]
  };
});

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  cutout: '75%', // Large inner radius for modern donut look
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      backgroundColor: '#ffffff',
      titleColor: '#0f172a',
      bodyColor: '#334155',
      borderColor: '#e2e8f0',
      borderWidth: 1,
      padding: 12,
      cornerRadius: 8,
      boxPadding: 6,
      usePointStyle: true,
      titleFont: {
        size: 13,
        weight: 'bold'
      },
      bodyFont: {
        size: 13
      },
      callbacks: {
        label: function(context) {
          const value = context.parsed;
          const total = totalValue.value;
          const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
          return ` ${context.label}: ${new Intl.NumberFormat('vi-VN').format(value)} (${percentage}%)`;
        }
      }
    }
  }
};
</script>

<style scoped>
.donut-card {
  font-family: 'Inter', 'Be Vietnam Pro', sans-serif;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03);
}
</style>
