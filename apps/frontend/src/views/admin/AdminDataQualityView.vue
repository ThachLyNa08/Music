<template>
  <section class="admin-data-quality">
    <header class="page-header">
      <div>
        <p class="eyebrow">MusicFlow Admin</p>
        <h1>Chất lượng dữ liệu</h1>
        <p>Rà soát lỗi metadata, audio URL và quan hệ dữ liệu bằng dữ liệu thật.</p>
      </div>
      <button class="refresh-button" type="button" :disabled="summaryLoading || issuesLoading" @click="refreshAll">
        <MfIcon name="refresh" :className="summaryLoading || issuesLoading ? 'spinning' : ''" size="20" />
        Kiểm tra lại
      </button>
    </header>

    <div v-if="summaryError" class="alert-card">
      <MfIcon name="error" size="24" />
      <div>
        <strong>Không thể tải tổng quan lỗi dữ liệu</strong>
        <p>{{ summaryError }}</p>
      </div>
    </div>

    <div class="issue-grid">
      <button
        v-for="issue in issueCards"
        :key="issue.type"
        type="button"
        class="issue-card"
        :class="{ active: selectedType === issue.type, danger: issue.count > 0 }"
        @click="selectType(issue.type)"
      >
        <span>{{ issue.label }}</span>
        <strong>{{ summaryLoading ? '...' : displayNumber(issue.count) }}</strong>
      </button>
    </div>

    <article class="panel">
      <div class="toolbar">
        <div>
          <h2>{{ selectedLabel }}</h2>
          <p>{{ totalText }}</p>
        </div>
        <div class="filters">
          <select v-model="market" :disabled="issuesLoading" @change="resetAndFetch">
            <option value="">Tất cả market</option>
            <option value="KPOP">KPOP</option>
            <option value="VPOP">VPOP</option>
            <option value="USUK">USUK</option>
            <option value="OTHER">OTHER</option>
          </select>
          <input
            v-model.trim="search"
            type="search"
            placeholder="Tìm bài hát, nghệ sĩ, album"
            :disabled="issuesLoading"
            @keyup.enter="resetAndFetch"
          />
          <button class="filter-submit-button" type="button" :disabled="issuesLoading" @click="resetAndFetch">Lọc</button>
          <AdminResetButton :disabled="issuesLoading" :loading="issuesLoading" @click="resetFilters" />
        </div>
      </div>

      <div v-if="issuesError" class="alert-card compact">
        <MfIcon name="error" size="22" />
        <div>
          <strong>Không thể tải danh sách lỗi</strong>
          <p>{{ issuesError }}</p>
        </div>
      </div>

      <div v-if="issuesLoading" class="empty-state">Đang tải danh sách lỗi...</div>
      <div v-else-if="items.length === 0" class="empty-state">Chưa có dữ liệu</div>
      <div v-else class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Tiêu đề</th>
              <th>Nghệ sĩ</th>
              <th>Album</th>
              <th>Genre</th>
              <th>Market</th>
              <th>Audio URL</th>
              <th>Cover URL</th>
              <th>Cập nhật</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="item in items" :key="rowKey(item)">
              <td>{{ item.song_id || item.album_id || item.artist_id || item.genre_id || 'Chưa có dữ liệu' }}</td>
              <td>{{ item.title || 'Chưa có dữ liệu' }}</td>
              <td>{{ item.artist || 'Chưa có dữ liệu' }}</td>
              <td>{{ item.album || 'Chưa có dữ liệu' }}</td>
              <td>{{ item.genre || 'Chưa có dữ liệu' }}</td>
              <td>{{ item.market || 'Chưa có dữ liệu' }}</td>
              <td class="mono">{{ item.audio_url || 'Chưa có dữ liệu' }}</td>
              <td class="mono">{{ item.cover_url || 'Chưa có dữ liệu' }}</td>
              <td>{{ formatDate(item.updated_at) }}</td>
              <td>{{ issueNote(item) }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <footer class="mt-4 flex justify-end">
        <AdminPagination :currentPage="page" :totalPages="totalPages" :disabled="issuesLoading" @update:currentPage="goPage" />
      </footer>
    </article>

    <article v-if="warnings.length > 0" class="panel warning-panel">
      <h2>Cảnh báo fallback</h2>
      <ul>
        <li v-for="warning in warnings" :key="warning">{{ warning }}</li>
      </ul>
    </article>
  </section>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '@/api/axios'
import { adminIssueRouteMap, adminIssueTypeMap } from '@/config/adminMenu'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import AdminResetButton from '@/components/admin/AdminResetButton.vue'

const route = useRoute()
const router = useRouter()

const summaryLoading = ref(true)
const issuesLoading = ref(true)
const summaryError = ref('')
const issuesError = ref('')
const summary = ref(null)
const issues = ref(null)
const page = ref(1)
const limit = ref(20)
const market = ref('')
const search = ref('')

const issueCards = computed(() => summary.value?.issueTypes || [])
const items = computed(() => issues.value?.items || [])
const warnings = computed(() => [...(summary.value?.warnings || []), ...(issues.value?.warnings || [])])
const totalPages = computed(() => issues.value?.totalPages || 1)
const total = computed(() => Number(issues.value?.total || 0))
const selectedType = computed(() => adminIssueTypeMap[route.params.type] || 'missing_audio')
const selectedLabel = computed(() => issueCards.value.find(item => item.type === selectedType.value)?.label || issues.value?.label || 'Danh sách lỗi')
const totalText = computed(() => issuesLoading.value ? 'Đang tải...' : `${displayNumber(total.value)} dòng cần kiểm tra`)

function routeType(type) {
  return adminIssueRouteMap[type] || adminIssueRouteMap.missing_audio
}

function selectType(type) {
  page.value = 1
  router.push({ name: 'AdminDataQualityType', params: { type: routeType(type) } })
}

function resetAndFetch() {
  page.value = 1
  fetchIssues()
}

function resetFilters() {
  market.value = ''
  search.value = ''
  page.value = 1
  fetchIssues()
}

function goPage(nextPage) {
  page.value = nextPage
  fetchIssues()
}

async function fetchSummary() {
  summaryLoading.value = true
  summaryError.value = ''
  try {
    const res = await api.get('/admin/data-quality/summary')
    summary.value = res.data?.data || null
  } catch (err) {
    summaryError.value = err.response?.data?.message || 'Không thể tải tổng quan lỗi dữ liệu.'
    summary.value = null
  } finally {
    summaryLoading.value = false
  }
}

async function fetchIssues() {
  issuesLoading.value = true
  issuesError.value = ''
  try {
    const res = await api.get('/admin/data-quality/issues', {
      params: {
        type: selectedType.value,
        page: page.value,
        limit: limit.value,
        market: market.value || undefined,
        search: search.value || undefined,
      },
    })
    issues.value = res.data?.data || null
  } catch (err) {
    issuesError.value = err.response?.data?.message || 'Không thể tải danh sách lỗi dữ liệu.'
    issues.value = null
  } finally {
    issuesLoading.value = false
  }
}

function refreshAll() {
  fetchSummary()
  fetchIssues()
}

function displayNumber(value) {
  if (value === null || value === undefined || value === '') return 'Chưa có dữ liệu'
  return new Intl.NumberFormat('vi-VN').format(Number(value || 0))
}

function formatDate(value) {
  if (!value) return 'Chưa có dữ liệu'
  return new Date(value).toLocaleString('vi-VN')
}

function rowKey(item) {
  return `${selectedType.value}:${item.song_id || item.album_id || item.artist_id || item.genre_id || item.title}`
}

function issueNote(item) {
  if (selectedType.value === 'album_track_mismatch') {
    return `DB: ${item.total_tracks ?? 'Chưa có dữ liệu'} / Thực tế: ${item.actual_tracks ?? 'Chưa có dữ liệu'}`
  }
  if (item.entity_type === 'album') return 'Album'
  if (item.entity_type === 'song') return 'Bài hát'
  return 'Sẽ phát triển repair sau'
}

watch(() => route.params.type, () => {
  page.value = 1
  fetchIssues()
})

onMounted(() => {
  fetchSummary()
  fetchIssues()
})
</script>

<style scoped>
.admin-data-quality {
  max-width: 1440px;
  margin: 0 auto;
  color: #0f172a;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 20px;
  margin-bottom: 18px;
}

.eyebrow {
  margin: 0 0 6px;
  color: #7c3aed;
  font-size: 12px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0;
}

h1, h2, p {
  margin: 0;
}

h1 {
  font-size: 28px;
  font-weight: 900;
}

.page-header p,
.toolbar p {
  margin-top: 6px;
  color: #64748b;
  font-size: 14px;
  line-height: 1.5;
}

.refresh-button,
.filter-submit-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 40px;
  padding: 0 14px;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #ffffff;
  color: #334155;
  font-weight: 800;
  cursor: pointer;
}

button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.spinning {
  animation: spin 1s linear infinite;
}

.issue-grid {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 14px;
}

.issue-card {
  min-height: 92px;
  padding: 14px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  color: #334155;
  text-align: left;
  cursor: pointer;
}

.issue-card span {
  display: block;
  color: #64748b;
  font-size: 12px;
  font-weight: 900;
  line-height: 1.35;
  text-transform: uppercase;
}

.issue-card strong {
  display: block;
  margin-top: 10px;
  color: #111827;
  font-size: 24px;
  font-weight: 900;
}

.issue-card.danger strong {
  color: #dc2626;
}

.issue-card.active {
  border-color: #7c3aed;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.12);
}

.panel,
.alert-card {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.04);
}

.panel {
  padding: 18px;
  margin-bottom: 14px;
}

.toolbar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 14px;
}

.toolbar h2 {
  font-size: 17px;
  font-weight: 900;
}

.filters {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

select,
input {
  height: 40px;
  min-width: 150px;
  border: 1px solid #dbe3ef;
  border-radius: 8px;
  background: #ffffff;
  color: #334155;
  font: inherit;
  font-size: 13px;
  font-weight: 700;
  padding: 0 10px;
}

input {
  min-width: 260px;
}

.empty-state {
  min-height: 220px;
  display: grid;
  place-items: center;
  border: 1px dashed #cbd5e1;
  border-radius: 8px;
  color: #64748b;
  font-weight: 800;
}

.table-wrap {
  overflow-x: auto;
}

table {
  width: 100%;
  min-width: 1120px;
  border-collapse: collapse;
}

th,
td {
  padding: 12px 10px;
  border-bottom: 1px solid #eef2f7;
  text-align: left;
  vertical-align: top;
  font-size: 13px;
}

th {
  color: #64748b;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
}

td {
  color: #334155;
  font-weight: 650;
}

.mono {
  max-width: 240px;
  overflow-wrap: anywhere;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 12px;
}



.alert-card {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  margin-bottom: 14px;
  padding: 14px;
  border-color: #fecaca;
  background: #fef2f2;
  color: #991b1b;
}

.alert-card.compact {
  margin-bottom: 14px;
}

.alert-card p {
  margin-top: 4px;
}

.warning-panel h2 {
  margin-bottom: 10px;
  font-size: 16px;
  font-weight: 900;
}

.warning-panel ul {
  margin: 0;
  padding-left: 18px;
  color: #92400e;
  font-size: 13px;
  line-height: 1.6;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@media (max-width: 1180px) {
  .issue-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .toolbar {
    flex-direction: column;
  }

  .filters {
    width: 100%;
    justify-content: flex-start;
  }
}

@media (max-width: 720px) {
  .page-header {
    flex-direction: column;
  }

  .refresh-button {
    width: 100%;
  }

  .issue-grid {
    grid-template-columns: 1fr;
  }

  .filters,
  .filter-submit-button,
  select,
  input {
    width: 100%;
  }
}
</style>
