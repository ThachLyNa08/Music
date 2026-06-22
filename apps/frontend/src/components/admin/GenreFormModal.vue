<template>
  <Teleport to="body">
    <div class="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6" aria-labelledby="modal-title" role="dialog" aria-modal="true">
      <!-- Overlay -->
      <div class="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" @click="handleClose"></div>

      <!-- Modal Panel -->
      <div class="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-bg-surface rounded-2xl shadow-2xl overflow-hidden flex flex-col transform transition-all">
        <!-- Header -->
        <div class="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-bg-border bg-gray-50 dark:bg-bg-card shrink-0">
          <h2 class="text-xl font-bold text-gray-900 dark:text-white" id="modal-title">
            {{ isEditing ? 'Sửa thông tin Thể loại' : 'Thêm Thể loại mới' }}
          </h2>
          <button type="button" class="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors focus:outline-none" @click="handleClose">
            <svg class="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <!-- Body -->
        <div class="flex-1 overflow-y-auto p-6">
          <form id="genre-form" @submit.prevent="handleSubmit" class="space-y-6">
            <!-- Basic Info -->
            <div class="space-y-4">
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">
                    Tên thể loại <span class="text-rose-500">*</span>
                  </label>
                  <input 
                    v-model="form.name" 
                    type="text" 
                    required 
                    placeholder="Nhập tên thể loại" 
                    class="w-full px-4 py-2.5 bg-white dark:bg-bg-card border border-slate-200 dark:border-bg-border rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-bg-surface focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm" 
                  />
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Slug (URL)
                  </label>
                  <input 
                    v-model="form.slug" 
                    type="text" 
                    placeholder="Tuỳ chọn (tự tạo nếu trống)" 
                    class="w-full px-4 py-2.5 bg-white dark:bg-bg-card border border-slate-200 dark:border-bg-border rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm font-mono" 
                  />
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                  Mô tả (không bắt buộc)
                </label>
                <textarea 
                  v-model="form.description" 
                  rows="3" 
                  placeholder="Mô tả đặc trưng của thể loại này..." 
                  class="w-full px-4 py-3 bg-white dark:bg-bg-card border border-slate-200 dark:border-bg-border rounded-xl text-sm text-slate-900 dark:text-white focus:bg-white dark:focus:bg-bg-surface focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm resize-none"
                ></textarea>
              </div>

              <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Màu đại diện (Hex)
                  </label>
                  <div class="flex gap-2">
                    <input type="color" v-model="form.color" class="h-10 w-12 p-1 rounded-xl border border-slate-200 dark:border-bg-border bg-white dark:bg-bg-card cursor-pointer shrink-0" />
                    <input v-model="form.color" type="text" placeholder="#HEX" class="flex-1 px-4 py-2.5 bg-white dark:bg-bg-card border border-slate-200 dark:border-bg-border rounded-xl text-sm font-mono text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm" />
                  </div>
                </div>
                <div>
                  <label class="block text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                    Icon label
                  </label>
                  <input v-model="form.icon" type="text" placeholder="VD: music, pop, rock, album" class="w-full px-4 py-2.5 bg-white dark:bg-bg-card border border-slate-200 dark:border-bg-border rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm" />
                </div>
              </div>

              <div>
                <label class="block text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                  Thứ tự hiển thị
                </label>
                <input 
                  v-model="form.sort_order" 
                  type="number" 
                  class="w-full px-4 py-2.5 bg-white dark:bg-bg-card border border-slate-200 dark:border-bg-border rounded-xl text-sm text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all shadow-sm" 
                />
              </div>
            </div>

            <!-- Upload Cover -->
            <div>
              <label class="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-2">
                Ảnh cover
              </label>
              <div 
                @click="$refs.coverInput.click()" 
                class="border-2 border-dashed border-indigo-200 dark:border-indigo-500/30 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50 dark:hover:bg-indigo-500/10 hover:border-indigo-400 transition-all group relative overflow-hidden" 
                :class="{ 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-300 dark:border-emerald-500/30': form.cover || coverPreview }"
              >
                <input type="file" ref="coverInput" accept="image/jpeg,image/png,image/webp" @change="handleCover" hidden />
                
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
                    {{ isEditing ? 'Tải lên ảnh mới để thay thế' : 'Click để chọn JPG/PNG' }}
                  </span>
                </template>
              </div>
            </div>

            <!-- Toggles -->
            <div class="flex gap-6">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="form.is_active" class="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 dark:focus:ring-indigo-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600">
                <span class="text-sm font-medium text-gray-900 dark:text-gray-300">Đang hoạt động</span>
              </label>

              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" v-model="form.is_featured" class="w-4 h-4 text-amber-500 border-gray-300 rounded focus:ring-amber-500 dark:focus:ring-amber-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600">
                <span class="text-sm font-medium text-gray-900 dark:text-gray-300">Hiển thị nổi bật (Featured)</span>
              </label>
            </div>
          </form>
        </div>

        <!-- Footer -->
        <div class="flex flex-shrink-0 justify-end gap-3 px-6 py-4 border-t border-gray-100 dark:border-bg-border bg-gray-50 dark:bg-bg-card sticky bottom-0">
          <button type="button" @click="handleClose" class="px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-bg-surface text-gray-700 dark:text-gray-300 font-bold hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus:outline-none shadow-sm">
            Hủy
          </button>
          <button type="submit" form="genre-form" :disabled="loading" class="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition-all shadow-md disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2">
            <div v-if="loading" class="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
            {{ loading ? 'Đang lưu...' : (isEditing ? 'Lưu thay đổi' : 'Thêm thể loại') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue';
import api from '@/api/axios';
import { useToastStore } from '@/stores/toast';

const props = defineProps({
  genre: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['close', 'success']);

const toast = useToastStore();

const isEditing = computed(() => !!props.genre);
const loading = ref(false);
const coverInput = ref(null);
const coverPreview = ref(null);

const form = reactive({
  name: '',
  description: '',
  slug: '',
  color: '',
  icon: '',
  sort_order: 0,
  is_active: true,
  is_featured: false,
  cover: null
});

onMounted(() => {
  if (isEditing.value) {
    form.name = props.genre.name || '';
    form.description = props.genre.description || '';
    form.slug = props.genre.slug || '';
    form.color = props.genre.color || '';
    form.icon = props.genre.icon || '';
    form.sort_order = props.genre.sort_order || 0;
    form.is_active = props.genre.status === 'active';
    form.is_featured = !!props.genre.is_featured;
    if (props.genre.cover_url) {
      coverPreview.value = props.genre.cover_url;
    }
  }
});

const handleClose = () => {
  if (loading.value) return;
  emit('close');
};

const handleCover = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  
  if (!file.type.startsWith('image/')) {
    toast.showToast('Vui lòng chọn file hình ảnh', 'error');
    return;
  }
  
  if (file.size > 2 * 1024 * 1024) {
    toast.showToast('Kích thước ảnh tối đa là 2MB', 'error');
    return;
  }

  form.cover = file;
  coverPreview.value = URL.createObjectURL(file);
};

const handleSubmit = async () => {
  if (!form.name) {
    toast.showToast('Vui lòng nhập tên thể loại', 'error');
    return;
  }

  loading.value = true;
  
  try {
    const formData = new FormData();
    formData.append('name', form.name);
    if (form.description) formData.append('description', form.description);
    if (form.slug) formData.append('slug', form.slug);
    if (form.color) formData.append('color', form.color);
    if (form.icon) formData.append('icon', form.icon);
    formData.append('sort_order', form.sort_order);
    formData.append('status', form.is_active ? 'active' : 'hidden');
    formData.append('is_featured', form.is_featured ? 1 : 0);
    
    if (form.cover) {
      formData.append('cover', form.cover);
    }
    
    if (isEditing.value) {
      await api.put(`/admin/genres/${props.genre.id}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.showToast('Cập nhật thành công', 'success');
    } else {
      await api.post('/admin/genres', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      toast.showToast('Tạo thể loại thành công', 'success');
    }
    
    emit('success');
  } catch (error) {
    toast.showToast(error.response?.data?.message || 'Có lỗi xảy ra', 'error');
  } finally {
    loading.value = false;
  }
};
</script>
