<template>
  <div class="user-layout-surface min-h-screen w-full overflow-x-hidden text-gray-200 font-sans">
    <!-- SIDEBAR -->
    <aside class="sidebar-scroll fixed left-0 top-0 bottom-0 z-[80] hidden w-[260px] flex-col overflow-y-auto border-r border-white/10 bg-[#080b14]/95 p-4 pb-28 backdrop-blur-xl md:flex">
      <!-- Brand -->
      <div class="mb-5 flex h-20 items-center gap-3 px-2">
        <div class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-violet-400/20 bg-violet-500/20 shadow-lg shadow-violet-950/30">
          <img src="/logo.png" alt="MusicFlow" class="h-8 w-8 object-contain opacity-95" />
        </div>
        <div class="min-w-0">
          <h1 class="truncate text-lg font-extrabold text-white">MusicFlow</h1>
          <p class="text-xs font-semibold text-slate-400">Premium Audio</p>
        </div>
      </div>

      <!-- Nav -->
      <nav class="flex flex-col gap-1.5">
        <RouterLink 
          v-for="item in navItems" 
          :key="item.to" 
          :to="item.to" 
          class="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm no-underline transition-all duration-200 group"
          :class="isActive(item.to) ? 'border border-white/10 bg-white/[0.10] font-bold text-white shadow-lg shadow-black/10' : 'border border-transparent font-semibold text-slate-400 hover:bg-white/[0.06] hover:text-white'"
        >
          <span class="h-5 w-5 shrink-0 transition-colors" :class="isActive(item.to) ? 'text-white' : 'text-slate-500 group-hover:text-white'" v-html="item.icon" />
          <span class="truncate">{{ item.label }}</span>
        </RouterLink>

        <div class="my-3 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

      </nav>

      <div class="flex-1" />

      <!-- Playlists section -->
      <div class="py-4">
        <div class="px-4 pb-2 pt-5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-slate-500">Thư viện</div>
        
        <RouterLink to="/liked-songs" class="flex items-center gap-3 rounded-2xl px-3 py-2.5 cursor-pointer transition-all duration-200 no-underline group" :class="isActive('/liked-songs') ? 'border border-white/10 bg-white/[0.10]' : 'border border-transparent hover:bg-white/[0.06]'">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-600 text-white shadow-md transition-transform group-hover:scale-105">
            <svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
              <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
            </svg>
          </div>
          <span class="truncate text-sm font-semibold" :class="isActive('/liked-songs') ? 'text-white' : 'text-slate-400 group-hover:text-white'">Bài hát yêu thích</span>
        </RouterLink>
        
        <RouterLink to="/recently-played" class="flex items-center gap-3 rounded-2xl px-3 py-2.5 cursor-pointer transition-all duration-200 no-underline group" :class="isActive('/recently-played') ? 'border border-white/10 bg-white/[0.10]' : 'border border-transparent hover:bg-white/[0.06]'">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-md transition-transform group-hover:scale-105">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
              <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <span class="truncate text-sm font-semibold" :class="isActive('/recently-played') ? 'text-white' : 'text-slate-400 group-hover:text-white'">Nghe gần đây</span>
        </RouterLink>
        
        <RouterLink to="/me/followed-artists" class="flex items-center gap-3 rounded-2xl px-3 py-2.5 cursor-pointer transition-all duration-200 no-underline group" :class="isActive('/me/followed-artists') ? 'border border-white/10 bg-white/[0.10]' : 'border border-transparent hover:bg-white/[0.06]'">
          <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md transition-transform group-hover:scale-105">
            <svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
            </svg>
          </div>
          <span class="truncate text-sm font-semibold" :class="isActive('/me/followed-artists') ? 'text-white' : 'text-slate-400 group-hover:text-white'">Nghệ sĩ đã follow</span>
        </RouterLink>
      </div>

      <!-- Create playlist -->
      <button class="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-500 px-4 py-3 text-sm font-extrabold text-white transition hover:scale-[1.02] hover:shadow-lg hover:shadow-violet-950/40" @click="$router.push('/library')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4.5v15m7.5-7.5h-15"/>
        </svg>
        Tạo Playlist
      </button>
    </aside>

    <!-- MAIN AREA -->
    <div
      class="relative flex min-h-screen flex-col user-layout-surface overflow-hidden md:ml-[260px]"
      :class="isRightSidebarOpen ? '2xl:mr-[400px]' : '2xl:mr-0'"
    >
      <UserTopbar :is-queue-open="isRightSidebarOpen" />

      <!-- Page content -->
      <main class="relative z-10 flex-1 px-4 pt-16 pb-[112px] md:px-8">
        <RouterView />
      </main>
    </div>

    <!-- QUEUE OVERLAY (for < 2xl) -->
    <div
      v-if="isRightSidebarOpen"
      class="fixed inset-0 z-[80] bg-black/35 backdrop-blur-[1px] 2xl:hidden"
      @click="isRightSidebarOpen = false"
    ></div>

    <!-- RIGHT SIDEBAR -->
    <aside
      class="fixed right-0 top-0 bottom-[96px] z-[90] flex flex-col w-[400px] max-w-[calc(100vw-24px)] overflow-hidden border-l border-white/10 bg-[#070a12]/95 backdrop-blur-xl shadow-[0_18px_45px_rgba(0,0,0,0.38)] transition-transform duration-300 ease-out will-change-transform"
      :class="isRightSidebarOpen ? 'translate-x-0' : 'translate-x-full'"
    >
      <div class="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
        <h3 class="text-sm font-bold text-white m-0">Danh sách chờ</h3>
        <button class="bg-transparent border-none text-gray-500 cursor-pointer p-1.5 rounded-full hover:bg-white/10 hover:text-white transition-colors" @click="isRightSidebarOpen = false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
      </div>
      
      <div class="sidebar-scroll flex-1 overflow-y-auto p-5">
        <div class="mb-6" v-if="player.currentSong">
          <div class="text-[11px] font-black text-emerald-500 uppercase tracking-widest mb-3">Đang phát</div>
          <div class="flex items-center gap-3 rounded-xl border border-violet-400/40 bg-violet-500/10 p-3">
            <img :src="$formatImageUrl(player.currentSong.cover_url)" @error="event => event.target.src = '/default-cover.png'" class="w-14 h-14 rounded-lg object-cover shadow-md shrink-0" />
            <div class="flex flex-col gap-1 overflow-hidden">
              <div class="text-sm font-bold text-white whitespace-nowrap overflow-hidden text-ellipsis">{{ player.currentSong.title }}</div>
              <div class="text-xs font-semibold text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis">{{ player.currentSong.artist_name || player.currentSong.artist }}</div>
            </div>
          </div>
        </div>

        <div>
          <div class="text-[11px] font-black text-gray-500 uppercase tracking-widest mb-3">Tiếp theo</div>
          <div class="text-xs text-gray-600 font-medium text-center py-8" v-if="upcomingSongs.length === 0">Chưa có bài hát nào.</div>
          <draggable
            v-if="canReorderQueue"
            v-model="upcomingQueueModel"
            item-key="id"
            tag="div"
            class="flex flex-col gap-1.5"
            handle=".queue-drag-handle"
            ghost-class="queue-row--ghost"
            chosen-class="queue-row--dragging"
            :animation="160"
          >
            <template #item="{ element: song, index }">
              <div
                class="queue-row user-row flex items-center gap-3 p-2.5 cursor-pointer group border border-transparent hover:border-white/10"
                @click="player.setSong(song)"
              >
                <button
                  class="queue-drag-handle flex h-10 w-7 shrink-0 cursor-grab items-center justify-center text-slate-500 transition active:cursor-grabbing group-hover:text-slate-300"
                  title="Keo de sap xep"
                  aria-label="Keo de sap xep"
                  @click.stop
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" class="h-4 w-4">
                    <path d="M8 6.5A1.5 1.5 0 116.5 5 1.5 1.5 0 018 6.5zm0 7A1.5 1.5 0 116.5 12 1.5 1.5 0 018 13.5zm0 7A1.5 1.5 0 116.5 19 1.5 1.5 0 018 20.5zm8-14A1.5 1.5 0 1114.5 5 1.5 1.5 0 0116 6.5zm0 7a1.5 1.5 0 11-1.5-1.5A1.5 1.5 0 0116 13.5zm0 7a1.5 1.5 0 11-1.5-1.5A1.5 1.5 0 0116 20.5z"/>
                  </svg>
                </button>
                <img :src="$formatImageUrl(song.cover_url || song.cover)" @error="event => event.target.src = '/default-cover.png'" class="w-11 h-11 rounded-md object-cover shadow-sm shrink-0" />
                <div class="flex min-w-0 flex-col overflow-hidden">
                  <div class="text-sm font-semibold text-gray-200 whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-white">{{ song.title }}</div>
                  <div class="text-xs font-medium text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis">{{ song.artist_name || song.artist }}</div>
                </div>
                <button
                  class="ml-auto opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
                  title="Xóa khỏi danh sách chờ"
                  @click.stop="player.removeFromQueue(player.queueIndex + 1 + index)"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </template>
          </draggable>
          <div class="flex flex-col gap-1.5" v-else>
            <div 
              v-for="(song, idx) in upcomingSongs" 
              :key="song.id + '-' + idx" 
              class="queue-row user-row flex items-center gap-3 p-2.5 cursor-pointer group border border-transparent hover:border-white/10"
              @click="player.setSong(song)"
            >
              <img :src="$formatImageUrl(song.cover_url || song.cover)" @error="event => event.target.src = '/default-cover.png'" class="w-11 h-11 rounded-md object-cover shadow-sm shrink-0" />
              <div class="flex min-w-0 flex-col overflow-hidden">
                <div class="text-sm font-semibold text-gray-200 whitespace-nowrap overflow-hidden text-ellipsis group-hover:text-white">{{ song.title }}</div>
                <div class="text-xs font-medium text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis">{{ song.artist_name || song.artist }}</div>
              </div>
              <button
                class="ml-auto opacity-0 group-hover:opacity-100 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-all"
                title="Xóa khỏi danh sách chờ"
                @click.stop="player.removeFromQueue(player.queueIndex + 1 + idx)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </aside>

    <!-- PLAYER BAR -->
    <footer class="fixed bottom-0 left-0 right-0 z-[999] flex h-[96px] items-center justify-between border-t border-white/10 bg-[#05070d]/95 px-4 shadow-[0_-18px_45px_rgba(0,0,0,0.45)] backdrop-blur-xl">
      <!-- Now playing -->
      <div class="flex items-center gap-4 min-w-[200px] flex-1">
        <div class="w-14 h-14 rounded-[4px] bg-white/10 flex items-center justify-center shrink-0 overflow-hidden group shadow-lg">
          <img v-if="player.currentSong?.cover_url" :src="$formatImageUrl(player.currentSong.cover_url)" @error="event => event.target.src = '/default-cover.png'" class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
          <svg v-else viewBox="0 0 24 24" fill="currentColor" class="w-6 h-6 text-gray-600">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
        </div>
        <div class="flex flex-col min-w-0">
          <span class="text-sm font-semibold text-white whitespace-nowrap overflow-hidden text-ellipsis hover:underline cursor-pointer" @click="player.currentSong && $router.push(`/song/${player.currentSong.id}`)">{{ player.currentSong?.title || 'Chưa phát gì' }}</span>
          <span class="text-xs font-medium text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis hover:underline hover:text-white cursor-pointer" @click="player.currentSong?.artist_id && $router.push(`/artist/${player.currentSong.artist_id}`)">{{ player.currentSong?.artist_name || player.currentSong?.artist || '---' }}</span>
        </div>
        <button 
          class="bg-transparent border-none cursor-pointer p-2 shrink-0 rounded-full transition-all duration-200 hover:bg-white/10"
          :class="{ 'text-pink-500 hover:!bg-pink-500/10': library.isLiked(player.currentSong), 'text-gray-400 hover:text-white': !library.isLiked(player.currentSong) }"
          @click="library.toggleLike(player.currentSong)"
        >
          <svg v-if="!library.isLiked(player.currentSong)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" class="w-5 h-5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"/>
          </svg>
          <svg v-else viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
            <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/>
          </svg>
        </button>
      </div>

      <!-- Controls -->
      <div class="flex flex-col items-center gap-1.5 flex-[2] max-w-[640px]">
        <div class="flex items-center gap-4">
          <!-- Shuffle -->
          <button class="bg-transparent border-none cursor-pointer p-1.5 rounded-full transition-all duration-200 text-gray-500 hover:text-white" :class="{ 'text-[#1ed760]': player.shuffle }" @click="player.toggleShuffle()" title="Shuffle">
            <svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
              <path d="M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z"/>
            </svg>
          </button>
          
          <!-- Previous -->
          <button class="bg-transparent border-none cursor-pointer p-1.5 rounded-full transition-all duration-200 text-gray-400 hover:text-white" @click="player.prev()" title="Previous">
            <svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
              <path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/>
            </svg>
          </button>
          
          <!-- Play/Pause -->
          <button class="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center transition-all duration-200 hover:scale-105 shadow-lg border-none cursor-pointer" @click="player.togglePlay()" title="Play/Pause">
            <svg v-if="!player.isPlaying" viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5 ml-0.5">
              <path d="M8 5v14l11-7z"/>
            </svg>
            <svg v-else viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          </button>
          
          <!-- Next -->
          <button class="bg-transparent border-none cursor-pointer p-1.5 rounded-full transition-all duration-200 text-gray-400 hover:text-white" @click="player.next()" title="Next">
            <svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5">
              <path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/>
            </svg>
          </button>
          
          <!-- Repeat -->
          <button class="bg-transparent border-none cursor-pointer p-1.5 rounded-full transition-all duration-200 text-gray-500 hover:text-white" :class="{ 'text-[#1ed760]': player.repeat !== 'none' }" @click="player.toggleRepeat()" title="Repeat">
            <svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4">
              <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/>
            </svg>
          </button>
        </div>
        
        <!-- Progress -->
        <div class="flex items-center gap-2 w-full max-w-[500px]">
          <span class="text-[11px] font-semibold text-gray-400 min-w-[36px] text-right">{{ formatTime(player.currentTime) }}</span>
          <div class="flex-1 h-1 bg-white/15 rounded-full cursor-pointer relative group flex items-center" @click="seek">
            <div class="absolute left-0 h-full bg-white rounded-full transition-colors group-hover:bg-[#1ed760]" :style="`width:${pct}%`">
              <div class="absolute -right-1.5 -translate-y-1/2 top-1/2 w-3 h-3 bg-white rounded-full opacity-0 group-hover:opacity-100 shadow-md transition-opacity"></div>
            </div>
          </div>
          <span class="text-[11px] font-semibold text-gray-400 min-w-[36px]">{{ formatTime(player.duration) }}</span>
        </div>
      </div>

      <!-- Right controls -->
      <div class="flex items-center gap-1 flex-1 justify-end">
        <button class="bg-transparent border-none cursor-pointer p-1.5 rounded-full transition-all duration-200 text-gray-500 hover:text-white" :class="{ 'text-[#1ed760]': isRightSidebarOpen }" @click="isRightSidebarOpen = !isRightSidebarOpen" title="Danh sách chờ">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.008v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.008v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.008v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/>
          </svg>
        </button>
        
        <button
          class="bg-transparent border-none cursor-pointer p-1.5 rounded-full transition-all duration-200 text-gray-500 hover:text-white"
          :class="{ 'text-[#1ed760]': isActive('/karaoke') }"
          title="Mở Karaoke"
          aria-label="Mở Karaoke"
          @click="router.push('/karaoke')"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"/>
          </svg>
        </button>
        
        <div class="flex items-center gap-1 group relative">
          <svg viewBox="0 0 24 24" fill="currentColor" class="w-4 h-4 text-gray-500 group-hover:text-white transition-colors">
            <path d="M3 9v6h4l5 5V4L7 9H3z"/>
          </svg>
          <div class="w-[80px] h-1 bg-white/15 rounded-full relative cursor-pointer group-hover:bg-white/30">
            <input type="range" min="0" max="100" :value="player.volume * 100" @input="player.setVolume($event.target.value / 100)" class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
            <div class="absolute left-0 h-full bg-white rounded-full group-hover:bg-[#1ed760] transition-colors" :style="`width:${player.volume * 100}%`"></div>
          </div>
        </div>
        
        <button class="bg-transparent border-none cursor-pointer p-1.5 rounded-full transition-all duration-200 text-gray-500 hover:text-white" @click="player.isNowPlayingExpanded = true" title="Now Playing">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-4 h-4">
            <path stroke-linecap="round" stroke-linejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15"/>
          </svg>
        </button>
      </div>
    </footer>

    <!-- Add To Playlist Modal -->
    <AddToPlaylistModal @success="msg => addToast(msg)" @error="msg => addToast(msg)" />

    <!-- Now Playing Overlay -->
    <NowPlayingView />

    <!-- Toast Manager -->
    <ToastManager />
  </div>
</template>

<script setup>
import { computed, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import draggable from 'vuedraggable'
import { usePlayerStore } from '@/stores/player'
import { useLibraryStore } from '@/stores/library'
import AddToPlaylistModal from '@/components/playlist/AddToPlaylistModal.vue'
import UserTopbar from '@/components/layout/UserTopbar.vue'
import NowPlayingView from '@/views/player/NowPlayingView.vue'
import ToastManager from '@/components/common/ToastManager.vue'
import { addToast } from '@/utils/toast'

const player = usePlayerStore()
const library = useLibraryStore()
const router = useRouter()

const pct = computed(() => player.duration ? (player.currentTime / player.duration) * 100 : 0)

const isRightSidebarOpen = ref(false)

const upcomingSongs = computed(() => {
  if (!player.queue || player.queue.length === 0) return []
  return player.queue.slice(player.queueIndex + 1)
})

const canReorderQueue = computed(() => upcomingSongs.value.length > 1)

const upcomingQueueModel = computed({
  get: () => upcomingSongs.value,
  set: (nextUpcoming) => {
    if (!Array.isArray(nextUpcoming)) return
    const lockedQueue = player.queue.slice(0, player.queueIndex + 1)
    player.reorderQueue([...lockedQueue, ...nextUpcoming])
  }
})

function isActive(path) {
  return router.currentRoute.value.path === path
}

onMounted(() => {
  library.fetchLikedSongs()
})

function formatTime(s) {
  if (!s) return '0:00'
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60).toString().padStart(2, '0')
  return `${m}:${sec}`
}

function seek(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  player.seek(((e.clientX - rect.left) / rect.width) * player.duration)
}

const navItems = [
  { to: '/', label: 'Trang chủ', icon: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>' },
  { to: '/search', label: 'Tìm kiếm', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><circle cx="11" cy="11" r="8"/><path stroke-linecap="round" d="m21 21-4.35-4.35"/></svg>' },
  { to: '/library', label: 'Thư viện', icon: '<svg viewBox="0 0 24 24" fill="currentColor" class="w-5 h-5"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/></svg>' },
  { to: '/ai', label: 'AI Playlist', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z"/></svg>' },
  { to: '/karaoke', label: 'Karaoke', icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="w-5 h-5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z"/></svg>' },
]
</script>

<style>
.sidebar-scroll {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.12) transparent;
}

.sidebar-scroll::-webkit-scrollbar {
  width: 4px;
}

.sidebar-scroll::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.12);
  border-radius: 999px;
}

.sidebar-scroll::-webkit-scrollbar-track {
  background: transparent;
}

.queue-row--dragging,
.queue-row--ghost {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.14);
  opacity: 0.72;
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.24);
}

.queue-drag-handle {
  touch-action: none;
}

@media (hover: hover) {
  .queue-drag-handle {
    opacity: 0;
  }

  .queue-row:hover .queue-drag-handle,
  .queue-drag-handle:focus-visible {
    opacity: 1;
  }
}
</style>
