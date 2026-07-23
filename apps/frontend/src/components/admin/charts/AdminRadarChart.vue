<template>
  <div class="chart-container" :style="{ height: height + 'px' }">
    <Radar
      v-if="chartData.labels && chartData.labels.length"
      :data="chartData"
      :options="chartOptions"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { Radar } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  PointElement,
  LineElement,
  RadialLinearScale,
  Filler
} from 'chart.js'

ChartJS.register(Title, Tooltip, Legend, PointElement, LineElement, RadialLinearScale, Filler)

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
    default: 1
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
          const val = context.parsed.r;
          label += `${val.toFixed(3)} (${(val * 100).toFixed(2)}%)`;
          return label;
        }
      }
    }
  },
  scales: {
    r: {
      min: props.yMin,
      max: props.yMax,
      angleLines: {
        color: '#f1f5f9'
      },
      grid: {
        color: '#f1f5f9'
      },
      pointLabels: {
        font: {
          family: "'Inter', sans-serif",
          size: 11
        }
      },
      ticks: {
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
