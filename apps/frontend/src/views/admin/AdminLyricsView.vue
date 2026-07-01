<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api/axios'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import AdminKpiCard from '@/components/admin/AdminKpiCard.vue'
import AdminFilterBar from '@/components/admin/AdminFilterBar.vue'
import AdminTableShell from '@/components/admin/AdminTableShell.vue'
import AdminResetButton from '@/components/admin/AdminResetButton.vue'

const router = useRouter()

const summary = ref({
  totalSongs: 0,
  songsWithLyrics: 0,
  songsMissingLyrics: 0,
  syncedLyricsCount: 0,
  plainLyricsCount: 0,
  lrclibCount: 0,
  manualCount: 0
})

const songs = ref([])
const loading = ref(false)
const tableContainer = ref(null)
const pagination = ref({ page: 1, limit: 20, total: 0, totalPages: 1 })

const displayRange = computed(() => {
  if (!pagination.value.total) return ''
  const start = (pagination.value.page - 1) * pagination.value.limit + 1
  const end = Math.min(pagination.value.page * pagination.value.limit, pagination.value.total)
  return `Hiển thị ${start}–${end} trong ${pagination.value.total.toLocaleString()} bài`
})

const kpiCards = computed(() => {
  const s = summary.value || {}
  const total = s.totalSongs || 0
  const coverageRate = total ? ((s.songsWithLyrics / total) * 100).toFixed(1) : 0
  
  return [
    {
      title: 'Tổng bài hát',
      value: total,
      subtitle: 'Trong thư viện',
      icon: 'library',
      tone: 'blue',
      filterState: { status: 'all', provider: 'all' }
    },
    {
      title: 'Có lyrics',
      value: s.songsWithLyrics || 0,
      subtitle: `${coverageRate}% đã có lời`,
      icon: 'check-circle',
      tone: 'green',
      filterState: { status: 'has_lyrics', provider: 'all' }
    },
    {
      title: 'Đồng bộ',
      value: s.syncedLyricsCount || 0,
      subtitle: 'Có timestamp',
      icon: 'karaoke',
      tone: 'purple',
      filterState: { status: 'synced', provider: 'all' }
    },
    {
      title: 'Lyrics thường',
      value: s.plainLyricsCount || 0,
      subtitle: 'Chưa có timestamp',
      icon: 'article',
      tone: 'amber',
      filterState: { status: 'plain', provider: 'all' }
    },
    {
      title: 'LRCLIB',
      value: s.lrclibCount || 0,
      subtitle: 'Nguồn tự động',
      icon: 'download',
      tone: 'cyan',
      filterState: { status: 'all', provider: 'LRCLIB' }
    },
    {
      title: 'Thiếu lyrics',
      value: s.songsMissingLyrics || 0,
      subtitle: 'Cần bổ sung',
      icon: 'warning',
      tone: 'rose',
      filterState: { status: 'missing', provider: 'all' }
    }
  ]
})

const isKpiActive = (item) => {
  if (!item.filterState) return false
  return Object.entries(item.filterState).every(([k, v]) => filters.value[k] === v)
}

const applyKpiFilter = (item) => {
  if (!item.filterState) return
  filters.value = { ...filters.value, status: 'all', provider: 'all', market: 'all' }
  Object.assign(filters.value, item.filterState)
}

const filters = ref({
  q: '',
  status: 'all',
  provider: 'all',
  market: 'all'
})

const searchInput = ref('')
const searchHistory = ref(JSON.parse(localStorage.getItem('adminLyricsSearchHistory') || '[]'))
const showHistory = ref(false)
let searchTimeout = null

const handleSearchInput = () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    filters.value.q = searchInput.value.trim()
  }, 500)
}

const handleEnter = () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  const term = searchInput.value.trim()
  filters.value.q = term
  if (term && !searchHistory.value.includes(term)) {
    searchHistory.value.unshift(term)
    if (searchHistory.value.length > 5) searchHistory.value.pop()
    localStorage.setItem('adminLyricsSearchHistory', JSON.stringify(searchHistory.value))
  }
  showHistory.value = false
}

const selectHistoryItem = (item) => {
  searchInput.value = item
  filters.value.q = item
  showHistory.value = false
}

const clearSearch = () => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchInput.value = ''
  filters.value.q = ''
  showHistory.value = false
}

const handleBlur = () => {
  setTimeout(() => {
    showHistory.value = false
  }, 200)
}

const removeHistoryItem = (item) => {
  searchHistory.value = searchHistory.value.filter(i => i !== item)
  localStorage.setItem('adminLyricsSearchHistory', JSON.stringify(searchHistory.value))
}

const fetchSummary = async () => {
  try {
    const res = await api.get('/admin/lyrics/summary')
    if (res.data?.success) {
      summary.value = res.data.data
    }
  } catch (err) {
    console.error('Failed to fetch summary:', err)
  }
}

const fetchSongs = async (page = 1) => {
  try {
    loading.value = true
    const res = await api.get('/admin/lyrics', {
      params: { ...filters.value, page, limit: pagination.value.limit }
    })
    if (res.data?.success) {
      songs.value = res.data.data
      pagination.value = res.data.pagination
      if (tableContainer.value) {
        tableContainer.value.scrollTop = 0
      }
    }
  } catch (err) {
    console.error('Failed to fetch songs:', err)
  } finally {
    loading.value = false
  }
}

const resetFilters = () => {
  filters.value = { q: '', status: 'all', provider: 'all', market: 'all' }
  searchInput.value = ''
  fetchSongs(1)
}

watch(filters, () => fetchSongs(1), { deep: true })

const viewDetail = (song) => {
  router.push(`/admin/lyrics/${song.song_id}`)
}

const exportBacklog = async () => {
  try {
    const res = await api.get('/admin/lyrics/backlog/export', { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'lyrics_backlog.csv')
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Lỗi export backlog:', err)
  }
}

const exportAudit = async () => {
  try {
    const res = await api.get('/admin/lyrics/audit/export', { responseType: 'blob' })
    const url = window.URL.createObjectURL(new Blob([res.data]))
    const link = document.createElement('a')
    link.href = url
    link.setAttribute('download', 'lyrics_audit.csv')
    document.body.appendChild(link)
    link.click()
    link.remove()
    window.URL.revokeObjectURL(url)
  } catch (err) {
    console.error('Lỗi export audit:', err)
  }
}

const calculatePercentage = (value, total) => {
  if (!total) return 0
  return ((value / total) * 100).toFixed(1)
}

onMounted(() => {
  fetchSummary()
  fetchSongs(1)
})
</script>

<template>
  <div class="flex-1 flex flex-col bg-slate-50 relative overflow-hidden full-bleed">
    <!-- Header -->
    <header class="py-6 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0">
      <div>
        <h1 class="text-2xl font-bold text-slate-900">Quản lý lời bài hát</h1>
        <p class="text-sm text-slate-500 mt-1">Xem, kiểm tra và chỉnh sửa lời bài hát trong hệ thống</p>
      </div>
      <div class="flex items-center gap-3">
        <button @click="fetchSummary(); fetchSongs(pagination.page)" class="inline-flex items-center px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition">
          <MfIcon name="refresh" size="18" class="mr-2" />
          Refresh
        </button>
        <button @click="exportBacklog" class="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary-dark transition shadow-sm">
          <MfIcon name="download" size="18" class="mr-2" />
          Export Backlog
        </button>
        <button @click="exportAudit" class="inline-flex items-center px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition shadow-sm">
          <MfIcon name="policy" size="18" class="mr-2" />
          Export Audit
        </button>
      </div>
    </header>

    <div class="flex-1 overflow-y-auto p-6 flex flex-col">
      <!-- KPI Cards -->
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 mb-6">
        <AdminKpiCard
          v-for="item in kpiCards"
          :key="item.title"
          v-bind="item"
          :showIcon="false"
          compact
          :loading="loading && !summary.totalSongs"
          @click="applyKpiFilter(item)"
          class="cursor-pointer hover:bg-slate-50"
        />
      </div>

      <!-- Filters -->
      <AdminFilterBar>
        <div class="flex-1 min-w-[200px] relative">
          <label class="block text-xs font-medium text-slate-500 mb-1.5">Tìm kiếm</label>
          <div class="relative">
            <input 
              v-model="searchInput" 
              @input="handleSearchInput"
              @keyup.enter="handleEnter()"
              @focus="showHistory = true"
              @blur="handleBlur"
              type="text" 
              placeholder="Nhập tên bài hát, nghệ sĩ để tìm kiếm. " 
              class="w-full pl-3 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
            <button v-if="searchInput" @click="clearSearch" class="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
              <MfIcon name="close" size="16" />
            </button>
          </div>
          <div v-if="showHistory && searchHistory.length > 0" class="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
            <div class="px-3 py-2 text-xs font-bold text-slate-500 bg-slate-50 border-b border-slate-100 flex justify-between">
              Lịch sử tìm kiếm
            </div>
            <ul>
              <li v-for="item in searchHistory" :key="item" class="flex items-center justify-between px-3 py-2 hover:bg-slate-50 cursor-pointer group" @mousedown.prevent="selectHistoryItem(item)">
                <span class="text-sm text-slate-700 flex-1 truncate"><MfIcon name="history" size="14" class="inline align-middle mr-1 text-slate-400" /> {{ item }}</span>
                <button @mousedown.prevent.stop="removeHistoryItem(item)" class="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-500">
                  <MfIcon name="close" size="14" />
                </button>
              </li>
            </ul>
          </div>
        </div>
        <div class="w-40">
          <label class="block text-xs font-medium text-slate-500 mb-1.5">Trạng thái</label>
          <select v-model="filters.status" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="all">Tất cả</option>
            <option value="missing">Thiếu lyrics</option>
            <option value="has_lyrics">Có lyrics</option>
            <option value="synced">Lyrics đồng bộ</option>
            <option value="plain">Lyrics thường</option>
          </select>
        </div>
        <div class="w-40">
          <label class="block text-xs font-medium text-slate-500 mb-1.5">Provider</label>
          <select v-model="filters.provider" class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="all">Tất cả</option>
            <option value="LRCLIB">LRCLIB</option>
            <option value="MANUAL">Manual</option>
          </select>
        </div>
        <AdminResetButton @click="resetFilters" class="h-[38px] mt-[auto]" />
      </AdminFilterBar>

      <!-- Table -->
      <AdminTableShell maxHeight="375px" style="min-height: 375px;" :loading="loading" :empty="!loading && songs.length === 0" emptyTitle="Không tìm thấy bài hát nào" emptyDescription="Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm.">
        <table class="w-full text-left text-sm whitespace-nowrap table-fixed min-w-[900px]">
          <thead class="bg-slate-50 sticky top-0 z-20 shadow-[0_1px_0_0_#e2e8f0]">
            <tr>
              <th class="px-4 py-3 font-semibold text-black uppercase text-xs w-20">Cover</th>
              <th class="px-4 py-3 font-semibold text-black uppercase text-xs w-[35%]">Bài hát</th>
              <th class="px-4 py-3 font-semibold text-black uppercase text-xs w-[25%]">Nghệ sĩ</th>
              <th class="px-4 py-3 font-semibold text-black uppercase text-xs w-32">Trạng thái</th>
              <th class="px-4 py-3 font-semibold text-black uppercase text-xs w-32">Provider</th>
              <th class="px-4 py-3 font-semibold text-black uppercase text-xs text-right w-40 sticky right-0 bg-slate-50 z-30 shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">Actions</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-slate-100 relative">
              <tr v-for="song in songs" :key="song.song_id" class="hover:bg-slate-50 transition group" :class="{'opacity-50 pointer-events-none': loading}">
                <td class="px-4 py-3">
                  <img :src="song.cover_url" class="w-10 h-10 rounded object-cover border border-slate-200">
                </td>
                <td class="px-4 py-3 font-medium text-slate-800 truncate" :title="song.title">{{ song.title }}</td>
                <td class="px-4 py-3 text-slate-500 truncate" :title="song.artist_name">{{ song.artist_name }}</td>
                <td class="px-4 py-3">
                  <span v-if="song.lyrics_status === 'synced'" class="px-2.5 py-1 text-xs font-semibold rounded-full bg-emerald-100 text-emerald-700">Đồng bộ</span>
                  <span v-else-if="song.lyrics_status === 'plain'" class="px-2.5 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">Thường</span>
                  <span v-else class="px-2.5 py-1 text-xs font-semibold rounded-full bg-rose-100 text-rose-700">Thiếu</span>
                </td>
                <td class="px-4 py-3">
                  <span v-if="song.provider" :class="{'text-primary': song.provider === 'MANUAL', 'text-slate-500': song.provider !== 'MANUAL'}" class="font-medium text-xs border px-1.5 py-0.5 rounded">{{ song.provider }}</span>
                  <span v-else class="text-slate-400">-</span>
                </td>
                <td class="px-4 py-3 text-right sticky right-0 bg-white group-hover:bg-slate-50 transition shadow-[-4px_0_10px_rgba(0,0,0,0.02)] z-10">
                  <button @click="viewDetail(song)" class="px-3 py-1.5 text-xs font-medium text-primary bg-primary-50 rounded hover:bg-primary-100 transition">
                    Xem / Sửa lyrics
                  </button>
                </td>
              </tr>
          </tbody>
        </table>
      </AdminTableShell>

      <!-- Pagination -->
      <div class="py-4 flex items-center justify-between" v-if="pagination.total > 0">
        <p class="text-sm text-slate-500">{{ displayRange }}</p>
        <div v-if="pagination.totalPages > 1">
          <AdminPagination :limit="20" :currentPage="pagination.page" :totalPages="pagination.totalPages" @update:currentPage="p => { pagination.page = p; fetchSongs(p); }" />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.full-bleed {
  margin: -24px;
  height: calc(100% + 48px);
}
@media (max-width: 900px) {
  .full-bleed {
    margin: -18px;
    height: calc(100% + 36px);
  }
}
</style>

