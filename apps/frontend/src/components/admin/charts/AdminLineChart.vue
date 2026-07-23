<template>
  <div class="chart-container" :style="{ height: height + 'px' }">
    <LineChart
      v-if="chartData.labels && chartData.labels.length"
      :data="chartData"
      :options="chartOptions"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Line as LineChart } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  PointElement,
  CategoryScale,
  LinearScale,
  Filler
} from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale, Filler)

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
    default: undefined
  },
  yMax: {
    type: Number,
    default: undefined
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
          label += context.parsed.y.toFixed(4);
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
