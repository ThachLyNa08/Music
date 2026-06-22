<template>
  <div class="search-page search-page-enter pb-32 pt-8 px-4 sm:px-8 min-h-full">
    <!-- Search Bar -->
    <section class="relative max-w-lg mx-auto mb-10 z-10 search-reveal">
      <div class="search-v6-wrapper" :class="{ 'is-focused': isInputFocused }">
        <div class="search-v6">
          <span class="sparkle">✦</span>
          <input
            ref="searchInput"
            v-model="query"
            type="text"
            placeholder="Bạn muốn nghe gì?"
            aria-label="Tìm kiếm nhạc"
            @focus="isInputFocused = true"
            @blur="handleBlur"
            @keyup.enter="submitSearch"
          />
          <button v-if="query.length > 0 || committedQuery.length > 0" class="flex items-center justify-center w-7 h-7 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors flex-shrink-0 z-10" @click="clearSearch" aria-label="Xóa">
            <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
          </button>
        </div>
      </div>

      <!-- Recent Searches Dropdown -->
      <div v-if="isInputFocused && query.length === 0 && recentSearches.length > 0" class="absolute top-full mt-2 left-0 right-0 bg-[#181818]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
        <div class="px-4 py-3 flex items-center justify-between border-b border-white/5 bg-white/5">
          <span class="text-xs font-semibold text-gray-300 uppercase tracking-wider">Tìm kiếm gần đây</span>
          <button class="text-xs font-semibold text-gray-400 hover:text-white transition-colors" @mousedown.prevent="clearHistory">Xóa tất cả</button>
        </div>
        <div class="max-h-[300px] overflow-y-auto scrollbar-hide">
          <div
            v-for="(term, i) in recentSearches"
            :key="i"
            class="group flex items-center gap-3 px-4 py-3 hover:bg-white/10 cursor-pointer transition-colors"
            @mousedown.prevent="applyRecentSearch(term)"
          >
            <svg class="w-4 h-4 text-gray-400 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-4.1-4.1" /></svg>
            <span class="text-sm font-medium text-white truncate flex-1">{{ term }}</span>
            <button class="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-white transition-all" @mousedown.prevent.stop="removeRecent(i)" aria-label="Xóa khỏi lịch sử">
              <svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      </div>

      <!-- Autocomplete Suggestions Dropdown -->
      <div v-if="showSuggestions && suggestions.length > 0" class="absolute top-full mt-2 left-0 right-0 bg-[#181818]/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
        <div class="px-4 py-3 border-b border-white/5 bg-white/5">
          <span class="text-xs font-semibold text-gray-300 uppercase tracking-wider">Gợi ý tìm kiếm</span>
        </div>
        <div class="max-h-[400px] overflow-y-auto scrollbar-hide">
          <div
            v-for="(s, i) in suggestions"
            :key="i"
            class="flex items-center gap-3 px-4 py-3 hover:bg-white/10 cursor-pointer transition-colors"
            @mousedown.prevent="applySuggestion(s)"
          >
            <div class="w-11 h-11 flex-shrink-0 flex items-center justify-center overflow-hidden bg-white/5" :class="s.type === 'artist' ? 'rounded-full' : 'rounded-md'">
              <img v-if="s.imageUrl" :src="formatImageUrl(s.imageUrl)" :alt="s.text" class="w-full h-full object-cover" @error="handleSuggestionImageError(s)" />
              <template v-else>
                <svg v-if="s.type === 'artist'" class="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                <svg v-else-if="s.type === 'album'" class="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="12" cy="12" r="3" /></svg>
                <svg v-else-if="s.type === 'playlist'" class="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>
                <svg v-else class="w-5 h-5 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg>
              </template>
            </div>
            <div class="flex flex-col min-w-0 justify-center">
              <span class="text-sm font-medium text-white truncate">{{ s.text }}</span>
              <span class="text-xs text-gray-400 truncate">{{ s.subtitle || (s.type === 'artist' ? 'Nghệ sĩ' : s.type === 'album' ? 'Album' : s.type === 'playlist' ? 'Playlist' : 'Bài hát') }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ═══ SEARCH RESULTS ═══ -->
    <section v-if="hasSearched && !isSearching" class="space-y-10 min-w-0 search-reveal search-reveal-delay-1">
      <!-- No results -->
      <div v-if="totalResults === 0" class="flex flex-col items-center justify-center py-20 text-center">
        <div class="w-16 h-16 mb-4 rounded-full bg-white/5 flex items-center justify-center">
          <svg class="w-8 h-8 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></svg>
        </div>
        <h3 class="text-xl font-bold text-white mb-2">Không tìm thấy kết quả phù hợp cho "{{ lastQuery }}"</h3>
        <p class="text-sm text-gray-400">Hãy thử tìm kiếm bằng từ khóa khác hoặc kiểm tra chính tả.</p>
      </div>

      <template v-else>
        <!-- Top Result + Songs -->
        <div class="grid grid-cols-1 md:grid-cols-[auto_1fr] xl:grid-cols-[400px_1fr] gap-6" :class="{ '!grid-cols-1': artistResults.length > 0 }">
          
          <!-- Top Result Card -->
          <div v-if="songResults.length > 0 && artistResults.length === 0" class="flex flex-col gap-4 search-reveal search-reveal-delay-1">
            <h2 class="text-xl font-bold text-white tracking-tight">Kết quả hàng đầu</h2>
            <div 
              class="relative flex flex-col p-6 rounded-xl bg-[#181818] hover:bg-[#252525] transition-colors cursor-pointer group border border-transparent hover:border-white/5"
              @click="$router.push(`/song/${songResults[0].id}`)"
            >
              <div class="w-24 h-24 rounded-md shadow-lg mb-5 flex-shrink-0 bg-cover bg-center" :style="getCoverStyle(songResults[0])"></div>
              <h3 class="text-3xl font-black text-white mb-2 truncate">{{ songResults[0].title }}</h3>
              <div class="flex items-center gap-2 text-sm mt-auto">
                <span class="text-gray-400 hover:text-white transition-colors truncate font-medium" @click.stop="goToArtist(songResults[0])">{{ songResults[0].artist_name || songResults[0].artist }}</span>
                <span class="px-2.5 py-1 rounded-full bg-[#121212] text-white text-[11px] font-bold uppercase tracking-widest">Bài hát</span>
              </div>
              <button 
                class="absolute bottom-6 right-6 w-12 h-12 rounded-full bg-[#1ed760] flex items-center justify-center opacity-0 translate-y-2 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-200 hover:scale-105 shadow-[0_8px_16px_rgba(0,0,0,0.3)]"
                @click.stop="playSong(songResults[0])"
              >
                <svg class="w-5 h-5 text-black ml-1" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3" /></svg>
              </button>
            </div>
          </div>

          <!-- Songs List -->
          <div v-if="songResults.length > 0" class="flex flex-col gap-4 min-w-0 search-reveal search-reveal-delay-1">
            <h2 class="text-xl font-bold text-white tracking-tight">Bài hát</h2>
            <TransitionGroup name="search-result" tag="div" class="flex flex-col min-w-0">
              <SongRow
                v-for="(song, idx) in songResults.slice(0, 5)"
                :key="song.id || idx"
                :song="song"
                :index="idx + 1"
                :showIndex="false"
                :showAlbum="false"
                :compact="true"
                @play="playSong"
                @open-menu="handleOpenMenu"
                @toggle-like="toggleLike"
                class="hover:bg-[#252525] rounded-md transition-colors"
              />
            </TransitionGroup>
          </div>
        </div>

        <!-- ── Artist Cards ── -->
        <div v-if="artistResults.length > 0" class="space-y-4 search-reveal search-reveal-delay-2">
          <h2 class="text-xl font-bold text-white tracking-tight">Nghệ sĩ</h2>
          <TransitionGroup name="search-result" tag="div" class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-5">
            <ArtistCard
              v-for="artist in artistResults"
              :key="artist.id || artist.artist_id"
              :artist="artist"
            />
          </TransitionGroup>
        </div>

        <!-- ── Albums ── -->
        <div v-if="albumResults.length > 0" class="space-y-4 search-reveal search-reveal-delay-3">
          <h2 class="text-xl font-bold text-white tracking-tight">Album</h2>
          <TransitionGroup name="search-result" tag="div" class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-5">
            <MediaCard
              v-for="album in albumResults"
              :key="album.id"
              :item="album"
              :type="album.album_type || album.type || 'album'"
            />
          </TransitionGroup>
        </div>

        <!-- ── Genres (when not exactly matched) ── -->
        <div v-if="genreResults.length > 0 && !selectedGenre" class="space-y-4 search-reveal search-reveal-delay-4">
          <h2 class="text-xl font-bold text-white tracking-tight">Thể loại</h2>
          <TransitionGroup name="search-result" tag="div" class="flex flex-wrap gap-3">
            <button
              v-for="genre in genreResults"
              :key="genre.id"
              class="flex items-center gap-2 px-4 py-2 rounded-full bg-[#181818] border border-white/10 hover:bg-[#252525] hover:border-white/20 transition-all text-sm font-medium text-white"
              @click="selectGenre(genre)"
            >
              <span>{{ genre.name }}</span>
            </button>
          </TransitionGroup>
        </div>

        <!-- ── Derived Genre Artists (when exactly matched) ── -->
        <div v-if="selectedGenre" class="space-y-4 search-reveal search-reveal-delay-2">
          <h2 class="text-xl font-bold text-white tracking-tight">Nghệ sĩ nổi bật trong {{ selectedGenre }}</h2>
          <TransitionGroup v-if="genreArtists.length > 0" name="search-result" tag="div" class="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-5">
            <ArtistCard
              v-for="artist in genreArtists"
              :key="artist.id || artist.name"
              :artist="artist"
            />
          </TransitionGroup>
          <div v-else class="p-6 rounded-xl bg-[#181818] border border-white/5 text-center">
            <p class="text-sm text-gray-400">Chưa có nghệ sĩ nổi bật trong thể loại này.</p>
          </div>
        </div>
      </template>
    </section>

    <!-- Loading State -->
    <section v-if="isSearching" class="flex flex-col items-center justify-center py-20 space-y-4">
      <div class="w-8 h-8 border-2 border-white/10 border-t-[#1ed760] rounded-full animate-spin"></div>
      <p class="text-sm text-gray-400 font-medium">Đang tìm kiếm...</p>
    </section>

    <!-- ═══ BROWSE SECTION (no search) ═══ -->
    <section v-if="!hasSearched && !isSearching" class="space-y-10 search-reveal search-reveal-delay-1">
      
      <!-- Popular Artists -->
      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-bold text-white tracking-tight">Nghệ sĩ phổ biến</h2>
        </div>
        <div class="relative group min-h-[210px] sm:min-h-[240px]">
          <Transition name="fade" mode="out-in">
            <!-- Loading Skeleton -->
            <div v-if="isLoadingPopular" class="flex overflow-hidden gap-5 pb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
              <div v-for="i in 6" :key="i" class="min-w-[150px] w-[150px] sm:min-w-[180px] sm:w-[180px] flex-shrink-0 flex flex-col">
                <div class="w-full aspect-square rounded-full bg-white/5 animate-pulse mb-3"></div>
                <div class="h-4 bg-white/5 rounded-md w-3/4 animate-pulse mx-auto"></div>
              </div>
            </div>

            <!-- Actual Content -->
            <div v-else-if="popularArtists.length > 0" class="relative">
              <button 
                @click="scrollPopularArtists('left')"
            :disabled="arrivedState.left"
            class="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg"
            :class="[
              !arrivedState.left 
                ? 'bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-[#1ed760] hover:text-black hover:scale-105 cursor-pointer' 
                : 'bg-black/40 text-gray-500 opacity-0 group-hover:opacity-50 cursor-not-allowed'
            ]"
            aria-label="Cuộn sang trái"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          </button>

          <div 
            ref="popularArtistsContainer"
            class="flex overflow-x-auto gap-5 pb-4 scrollbar-hide -mx-4 px-4 sm:mx-0 sm:px-0 scroll-smooth"
          >
            <ArtistCard
              v-for="artist in popularArtists"
              :key="artist.id"
              :artist="artist"
              class="min-w-[150px] w-[150px] sm:min-w-[180px] sm:w-[180px] flex-shrink-0"
            />
          </div>

              <button 
                @click="scrollPopularArtists('right')"
                :disabled="arrivedState.right"
                class="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-all shadow-lg"
                :class="[
                  !arrivedState.right 
                    ? 'bg-black/60 text-white opacity-0 group-hover:opacity-100 hover:bg-[#1ed760] hover:text-black hover:scale-105 cursor-pointer' 
                    : 'bg-black/40 text-gray-500 opacity-0 group-hover:opacity-50 cursor-not-allowed'
                ]"
                aria-label="Cuộn sang phải"
              >
                <svg class="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>

            <!-- Empty State -->
            <div v-else class="flex items-center justify-center text-sm text-gray-500 h-[150px]">
              Chưa có dữ liệu nghệ sĩ phổ biến.
            </div>
          </Transition>
        </div>
      </div>

      <!-- Genre Browse -->
      <div class="space-y-4 search-reveal search-reveal-delay-2">
        <h2 class="text-xl font-bold text-white tracking-tight">Duyệt tìm tất cả</h2>
        <TransitionGroup name="search-result" tag="div" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          <div
            v-for="genre in displayBrowseGenres"
            :key="genre.key"
            class="relative h-[110px] sm:h-[140px] rounded-xl overflow-hidden cursor-pointer group bg-[#181818] border border-white/5"
            @click="selectGenre(genre)"
          >
            <img
              :src="formatImageUrl(genre.cover_url)"
              :alt="genre.name"
              class="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
              loading="lazy"
              @error="handleGenreImageError"
            />
          </div>
        </TransitionGroup>
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
import { useScroll } from '@vueuse/core'
import { useRouter } from 'vue-router'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import { songApi } from '@/api/song'
import { artistApi } from '@/api/artist'
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
const committedQuery = ref('')
const isInputFocused = ref(false)
const searchInput = ref(null)

const songResults = ref([])
const artistResults = ref([])
const albumResults = ref([])
const genreResults = ref([])
const suggestions = ref([])
const popularArtists = ref([])
const isLoadingPopular = ref(true)
const popularArtistsContainer = ref(null)
const { arrivedState } = useScroll(popularArtistsContainer)
const hasSearched = computed(() => committedQuery.value.length > 0)
const isSearching = ref(false)
const lastQuery = ref('')
const recentSearches = ref([])
const userTopGenres = ref([])

let suggestionTimer = null

const totalResults = computed(() => {
  return songResults.value.length + artistResults.value.length + albumResults.value.length + genreResults.value.length
})

const showSuggestions = computed(() => {
  return isInputFocused.value && query.value.length >= 1 && !hasSearched.value
})

const isGenreMode = ref(false)
const explicitGenreName = ref(null)

function selectGenre(genre) {
  const genreName = genre.name || genre.displayName || ''
  explicitGenreName.value = genreName
  isGenreMode.value = true
  query.value = genreName
  executeSearch()
}

function normalizeForMatch(str) {
  if (!str) return ''
  return str.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim()
}

const selectedGenre = computed(() => {
  if (isGenreMode.value && explicitGenreName.value) {
    const match = genreResults.value?.find(g => normalizeForMatch(g.name) === normalizeForMatch(explicitGenreName.value))
    return match ? match.name : explicitGenreName.value
  }

  if (!query.value || !genreResults.value || genreResults.value.length === 0) return null
  const q = normalizeForMatch(query.value)
  const match = genreResults.value.find(g => normalizeForMatch(g.name) === q)
  return match ? match.name : null
})

const genreArtists = computed(() => {
  if (!selectedGenre.value) return []
  
  const map = new Map()
  for (const song of songResults.value || []) {
    const artistId = song.artist_id || song.artist?.id
    const artistName = song.artist_name || song.artist?.name || song.artist
    if (!artistName) continue
    
    const key = artistId || artistName
    if (!map.has(key)) {
      map.set(key, {
        id: artistId,
        artist_id: artistId,
        name: artistName,
        avatar_url: song.artist_avatar || song.artist?.avatar || song.artist_image || null,
        songCount: 0
      })
    }
    map.get(key).songCount += 1
  }
  
  return Array.from(map.values())
    .sort((a, b) => b.songCount - a.songCount)
    .slice(0, 12)
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
    isLoadingPopular.value = true
    const res = await artistApi.getPopular({ period: '7d', limit: 12 })
    if (res.data?.success) popularArtists.value = res.data.data
  } catch (err) {
    console.warn('Failed to load popular artists', err)
  } finally {
    isLoadingPopular.value = false
  }
  try {
    const res = await api.get('/users/me/profile')
    if (res.data?.success && res.data.data?.top_genres) {
      userTopGenres.value = res.data.data.top_genres
    }
  } catch {}
})

// ── Real-time search as user types ──
watch(query, (val) => {
  if (explicitGenreName.value && val !== explicitGenreName.value) {
    isGenreMode.value = false
    explicitGenreName.value = null
  }

  clearTimeout(suggestionTimer)
  const q = val.trim()

  if (q.length < 1) {
    suggestions.value = []
    return
  }

  // Suggestions dropdown (debounce 250ms)
  suggestionTimer = setTimeout(async () => {
    try {
      const res = await songApi.getSuggestions(q)
      if (res.data?.success) {
        const all = (res.data.data || []).map(normalizeSuggestionItem)
        const songs = all.filter(s => s.type === 'song').slice(0, 3)
        const artists = all.filter(s => s.type === 'artist').slice(0, 3)
        const albums = all.filter(s => s.type === 'album').slice(0, 2)
        const playlists = all.filter(s => s.type === 'playlist').slice(0, 2)
        const others = all.filter(s => !['song', 'artist', 'album', 'playlist'].includes(s.type))
        suggestions.value = [...songs, ...artists, ...albums, ...playlists, ...others]
      }
    } catch {}
  }, 250)
})

function normalizeSuggestionItem(item) {
  return {
    ...item,
    imageUrl: item.imageUrl || item.image_url || item.cover_url || item.coverUrl || item.avatar_url || item.avatarUrl || item.album_cover || item.thumbnail || item.album?.cover_url || item.artist?.avatar_url || null
  }
}

function handleSuggestionImageError(s) {
  s.imageUrl = null
}

async function submitSearch() {
  const q = query.value.trim()
  if (!q) return

  committedQuery.value = q
  isInputFocused.value = false
  saveRecent(q)

  isSearching.value = true
  lastQuery.value = q
  suggestions.value = []

  try {
    const res = await songApi.search(q, 15)
    if (res.data?.success) {
      const data = res.data.data
      songResults.value = library.applyLikedStateToSongs((data.songs || []).map(normalizeSong))
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
  const term = s.text || s.title || s.name
  saveRecent(term)
  
  if (s.type === 'song' && s.id) {
    router.push(`/song/${s.id}`)
  } else if (s.type === 'artist' && s.id) {
    router.push(`/artist/${s.id}`)
  } else if (s.type === 'album' && s.id) {
    router.push(`/album/${s.id}`)
  } else if (s.type === 'playlist' && s.id) {
    router.push(`/playlist/${s.id}`)
  } else if (s.type === 'genre') {
    query.value = term
    submitSearch()
  } else {
    query.value = term
    submitSearch()
  }
  isInputFocused.value = false
}

function applyRecentSearch(term) {
  query.value = term
  submitSearch()
}

function scrollPopularArtists(direction) {
  if (popularArtistsContainer.value) {
    const scrollAmount = direction === 'left' ? -300 : 300
    popularArtistsContainer.value.scrollBy({ left: scrollAmount, behavior: 'smooth' })
  }
}

function goToArtist(song) {
  if (song.artist_id) router.push(`/artist/${song.artist_id}`)
}

function clearSearch() {
  if (query.value.length > 0) {
    query.value = ''
    searchInput.value?.focus()
  } else if (committedQuery.value.length > 0) {
    committedQuery.value = ''
    songResults.value = []; artistResults.value = []; albumResults.value = []; genreResults.value = []
    suggestions.value = []
  }
}

function handleBlur() { setTimeout(() => { isInputFocused.value = false }, 200) }

function saveRecent(term) {
  const t = term.trim()
  if (!t) return
  const filtered = recentSearches.value.filter(item => item.toLowerCase() !== t.toLowerCase())
  recentSearches.value = [t, ...filtered].slice(0, 10)
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

.search-page {
  font-family: 'Be Vietnam Pro', sans-serif;
}

/* ── ANIMATIONS ── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.search-page-enter {
  animation: searchPageSlideUp 560ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.search-reveal {
  opacity: 0;
  animation: searchSectionReveal 520ms cubic-bezier(0.16, 1, 0.3, 1) both;
}

.search-reveal-delay-1 { animation-delay: 70ms; }
.search-reveal-delay-2 { animation-delay: 140ms; }
.search-reveal-delay-3 { animation-delay: 210ms; }
.search-reveal-delay-4 { animation-delay: 280ms; }

@keyframes searchPageSlideUp {
  from {
    opacity: 0;
    transform: translateY(22px);
    filter: blur(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}

@keyframes searchSectionReveal {
  from {
    opacity: 0;
    transform: translateY(18px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.search-result-move,
.search-result-enter-active,
.search-result-leave-active {
  transition:
    opacity 260ms ease,
    transform 260ms cubic-bezier(0.16, 1, 0.3, 1);
}

.search-result-enter-from,
.search-result-leave-to {
  opacity: 0;
  transform: translateY(10px);
}

.search-result-leave-active {
  position: absolute;
}

@media (prefers-reduced-motion: reduce) {
  .search-page-enter,
  .search-reveal {
    animation: none !important;
    opacity: 1 !important;
    transform: none !important;
    filter: none !important;
  }

  .search-result-move,
  .search-result-enter-active,
  .search-result-leave-active {
    transition: none !important;
  }
}

/* Base resets or specific scoped fixes */
input::placeholder {
  color: #9ca3af;
}

/* ── SEARCH V6 ANIMATED BORDER ── */
.search-v6-wrapper {
  position: relative;
  padding: 1.5px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.1);
  transition: box-shadow 0.3s ease;
  width: 100%;
}

.search-v6-wrapper.is-focused {
  box-shadow: 0 0 20px rgba(30, 215, 96, 0.15);
}

.search-v6-wrapper::before {
  content: '';
  position: absolute;
  inset: -50%;
  background: conic-gradient(from 0deg, transparent 0%, #8B5CF6 20%, #1ED760 40%, #8B5CF6 60%, transparent 80%);
  animation: rotate 4s linear infinite;
  opacity: 0;
  transition: opacity 0.35s ease;
  pointer-events: none;
}

.search-v6-wrapper.is-focused::before {
  opacity: 1;
}

.search-v6 {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 12px 22px;
  background: rgba(10, 10, 15, 0.94);
  border-radius: 999px;
}

.search-v6 input {
  flex: 1;
  background: transparent;
  border: none !important;
  outline: none !important;
  box-shadow: none !important;
  color: #f0f0f5;
  font-size: 15px;
  min-width: 0;
}

.sparkle {
  color: #1ED760;
  animation: sparkle 2s ease-in-out infinite;
  font-size: 18px;
  line-height: 1;
  user-select: none;
}

@keyframes rotate {
  100% { transform: rotate(360deg); }
}

@keyframes sparkle {
  0%, 100% { opacity: 0.6; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.18); }
}

@media (prefers-reduced-motion: reduce) {
  .search-v6-wrapper::before {
    animation: none;
  }
  .sparkle {
    animation: none;
  }
}
</style>
