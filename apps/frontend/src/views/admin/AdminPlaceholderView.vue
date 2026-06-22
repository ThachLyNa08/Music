<template>
  <section class="admin-placeholder">
    <header>
      <p class="eyebrow">MusicFlow Admin</p>
      <h1>{{ title }}</h1>
      <p>{{ description }}</p>
    </header>

    <div class="placeholder-panel">
      <MfIcon :name="icon" size="32" />
      <div>
        <strong>Chưa cấu hình</strong>
        <span>Module này chỉ được tổ chức route/menu trước. Chưa có API xử lý thật nên không hiển thị dữ liệu giả.</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const title = computed(() => route.meta?.title || 'Module Admin')
const description = computed(() => route.meta?.description || 'Khu vực này sẽ được hoàn thiện khi backend API tương ứng sẵn sàng.')
const icon = computed(() => route.meta?.icon || 'construction')
</script>

<style scoped>
.admin-placeholder {
  max-width: 980px;
  margin: 0 auto;
  color: #0f172a;
}

.eyebrow {
  margin: 0 0 6px;
  color: #7c3aed;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0;
}

h1 {
  margin: 0;
  font-size: 28px;
  font-weight: 900;
}

p {
  margin: 8px 0 0;
  color: #64748b;
  font-size: 14px;
  line-height: 1.6;
}

.placeholder-panel {
  margin-top: 22px;
  display: flex;
  gap: 14px;
  align-items: flex-start;
  padding: 18px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
}

.placeholder-panel :deep(.mf-icon) {
  color: #7c3aed;
}

.placeholder-panel strong {
  display: block;
  color: #111827;
  font-size: 16px;
  font-weight: 900;
}

.placeholder-panel span {
  display: block;
  margin-top: 5px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.5;
}
</style>
