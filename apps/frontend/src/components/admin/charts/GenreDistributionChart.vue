<template>
  <AdminGenreDonutChart
    title="Tỷ lệ theo Thể loại"
    :data="data"
    nameKey="label"
    valueKey="count"
    :centerLabel="totalCount"
    centerSubLabel="bài hát"
    emptyText="Chưa có dữ liệu thể loại"
  />
</template>

<script setup>
import { computed } from 'vue';
import AdminGenreDonutChart from '../AdminGenreDonutChart.vue';

const props = defineProps({
  data: {
    type: Array,
    default: () => []
  }
});

const totalCount = computed(() => {
  return props.data.reduce((sum, item) => sum + (Number(item.count) || 0), 0);
});
</script>
