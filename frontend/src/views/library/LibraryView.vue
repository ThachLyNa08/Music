<template>
  <div class="library-page user-page-bg">
    <div class="header-glass user-panel">
      <h1>Thư viện của tôi</h1>
      <button class="btn-create user-primary-btn" @click="showCreateModal = true">
        <svg viewBox="0 0 24 24"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
        Tạo playlist
      </button>
    </div>
    
    <!-- Tabs -->
    <div class="tabs-container">
      <div class="flex gap-2 overflow-x-auto pb-2">
        <button 
          class="tab-btn px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap"
          :class="{ 'active': activeTab === 'playlists' }"
          @click="switchTab('playlists')"
        >
          Playlist
        </button>
        <button 
          class="tab-btn px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap"
          :class="{ 'active': activeTab === 'albums' }"
          @click="switchTab('albums')"
        >
          Album
          <span v-if="albumCount > 0" class="ml-1 text-xs opacity-70">({{ albumCount }})</span>
        </button>
        <button 
          class="tab-btn px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap"
          :class="{ 'active': activeTab === 'singles' }"
          @click="switchTab('singles')"
        >
          Single
          <span v-if="singleCount > 0" class="ml-1 text-xs opacity-70">({{ singleCount }})</span>
        </button>
        <button 
          class="tab-btn px-4 py-2 rounded-full text-sm font-bold transition-all whitespace-nowrap"
          :class="{ 'active': activeTab === 'artists' }"
          @click="switchTab('artists')"
        >
          Nghệ sĩ đã theo dõi
          <span v-if="followedCount > 0" class="ml-1 text-xs opacity-70">({{ followedCount }})</span>
        </button>
      </div>
    </div>

    <!-- Playlists Tab -->
    <div v-if="activeTab === 'playlists'">
      <div v-if="loading" class="loading-state">Loading playlists...</div>

      <div v-else-if="paginatedPlaylists.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
        </div>
        <h2>Thư viện của bạn đang trống</h2>
        <p>Hãy tạo playlist đầu tiên để bắt đầu trải nghiệm âm nhạc.</p>
      </div>

      <div v-else class="library-grid-wrap">
        <div class="playlist-grid">
          <RouterLink 
            v-for="p in paginatedPlaylists" 
            :key="`playlist-${p.id || p.name}`" 
            class="playlist-card user-card user-card-hover"
            :to="`/playlist/${p.id}`"
          >
            <div class="card-art">
              <CoverImage v-if="getLibraryItemCover(p)" :src="getLibraryItemCover(p)" />
              <div v-else class="placeholder-art">
                <svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
              </div>
            </div>
            <h3>{{ p.name }}</h3>
          </RouterLink>
        </div>

        <div v-if="playlistTotalPages > 1" class="pagination">
          <button class="pagination-btn" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)">&lt;</button>
          <div class="pagination-pages">
            <button v-for="page in playlistTotalPages" :key="`playlist-page-${page}`" class="page-dot" :class="{ active: page === currentPage }" @click="goToPage(page)">{{ page }}</button>
          </div>
          <span class="pagination-label">Trang {{ currentPage }} / {{ playlistTotalPages }}</span>
          <button class="pagination-btn" :disabled="currentPage === playlistTotalPages" @click="goToPage(currentPage + 1)">&gt;</button>
        </div>
      </div>
    </div>

    <!-- Albums Tab -->
    <div v-if="activeTab === 'albums'">
      <div v-if="loading" class="loading-state">Loading albums...</div>

      <div v-else-if="paginatedAlbums.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
        </div>
        <h2>Bạn chưa thêm album nào</h2>
        <p>Hãy thêm album yêu thích vào thư viện.</p>
      </div>

      <div v-else class="library-grid-wrap">
        <div class="library-cards-grid">
          <MediaCard
            v-for="a in paginatedAlbums" 
            :key="`album-${a.id}`" 
            :item="a"
            type="album"
          />
        </div>

        <div v-if="albumTotalPages > 1" class="pagination">
          <button class="pagination-btn" :disabled="albumPage === 1" @click="albumPage--">&lt;</button>
          <div class="pagination-pages">
            <button v-for="page in albumTotalPages" :key="`album-page-${page}`" class="page-dot" :class="{ active: page === albumPage }" @click="albumPage = page">{{ page }}</button>
          </div>
          <span class="pagination-label">Trang {{ albumPage }} / {{ albumTotalPages }}</span>
          <button class="pagination-btn" :disabled="albumPage === albumTotalPages" @click="albumPage++">&gt;</button>
        </div>
      </div>
    </div>

    <!-- Singles Tab -->
    <div v-if="activeTab === 'singles'">
      <div v-if="loading" class="loading-state">Loading singles...</div>

      <div v-else-if="paginatedSingles.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
        </div>
        <h2>Bạn chưa thêm single nào</h2>
        <p>Hãy thêm single yêu thích vào thư viện.</p>
      </div>

      <div v-else class="library-grid-wrap">
        <div class="library-cards-grid">
          <MediaCard
            v-for="s in paginatedSingles" 
            :key="`single-${s.id}`" 
            :item="s"
            type="single"
          />
        </div>

        <div v-if="singleTotalPages > 1" class="pagination">
          <button class="pagination-btn" :disabled="singlePage === 1" @click="singlePage--">&lt;</button>
          <div class="pagination-pages">
            <button v-for="page in singleTotalPages" :key="`single-page-${page}`" class="page-dot" :class="{ active: page === singlePage }" @click="singlePage = page">{{ page }}</button>
          </div>
          <span class="pagination-label">Trang {{ singlePage }} / {{ singleTotalPages }}</span>
          <button class="pagination-btn" :disabled="singlePage === singleTotalPages" @click="singlePage++">&gt;</button>
        </div>
      </div>
    </div>

    <!-- Artists Tab -->
    <div v-if="activeTab === 'artists'">
      <div v-if="followedLoading" class="loading-state">Loading artists...</div>

      <div v-else-if="followedArtists.length === 0" class="empty-state">
        <div class="empty-icon">
          <svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
        </div>
        <h2>Bạn chưa theo dõi nghệ sĩ nào</h2>
        <p>Hãy khám phá nghệ sĩ yêu thích để nhận gợi ý phù hợp hơn.</p>
        <button @click="$router.push('/')" class="mt-6 user-primary-btn">
          Khám phá nghệ sĩ
        </button>
      </div>

      <div v-else class="playlist-grid artist-grid">
        <ArtistCard
          v-for="artist in followedArtists"
          :key="artist.id || artist.artist_id"
          :artist="artist"
        />
      </div>

      <!-- View All Link -->
      <div v-if="followedArtists.length > 0" class="view-all-container">
        <button @click="$router.push('/me/followed-artists')" class="view-all-btn">
          Xem tất cả nghệ sĩ đã theo dõi
          <svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
        </button>
      </div>
    </div>

    <!-- Create Modal -->
    <CreatePlaylistModal 
      v-if="showCreateModal" 
      :creating="creating"
      @close="showCreateModal = false"
      @create="handleCreate"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, computed, watch } from 'vue'
import { playlistApi } from '@/api/playlist'
import { useFollowedArtistsStore } from '@/stores/followedArtists'
import CreatePlaylistModal from '@/components/playlist/CreatePlaylistModal.vue'
import CoverImage from '@/components/common/CoverImage.vue'
import MediaCard from '@/components/common/MediaCard.vue'
import ArtistCard from '@/components/common/ArtistCard.vue'

const playlists = ref([])
const loading = ref(true)
const showCreateModal = ref(false)
const creating = ref(false)
const activeTab = ref('playlists')
const currentPage = ref(1)
const albumPage = ref(1)
const singlePage = ref(1)
const itemsPerPage = ref(10)

const LEGACY_NAMES = ['Daily Mix 1', 'Daily Mix 2', 'Morning Mix', 'Evening Mix']
const SYSTEM_ORDER = [
  'dailymix_01',
  'dailymix_02',
  'dailymix_03',
  'dailymix_04',
  'dailymix_05',
  'dailymix_06',
  'weeklymix',
  'morning_vibes',
  'night_vibes',
  'moodmix',
  'favorite_songs',
  'recently_played'
]

const followedArtistsStore = useFollowedArtistsStore()
const followedArtists = computed(() => followedArtistsStore.followedArtists)
const followedLoading = computed(() => followedArtistsStore.loading)
const followedCount = computed(() => followedArtistsStore.followedArtistCount)

// Filter playlist items (exclude albums/singles)
const playlistItems = computed(() => {
  return playlists.value
    .filter((item) => {
      // Only show items with item_type = 'playlist' or items without item_type but have system_key
      if (item.item_type === 'playlist' || (!item.item_type && (item.system_key || item.is_system))) {
        if (LEGACY_NAMES.includes(item.name)) return false
        if (item.is_system && !item.system_key) return false
        return true
      }
      return false
    })
    .sort((a, b) => {
      // Sort system playlists first in order
      if (a.system_key && b.system_key) {
        const aIndex = SYSTEM_ORDER.indexOf(a.system_key)
        const bIndex = SYSTEM_ORDER.indexOf(b.system_key)
        if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex
      }
      // System playlists before user playlists
      if (a.system_key && !b.system_key) return -1
      if (!a.system_key && b.system_key) return 1
      // Sort by date
      return new Date(b.updated_at || b.created_at || 0) - new Date(a.updated_at || a.created_at || 0)
    })
})

// Filter album items
const albumItems = computed(() => {
  return playlists.value
    .filter((item) => {
      // item_type = 'album' và album_type = 'album'
      if (item.item_type === 'album' && item.album_type === 'album') return true
      // hoặc không có item_type nhưng album_type = 'album'
      if (!item.item_type && item.album_type === 'album') return true
      return false
    })
    .sort((a, b) => new Date(b.saved_at || 0) - new Date(a.saved_at || 0))
})

// Filter single items
const singleItems = computed(() => {
  return playlists.value
    .filter((item) => {
      // item_type = 'album' và album_type = 'single'
      if (item.item_type === 'album' && item.album_type === 'single') return true
      // hoặc không có item_type nhưng album_type = 'single'
      if (!item.item_type && item.album_type === 'single') return true
      // item_type = 'single'
      if (item.item_type === 'single') return true
      return false
    })
    .sort((a, b) => new Date(b.saved_at || 0) - new Date(a.saved_at || 0))
})

// Counts
const albumCount = computed(() => albumItems.value.length)
const singleCount = computed(() => singleItems.value.length)

// Pagination for playlists
const playlistTotalPages = computed(() => Math.max(1, Math.ceil(playlistItems.value.length / itemsPerPage.value)))
const paginatedPlaylists = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage.value
  return playlistItems.value.slice(start, start + itemsPerPage.value)
})

// Pagination for albums
const albumTotalPages = computed(() => Math.max(1, Math.ceil(albumItems.value.length / itemsPerPage.value)))
const paginatedAlbums = computed(() => {
  const start = (albumPage.value - 1) * itemsPerPage.value
  return albumItems.value.slice(start, start + itemsPerPage.value)
})

// Pagination for singles
const singleTotalPages = computed(() => Math.max(1, Math.ceil(singleItems.value.length / itemsPerPage.value)))
const paginatedSingles = computed(() => {
  const start = (singlePage.value - 1) * itemsPerPage.value
  return singleItems.value.slice(start, start + itemsPerPage.value)
})

function updateItemsPerPage() {
  const width = window.innerWidth
  if (width < 640) itemsPerPage.value = 6
  else if (width < 1024) itemsPerPage.value = 8
  else itemsPerPage.value = 10
}

function switchTab(tab) {
  activeTab.value = tab
  currentPage.value = 1
  albumPage.value = 1
  singlePage.value = 1
}

function goToPage(page) {
  currentPage.value = Math.min(Math.max(page, 1), playlistTotalPages.value)
}

function getLibraryItemCover(item) {
  // Đọc từ nhiều field cover possible
  const raw =
    item?.cover_url ||
    item?.coverUrl ||
    item?.image_url ||
    item?.imageUrl ||
    item?.thumbnail_url ||
    item?.thumbnailUrl ||
    item?.cover ||
    item?.image ||
    null

  if (raw && raw.trim()) return raw

  // Fallback sang effective_cover_url (playlist)
  if (item?.effective_cover_url && item.effective_cover_url.trim()) {
    return item.effective_cover_url
  }

  // Không có cover - CoverImage component sẽ xử lý fallback
  return null
}

watch([playlistItems, albumItems, singleItems, itemsPerPage], () => {
  if (currentPage.value > playlistTotalPages.value) currentPage.value = playlistTotalPages.value
  if (albumPage.value > albumTotalPages.value) albumPage.value = albumTotalPages.value
  if (singlePage.value > singleTotalPages.value) singlePage.value = singleTotalPages.value
})

async function fetchPlaylists() {
  loading.value = true
  try {
    const res = await playlistApi.getMyPlaylists()
    if (res.data?.success) {
      playlists.value = res.data.data
    }
  } catch (err) {
    console.error(err)
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  updateItemsPerPage()
  window.addEventListener('resize', updateItemsPerPage)
  fetchPlaylists()
  // Fetch followed artists khi vào tab
  followedArtistsStore.fetchFollowedArtists()
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateItemsPerPage)
})

async function handleCreate(form) {
  creating.value = true
  
  const fd = new FormData()
  fd.append('name', form.name)
  fd.append('description', form.description)
  fd.append('is_public', form.is_public)
  if (form.coverFile) fd.append('cover', form.coverFile)

  try {
    const res = await playlistApi.create(fd)
    if (res.data?.success) {
      showCreateModal.value = false
      await fetchPlaylists() // reload list
    }
  } catch (err) {
    alert('Lỗi tạo playlist')
  } finally {
    creating.value = false
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;600;700;800;900&display=swap');

.library-page {
  padding: 32px 48px 144px;
  font-family: 'Be Vietnam Pro', sans-serif;
  color: #ffffff;
  min-height: 100%;
}

.header-glass {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 20px;
  padding: 20px 28px;
}

.header-glass h1 {
  font-size: 32px;
  font-weight: 900;
  margin: 0;
  letter-spacing: -0.02em;
  background: linear-gradient(135deg, #7C3AED, #3B82F6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.btn-create {
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}
.btn-create:hover {
  transform: translateY(-3px) scale(1.05);
  box-shadow: 0 15px 35px rgba(124, 58, 237, 0.5);
}
.btn-create svg {
  width: 20px; height: 20px; fill: currentColor;
}

/* Tabs */
.tabs-container {
  margin-bottom: 24px;
  padding: 0 8px;
}

.tab-btn {
  background: rgba(255, 255, 255, 0.05);
  color: rgba(255, 255, 255, 0.7);
  border: 1px solid rgba(255, 255, 255, 0.08);
}

.tab-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.tab-btn.active {
  background: white;
  color: black;
  border-color: white;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80px 20px;
  border-radius: 24px;
  border: 1px dashed rgba(124, 58, 237, 0.35);
  background: linear-gradient(135deg, rgba(76,29,149,0.12), rgba(15,23,42,0.78));
  backdrop-filter: blur(12px);
}

.empty-icon {
  width: 80px; height: 80px;
  border-radius: 50%;
  background: rgba(124, 58, 237, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 24px;
  color: #7C3AED;
}
.empty-icon svg { width: 40px; height: 40px; fill: currentColor; }

.empty-state h2 {
  font-size: 24px; font-weight: 800; margin: 0 0 12px; color: #ffffff;
}
.empty-state p {
  font-size: 15px; color: rgba(255, 255, 255, 0.7); margin: 0;
}

.library-grid-wrap {
  width: 100%;
  max-width: 1120px;
  margin: 0 auto;
}

.playlist-grid {
  display: grid;
  grid-template-columns: repeat(5, 176px);
  gap: 24px 22px;
  justify-content: center;
}

.library-cards-grid {
  display: grid;
  grid-template-columns: repeat(5, 176px);
  gap: 24px 22px;
  justify-content: center;
}

.artist-grid {
  grid-template-columns: repeat(5, 166px);
}

.playlist-card {
  width: 176px;
  min-height: 218px;
  padding: 12px;
  text-decoration: none;
  color: #ffffff;
  transition: transform 0.2s, box-shadow 0.2s, background-color 0.2s;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.playlist-card:hover {
  border-color: rgba(124, 58, 237, 0.3);
}

.card-art {
  width: 152px;
  height: 152px;
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 12px;
  background: rgba(124, 58, 237, 0.1);
  flex-shrink: 0;
}
.card-art img {
  width: 100%; height: 100%; object-fit: cover;
}
.placeholder-art {
  width: 100%;
  height: 100%;
  display: flex; align-items: center; justify-content: center;
  color: #7C3AED;
}
.placeholder-art svg { width: 48px; height: 48px; fill: currentColor; }

.playlist-card h3 {
  margin: 0; font-size: 15px; font-weight: 800;
  color: #ffffff;
  line-height: 1.25;
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.playlist-card p {
  margin: 0; font-size: 13px; color: rgba(255, 255, 255, 0.5); font-weight: 600;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 28px;
  margin-bottom: 12px;
  width: 100%;
}

.pagination-pages {
  display: flex;
  align-items: center;
  gap: 6px;
}

.pagination-btn,
.page-dot {
  min-width: 36px;
  height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.055);
  color: rgba(255, 255, 255, 0.82);
  font-size: 14px;
  font-weight: 800;
  cursor: pointer;
  transition: background-color 0.18s ease, color 0.18s ease, transform 0.18s ease;
}

.pagination-btn:hover:not(:disabled),
.page-dot:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  transform: translateY(-1px);
}

.pagination-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.page-dot.active {
  background: #7C3AED;
  border-color: #7C3AED;
  color: #ffffff;
}

.pagination-label {
  color: rgba(255, 255, 255, 0.62);
  font-size: 13px;
  font-weight: 700;
  min-width: 86px;
  text-align: center;
}

@media (max-width: 1279px) {
  .playlist-grid {
    grid-template-columns: repeat(4, 170px);
  }

  .artist-grid {
    grid-template-columns: repeat(4, 166px);
  }

  .playlist-card {
    width: 170px;
    min-height: 212px;
  }

  .card-art {
    width: 146px;
    height: 146px;
  }
}

@media (max-width: 1023px) {
  .library-page {
    padding: 28px 28px 144px;
  }

  .playlist-grid {
    grid-template-columns: repeat(3, 160px);
  }

  .artist-grid {
    grid-template-columns: repeat(3, 1fr);
  }

  .playlist-card {
    width: 160px;
    min-height: 202px;
  }

  .card-art {
    width: 136px;
    height: 136px;
  }
}

@media (max-width: 639px) {
  .library-page {
    padding: 22px 16px 144px;
  }

  .header-glass {
    align-items: flex-start;
    flex-direction: column;
    gap: 14px;
    padding: 18px;
  }

  .header-glass h1 {
    font-size: 26px;
  }

  .btn-create {
    width: 100%;
    justify-content: center;
  }

  .playlist-grid {
    grid-template-columns: repeat(2, minmax(140px, 1fr));
    gap: 16px;
  }

  .artist-grid {
    grid-template-columns: repeat(2, minmax(140px, 1fr));
  }

  .playlist-card {
    width: 100%;
    min-height: 0;
  }

  .card-art {
    width: 100%;
    height: auto;
    aspect-ratio: 1 / 1;
  }

  .pagination {
    flex-wrap: wrap;
    gap: 8px;
  }

  .pagination-label {
    order: 3;
    width: 100%;
  }
}

/* View All Button */
.view-all-container {
  margin-top: 32px;
  display: flex;
  justify-content: center;
}

.view-all-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 32px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.08);
  color: white;
  border: 1px solid rgba(255, 255, 255, 0.15);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.3s ease;
}

.view-all-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  border-color: rgba(255, 255, 255, 0.3);
  transform: scale(1.02);
}

/* Modal */
.modal-backdrop {
  position: fixed; inset: 0;
  background: rgba(0,0,0,0.5);
  backdrop-filter: blur(4px);
  display: flex; align-items: center; justify-content: center;
  z-index: 1000;
}

.modal-glass {
  background: rgba(17, 24, 39, 0.85);
  border: 1px solid rgba(255, 255, 255, 0.08);
  padding: 32px;
  border-radius: 24px;
  width: 100%; max-width: 400px;
  box-shadow: 0 20px 50px rgba(0,0,0,0.5);
  backdrop-filter: blur(20px);
  color: #ffffff;
}
.modal-glass h2 { margin: 0 0 24px; font-weight: 900; color: #ffffff; }

.form-group { margin-bottom: 16px; display: flex; flex-direction: column; gap: 8px; }
.row-group { flex-direction: row; align-items: center; justify-content: space-between; }
.form-group label { font-size: 13px; font-weight: 800; color: rgba(255, 255, 255, 0.6); text-transform: uppercase; }
.form-group input[type="text"], .form-group textarea {
  padding: 12px 16px; border-radius: 12px; border: 1px solid rgba(255, 255, 255, 0.08); background: rgba(255, 255, 255, 0.03);
  outline: none; font-family: inherit; transition: all 0.2s; color: white;
}
.form-group input:focus, .form-group textarea:focus { background: rgba(255, 255, 255, 0.05); border-color: #7C3AED; box-shadow: 0 0 15px rgba(124, 58, 237, 0.2); }
.form-group textarea { resize: vertical; min-height: 80px; }

.file-group { margin-top: 24px; }
.file-box {
  padding: 20px; border: 2px dashed rgba(124, 58, 237, 0.5); border-radius: 12px;
  text-align: center; cursor: pointer; color: #7C3AED; font-weight: 700;
  background: rgba(255, 255, 255, 0.01);
  transition: all 0.2s;
}
.file-box:hover {
  background: rgba(124, 58, 237, 0.05);
  border-color: #7C3AED;
}
.file-selected { color: #55efc4; }

.modal-actions { display: flex; gap: 12px; margin-top: 32px; }
.modal-actions button {
  flex: 1; padding: 12px; border-radius: 12px; font-weight: 800; border: none; cursor: pointer;
  transition: all 0.2s;
}
.btn-cancel { background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.7); }
.btn-cancel:hover { background: rgba(255, 255, 255, 0.12); color: white; }
.btn-submit { background: linear-gradient(135deg, #7C3AED, #3B82F6); color: white; box-shadow: 0 5px 15px rgba(124, 58, 237, 0.3); }
.btn-submit:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 8px 20px rgba(124, 58, 237, 0.5); }
.btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
