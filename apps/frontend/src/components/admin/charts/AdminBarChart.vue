<template>
  <div class="chart-container" :style="{ height: height + 'px' }">
    <Bar
      v-if="chartData.labels && chartData.labels.length"
      :data="chartData"
      :options="chartOptions"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  BarElement,
  CategoryScale,
  LinearScale
} from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)

const props = defineProps({
  title: {
    type: String,
    default: ''
  },
  labels: {
    type: Array,
    required: true
  },
  datasets: {
    type: Array,
    required: true
  },
  height: {
    type: [Number, String],
    default: 300
  },
  yMin: {
    type: Number,
    default: 0
  },
  yMax: {
    type: Number,
    default: undefined
  },
  isPercent: {
    type: Boolean,
    default: false
  }
})

const chartData = computed(() => ({
  labels: props.labels,
  datasets: props.datasets
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top',
      labels: {
        font: {
          family: "'Inter', sans-serif",
          size: 11
        },
        usePointStyle: true,
        boxWidth: 8
      }
    },
    title: {
      display: !!props.title,
      text: props.title,
      font: {
        family: "'Inter', sans-serif",
        size: 14,
        weight: '600'
      },
      padding: { bottom: 16 }
    },
    tooltip: {
      callbacks: {
        label: function(context) {
          let label = context.dataset.label || '';
          if (label) {
            label += ': ';
          }
          const val = context.parsed.y;
          if (props.isPercent) {
            label += `${val.toFixed(3)} (${(val * 100).toFixed(2)}%)`;
          } else {
            label += val.toFixed(3);
          }
          return label;
        }
      }
    }
  },
  scales: {
    y: {
      min: props.yMin,
      max: props.yMax,
      grid: {
        color: '#f1f5f9'
      }
    },
    x: {
      grid: {
        display: false
      }
    }
  }
}))
</script>

<style scoped>
.chart-container {
  position: relative;
  width: 100%;
}
</style>
