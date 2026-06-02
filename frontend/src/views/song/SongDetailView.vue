<template>
  <div class="user-layout-surface pb-4">
    <!-- Loading State -->
    <div v-if="loading" class="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <div class="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      <p class="text-slate-400 font-medium">Đang tải thông tin bài hát...</p>
    </div>

    <!-- Error State -->
    <div v-else-if="error" class="flex flex-col items-center justify-center min-h-[60vh] gap-4">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="64" height="64" class="text-slate-500">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"/>
      </svg>
      <h3 class="text-2xl font-bold text-white">{{ error }}</h3>
      <RouterLink to="/" class="mt-2 text-cyan-400 hover:text-cyan-300 font-medium no-underline hover:underline">
        Về trang chủ
      </RouterLink>
    </div>

    <!-- Song Detail Content -->
    <div v-else-if="song" class="space-y-8 px-4 md:px-8 py-6 max-w-[1400px] mx-auto">
      
      <!-- 1. HERO / SONG HEADER -->
      <section class="user-panel overflow-hidden relative">
        <div class="grid gap-6 lg:grid-cols-[220px_1fr] xl:grid-cols-[240px_1fr] relative z-10 p-6 md:p-8">
          <!-- Cover Art -->
          <div class="aspect-square w-full max-w-[240px] mx-auto lg:mx-0 rounded-[24px] overflow-hidden shadow-2xl bg-white/5 flex-shrink-0">
            <img 
              :src="coverImage" 
              :alt="song.title"
              class="w-full h-full object-cover"
              @error="handleImageError"
            />
          </div>

          <!-- Song Info -->
          <div class="flex flex-col justify-center gap-3 text-center lg:text-left mt-4 lg:mt-0">
            <div>
              <div class="text-xs font-extrabold uppercase tracking-[0.22em] text-cyan-300">Bài hát</div>
              <h1 class="text-3xl md:text-5xl font-black tracking-tight text-white line-clamp-2 mt-1">{{ song.title }}</h1>
            </div>
            
            <!-- Artist Links & Album -->
            <div class="flex flex-wrap items-center justify-center lg:justify-start gap-x-2 text-sm text-slate-300">
              <template v-for="(artist, idx) in song.artists" :key="artist.id">
                <RouterLink 
                  :to="`/artist/${artist.id}`"
                  class="hover:text-white hover:underline font-bold transition"
                >
                  {{ artist.name }}
                </RouterLink>
                <span v-if="idx < song.artists.length - 1" class="text-slate-500">•</span>
              </template>

              <!-- Album Link -->
              <span v-if="song.album_id" class="flex items-center gap-2">
                <span class="text-slate-500">•</span>
                <RouterLink 
                  :to="`/album/${song.album_id}`"
                  class="hover:text-white hover:underline transition"
                >
                  {{ song.album_title || 'Unknown Album' }}
                </RouterLink>
              </span>
            </div>

            <!-- Stats -->
            <div class="flex flex-wrap items-center justify-center lg:justify-start gap-4 text-sm text-slate-400">
              <span class="flex items-center gap-1" v-if="song.like_count !== undefined">
                <svg viewBox="0 0 24 24" class="w-4 h-4 fill-current"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
                {{ formatCount(displayLikeCount) }}
              </span>
              <span class="flex items-center gap-1" v-if="song.play_count !== undefined">
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" class="text-slate-500">
                  <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
                </svg>
                {{ formatCount(song.play_count) }} lượt nghe
              </span>
              <span v-if="song.duration_sec">• {{ formatDuration(song.duration_sec) }}</span>
              <span v-if="song.release_date">• {{ formatReleaseDate(song.release_date) }}</span>
            </div>

            <!-- Action Buttons -->
            <div class="flex items-center justify-center lg:justify-start gap-3 mt-4">
              <!-- Play Button -->
              <button 
                @click="togglePlay"
                class="user-primary-btn px-8 py-3 rounded-full flex items-center justify-center gap-2 transition-transform hover:scale-105 shadow-lg shadow-cyan-500/20 mr-2"
              >
                <svg v-if="!isThisSongPlaying" viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
                <svg v-else viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
                  <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                </svg>
                <span class="font-bold text-sm">{{ isThisSongPlaying ? 'Tạm dừng' : 'Phát' }}</span>
              </button>

              <LikeButton 
                :song="song"
                baseClass="h-12 w-12 rounded-full border border-white/10 bg-white/[0.06] flex items-center justify-center transition-all hover:bg-white/[0.10] hover:scale-105"
                activeClass="text-primary"
                inactiveClass="text-white"
              >
                <template #icon="{ isLiked }">
                  <svg viewBox="0 0 24 24" :fill="isLiked ? 'currentColor' : 'none'" stroke="currentColor" stroke-width="2" width="20" height="20">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/>
                  </svg>
                </template>
              </LikeButton>

              <!-- Add to Playlist -->
              <button 
                @click="openAddToPlaylist"
                class="h-12 w-12 rounded-full border border-white/10 bg-white/[0.06] text-white flex items-center justify-center transition-all hover:bg-white/[0.10] hover:scale-105"
                title="Thêm vào playlist"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                </svg>
              </button>

              <!-- More Menu -->
              <div class="relative" ref="moreMenuRef">
                <button 
                  @click="toggleMoreMenu"
                  class="h-12 w-12 rounded-full border border-white/10 bg-white/[0.06] text-white flex items-center justify-center transition-all hover:bg-white/[0.10] hover:scale-105"
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
                    <path d="M4.5 13.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7.5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3zm7.5 0a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/>
                  </svg>
                </button>

                <!-- Dropdown Menu -->
                <div 
                  v-if="showMoreMenu"
                  class="absolute top-full mt-2 left-0 lg:left-0 -translate-x-1/2 lg:translate-x-0 user-dropdown min-w-[200px] z-50"
                >
                  <button 
                    @click="openAddToPlaylist"
                    class="w-full px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/10 flex items-center gap-3 transition"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"/>
                    </svg>
                    Thêm vào playlist
                  </button>
                  <button 
                    @click="addToQueue"
                    class="w-full px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/10 flex items-center gap-3 transition"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 15L12 18.75 15.75 15m-7.5-6L12 5.25 15.75 9"/>
                    </svg>
                    Thêm vào hàng đợi
                  </button>
                  <div class="border-t border-white/10 my-1"></div>
                  <button 
                    @click="goToArtist"
                    class="w-full px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/10 flex items-center gap-3 transition"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
                    </svg>
                    Đi tới nghệ sĩ
                  </button>
                  <button 
                    v-if="song.album_id"
                    @click="goToAlbum"
                    class="w-full px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/10 flex items-center gap-3 transition"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z"/>
                    </svg>
                    Đi tới album
                  </button>
                  <button 
                    @click="copyLink"
                    class="w-full px-4 py-2.5 text-left text-sm text-slate-300 hover:bg-white/10 flex items-center gap-3 transition"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244"/>
                    </svg>
                    Sao chép liên kết
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- 2. LYRICS & ARTISTS (2 cols) -->
      <div class="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        
        <!-- Lyrics Panel -->
        <section class="user-panel-soft h-fit">
          <h2 class="user-section-title text-lg flex items-center gap-2 mb-4">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" class="text-cyan-400">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.801 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"/>
            </svg>
            Lời bài hát
          </h2>
          
          <div v-if="song.lyrics" class="relative">
            <div 
              class="text-slate-300 whitespace-pre-line leading-relaxed transition-all duration-300 overflow-hidden"
              :class="{ 'max-h-60': !showFullLyrics && isLyricsLong }"
            >
              {{ cleanLyrics(song.lyrics) }}
            </div>
            <div v-if="isLyricsLong && !showFullLyrics" class="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-slate-900/95 to-transparent pointer-events-none"></div>
            <button 
              v-if="isLyricsLong"
              @click="showFullLyrics = !showFullLyrics"
              class="mt-4 text-cyan-400 hover:text-cyan-300 text-sm font-bold flex items-center gap-1 transition"
            >
              {{ showFullLyrics ? 'Thu gọn' : 'Xem thêm' }}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16" :class="{ 'rotate-180': showFullLyrics }">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
          </div>
          
          <div v-else class="text-center py-6 flex flex-col items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="36" height="36" class="text-slate-600 mb-2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.801 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"/>
            </svg>
            <span class="text-sm text-slate-500 font-medium">Chưa có lời bài hát</span>
          </div>
        </section>

        <!-- Artist Panel -->
        <section class="user-panel-soft h-fit">
          <h2 class="user-section-title text-lg mb-4 flex items-center gap-2">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" class="text-cyan-400">
              <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"/>
            </svg>
            Nghệ sĩ
          </h2>
          
          <div class="flex flex-col gap-6">
            <div 
              v-for="artist in (song.artists && song.artists.length > 0 ? song.artists : (mainArtist ? [mainArtist] : []))" 
              :key="artist.id" 
              class="flex items-center gap-4"
            >
              <RouterLink :to="`/artist/${artist.id}`" class="w-14 h-14 rounded-full overflow-hidden flex-shrink-0 bg-white/10">
                <img 
                  :src="formatImageUrl(artist.avatar_url)" 
                  :alt="artist.name"
                  class="w-full h-full object-cover"
                  @error="e => e.target.src = '/default-avatar.png'"
                />
              </RouterLink>
              <div class="flex-1 min-w-0">
                <RouterLink :to="`/artist/${artist.id}`" class="font-bold text-white hover:underline truncate block">
                  {{ artist.name }}
                </RouterLink>
                <div class="text-xs text-slate-400">{{ formatCount(artist.followers_count) }} người theo dõi</div>
              </div>
              <button 
                v-if="authStore.isLoggedIn"
                @click="artist.id === mainArtist?.id ? toggleFollowArtist() : null"
                class="rounded-full border px-4 py-2 text-xs font-bold transition-all flex-shrink-0"
                :class="(artist.id === mainArtist?.id ? mainArtist.is_following : false)
                  ? 'bg-white text-black border-transparent' 
                  : 'border-white/20 text-white hover:bg-white/10'"
              >
                {{ (artist.id === mainArtist?.id ? mainArtist.is_following : false) ? 'Đang theo dõi' : 'Theo dõi' }}
              </button>
            </div>
          </div>
        </section>
      </div>

      <!-- 3. POPULAR SONGS -->
      <section v-if="popularSongs.length > 0" class="user-panel-soft">
        <h2 class="user-section-title text-lg mb-4 flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18" class="text-cyan-400">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
          Bài hát nổi bật của {{ mainArtist?.name }}
        </h2>
        
        <div class="flex flex-col gap-1">
          <SongRow
            v-for="(popSong, idx) in popularSongs.slice(0, 6)"
            :key="popSong.id"
            :song="popSong"
            :index="idx + 1"
            :showIndex="false"
            :showAlbum="false"
            :compact="true"
            :isPlaying="player.currentSong?.id === popSong.id"
            @play="playPopularSong"
            @open-menu="handleOpenMenu"
            @toggle-like="handleToggleLike"
          />
        </div>
      </section>

      <!-- 4. ALBUMS -->
      <section v-if="artistAlbums.length > 0" class="user-panel-soft">
        <h2 class="user-section-title text-lg mb-4 flex items-center gap-2">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18" class="text-cyan-400">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z"/>
          </svg>
          Album nổi bật của {{ mainArtist?.name }}
        </h2>
        
        <div class="user-horizontal-row">
          <RouterLink 
            v-for="album in artistAlbums.slice(0, 8)" 
            :key="album.id"
            :to="`/album/${album.id}`"
            class="user-horizontal-card user-album-card-size user-card user-card-hover group p-3 rounded-2xl flex flex-col gap-2"
          >
            <div class="aspect-square rounded-xl overflow-hidden bg-white/5 relative shadow-md">
              <img 
                :src="formatImageUrl(album.cover_url)" 
                :alt="album.title"
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                @error="e => e.target.src = '/default-cover.png'"
              />
            </div>
            <div class="min-w-0 px-1">
              <div class="text-sm font-bold text-white truncate group-hover:text-cyan-400 transition-colors">{{ album.title }}</div>
              <div class="text-xs text-slate-400 truncate mt-0.5">{{ formatReleaseYear(album.release_date) }}</div>
            </div>
          </RouterLink>
        </div>
      </section>

      <!-- 5. RELATED SONGS -->
      <section v-if="relatedSongs.length > 0" class="user-panel-soft">
        <h2 class="user-section-title text-lg flex items-center gap-2 mb-4">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20" class="text-cyan-400">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z"/>
          </svg>
          Có thể bạn cũng thích
        </h2>
        
        <div class="flex flex-col gap-1">
          <SongRow
            v-for="(relatedSong, idx) in relatedSongs.slice(0, 6)"
            :key="relatedSong.id"
            :song="relatedSong"
            :index="idx + 1"
            :showIndex="false"
            :showAlbum="false"
            :compact="true"
            :isPlaying="player.currentSong?.id === relatedSong.id"
            @play="playRelatedSong"
            @open-menu="handleOpenMenu"
            @toggle-like="handleToggleLike"
          />
        </div>
      </section>

    </div>

    <!-- Add to Playlist Modal -->
    <AddToPlaylistModal 
      :show="showAddToPlaylist" 
      :song="song"
      @close="showAddToPlaylist = false"
      @success="handlePlaylistSuccess"
    />

    <!-- Action Menu -->
    <SongActionMenu
      :show="listMenuState.show"
      :position="listMenuState.position"
      :song="listMenuState.song"
      :isLiked="library.isLiked(listMenuState.song)"
      @close="listMenuState.show = false"
      @add-to-playlist="handleListAddToPlaylist"
      @toggle-like="handleToggleLike"
      @add-to-queue="handleListAddToQueue"
      @go-to-song="handleListGoToSong"
      @go-to-artist="handleListGoToArtist"
      @go-to-album="handleListGoToAlbum"
      @share="handleListShare"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { songApi } from '@/api/song'
import { artistApi } from '@/api/artist'
import { albumApi } from '@/api/album'
import { usePlayerStore } from '@/stores/player'
import { useAuthStore } from '@/stores/auth'
import { useLibraryStore } from '@/stores/library'
import api from '@/api/axios'
import { formatImageUrl, formatDuration } from '@/utils/formatters'
import AddToPlaylistModal from '@/components/common/AddToPlaylistModal.vue'
import SongRow from '@/components/common/SongRow.vue'
import SongActionMenu from '@/components/common/SongActionMenu.vue'
import MediaCard from '@/components/common/MediaCard.vue'
import LikeButton from '@/components/common/LikeButton.vue'

const route = useRoute()
const router = useRouter()
const player = usePlayerStore()
const authStore = useAuthStore()
const library = useLibraryStore()

// State
const loading = ref(true)
const error = ref('')
const song = ref(null)
const relatedSongs = ref([])
const popularSongs = ref([])
const artistAlbums = ref([])
const showFullLyrics = ref(false)
const showMoreMenu = ref(false)
const showAddToPlaylist = ref(false)
const isPlaying = ref(false)
const initialIsLiked = ref(false)
const moreMenuRef = ref(null)

const displayLikeCount = computed(() => {
  if (!song.value) return 0
  const baseCount = song.value.like_count || 0
  const currentIsLiked = library.isLiked(song.value)
  
  if (initialIsLiked.value && !currentIsLiked) {
    return Math.max(0, baseCount - 1)
  }
  if (!initialIsLiked.value && currentIsLiked) {
    return baseCount + 1
  }
  return baseCount
})

// Computed
const coverImage = computed(() => {
  return formatImageUrl(song.value?.cover_url || song.value?.album_cover_url || '/default-cover.png')
})

const mainArtist = computed(() => {
  return song.value?.artists?.[0] || null
})

const isThisSongPlaying = computed(() => {
  return player.currentSong?.id === song.value?.id && player.isPlaying
})

const isLyricsLong = computed(() => {
  return song.value?.lyrics && song.value.lyrics.length > 500
})

// Methods
function cleanLyrics(lyrics) {
  if (!lyrics) return ''
  return lyrics.replace(/\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g, '').trim()
}

function formatCount(num) {
  if (!num) return '0'
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K'
  return String(num)
}

function formatReleaseDate(date) {
  if (!date) return ''
  const d = new Date(date)
  return d.toLocaleDateString('vi-VN', { year: 'numeric', month: 'long', day: 'numeric' })
}

function formatReleaseYear(date) {
  if (!date) return ''
  return new Date(date).getFullYear()
}

function handleImageError(e) {
  e.target.src = '/default-cover.png'
}

async function fetchSongDetail() {
  loading.value = true
  error.value = ''
  relatedSongs.value = []
  popularSongs.value = []
  artistAlbums.value = []
  try {
    const res = await songApi.getSongDetail(route.params.id)
    if (res.data?.success) {
      song.value = res.data.data
      initialIsLiked.value = song.value.is_liked === 1 || song.value.is_liked === true || song.value.isLiked === true || song.value.liked === true
      document.title = `${song.value.title} - ${song.value.artist_name} | MusicFlow`
      
      // Fetch related data in parallel
      if (song.value.artist) {
        fetchRelatedData(song.value.artist.id)
      }
    } else {
      error.value = 'Không tìm thấy bài hát.'
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Không tìm thấy bài hát.'
  } finally {
    loading.value = false
  }
}

async function fetchRelatedData(artistId) {
  try {
    const [relatedRes, artistRes] = await Promise.all([
      songApi.getRelatedSongs(route.params.id, 10),
      artistApi.getById(artistId)
    ])
    
    if (relatedRes.data?.success) {
      relatedSongs.value = relatedRes.data.data || []
    }
    
    if (artistRes.data?.success) {
      const artistData = artistRes.data.data
      popularSongs.value = artistData.popular_songs?.slice(0, 6) || []
      artistAlbums.value = [...(artistData.albums || []), ...(artistData.singles || [])].slice(0, 5)
      
      // Update artist following status
      if (song.value?.artist) {
        song.value.artist.is_following = artistData.is_following || false
      }
      if (song.value?.artists?.[0]) {
        song.value.artists[0].is_following = artistData.is_following || false
      }
    }
  } catch (err) {
    console.warn('Error fetching related data:', err)
  }
}

function togglePlay() {
  if (player.currentSong?.id === song.value?.id) {
    player.togglePlay()
  } else {
    player.setSong(song.value, relatedSongs.value.length > 0 ? [song.value, ...relatedSongs.value] : null, 'song_detail')
    if (!player.isPlaying) player.togglePlay()
  }
}

function playRelatedSong(songItem) {
  player.setSong(songItem, [song.value, ...relatedSongs.value], 'song_detail')
  if (!player.isPlaying) player.togglePlay()
}

function playPopularSong(songItem) {
  player.setSong(songItem, popularSongs.value, 'artist_songs')
  if (!player.isPlaying) player.togglePlay()
}



async function toggleFollowArtist() {
  if (!authStore.isLoggedIn || !mainArtist.value) return
  
  const wasFollowing = mainArtist.value.is_following
  mainArtist.value.is_following = !wasFollowing
  mainArtist.value.followers_count = (mainArtist.value.followers_count || 0) + (wasFollowing ? -1 : 1)
  
  try {
    if (wasFollowing) {
      await artistApi.unfollowArtist(mainArtist.value.id)
    } else {
      await artistApi.followArtist(mainArtist.value.id)
    }
  } catch (err) {
    mainArtist.value.is_following = wasFollowing
    mainArtist.value.followers_count = (mainArtist.value.followers_count || 0) + (wasFollowing ? 1 : -1)
  }
}

function openAddToPlaylist() {
  showMoreMenu.value = false
  if (!authStore.isLoggedIn) {
    router.push('/login')
    return
  }
  showAddToPlaylist.value = true
}

function addToQueue() {
  showMoreMenu.value = false
  player.addToQueue(song.value)
}

function goToArtist() {
  showMoreMenu.value = false
  if (mainArtist.value) {
    router.push(`/artist/${mainArtist.value.id}`)
  }
}

function goToAlbum() {
  showMoreMenu.value = false
  if (song.value?.album_id) {
    router.push(`/album/${song.value.album_id}`)
  }
}

function copyLink() {
  showMoreMenu.value = false
  const url = `${window.location.origin}/song/${song.value.id}`
  navigator.clipboard.writeText(url)
}

function handlePlaylistSuccess(message) {
  console.log(message)
}

function toggleMoreMenu() {
  showMoreMenu.value = !showMoreMenu.value
}

function handleClickOutside(e) {
  if (moreMenuRef.value && !moreMenuRef.value.contains(e.target)) {
    showMoreMenu.value = false
  }
}

// Menu logic for list songs
const listMenuState = ref({ show: false, position: { x: 0, y: 0 }, song: null })
function handleOpenMenu({ song: targetSong, x, y }) {
  listMenuState.value = { show: true, position: { x, y }, song: targetSong }
}
function handleListAddToPlaylist(targetSong) { library.openPlaylistModal(targetSong) }
function handleListAddToQueue(targetSong) { player.addToQueue(targetSong) }
function handleListGoToSong(targetSong) { router.push(`/song/${targetSong.id || targetSong.song_id}`) }
function handleListGoToArtist(targetSong) { if (targetSong.artist_id) router.push(`/artist/${targetSong.artist_id}`) }
function handleListGoToAlbum(targetSong) { if (targetSong.album_id) router.push(`/album/${targetSong.album_id}`) }
function handleListShare(targetSong) { 
  navigator.clipboard.writeText(`${window.location.origin}/song/${targetSong.id || targetSong.song_id}`) 
}

// Lifecycle
onMounted(() => {
  fetchSongDetail()
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
  document.title = 'MusicFlow'
})

watch(() => route.params.id, (newId) => {
  if (route.name === 'SongDetail' && newId) {
    fetchSongDetail()
    showMoreMenu.value = false
    showFullLyrics.value = false
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
})
</script>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.rotate-180 {
  transform: rotate(180deg);
}

.scrollbar-hide::-webkit-scrollbar {
  display: none;
}
.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
</style>
