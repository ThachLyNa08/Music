<template>
  <div class="search-page user-page-bg">
    <!-- Search Bar -->
    <section class="search-bar-section user-panel-soft">
      <div class="search-bar" :class="{ focused: isInputFocused }">
        <svg class="search-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-4.1-4.1" />
        </svg>
        <input
          ref="searchInput"
          v-model="query"
          type="text"
          placeholder="Bạn muốn nghe gì?"
          aria-label="Tìm kiếm nhạc"
          @focus="isInputFocused = true"
          @blur="handleBlur"
          @keyup.enter="executeSearch"
        />
        <button v-if="query.length > 0" class="clear-btn" @click="clearSearch" aria-label="Xóa">
          <svg viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" /></svg>
        </button>
      </div>

      <!-- Autocomplete Suggestions Dropdown -->
      <div v-if="showSuggestions && suggestions.length > 0" class="suggestions-dropdown">
        <div
          v-for="(s, i) in suggestions"
          :key="i"
          class="suggestion-item"
          @mousedown.prevent="applySuggestion(s)"
        >
          <div class="suggestion-icon-wrap">
            <svg v-if="s.type === 'artist'" viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
            <svg v-else-if="s.type === 'album'" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="12" cy="12" r="3" /></svg>
            <svg v-else viewBox="0 0 24 24"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
          </div>
          <div class="suggestion-text">
            <span class="suggestion-main">{{ s.text }}</span>
            <span class="suggestion-sub">
              {{ s.subtitle || (s.type === 'artist' ? 'Nghệ sĩ' : s.type === 'album' ? 'Album' : 'Bài hát') }}
            </span>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ SEARCH RESULTS ═══ -->
    <section v-if="hasSearched && !isSearching" class="results-section">
      <!-- No results -->
      <div v-if="totalResults === 0" class="no-results">
        <svg viewBox="0 0 80 80"><circle cx="35" cy="35" r="22" /><path d="m62 62-12-12" /></svg>
        <h3>Không tìm thấy kết quả cho "{{ lastQuery }}"</h3>
        <p>Hãy thử tìm kiếm bằng từ khóa khác, kiểm tra chính tả hoặc bỏ dấu tiếng Việt.</p>
      </div>

      <template v-else>
        <!-- ── Artist Cards ── -->
        <div v-if="artistResults.length > 0" class="result-group user-panel-soft">
          <h2>Nghệ sĩ</h2>
          <div class="artist-cards">
            <ArtistCard
              v-for="artist in artistResults"
              :key="artist.id || artist.artist_id"
              :artist="artist"
            />
          </div>
        </div>

        <!-- ── Top Result + Songs ── -->
        <div class="results-grid" :class="{ 'no-top': artistResults.length > 0 }">
          <!-- Top Result Card (show only if no artist match or first song is very relevant) -->
          <div v-if="songResults.length > 0 && artistResults.length === 0" class="top-result-section user-panel-soft">
            <h2>Kết quả hàng đầu</h2>
            <div class="top-result-card" @click="$router.push(`/song/${songResults[0].id}`)">
              <div class="top-cover" :style="getCoverStyle(songResults[0])"></div>
              <h3 class="top-title">{{ songResults[0].title }}</h3>
              <p class="top-meta">
                <span class="top-artist" @click.stop="goToArtist(songResults[0])">{{ songResults[0].artist_name || songResults[0].artist }}</span>
                <span class="top-badge">Bài hát</span>
              </p>
              <button class="play-fab" @click.stop="playSong(songResults[0])">
                <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              </button>
            </div>
          </div>

          <!-- Songs List -->
          <div v-if="songResults.length > 0" class="songs-list-section user-panel-soft">
            <h2>Bài hát</h2>
            <div class="songs-list">
              <SongRow
                v-for="(song, idx) in songResults.slice(0, 8)"
                :key="song.id || idx"
                :song="song"
                :index="idx + 1"
                :showIndex="false"
                :showAlbum="false"
                :compact="true"
                @play="playSong"
                @open-menu="handleOpenMenu"
                @toggle-like="toggleLike"
              />
            </div>
          </div>
        </div>

        <!-- ── Albums ── -->
        <div v-if="albumResults.length > 0" class="result-group user-panel-soft">
          <h2>Album</h2>
          <div class="album-cards">
            <MediaCard
              v-for="album in albumResults"
              :key="album.id"
              :item="album"
              :type="album.album_type || album.type || 'album'"
            />
          </div>
        </div>

        <!-- ── Genres ── -->
        <div v-if="genreResults.length > 0" class="result-group user-panel-soft">
          <h2>Thể loại</h2>
          <div class="genre-chips-result">
            <button
              v-for="genre in genreResults"
              :key="genre.id"
              class="genre-chip-result"
              @click="query = genre.name; executeSearch()"
            >
              <svg viewBox="0 0 24 24"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
              <span>{{ genre.name }}</span>
              <small>{{ genre.song_count }} bài hát</small>
            </button>
          </div>
        </div>
      </template>
    </section>

    <!-- Loading State -->
    <section v-if="isSearching" class="loading-section">
      <div class="loading-spinner"></div>
      <p>Đang tìm kiếm...</p>
    </section>

    <!-- ═══ BROWSE SECTION (no search) ═══ -->
    <section v-if="!hasSearched && !isSearching" class="browse-section">
      <!-- Recent Searches -->
      <div v-if="recentSearches.length > 0" class="recent-section user-panel-soft">
        <div class="section-header">
          <h2>Tìm kiếm gần đây</h2>
          <button class="clear-history-btn" @click="clearHistory">Xóa tất cả</button>
        </div>
        <div class="recent-chips">
          <button v-for="(term, i) in recentSearches" :key="i" class="recent-chip" @click="query = term; executeSearch()">
            <svg viewBox="0 0 24 24"><path d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            {{ term }}
            <span class="chip-remove" @click.stop="removeRecent(i)">×</span>
          </button>
        </div>
      </div>

      <!-- Popular Artists -->
      <div v-if="trendingSuggestions.length > 0" class="trending-section user-panel-soft">
        <h2>Nghệ sĩ phổ biến</h2>
        <div class="trending-chips">
          <button v-for="(s, i) in trendingSuggestions" :key="i" class="trending-chip" @click="query = s.text; executeSearch()">
            <svg viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            {{ s.text }}
          </button>
        </div>
      </div>

      <!-- Genre Browse -->
      <div class="genres-section user-panel-soft">
        <h2>Thể loại bạn hay nghe</h2>
        <div class="genre-grid">
          <div
            v-for="genre in displayBrowseGenres"
            :key="genre.key"
            class="genre-card"
            @click="query = genre.name; executeSearch()"
          >
            <img
              :src="formatImageUrl(genre.cover_url)"
              :alt="genre.name"
              class="genre-card__image"
              loading="lazy"
              @error="handleGenreImageError"
            />
          </div>
        </div>
      </div>
    </section>

    <!-- Action Menu -->
    <SongActionMenu
      :show="menuState.show"
      :position="menuState.position"
      :song="menuState.song"
      :isLiked="library.isLiked(menuState.song)"
      @close="menuState.show = false"
      @add-to-playlist="handleAddToPlaylist"
      @toggle-like="toggleLike"
      @add-to-queue="handleAddToQueue"
      @go-to-song="handleGoToSong"
      @go-to-artist="handleGoToArtist"
      @go-to-album="handleGoToAlbum"
      @share="handleShare"
    />
  </div>
</template>

<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import { songApi } from '@/api/song'
import api from '@/api/axios'
import { formatImageUrl } from '@/utils/formatters'
import SongRow from '@/components/common/SongRow.vue'
import SongActionMenu from '@/components/common/SongActionMenu.vue'
import MediaCard from '@/components/common/MediaCard.vue'
import ArtistCard from '@/components/common/ArtistCard.vue'

const router = useRouter()
const player = usePlayerStore()
const library = useLibraryStore()

const query = ref('')
const isInputFocused = ref(false)
const searchInput = ref(null)

const songResults = ref([])
const artistResults = ref([])
const albumResults = ref([])
const genreResults = ref([])
const suggestions = ref([])
const trendingSuggestions = ref([])
const hasSearched = ref(false)
const isSearching = ref(false)
const lastQuery = ref('')
const recentSearches = ref([])
const userTopGenres = ref([])

let suggestionTimer = null
let searchTimer = null

const totalResults = computed(() => {
  return songResults.value.length + artistResults.value.length + albumResults.value.length + genreResults.value.length
})

const showSuggestions = computed(() => {
  return isInputFocused.value && query.value.length >= 1 && !hasSearched.value
})

const fullGenreCovers = [
  { name: 'Kpop Gen 2', key: 'kpop-gen2', cover_url: '/uploads/img/genre/kpop-gen2.png' },
  { name: 'Kpop Gen 3', key: 'kpop-gen3', cover_url: '/uploads/img/genre/kpop-gen3.png' },
  { name: 'Kpop Gen 4', key: 'kpop-gen4', cover_url: '/uploads/img/genre/kpop-gen4.png' },
  { name: 'Kpop Gen 5', key: 'kpop-gen5', cover_url: '/uploads/img/genre/kpop-gen5.png' },
  { name: 'Vpop Mainstream', key: 'vpop-mainstream', cover_url: '/uploads/img/genre/vpop-mainstream.png' },
  { name: 'Vpop Gen Z', key: 'vpop-genz', cover_url: '/uploads/img/genre/vpop-genz.png' },
  { name: 'Vpop Indie Chill', key: 'vpop-indie-chill', cover_url: '/uploads/img/genre/vpop-indie-chill.png' },
  { name: 'Vpop Bolero/Folk', key: 'vpop-bolero-folk', cover_url: '/uploads/img/genre/vpop-bolero-folk.png' },
  { name: 'Vpop Rap/Hip-Hop', key: 'vpop-rap-hiphop', cover_url: '/uploads/img/genre/vpop-rap-hiphop.png' },
  { name: 'USUK Pop', key: 'usuk-pop', cover_url: '/uploads/img/genre/usuk-pop.png' },
  { name: 'USUK Rap', key: 'usuk-rap', cover_url: '/uploads/img/genre/usuk-rap.png' },
  { name: 'USUK R&B', key: 'usuk-rnb', cover_url: '/uploads/img/genre/usuk-rnb.png' },
  { name: 'USUK Rock/Indie', key: 'usuk-rock-indie', cover_url: '/uploads/img/genre/usuk-rock-indie.png' },
  { name: 'USUK EDM', key: 'usuk-edm', cover_url: '/uploads/img/genre/usuk-edm.png' },
]

const MAX_BROWSE_GENRES = 8

function normalizeGenreKey(name = '') {
  const value = name.toLowerCase()

  if (value.includes('kpop') || value.includes('k-pop')) {
    if (value.includes('gen 2') || value.includes('gen2')) return 'kpop-gen2'
    if (value.includes('gen 3') || value.includes('gen3')) return 'kpop-gen3'
    if (value.includes('gen 4') || value.includes('gen4')) return 'kpop-gen4'
    if (value.includes('gen 5') || value.includes('gen5')) return 'kpop-gen5'
    return 'kpop-gen4'
  }

  if (value.includes('vpop') || value.includes('v-pop')) {
    if (value.includes('rap') || value.includes('hip')) return 'vpop-rap-hiphop'
    if (value.includes('bolero') || value.includes('folk')) return 'vpop-bolero-folk'
    if (value.includes('indie') || value.includes('chill')) return 'vpop-indie-chill'
    if (value.includes('gen z') || value.includes('genz')) return 'vpop-genz'
    return 'vpop-mainstream'
  }

  if (value.includes('usuk') || value.includes('us-uk') || value.includes('us uk')) {
    if (value.includes('rap') || value.includes('hip')) return 'usuk-rap'
    if (value.includes('r&b') || value.includes('rnb')) return 'usuk-rnb'
    if (value.includes('rock') || value.includes('indie')) return 'usuk-rock-indie'
    if (value.includes('edm')) return 'usuk-edm'
    return 'usuk-pop'
  }

  if (value.includes('edm')) return 'usuk-edm'
  if (value.includes('r&b') || value.includes('rnb')) return 'usuk-rnb'
  if (value.includes('rock')) return 'usuk-rock-indie'
  if (value.includes('rap') || value.includes('hip')) return 'vpop-rap-hiphop'
  if (value.includes('pop')) return 'vpop-mainstream'

  return null
}

const displayBrowseGenres = computed(() => {
  const selected = []
  const used = new Set()

  for (const userGenre of userTopGenres.value || []) {
    const key = normalizeGenreKey(userGenre.name || userGenre.slug || '')
    if (!key) continue
    const genreCard = fullGenreCovers.find(g => g.key === key)
    if (genreCard && !used.has(genreCard.key)) {
      selected.push({ ...genreCard, listen_count: userGenre.listen_count || 0 })
      used.add(genreCard.key)
    }
    if (selected.length >= MAX_BROWSE_GENRES) return selected
  }

  const fallbackKeys = [
    'kpop-gen4', 'kpop-gen5', 'vpop-mainstream', 'vpop-genz',
    'vpop-indie-chill', 'usuk-pop', 'usuk-rnb', 'usuk-edm'
  ]
  for (const key of fallbackKeys) {
    const genreCard = fullGenreCovers.find(g => g.key === key)
    if (genreCard && !used.has(genreCard.key)) {
      selected.push(genreCard)
      used.add(genreCard.key)
    }
    if (selected.length >= MAX_BROWSE_GENRES) return selected
  }

  return selected
})

onMounted(async () => {
  library.fetchLikedSongs()
  try {
    const saved = localStorage.getItem('musicflow_recent_searches')
    if (saved) recentSearches.value = JSON.parse(saved)
  } catch {}
  try {
    const res = await songApi.getSuggestions('')
    if (res.data?.success) trendingSuggestions.value = res.data.data
  } catch {}
  try {
    const res = await api.get('/users/me/profile')
    if (res.data?.success && res.data.data?.top_genres) {
      userTopGenres.value = res.data.data.top_genres
    }
  } catch {}
})

// ── Real-time search as user types ──
watch(query, (val) => {
  clearTimeout(suggestionTimer)
  clearTimeout(searchTimer)
  const q = val.trim()

  if (q.length < 1) {
    suggestions.value = []
    if (!q) { hasSearched.value = false; songResults.value = []; artistResults.value = []; albumResults.value = []; genreResults.value = [] }
    return
  }

  // Suggestions dropdown (fast, 200ms)
  suggestionTimer = setTimeout(async () => {
    try {
      const res = await songApi.getSuggestions(q)
      if (res.data?.success) suggestions.value = res.data.data
    } catch {}
  }, 200)

  // Real-time search (slightly slower, 400ms)
  searchTimer = setTimeout(() => {
    executeSearch(true)
  }, 400)
})

async function executeSearch(isRealtime = false) {
  const q = query.value.trim()
  if (!q) return

  if (!isRealtime) {
    // Only save to recent on explicit Enter press
    saveRecent(q)
  }

  hasSearched.value = true
  isSearching.value = true
  lastQuery.value = q
  suggestions.value = []

  try {
    const res = await songApi.search(q, 15)
    if (res.data?.success) {
      const data = res.data.data
      songResults.value = (data.songs || []).map(normalizeSong)
      artistResults.value = data.artists || []
      albumResults.value = data.albums || []
      genreResults.value = data.genres || []
    }
  } catch (err) {
    console.warn('Search error:', err)
    songResults.value = []
    artistResults.value = []
    albumResults.value = []
    genreResults.value = []
  } finally {
    isSearching.value = false
  }
}

function applySuggestion(s) {
  if (s.type === 'artist' && s.artist_id) {
    router.push(`/artist/${s.artist_id}`)
    return
  }
  query.value = s.text
  executeSearch()
}

function goToArtist(song) {
  if (song.artist_id) router.push(`/artist/${song.artist_id}`)
}

function clearSearch() {
  query.value = ''
  hasSearched.value = false
  songResults.value = []; artistResults.value = []; albumResults.value = []; genreResults.value = []
  suggestions.value = []
  searchInput.value?.focus()
}

function handleBlur() { setTimeout(() => { isInputFocused.value = false }, 200) }

function saveRecent(term) {
  const filtered = recentSearches.value.filter(t => t.toLowerCase() !== term.toLowerCase())
  recentSearches.value = [term, ...filtered].slice(0, 8)
  localStorage.setItem('musicflow_recent_searches', JSON.stringify(recentSearches.value))
}

function removeRecent(index) {
  recentSearches.value.splice(index, 1)
  localStorage.setItem('musicflow_recent_searches', JSON.stringify(recentSearches.value))
}

function clearHistory() {
  recentSearches.value = []
  localStorage.removeItem('musicflow_recent_searches')
}

function normalizeSong(song) {
  const seconds = Number(song.duration_sec || 0)
  return {
    ...song,
    artist_name: song.artist_name || song.artist,
    album: song.album || 'Single',
    duration: song.duration || `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`,
    cover: song.cover || song.cover_url || null,
    audio_url: song.audio_url || song.preview_url || null,
  }
}

function formatDuration(song) {
  if (song.duration && song.duration.includes(':')) return song.duration
  const s = Number(song.duration_sec || 0)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function getCoverStyle(song) {
  const cover = song.cover || song.cover_url
  if (!cover) return { background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }
  if (cover.startsWith('linear-gradient') || cover.startsWith('radial-gradient')) return { background: cover }
  return { backgroundImage: `url(${formatImageUrl(cover)})`, backgroundSize: 'cover', backgroundPosition: 'center' }
}

function getArtistAvatarStyle(artist) {
  const img = artist.avatar_url || artist.sample_cover
  if (!img) return { background: `hsl(${Math.abs(artist.name.charCodeAt(0) * 37) % 360}, 55%, 40%)` }
  return { backgroundImage: `url(${formatImageUrl(img)})`, backgroundSize: 'cover', backgroundPosition: 'center' }
}

function getAlbumCoverStyle(album) {
  if (!album.cover_url) return { background: 'linear-gradient(135deg, #1e293b, #334155)' }
  return { backgroundImage: `url(${formatImageUrl(album.cover_url)})`, backgroundSize: 'cover', backgroundPosition: 'center' }
}

function handleGenreImageError(event) {
  const defaultGenre = 'linear-gradient(135deg, #1e293b, #334155)'
  event.target.style.display = 'none'
  event.target.parentElement.style.background = defaultGenre
}

function playSong(song) {
  player.playbackSource = 'search'
  player.setSong(song, songResults.value)
}

// Menu and Like logic
const menuState = ref({ show: false, position: { x: 0, y: 0 }, song: null })
function handleOpenMenu({ song, x, y }) {
  menuState.value = { show: true, position: { x, y }, song }
}
async function toggleLike(song) {
  if (!song) return;
  await library.toggleLike(song)
}
function handleAddToPlaylist(song) { library.openPlaylistModal(song) }
function handleAddToQueue(song) { player.addToQueue(song) }
function handleGoToSong(song) { router.push(`/song/${song.id || song.song_id}`) }
function handleGoToArtist(song) { if (song.artist_id) router.push(`/artist/${song.artist_id}`) }
function handleGoToAlbum(song) { if (song.album_id) router.push(`/album/${song.album_id}`) }
function handleShare(song) { 
  navigator.clipboard.writeText(`${window.location.origin}/song/${song.id || song.song_id}`) 
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@400;500;600;700;800;900&display=swap');
* { box-sizing: border-box; }

.search-page {
  min-height: 100%;
  padding: 28px 36px 150px;
  color: #fff;
  font-family: 'Be Vietnam Pro', sans-serif;
}

/* ─── Search Bar ─── */
.search-bar-section { position: relative; max-width: 680px; margin: 0 auto 40px; }

.search-bar {
  display: flex; align-items: center; height: 52px; padding: 0 20px;
  border-radius: 28px; background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1); transition: all 0.2s ease;
}
.search-bar.focused {
  background: rgba(255,255,255,0.12);
  border-color: rgba(147, 112, 219, 0.5);
  box-shadow: 0 0 0 4px rgba(147, 112, 219, 0.12);
}

.search-icon { width: 20px; height: 20px; flex-shrink: 0; fill: none; stroke: #9ca3af; stroke-width: 2.5; stroke-linecap: round; margin-right: 14px; transition: stroke 0.2s; }
.search-bar.focused .search-icon { stroke: #fff; }

.search-bar input { flex: 1; height: 100%; border: 0; outline: none; background: transparent; color: #fff; font: 500 15px 'Be Vietnam Pro', sans-serif; }
.search-bar input::placeholder { color: #9ca3af; }

.clear-btn { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; border: 0; border-radius: 50%; background: rgba(255,255,255,0.08); color: #9ca3af; cursor: pointer; transition: all 0.15s; flex-shrink: 0; margin-left: 8px; }
.clear-btn:hover { color: #fff; background: rgba(255,255,255,0.15); transform: scale(1.05); }
.clear-btn svg { width: 14px; height: 14px; fill: none; stroke: currentColor; stroke-width: 2.5; stroke-linecap: round; }

/* ─── Suggestions ─── */
.suggestions-dropdown { position: absolute; top: calc(100% + 8px); left: 0; right: 0; background: rgba(2,6,23,0.96); border: 1px solid rgba(255,255,255,0.1); border-radius: 16px; box-shadow: 0 18px 50px rgba(0,0,0,0.45); overflow: hidden; z-index: 100; animation: dropIn 0.15s ease; backdrop-filter: blur(18px); }
@keyframes dropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }

.suggestion-item { display: flex; align-items: center; gap: 12px; padding: 12px 16px; cursor: pointer; transition: background 0.12s; }
.suggestion-item:hover { background: rgba(255,255,255,0.1); }
.suggestion-icon-wrap { width: 32px; height: 32px; border-radius: 4px; background: rgba(255,255,255,0.08); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.suggestion-icon-wrap svg { width: 16px; height: 16px; fill: none; stroke: #9ca3af; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.suggestion-text { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.suggestion-main { font-size: 14px; font-weight: 500; color: #fff; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.suggestion-sub { font-size: 12px; color: #6b7280; }

/* ─── Results Section ─── */
.results-section { animation: fadeUp 0.3s ease; }
@keyframes fadeUp { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }

.result-group { margin-bottom: 28px; }
.result-group:last-child { margin-bottom: 0; }
.result-group h2, .results-grid h2, .browse-section > div > h2, .browse-section h2 { font-size: 20px; font-weight: 700; margin: 0 0 16px; color: #fff; letter-spacing: -0.01em; }

/* No Results */
.no-results { text-align: center; padding: 60px 20px; }
.no-results svg { width: 56px; height: 56px; fill: none; stroke: #4b5563; stroke-width: 2; stroke-linecap: round; margin-bottom: 20px; }
.no-results h3 { font-size: 18px; font-weight: 600; margin: 0 0 8px; color: #e5e7eb; }
.no-results p { color: #6b7280; font-size: 14px; margin: 0; }

/* ─── Artist Cards ─── */
.artist-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 166px));
  gap: 20px;
  padding-bottom: 8px;
}
/* ─── Results Grid ─── */
.results-grid { display: grid; grid-template-columns: 380px 1fr; gap: 24px; margin-bottom: 40px; }
.results-grid.no-top { grid-template-columns: 1fr; }
@media (max-width: 900px) { .results-grid { grid-template-columns: 1fr; } }

/* ─── Top Result Card ─── */
.top-result-card {
  position: relative; padding: 24px; border-radius: 12px;
  background: rgba(255,255,255,0.055); cursor: pointer;
  border: 1px solid rgba(255,255,255,0.1);
  transition: background 0.3s; overflow: hidden;
}
.top-result-card:hover { background: rgba(255,255,255,0.1); }

.top-cover { width: 92px; height: 92px; border-radius: 8px; margin-bottom: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.5); background-size: cover; background-position: center; }
.top-title { font-size: 32px; font-weight: 900; margin: 0 0 12px; line-height: 1.1; letter-spacing: -0.02em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.top-meta { display: flex; align-items: center; gap: 12px; margin: 0; }
.top-artist { font-size: 15px; color: #b3b3b3; font-weight: 500; cursor: pointer; transition: color 0.15s; }
.top-artist:hover { color: #fff; text-decoration: underline; }
.top-badge { font-size: 12px; font-weight: 700; padding: 4px 12px; border-radius: 500px; background: rgba(255,255,255,0.08); color: #fff; text-transform: uppercase; letter-spacing: 0.04em; }

.play-fab {
  position: absolute; right: 24px; bottom: 24px; width: 48px; height: 48px;
  border: 0; border-radius: 50%; background: #8b5cf6;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; box-shadow: 0 8px 16px rgba(0,0,0,0.3);
  opacity: 0; transform: translateY(8px); transition: all 0.25s ease;
}
.top-result-card:hover .play-fab { opacity: 1; transform: translateY(0); }
.play-fab:hover { transform: scale(1.06) !important; background: #a78bfa; }
.play-fab svg { width: 20px; height: 20px; fill: #000; stroke: none; margin-left: 2px; }

/* ─── Songs List ─── */
.songs-list { display: flex; flex-direction: column; }

.song-row {
  display: flex; align-items: center; gap: 14px; padding: 8px 12px;
  border-radius: 6px; cursor: pointer; transition: background 0.15s;
}
.song-row:hover { background: rgba(255,255,255,0.08); }

.song-cover { width: 44px; height: 44px; border-radius: 4px; flex-shrink: 0; background-size: cover; background-position: center; background-color: rgba(255,255,255,0.05); }
.song-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.song-title { font-size: 15px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #fff; }
.song-row:hover .song-title { color: #1DB954; }
.song-artist { font-size: 13px; color: #b3b3b3; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; cursor: pointer; transition: color 0.15s; }
.song-artist:hover { color: #fff; text-decoration: underline; }

.song-duration { color: #b3b3b3; font-size: 13px; flex-shrink: 0; width: 45px; text-align: right; font-variant-numeric: tabular-nums; }
.song-actions { display: flex; gap: 4px; opacity: 0; transition: opacity 0.15s; }
.song-row:hover .song-actions { opacity: 1; }

.action-btn { display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; border: 0; border-radius: 50%; background: transparent; color: #b3b3b3; cursor: pointer; padding: 0; transition: all 0.15s; }
.action-btn:hover { color: #fff; transform: scale(1.1); }
.action-btn svg { width: 16px; height: 16px; }
.action-btn.liked { color: #1DB954; opacity: 1; }

/* ─── Album Cards ─── */
.album-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 20px; }

.album-card {
  display: flex; flex-direction: column; gap: 10px; padding: 16px;
  border-radius: 8px; background: rgba(255,255,255,0.04);
  transition: background 0.2s; cursor: pointer;
}
.album-card:hover { background: rgba(255,255,255,0.08); }

.album-cover {
  position: relative; width: 100%; aspect-ratio: 1; border-radius: 6px;
  overflow: hidden; box-shadow: 0 8px 24px rgba(0,0,0,0.5);
}
.album-play-btn {
  position: absolute; right: 8px; bottom: 8px; width: 44px; height: 44px;
  border: 0; border-radius: 50%; background: #1DB954;
  display: flex; align-items: center; justify-content: center;
  cursor: pointer; opacity: 0; transform: translateY(8px);
  transition: all 0.2s ease; box-shadow: 0 6px 12px rgba(0,0,0,0.3);
}
.album-card:hover .album-play-btn { opacity: 1; transform: translateY(0); }
.album-play-btn:hover { transform: scale(1.06) !important; background: #1ed760; }
.album-play-btn svg { width: 18px; height: 18px; fill: #000; margin-left: 2px; }

.album-card-title { font-size: 15px; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.album-card-meta { font-size: 13px; color: #b3b3b3; }

/* ─── Genre Chips in Results ─── */
.genre-chips-result { display: flex; flex-wrap: wrap; gap: 12px; }

.genre-chip-result {
  display: flex; align-items: center; gap: 10px; padding: 14px 22px;
  border: 1px solid rgba(255,255,255,0.08); border-radius: 12px;
  background: rgba(255,255,255,0.04); color: #fff; cursor: pointer;
  font: 600 14px 'Be Vietnam Pro', sans-serif; transition: all 0.2s;
}
.genre-chip-result:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.15); transform: translateY(-2px); }
.genre-chip-result svg { width: 18px; height: 18px; fill: none; stroke: #1DB954; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
.genre-chip-result small { color: #b3b3b3; font-weight: 500; margin-left: auto; }

/* ─── Loading ─── */
.loading-section { display: flex; flex-direction: column; align-items: center; gap: 16px; padding: 80px 0; }
.loading-spinner { width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.1); border-top-color: #9370db; border-radius: 50%; animation: spin 0.7s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.loading-section p { color: #6b7280; font-size: 14px; }

/* ─── Browse Section ─── */
.browse-section { animation: fadeUp 0.3s ease; }

.recent-section { margin-bottom: 24px; }
.trending-section { margin-bottom: 24px; }

.section-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
.section-header h2 { font-size: 20px; font-weight: 700; margin: 0; color: #fff; letter-spacing: -0.01em; }

.clear-history-btn {
  border: 0; background: transparent; color: #6b7280; font-size: 13px; font-weight: 600;
  cursor: pointer; padding: 6px 14px; border-radius: 500px; transition: all 0.15s;
}
.clear-history-btn:hover { color: #fff; background: rgba(255,255,255,0.1); }

.recent-chips, .trending-chips { display: flex; flex-wrap: wrap; gap: 8px; }

.recent-chip {
  display: flex; align-items: center; gap: 6px; padding: 8px 14px;
  border: 1px solid rgba(255,255,255,0.1); border-radius: 500px; background: rgba(255,255,255,0.06);
  color: #d1d5db; font: 500 13px 'Be Vietnam Pro', sans-serif; cursor: pointer; transition: all 0.18s;
}
.recent-chip:hover { background: rgba(255,255,255,0.12); border-color: rgba(255,255,255,0.2); color: #fff; }
.recent-chip svg { width: 14px; height: 14px; fill: none; stroke: #9ca3af; stroke-width: 2; stroke-linecap: round; }
.chip-remove { margin-left: 2px; font-size: 16px; line-height: 1; opacity: 0; transition: opacity 0.15s; color: #9ca3af; }
.recent-chip:hover .chip-remove { opacity: 1; }
.recent-chip:hover .chip-remove:hover { color: #fff; }

.trending-chip {
  display: flex; align-items: center; gap: 6px; padding: 8px 16px;
  border: 1px solid rgba(255,255,255,0.08); border-radius: 500px; background: rgba(255,255,255,0.04);
  color: #9ca3af; font: 500 13px 'Be Vietnam Pro', sans-serif; cursor: pointer; transition: all 0.18s;
}
.trending-chip:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.15); color: #fff; }
.trending-chip svg { width: 12px; height: 12px; fill: none; stroke: #fbbf24; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }

/* ─── Genre Browse Cards ─── */
.genres-section { margin-top: 16px; }

.genre-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.genre-card {
  position: relative;
  height: 140px;
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  background: rgba(255,255,255,0.055);
  border: 1px solid rgba(255,255,255,0.1);
  transition: transform 0.2s ease, border-color 0.2s ease, box-shadow 0.2s ease;
}
.genre-card:hover {
  transform: translateY(-4px);
  border-color: rgba(255,255,255,0.15);
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}

.genre-card__image {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
  transition: transform 0.3s ease;
}
.genre-card:hover .genre-card__image {
  transform: scale(1.03);
}

@media (max-width: 1100px) { .genre-grid { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 768px) {
  .genre-grid { grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .search-page { padding: 20px 16px 130px; }
  .genre-card { height: 110px; }
  .genre-section h2, .section-header h2 { font-size: 18px; }
}
</style>
