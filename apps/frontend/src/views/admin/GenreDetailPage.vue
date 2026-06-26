<template>
  <div class="h-full flex flex-col bg-gray-50 dark:bg-bg-base overflow-hidden">
    <!-- Header / Breadcrumb -->
    <div class="px-6 py-4 bg-white dark:bg-bg-surface border-b border-gray-200 dark:border-bg-border flex items-center justify-between shrink-0 sticky top-0 z-10">
      <div class="flex items-center gap-4">
        <router-link 
          to="/admin/genres" 
          class="p-2 text-gray-400 hover:text-gray-900 dark:hover:text-white bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-full transition-colors flex items-center justify-center group"
          title="Quay lại Taxonomy Center"
        >
          <MfIcon name="arrow_back" size="20" class="group-hover:-translate-x-0.5 transition-transform" />
        </router-link>
        <div v-if="genre" class="flex flex-col">
          <div class="flex items-center gap-2 text-xs font-medium text-gray-500 mb-0.5">
            <router-link to="/admin/genres" class="hover:text-indigo-500 transition-colors">Admin</router-link>
            <MfIcon name="chevron_right" size="14" />
            <router-link to="/admin/genres" class="hover:text-indigo-500 transition-colors">Taxonomy</router-link>
            <MfIcon name="chevron_right" size="14" />
            <span class="text-gray-900 dark:text-gray-300">{{ genre.name }}</span>
          </div>
          <h1 class="text-xl font-black text-gray-900 dark:text-white flex items-center gap-2">
            Phân tích thể loại
          </h1>
        </div>
        <div v-else class="h-10 w-48 bg-gray-200 dark:bg-gray-800 animate-pulse rounded"></div>
      </div>
    </div>

    <!-- Main Scrollable Content -->
    <div class="flex-1 overflow-y-auto">
      
      <!-- Loading State -->
      <div v-if="loading" class="flex flex-col items-center justify-center h-[50vh]">
        <div class="w-12 h-12 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
        <p class="text-sm text-gray-500 font-medium">Đang tải dữ liệu phân tích...</p>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="flex flex-col items-center justify-center h-[50vh] text-center px-4">
        <div class="w-16 h-16 bg-rose-100 text-rose-500 rounded-full flex items-center justify-center mb-4">
          <MfIcon name="error_outline" size="32" />
        </div>
        <h3 class="text-lg font-bold text-gray-900 dark:text-white mb-2">Không thể tải dữ liệu</h3>
        <p class="text-gray-500 max-w-md">{{ error }}</p>
        <button @click="fetchData" class="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-bold text-sm">
          Thử lại
        </button>
      </div>

      <!-- Content -->
      <div v-else-if="genre" class="max-w-7xl mx-auto w-full p-4 md:p-6 lg:p-8 space-y-6">
        
        <!-- Hero Header -->
        <div class="relative bg-white dark:bg-bg-surface rounded-2xl overflow-hidden shadow-sm border border-gray-200 dark:border-bg-border flex flex-col md:flex-row items-stretch min-h-[220px]">
          <!-- Cover -->
          <div class="md:w-1/3 lg:w-1/4 relative bg-gray-100 dark:bg-gray-800 shrink-0">
            <img v-if="genre.cover_url" :src="$formatImageUrl(genre.cover_url)" class="w-full h-full object-cover absolute inset-0" alt="cover">
            <div v-else class="w-full h-full absolute inset-0 flex flex-col items-center justify-center opacity-50" :style="{ backgroundColor: genre.color || '#e5e7eb' }">
              <span v-if="genre.icon" class="text-6xl drop-shadow-md text-white">{{ genre.icon }}</span>
              <MfIcon v-else name="category" size="48" class="text-gray-400" />
            </div>
            <div class="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent md:bg-gradient-to-r"></div>
            
            <div class="absolute bottom-4 left-4 right-4 md:hidden">
               <h2 class="text-3xl font-black text-white drop-shadow-md">{{ genre.name }}</h2>
            </div>
          </div>
          
          <!-- Info Info -->
          <div class="p-6 md:p-8 flex-1 flex flex-col justify-center relative">
            <div class="hidden md:block mb-2">
              <h2 class="text-4xl lg:text-5xl font-black text-gray-900 dark:text-white tracking-tight">{{ genre.name }}</h2>
            </div>
            
            <div class="flex flex-wrap items-center gap-2 mb-4">
              <span class="px-2.5 py-1 rounded-md bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 text-xs font-mono font-bold border border-gray-200 dark:border-gray-700">
                slug: {{ genre.slug }}
              </span>
              <span v-if="genre.market" class="px-2.5 py-1 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold border border-indigo-100 dark:border-indigo-500/20">
                Market: {{ genre.market }}
              </span>
              <span v-if="genre.parent_name" class="px-2.5 py-1 rounded-md bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 text-xs font-bold border border-purple-100 dark:border-purple-500/20 flex items-center gap-1">
                Parent: {{ genre.parent_name }}
              </span>
              <span 
                class="px-2.5 py-1 rounded-md text-xs font-bold border"
                :class="genre.status === 'active' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 border-emerald-100 dark:border-emerald-500/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 border-gray-200 dark:border-gray-700'"
              >
                {{ genre.status === 'active' ? 'ACTIVE' : 'HIDDEN' }}
              </span>
            </div>
            
            <p v-if="genre.description" class="text-gray-600 dark:text-gray-400 text-sm leading-relaxed max-w-3xl">
              {{ genre.description }}
            </p>
            <p v-else class="text-gray-400 dark:text-gray-500 text-sm italic">
              Chưa có mô tả chi tiết.
            </p>
          </div>
        </div>

        <!-- Data Quality Warnings -->
        <div v-if="dataQuality && dataQuality.length > 0" class="space-y-2">
          <div 
            v-for="(warn, i) in dataQuality" :key="i"
            class="p-3 rounded-xl border text-sm font-medium flex items-start gap-2"
            :class="warn.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-500/10 dark:border-rose-500/20 dark:text-rose-400' : 'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-500/10 dark:border-amber-500/20 dark:text-amber-400'"
          >
            <MfIcon :name="warn.type === 'error' ? 'error' : 'warning'" size="18" class="shrink-0 mt-0.5" />
            <span>{{ warn.message }}</span>
          </div>
        </div>

        <!-- Two Columns Layout -->
        <div class="grid grid-cols-1 xl:grid-cols-3 gap-6">
          
          <!-- Left Column: Stats & Analytics (Takes 2/3) -->
          <div class="xl:col-span-2 space-y-6">
            
            <!-- Stat Cards -->
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div class="bg-white dark:bg-bg-surface p-4 rounded-xl border border-gray-200 dark:border-bg-border shadow-sm flex flex-col justify-center">
                <div class="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Bài hát</div>
                <div class="text-2xl font-black text-gray-900 dark:text-white">{{ formatNumber(stats.song_count) }}</div>
              </div>
              <div class="bg-white dark:bg-bg-surface p-4 rounded-xl border border-gray-200 dark:border-bg-border shadow-sm flex flex-col justify-center">
                <div class="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Nghệ sĩ</div>
                <div class="text-2xl font-black text-gray-900 dark:text-white">{{ formatNumber(stats.artist_count) }}</div>
              </div>
              <div class="bg-white dark:bg-bg-surface p-4 rounded-xl border border-gray-200 dark:border-bg-border shadow-sm flex flex-col justify-center">
                <div class="text-gray-500 dark:text-gray-400 text-xs font-bold uppercase tracking-wider mb-1">Album</div>
                <div class="text-2xl font-black text-gray-900 dark:text-white">{{ formatNumber(stats.album_count) }}</div>
              </div>
              <div class="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 shadow-sm flex flex-col justify-center">
                <div class="text-blue-600 dark:text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">Lượt nghe (30N)</div>
                <div class="text-2xl font-black text-blue-700 dark:text-blue-300">{{ formatNumber(stats.listens_30d) }}</div>
              </div>
              <div class="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-900/30 shadow-sm flex flex-col justify-center">
                <div class="text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">User Follow</div>
                <div class="text-2xl font-black text-emerald-700 dark:text-emerald-300">{{ formatNumber(stats.users_selected) }}</div>
              </div>
              <div class="bg-purple-50 dark:bg-purple-900/10 p-4 rounded-xl border border-purple-100 dark:border-purple-900/30 shadow-sm flex flex-col justify-center">
                <div class="text-purple-600 dark:text-purple-400 text-xs font-bold uppercase tracking-wider mb-1">Playlist chứa</div>
                <div class="text-2xl font-black text-purple-700 dark:text-purple-300">{{ formatNumber(stats.playlist_usage) }}</div>
              </div>
            </div>

            <!-- Analytics Chart (CSS Only) -->
            <div class="bg-white dark:bg-bg-surface rounded-xl border border-gray-200 dark:border-bg-border shadow-sm p-5 md:p-6">
              <h3 class="text-base font-bold text-gray-900 dark:text-white mb-6 flex items-center gap-2">
                <MfIcon name="insights" size="20" class="text-indigo-500" />
                Lượt nghe 30 ngày qua
              </h3>
              
              <div v-if="trend.length > 0 && maxTrendValue > 0" class="h-48 flex items-end justify-between gap-1 mt-4 border-b border-gray-100 dark:border-gray-800 pb-2 relative">
                <!-- Y-Axis Lines (Decorative) -->
                <div class="absolute inset-x-0 bottom-0 top-0 flex flex-col justify-between pointer-events-none">
                  <div class="border-t border-gray-100 dark:border-gray-800/50 w-full"></div>
                  <div class="border-t border-gray-100 dark:border-gray-800/50 w-full"></div>
                  <div class="border-t border-gray-100 dark:border-gray-800/50 w-full"></div>
                </div>
                
                <!-- Bars -->
                <div 
                  v-for="(t, i) in trend" :key="i"
                  class="flex-1 bg-indigo-100 dark:bg-indigo-500/20 hover:bg-indigo-400 dark:hover:bg-indigo-500 rounded-t-sm transition-all duration-300 relative group min-w-[4px]"
                  :style="{ height: `${Math.max((t.count / maxTrendValue) * 100, 2)}%` }"
                >
                  <!-- Tooltip -->
                  <div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-gray-900 text-white text-xs py-1 px-2 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 hidden md:block">
                    {{ t.date }}: <b>{{ formatNumber(t.count) }}</b>
                  </div>
                </div>
              </div>
              <div v-else class="h-48 flex items-center justify-center text-gray-400 text-sm bg-gray-50 dark:bg-bg-base rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                Chưa có dữ liệu lượt nghe trong 30 ngày qua
              </div>
              <div class="flex justify-between text-[10px] font-medium text-gray-400 mt-2">
                <span>{{ trend[0]?.date }}</span>
                <span>Hôm nay</span>
              </div>
            </div>

            <!-- Top Songs -->
            <div class="bg-white dark:bg-bg-surface rounded-xl border border-gray-200 dark:border-bg-border shadow-sm p-5 md:p-6">
              <h3 class="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <MfIcon name="music_note" size="20" class="text-indigo-500" />
                Top Bài hát (30 ngày)
              </h3>
              
              <div v-if="topSongs.length > 0" class="overflow-x-auto">
                <table class="w-full text-left text-sm text-gray-600 dark:text-gray-300">
                  <thead class="text-xs uppercase bg-gray-50 dark:bg-bg-card text-gray-500 border-b border-gray-200 dark:border-bg-border">
                    <tr>
                      <th class="px-4 py-3 w-10 text-center">#</th>
                      <th class="px-4 py-3">Bài hát</th>
                      <th class="px-4 py-3 text-right">Lượt nghe</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-gray-100 dark:divide-bg-border">
                    <tr 
                      v-for="(song, idx) in topSongs" 
                      :key="song.id" 
                      @click.stop="goToSong(song)"
                      title="Mở chi tiết bài hát trong Admin"
                      class="hover:bg-gray-100 dark:hover:bg-bg-card transition-colors cursor-pointer group"
                    >
                      <td class="px-4 py-3 font-bold text-gray-400 text-center group-hover:text-indigo-500">{{ idx + 1 }}</td>
                      <td class="px-4 py-3">
                        <div class="flex items-center gap-3">
                          <img :src="$formatImageUrl(song.cover_url)" class="w-10 h-10 rounded shadow-sm object-cover bg-gray-100" alt="">
                          <div>
                            <div class="font-bold text-gray-900 dark:text-white group-hover:underline">{{ song.title }}</div>
                            <div class="text-xs text-gray-500">{{ song.artist_name }}</div>
                          </div>
                        </div>
                      </td>
                      <td class="px-4 py-3 text-right font-medium group-hover:text-indigo-500">{{ formatNumber(song.listens) }}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <div v-else class="text-center p-8 text-gray-400 text-sm bg-gray-50 dark:bg-bg-base rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                Chưa có bài hát nào thuộc thể loại này
              </div>
            </div>

          </div>

          <!-- Right Column: Settings & Related (Takes 1/3) -->
          <div class="space-y-6">
            
            <!-- Taxonomy Settings -->
            <div class="bg-white dark:bg-bg-surface rounded-xl border border-gray-200 dark:border-bg-border shadow-sm p-5 md:p-6">
              <h3 class="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <MfIcon name="settings" size="20" class="text-gray-500" />
                Thiết lập Taxonomy
              </h3>
              
              <div class="space-y-4">
                <div class="flex items-start justify-between gap-4 p-3 rounded-lg bg-gray-50 dark:bg-bg-card border border-gray-100 dark:border-bg-border">
                  <div>
                    <div class="text-sm font-bold text-gray-800 dark:text-gray-200 mb-0.5">Gợi ý nhạc</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">Cho phép dùng để đề xuất bài hát tương tự</div>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer shrink-0">
                    <input type="checkbox" v-model="flags.use_in_recommendation" @change="updateFlags" class="sr-only peer">
                    <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-500"></div>
                  </label>
                </div>
                
                <div class="flex items-start justify-between gap-4 p-3 rounded-lg bg-gray-50 dark:bg-bg-card border border-gray-100 dark:border-bg-border">
                  <div>
                    <div class="text-sm font-bold text-gray-800 dark:text-gray-200 mb-0.5">Cold Start</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">Hiển thị lúc User đăng ký để chọn sở thích</div>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer shrink-0">
                    <input type="checkbox" v-model="flags.use_in_cold_start" @change="updateFlags" class="sr-only peer">
                    <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
                
                <div class="flex items-start justify-between gap-4 p-3 rounded-lg bg-gray-50 dark:bg-bg-card border border-gray-100 dark:border-bg-border">
                  <div>
                    <div class="text-sm font-bold text-gray-800 dark:text-gray-200 mb-0.5">AI Playlist</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">Có thể dùng làm Prompt tạo Playlist tự động</div>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer shrink-0">
                    <input type="checkbox" v-model="flags.use_in_ai_playlist" @change="updateFlags" class="sr-only peer">
                    <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-amber-500"></div>
                  </label>
                </div>
              </div>
            </div>

            <!-- Top Artists -->
            <div class="bg-white dark:bg-bg-surface rounded-xl border border-gray-200 dark:border-bg-border shadow-sm p-5 md:p-6">
              <h3 class="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <MfIcon name="person" size="20" class="text-rose-500" />
                Nghệ sĩ tiêu biểu
              </h3>
              
              <div v-if="topArtists.length > 0" class="flex flex-col gap-3">
                <div 
                  v-for="artist in topArtists" 
                  :key="artist.id" 
                  @click.stop="goToArtist(artist)"
                  title="Mở chi tiết nghệ sĩ trong Admin"
                  class="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-bg-card rounded-lg border border-transparent hover:border-gray-200 dark:hover:border-gray-700 transition-colors cursor-pointer group"
                >
                  <img :src="$formatImageUrl(artist.avatar_url)" class="w-10 h-10 rounded-full object-cover shadow-sm bg-gray-100" alt="">
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400">{{ artist.name }}</div>
                    <div class="text-xs text-gray-500">{{ artist.song_count }} bài hát</div>
                  </div>
                  <div class="text-xs font-medium text-gray-400 flex items-center gap-1 group-hover:text-indigo-500">
                    <MfIcon name="play_arrow" size="14" />
                    {{ formatNumber(artist.listens) }}
                  </div>
                </div>
              </div>
              <div v-else class="text-center p-6 text-gray-400 text-sm bg-gray-50 dark:bg-bg-base rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                Chưa có nghệ sĩ nổi bật
              </div>
            </div>

            <!-- Related Playlists -->
            <div class="bg-white dark:bg-bg-surface rounded-xl border border-gray-200 dark:border-bg-border shadow-sm p-5 md:p-6">
              <h3 class="text-base font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <MfIcon name="queue_music" size="20" class="text-emerald-500" />
                Playlist Hệ thống
              </h3>
              
              <div v-if="relatedPlaylists.length > 0" class="flex flex-col gap-3">
                <div v-for="playlist in relatedPlaylists" :key="playlist.id" class="flex items-center gap-3 p-2 hover:bg-gray-50 dark:hover:bg-bg-card rounded-lg border border-transparent hover:border-gray-100 dark:hover:border-bg-border transition-colors">
                  <img :src="$formatImageUrl(playlist.cover_url)" class="w-10 h-10 rounded object-cover shadow-sm bg-gray-100" alt="">
                  <div class="flex-1 min-w-0">
                    <div class="text-sm font-bold text-gray-900 dark:text-white truncate">{{ playlist.title }}</div>
                    <div class="text-xs text-gray-500">Chứa {{ playlist.genre_song_count }} bài</div>
                  </div>
                </div>
              </div>
              <div v-else class="text-center p-6 text-gray-400 text-sm bg-gray-50 dark:bg-bg-base rounded-lg border border-dashed border-gray-200 dark:border-gray-700">
                Chưa có playlist liên quan
              </div>
            </div>

          </div>
        </div>

      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import api from '@/api/axios';
import { useToastStore } from '@/stores/toast';
import MfIcon from '@/components/common/MfIcon.vue';

const route = useRoute();
const router = useRouter();
const toast = useToastStore();

const loading = ref(true);
const error = ref(null);

const genre = ref(null);
const stats = ref({});
const trend = ref([]);
const topSongs = ref([]);
const topArtists = ref([]);
const relatedPlaylists = ref([]);
const dataQuality = ref([]);

const flags = ref({
  use_in_recommendation: false,
  use_in_cold_start: false,
  use_in_ai_playlist: false
});

const maxTrendValue = computed(() => {
  if (!trend.value || trend.value.length === 0) return 0;
  return Math.max(...trend.value.map(t => t.count));
});

const fetchData = async () => {
  loading.value = true;
  error.value = null;
  try {
    const id = route.params.id;
    const { data } = await api.get(`/admin/genres/${id}/detail`);
    
    if (data.success) {
      genre.value = data.data;
      stats.value = data.data.stats || {};
      trend.value = data.data.listens_trend_30d || [];
      topSongs.value = data.data.top_songs || [];
      topArtists.value = data.data.top_artists || [];
      relatedPlaylists.value = data.data.related_playlists || [];
      dataQuality.value = data.data.data_quality || [];
      
      flags.value = {
        use_in_recommendation: Boolean(genre.value.use_in_recommendation),
        use_in_cold_start: Boolean(genre.value.use_in_cold_start),
        use_in_ai_playlist: Boolean(genre.value.use_in_ai_playlist)
      };
    } else {
      error.value = data.message || 'Lỗi không xác định';
    }
  } catch (err) {
    error.value = err.response?.data?.message || 'Không thể tải dữ liệu thể loại. Vui lòng kiểm tra lại mạng.';
  } finally {
    loading.value = false;
  }
};

const updateFlags = async () => {
  try {
    const id = route.params.id;
    await api.patch(`/admin/genres/${id}/taxonomy-flags`, flags.value);
    toast.showToast('Cập nhật thuộc tính Taxonomy thành công', 'success');
  } catch (error) {
    toast.showToast('Lỗi khi cập nhật Taxonomy', 'error');
  }
};

const formatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  return new Intl.NumberFormat('vi-VN').format(num);
};

const goToSong = (song) => {
  const id = song.id || song.song_id;
  if (id) {
    router.push(`/admin/songs/${id}`);
  }
};

const goToArtist = (artist) => {
  const id = artist.id || artist.artist_id;
  if (id) {
    router.push(`/admin/artists/${id}/detail`);
  }
};

onMounted(() => {
  fetchData();
});
</script>
