<script setup>
import { ref, onMounted, watch, computed } from 'vue'
import { useRouter } from 'vue-router'
import api from '@/api/axios'
import AdminPagination from '@/components/admin/AdminPagination.vue'
import AdminKpiCard from '@/components/admin/AdminKpiCard.vue'

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
      icon: 'library_music',
      tone: 'blue'
    },
    {
      title: 'Có lyrics',
      value: s.songsWithLyrics || 0,
      subtitle: `${coverageRate}% đã có lời`,
      icon: 'check_circle',
      tone: 'green'
    },
    {
      title: 'Đồng bộ',
      value: s.syncedLyricsCount || 0,
      subtitle: 'Có timestamp',
      icon: 'format_align_left',
      tone: 'purple'
    },
    {
      title: 'Lyrics thường',
      value: s.plainLyricsCount || 0,
      subtitle: 'Chưa có timestamp',
      icon: 'notes',
      tone: 'amber'
    },
    {
      title: 'LRCLIB',
      value: s.lrclibCount || 0,
      subtitle: 'Nguồn tự động',
      icon: 'cloud_download',
      tone: 'cyan'
    },
    {
      title: 'Thiếu lyrics',
      value: s.songsMissingLyrics || 0,
      subtitle: 'Cần bổ sung',
      icon: 'warning',
      tone: 'rose'
    }
  ]
})

const filters = ref({
  q: '',
  status: 'all',
  provider: 'all',
  market: 'all'
})

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
          :show-icon="false"
          compact
          :loading="loading && !summary.totalSongs"
        />
      </div>

      <!-- Filters -->
      <div class="bg-white rounded-xl border border-slate-200 p-4 mb-6 shadow-sm">
        <div class="flex flex-wrap items-end gap-3">
          <div class="flex-1 min-w-[200px]">
            <label class="block text-xs font-medium text-slate-500 mb-1.5">Tìm kiếm</label>
            <input v-model.lazy="filters.q" type="text" placeholder="Bài hát, nghệ sĩ..." class="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500">
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
          <button @click="resetFilters" class="px-3 py-2 text-sm font-medium text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition">
            Reset
          </button>
        </div>
      </div>

      <!-- Table -->
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col flex-1 min-h-[500px]">
        <div ref="tableContainer" class="overflow-auto flex-1 relative">
          <table class="w-full text-left text-sm whitespace-nowrap table-fixed min-w-[900px]">
            <thead class="bg-slate-50 sticky top-0 z-20 shadow-[0_1px_0_0_#e2e8f0]">
              <tr>
                <th class="px-4 py-3 font-semibold text-black w-20">Cover</th>
                <th class="px-4 py-3 font-semibold text-black w-[35%]">Bài hát</th>
                <th class="px-4 py-3 font-semibold text-black w-[25%]">Nghệ sĩ</th>
                <th class="px-4 py-3 font-semibold text-black w-32">Trạng thái</th>
                <th class="px-4 py-3 font-semibold text-black w-32">Provider</th>
                <th class="px-4 py-3 font-semibold text-black text-right w-40 sticky right-0 bg-slate-50 z-30 shadow-[-4px_0_10px_rgba(0,0,0,0.02)]">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100 relative">
              <tr v-if="loading && songs.length === 0" class="animate-pulse">
                <td colspan="6" class="p-8 text-center text-slate-400">Đang tải...</td>
              </tr>
              <tr v-else-if="!loading && songs.length === 0">
                <td colspan="6" class="p-8 text-center text-slate-400">Không tìm thấy bài hát nào</td>
              </tr>
              <template v-else>
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
              </template>
            </tbody>
          </table>
        </div>
        
        <!-- Pagination -->
        <div class="px-6 py-4 border-t border-slate-200 flex items-center justify-between bg-slate-50" v-if="pagination.total > 0">
          <p class="text-sm text-slate-500">{{ displayRange }}</p>
          <div v-if="pagination.totalPages > 1">
            <AdminPagination :currentPage="pagination.page" :totalPages="pagination.totalPages" @update:currentPage="p => { pagination.page = p; fetchSongs(p); }" />
          </div>
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

