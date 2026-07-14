<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[9999] bg-slate-900/50 backdrop-blur-sm p-3 sm:p-6 flex items-center justify-center animate-fade-in">
      
      <!-- Backdrop click area -->
      <div class="absolute inset-0 cursor-pointer" @click="$emit('close')"></div>

      <!-- Card -->
      <div class="relative bg-white dark:bg-bg-surface shadow-2xl rounded-[24px] flex flex-col border border-gray-100 dark:border-bg-border overflow-hidden w-full max-w-[900px] max-h-full md:max-h-[86vh] animate-modal-pop">
        
        <!-- Header -->
        <div class="px-6 py-4 border-b border-gray-100 dark:border-bg-border flex items-center justify-between shrink-0 bg-gray-50/50 dark:bg-bg-card/50">
          <h2 class="text-lg font-extrabold text-gray-900 dark:text-white flex items-center gap-2">
            <MfIcon name="info" size="20" class="text-indigo-500" />
            Chi tiết thể loại
          </h2>
          <div class="flex items-center gap-2">
            <router-link 
              v-if="genre"
              :to="`/admin/genres/${genre.id}`" 
              @click="$emit('close')"
              class="px-3 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-500/10 dark:hover:bg-indigo-500/20 rounded-lg transition-colors flex items-center gap-1"
            >
              <span>Phân tích chi tiết</span>
              <MfIcon name="arrow_forward" size="14" />
            </router-link>
            <button 
              @click="$emit('close')" 
              class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors focus:outline-none"
            >
              <MfIcon name="close" size="20" />
            </button>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="flex-1 flex flex-col items-center justify-center min-h-[300px]">
          <div class="w-10 h-10 border-4 border-indigo-100 border-t-indigo-500 rounded-full animate-spin mb-4"></div>
          <p class="text-sm text-gray-500">Đang tải dữ liệu...</p>
        </div>

        <!-- Content -->
        <div v-else-if="genre" class="flex-1 overflow-y-auto">
          <!-- Hero Cover -->
          <div class="relative h-48 md:h-56 bg-gray-100 dark:bg-gray-800 flex items-center justify-center overflow-hidden">
            <img v-if="genre.cover_url || genre.coverUrl" :src="$formatImageUrl(genre.cover_url || genre.coverUrl)" class="w-full h-full object-cover opacity-80" alt="cover">
            <div v-else class="absolute inset-0 flex flex-col items-center justify-center opacity-50" :style="{ backgroundColor: genre.color || '#e5e7eb' }">
              <span v-if="genre.icon" class="text-5xl drop-shadow-md text-white">{{ genre.icon }}</span>
            </div>
            <!-- Title Overlay -->
            <div class="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
            <div class="absolute bottom-6 left-8 right-8">
              <h3 class="text-3xl md:text-4xl font-black text-white drop-shadow-md">{{ genre.name }}</h3>
              <p class="text-gray-200 text-sm font-medium drop-shadow-md flex items-center gap-2 mt-2">
                <span class="font-mono bg-black/40 px-2 rounded">{{ genre.slug }}</span>
                <span v-if="genre.market" class="px-2 py-0.5 rounded-full bg-white/20 text-xs font-bold text-white uppercase">{{ genre.market }}</span>
              </p>
            </div>
          </div>

          <div class="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            
            <!-- Left Column: Stats & Top List -->
            <div class="space-y-6">
              <!-- Stats Row -->
              <div class="grid grid-cols-3 gap-3">
                <div class="bg-gray-50 dark:bg-bg-card rounded-xl p-3 text-center border border-gray-100 dark:border-bg-border">
                  <div class="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">Bài hát</div>
                  <div class="text-lg md:text-xl font-black text-gray-900 dark:text-white">{{ formatNumber(genre.stats?.song_count) }}</div>
                </div>
                <div class="bg-gray-50 dark:bg-bg-card rounded-xl p-3 text-center border border-gray-100 dark:border-bg-border">
                  <div class="text-xs text-gray-500 dark:text-gray-400 font-bold uppercase tracking-wider mb-1">Nghệ sĩ</div>
                  <div class="text-lg md:text-xl font-black text-gray-900 dark:text-white">{{ formatNumber(genre.stats?.artist_count) }}</div>
                </div>
                <div class="bg-blue-50 dark:bg-blue-500/10 rounded-xl p-3 text-center border border-blue-100 dark:border-blue-500/20">
                  <div class="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider mb-1">Nghe (7N)</div>
                  <div class="text-lg md:text-xl font-black text-blue-700 dark:text-blue-300">{{ formatNumber(genre.stats?.listens_7d) }}</div>
                </div>
              </div>

              <!-- Top Songs -->
              <div v-if="genre.top_songs && genre.top_songs.length > 0">
                <h4 class="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
                  <MfIcon name="music_note" size="18" class="text-gray-400" />
                  Top bài hát (30 ngày)
                </h4>
                <div class="relative">
                  <div class="space-y-2 max-h-[290px] md:max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                    <div 
                      v-for="(song, idx) in genre.top_songs" 
                      :key="song.id" 
                      @click.stop="goToSong(song)"
                      title="Mở chi tiết bài hát trong Admin"
                      class="flex items-center gap-3 p-2 hover:bg-gray-100 dark:hover:bg-bg-border rounded-lg transition-colors border border-transparent hover:border-gray-200 dark:hover:border-gray-700 cursor-pointer group"
                    >
                      <div class="w-6 text-center text-xs font-bold text-gray-400 group-hover:text-indigo-500">{{ idx + 1 }}</div>
                      <img :src="$formatImageUrl(song.cover_url)" class="w-10 h-10 rounded shadow-sm object-cover" alt="">
                      <div class="flex-1 min-w-0">
                        <div class="text-sm font-bold text-gray-900 dark:text-white truncate group-hover:underline">{{ song.title }}</div>
                        <div class="text-xs text-gray-500 truncate">{{ song.artist_name }}</div>
                      </div>
                      <div class="text-xs font-medium text-gray-500 flex items-center gap-1 group-hover:text-indigo-500">
                        <MfIcon name="play_arrow" size="12" /> {{ formatNumber(song.listens) }}
                      </div>
                    </div>
                  </div>
                  <div class="absolute bottom-0 left-0 right-2 h-8 bg-gradient-to-t from-white dark:from-bg-surface to-transparent pointer-events-none"></div>
                </div>
              </div>
            </div>

            <!-- Right Column: Taxonomy & Settings -->
            <div class="space-y-6">
              <!-- Description -->
              <div v-if="genre.description">
                <h4 class="text-sm font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-1.5">
                  <MfIcon name="description" size="18" class="text-gray-400" />
                  Mô tả
                </h4>
                <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-bg-card p-3 rounded-xl border border-gray-100 dark:border-bg-border">
                  {{ genre.description }}
                </p>
              </div>

              <!-- Taxonomy Flags -->
              <div>
                <h4 class="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
                  <MfIcon name="settings" size="18" class="text-gray-400" />
                  Thuộc tính Taxonomy (AI & Gợi ý)
                </h4>
                <div class="bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl overflow-hidden shadow-sm">
                  <div class="flex items-center justify-between p-3 border-b border-gray-100 dark:border-bg-border hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div>
                      <div class="text-sm font-bold text-gray-800 dark:text-gray-200 mb-0.5">Gợi ý nhạc</div>
                      <div class="text-[11px] text-gray-500 dark:text-gray-400">Cho phép hệ thống gợi ý nhạc thuộc thể loại này</div>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                      <input type="checkbox" v-model="flags.use_in_recommendation" @change="updateFlags" class="sr-only peer">
                      <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-indigo-500"></div>
                    </label>
                  </div>
                  <div class="flex items-center justify-between p-3 border-b border-gray-100 dark:border-bg-border hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div>
                      <div class="text-sm font-bold text-gray-800 dark:text-gray-200 mb-0.5">Cold Start (Đăng ký)</div>
                      <div class="text-[11px] text-gray-500 dark:text-gray-400">Hiển thị ở bước chọn sở thích cho user mới</div>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                      <input type="checkbox" v-model="flags.use_in_cold_start" @change="updateFlags" class="sr-only peer">
                      <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                  <div class="flex items-center justify-between p-3 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <div>
                      <div class="text-sm font-bold text-gray-800 dark:text-gray-200 mb-0.5">AI Playlist</div>
                      <div class="text-[11px] text-gray-500 dark:text-gray-400">Cho phép AI dùng thể loại này tạo Playlist</div>
                    </div>
                    <label class="relative inline-flex items-center cursor-pointer shrink-0 ml-4">
                      <input type="checkbox" v-model="flags.use_in_ai_playlist" @change="updateFlags" class="sr-only peer">
                      <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all dark:border-gray-600 peer-checked:bg-amber-500"></div>
                    </label>
                  </div>
                </div>
              </div>

              <!-- Top Artists -->
              <div v-if="genre.top_artists && genre.top_artists.length > 0">
                <h4 class="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-1.5">
                  <MfIcon name="person" size="18" class="text-gray-400" />
                  Top nghệ sĩ (30 ngày)
                </h4>
                <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <div 
                    v-for="artist in genre.top_artists" 
                    :key="artist.id" 
                    @click.stop="goToArtist(artist)"
                    title="Mở chi tiết nghệ sĩ trong Admin"
                    class="flex items-center gap-2 bg-gray-50 dark:bg-bg-card hover:bg-gray-200 dark:hover:bg-bg-border border border-gray-100 dark:border-gray-700 rounded-full py-1 pr-3 pl-1 shadow-sm cursor-pointer transition-colors group w-full overflow-hidden"
                  >
                    <img :src="$formatImageUrl(artist.avatar_url)" class="w-6 h-6 rounded-full object-cover shrink-0" alt="">
                    <span class="text-xs font-bold text-gray-800 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 truncate">{{ artist.name }}</span>
                  </div>
                </div>
              </div>
              
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import api from '@/api/axios';
import { useToastStore } from '@/stores/toast';
import MfIcon from '@/components/common/MfIcon.vue';

const props = defineProps({
  genreId: {
    type: [Number, String],
    required: true
  }
});

const emit = defineEmits(['close', 'updated']);
const router = useRouter();
const toast = useToastStore();

const loading = ref(true);
const genre = ref(null);
const flags = ref({
  use_in_recommendation: true,
  use_in_cold_start: true,
  use_in_ai_playlist: true
});

const fetchGenreDetail = async () => {
  loading.value = true;
  try {
    const { data } = await api.get(`/admin/genres/${props.genreId}/detail`);
    genre.value = data.data;
    flags.value = {
      use_in_recommendation: Boolean(genre.value.use_in_recommendation),
      use_in_cold_start: Boolean(genre.value.use_in_cold_start),
      use_in_ai_playlist: Boolean(genre.value.use_in_ai_playlist)
    };
  } catch (error) {
    toast.showToast('Lỗi khi tải chi tiết thể loại', 'error');
    emit('close');
  } finally {
    loading.value = false;
  }
};

const updateFlags = async () => {
  try {
    await api.patch(`/admin/genres/${props.genreId}/taxonomy-flags`, flags.value);
    toast.showToast('Cập nhật thuộc tính Taxonomy thành công', 'success');
    emit('updated');
  } catch (error) {
    toast.showToast('Lỗi khi cập nhật Taxonomy', 'error');
  }
};

onMounted(() => {
  fetchGenreDetail();
});

watch(() => props.genreId, () => {
  fetchGenreDetail();
});

const formatNumber = (num) => {
  if (num === undefined || num === null) return '0';
  return new Intl.NumberFormat('vi-VN').format(num);
};

const goToSong = (song) => {
  const id = song.id || song.song_id;
  if (id) {
    emit('close');
    router.push(`/admin/songs/${id}`);
  }
};

const goToArtist = (artist) => {
  const id = artist.id || artist.artist_id;
  if (id) {
    emit('close');
    router.push(`/admin/artists/${id}/detail`);
  }
};
</script>

<style scoped>
@keyframes modalPop {
  0% {
    opacity: 0;
    transform: scale(0.96) translateY(12px);
  }
  100% {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}
.animate-modal-pop {
  animation: modalPop 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
.animate-fade-in {
  animation: fadeIn 0.2s ease-out forwards;
}
@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Custom Scrollbar for Drawer Lists */
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #d1d5db; /* gray-300 */
  border-radius: 4px;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: #9ca3af; /* gray-400 */
}
:deep(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #4b5563; /* gray-600 */
}
:deep(.dark) .custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: #6b7280; /* gray-500 */
}
</style>
