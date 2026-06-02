<template>
  <Teleport to="body">
    <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <!-- Overlay -->
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" @click="handleClose"></div>

      <!-- Modal Panel -->
      <div class="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-bg-card rounded-2xl shadow-2xl overflow-hidden flex flex-col transform transition-all animate-fade-in-up">
        
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-bg-border bg-gray-50 dark:bg-bg-surface shrink-0">
          <h2 class="text-xl sm:text-2xl font-extrabold text-gray-900 dark:text-white" id="modal-title">
            {{ isEditing ? 'Chỉnh sửa Bài hát' : 'Thêm Bài hát Mới' }}
          </h2>
          <button type="button" class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors focus:outline-none" @click="handleClose">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-6 sm:p-8">
          <form id="song-form" @submit.prevent="handleSubmit" class="space-y-8">
            <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
              
              <!-- Left Column: Basic Info -->
              <div class="space-y-5">
                <!-- Title -->
                <div>
                  <label class="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">
                    Tên bài hát <span class="text-rose-500">*</span>
                  </label>
                  <input v-model="form.title" type="text" required placeholder="Nhập tên bài hát" class="w-full px-4 py-3 bg-gray-50 dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl text-sm font-semibold text-gray-900 dark:text-white focus:bg-white dark:focus:bg-bg-surface focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm" />
                </div>

                <!-- Artist -->
                <SearchableCombobox
                  v-model="form.artistSelection"
                  :options="metadata.artists"
                  label="Nghệ sĩ"
                  placeholder="Tìm hoặc tạo nghệ sĩ..."
                  :allowCreate="true"
                  :required="true"
                />

                <!-- Album -->
                <SearchableCombobox
                  v-model="form.albumSelection"
                  :options="albumOptions"
                  label="Album"
                  labelKey="title"
                  placeholder="Đĩa đơn (Single) / Không thuộc album"
                  :allowCreate="true"
                  :required="false"
                />

                <!-- Genre -->
                <SearchableCombobox
                  v-model="form.genreSelection"
                  :options="metadata.genres"
                  label="Thể loại"
                  placeholder="Chọn thể loại..."
                  :allowCreate="false"
                  :required="true"
                />
              </div>

              <!-- Right Column: Uploads -->
              <div class="space-y-6">
                <!-- Audio Upload -->
                <div>
                  <label class="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">
                    Tệp âm thanh (Audio) <span v-if="!isEditing" class="text-rose-500">*</span>
                  </label>
                  <div 
                    @click="$refs.audioInput.click()" 
                    class="border-2 border-dashed border-indigo-200 dark:border-indigo-500/30 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:border-indigo-400 transition-all group" 
                    :class="{ 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30': form.audio }"
                  >
                    <input type="file" ref="audioInput" accept="audio/*" @change="handleAudio" hidden />
                    <svg v-if="!form.audio" class="w-10 h-10 text-indigo-300 dark:text-indigo-500/50 group-hover:text-indigo-500 mb-3 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M12 16v-8m0 0l-4 4m4-4l4 4M4 12v4a2 2 0 002 2h12a2 2 0 002-2v-4"/></svg>
                    <span v-if="!form.audio" class="text-sm font-semibold text-gray-500 dark:text-gray-400 text-center">
                      {{ isEditing ? 'Tải lên MP3/WAV mới để thay thế' : 'Click để chọn MP3/WAV' }}<br>
                      <span v-if="isEditing" class="text-xs font-normal text-gray-400 mt-1">(Bỏ trống nếu giữ nguyên file cũ)</span>
                    </span>
                    <div v-else class="flex flex-col items-center">
                      <span class="text-base font-bold text-emerald-600 dark:text-emerald-400 text-center break-all">🎵 {{ form.audio.name }}</span>
                      <span class="text-xs text-emerald-500 mt-1">Click để đổi file khác</span>
                    </div>
                  </div>
                </div>

                <!-- Cover Upload -->
                <div>
                  <label class="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">
                    Ảnh bìa (Cover)
                  </label>
                  <div 
                    @click="$refs.coverInput.click()" 
                    class="border-2 border-dashed border-indigo-200 dark:border-indigo-500/30 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:border-indigo-400 transition-all group relative overflow-hidden" 
                    :class="{ 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30': form.cover || coverPreview }"
                  >
                    <input type="file" ref="coverInput" accept="image/*" @change="handleCover" hidden />
                    
                    <template v-if="form.cover || coverPreview">
                      <img v-if="coverPreview" :src="coverPreview" class="absolute inset-0 w-full h-full object-cover opacity-30 group-hover:opacity-10 transition-opacity" />
                      <div class="relative z-10 flex flex-col items-center">
                        <span class="text-base font-bold text-emerald-600 dark:text-emerald-400 text-center break-all">
                          🖼️ {{ form.cover ? form.cover.name : 'Đã có ảnh bìa' }}
                        </span>
                        <span class="text-xs text-emerald-500 mt-1">Click để đổi ảnh khác</span>
                      </div>
                    </template>
                    <template v-else>
                      <svg class="w-10 h-10 text-indigo-300 dark:text-indigo-500/50 group-hover:text-indigo-500 mb-3 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5"><path stroke-linecap="round" stroke-linejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>
                      <span class="text-sm font-semibold text-gray-500 dark:text-gray-400 text-center">
                        {{ isEditing ? 'Tải lên JPG/PNG mới để thay thế' : 'Click để chọn JPG/PNG' }}<br>
                        <span v-if="isEditing" class="text-xs font-normal text-gray-400 mt-1">(Bỏ trống nếu giữ nguyên ảnh cũ)</span>
                      </span>
                    </template>
                  </div>
                </div>
              </div>
            </div>

            <div v-if="statusMessage" :class="['p-4 rounded-xl text-sm font-bold text-center', isError ? 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400']">
              {{ statusMessage }}
            </div>
          </form>
        </div>

        <!-- Footer -->
        <div class="flex flex-shrink-0 justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-bg-border bg-gray-50 dark:bg-bg-surface sticky bottom-0">
          <button type="button" @click="handleClose" class="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-bg-card text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none shadow-sm">
            Hủy
          </button>
          <button type="submit" form="song-form" :disabled="saving" class="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-bold transition-all shadow-md hover:shadow-lg disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2">
            <div v-if="saving" class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            {{ saving ? 'Đang lưu...' : (isEditing ? 'Lưu thay đổi' : 'Thêm bài hát') }}
          </button>
        </div>

      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick } from 'vue';
import SearchableCombobox from '@/components/common/SearchableCombobox.vue';

const props = defineProps({
  isOpen: { type: Boolean, default: false },
  isEditing: { type: Boolean, default: false },
  songData: { type: Object, default: () => ({}) },
  metadata: { type: Object, default: () => ({ artists: [], albums: [], genres: [] }) },
  saving: { type: Boolean, default: false },
  statusMessage: { type: String, default: '' },
  isError: { type: Boolean, default: false }
});

const emit = defineEmits(['close', 'submit']);

// Utility formatting URL
const formatImageUrl = (url) => {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  return `http://localhost:5000${url}`;
};

const audioInput = ref(null);
const coverInput = ref(null);

const form = reactive({
  title: '',
  artistSelection: null,
  albumSelection: -1,
  genreSelection: null,
  audio: null,
  cover: null
});

const coverPreview = ref(null);

const isArtistSelected = computed(() => {
  return form.artistSelection && (!form.artistSelection.isNew || form.artistSelection.label);
});

const albumOptions = computed(() => {
  const artistId = typeof form.artistSelection === 'object' ? form.artistSelection?.value : form.artistSelection;

  let filtered = props.metadata.albums || [];
  if (artistId) {
    filtered = filtered.filter(a => !a.artist_id || Number(a.artist_id) === Number(artistId));
  }

  return [
    {
      id: -1,
      title: 'Đĩa đơn (Single) / Không thuộc album',
    },
    ...filtered
  ];
});

// Watch open state to initialize form
watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    if (props.isEditing && props.songData) {
      form.title = props.songData.title || '';
      form.artistSelection = props.songData.artist_id || '';
      form.albumSelection = props.songData.album_id || -1;
      form.genreSelection = props.songData.genre_id || '';
      coverPreview.value = props.songData.cover_url ? formatImageUrl(props.songData.cover_url) : null;
    } else {
      resetForm();
    }
  }
});

// Reset album when artist changes to a different one
watch(() => form.artistSelection, (newVal, oldVal) => {
  if (newVal !== oldVal && props.isOpen) {
    // If we are initializing edit mode, don't reset album
    if (props.isEditing && props.songData && 
        (newVal === props.songData.artist_id || 
         (typeof newVal === 'object' && newVal.value === props.songData.artist_id))) {
      return;
    }
    form.albumSelection = -1;
  }
}, { deep: true });

function resetForm() {
  form.title = '';
  form.artistSelection = null;
  form.albumSelection = -1;
  form.genreSelection = null;
  form.audio = null;
  form.cover = null;
  coverPreview.value = null;
  if (audioInput.value) audioInput.value.value = '';
  if (coverInput.value) coverInput.value.value = '';
}

function handleAudio(e) { 
  if (e.target.files.length) form.audio = e.target.files[0]; 
}

function handleCover(e) { 
  if (e.target.files.length) {
    form.cover = e.target.files[0];
    coverPreview.value = URL.createObjectURL(form.cover);
  }
}

function handleClose() {
  if (props.saving) return;
  emit('close');
}

function handleSubmit() {
  // Validate Required Fields
  if (!form.title.trim()) {
    alert("Vui lòng nhập tên bài hát.");
    return;
  }
  if (!form.artistSelection) {
    alert("Vui lòng chọn hoặc tạo nghệ sĩ.");
    return;
  }
  if (!form.genreSelection) {
    alert("Vui lòng chọn thể loại.");
    return;
  }
  if (!props.isEditing && !form.audio) {
    alert("Vui lòng chọn file âm thanh (MP3/WAV) cho bài hát mới!");
    return;
  }

  const formData = new FormData();
  formData.append('title', form.title.trim());

  // Artist logic
  if (typeof form.artistSelection === 'object' && form.artistSelection.isNew) {
    formData.append('artist_name', form.artistSelection.label);
  } else {
    const artistId = typeof form.artistSelection === 'object' ? form.artistSelection.value : form.artistSelection;
    if (artistId) formData.append('artist_id', artistId);
  }

  // Album logic
  if (form.albumSelection && form.albumSelection !== -1) {
    if (typeof form.albumSelection === 'object' && form.albumSelection.isNew) {
      if (!isArtistSelected.value) {
        alert("Vui lòng chọn hoặc tạo nghệ sĩ trước khi tạo album.");
        return;
      }
      formData.append('album_title', form.albumSelection.label);
    } else {
      const albumId = typeof form.albumSelection === 'object' ? form.albumSelection.value : form.albumSelection;
      if (albumId && albumId !== -1) formData.append('album_id', albumId);
    }
  }

  // Genre logic
  const genreId = typeof form.genreSelection === 'object' ? form.genreSelection.value : form.genreSelection;
  if (genreId) formData.append('genre_id', genreId);

  // Files
  if (form.audio) formData.append('audio', form.audio);
  if (form.cover) formData.append('cover', form.cover);

  emit('submit', formData);
}
</script>
