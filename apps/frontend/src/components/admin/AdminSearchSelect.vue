<template>
  <div class="relative" ref="dropdownRef">
    <div 
      @click="toggleDropdown"
      class="admin-input min-w-0 w-full cursor-pointer flex items-center justify-between bg-white dark:bg-bg-surface border border-gray-200 dark:border-bg-border rounded-lg px-3 py-[7px] text-[13px] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-bg-card transition-colors shadow-sm"
    >
      <span class="truncate">{{ selectedLabel }}</span>
      <MfIcon name="expand_more" size="18" class="text-gray-400 shrink-0 ml-1" />
    </div>

    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <div 
        v-if="isOpen"
        class="absolute z-50 w-full xl:w-56 mt-1 bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl shadow-lg overflow-hidden"
      >
        <div class="p-2 border-b border-gray-100 dark:border-bg-border bg-gray-50/50 dark:bg-bg-card/50">
          <div class="relative">
            <MfIcon name="search" size="14" class="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input 
              v-model="searchQuery"
              type="text"
              class="w-full pl-8 pr-3 py-1.5 text-xs bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500 text-gray-800 dark:text-gray-200"
              :placeholder="placeholderText"
              @click.stop
            />
          </div>
        </div>
        
        <!-- Max height calculated for roughly 3.5 items to indicate scrolling (approx 36px per item) => ~126px -->
        <ul class="max-h-[126px] overflow-y-auto custom-scrollbar">
          <li 
            @click="selectOption('')"
            class="px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center justify-between transition-colors"
            :class="!modelValue ? 'text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/50 dark:bg-indigo-500/10' : 'text-gray-700 dark:text-gray-300'"
          >
            {{ allLabel }}
            <MfIcon v-if="!modelValue" name="check" size="14" />
          </li>
          <li 
            v-for="option in filteredOptions" 
            :key="option[valueKey]"
            @click="selectOption(option[valueKey])"
            class="px-3 py-2 text-xs cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 flex items-center justify-between transition-colors"
            :class="modelValue === option[valueKey] ? 'text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50/50 dark:bg-indigo-500/10' : 'text-gray-700 dark:text-gray-300'"
          >
            <span class="truncate">{{ option[labelKey] }}</span>
            <MfIcon v-if="modelValue === option[valueKey]" name="check" size="14" />
          </li>
          <li v-if="filteredOptions.length === 0" class="px-3 py-4 text-center text-xs text-gray-500">
            Không tìm thấy
          </li>
        </ul>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue';
import MfIcon from '@/components/common/MfIcon.vue';

const props = defineProps({
  modelValue: {
    type: [String, Number],
    default: ''
  },
  options: {
    type: Array,
    default: () => []
  },
  allLabel: {
    type: String,
    default: 'Tất cả'
  },
  labelKey: {
    type: String,
    default: 'name'
  },
  valueKey: {
    type: String,
    default: 'id'
  },
  placeholderText: {
    type: String,
    default: 'Tìm kiếm...'
  }
});

const emit = defineEmits(['update:modelValue', 'change']);

const isOpen = ref(false);
const searchQuery = ref('');
const dropdownRef = ref(null);

const selectedLabel = computed(() => {
  if (!props.modelValue) return props.allLabel;
  const option = props.options.find(o => o[props.valueKey] === props.modelValue);
  return option ? option[props.labelKey] : props.allLabel;
});

const filteredOptions = computed(() => {
  if (!searchQuery.value) return props.options;
  const query = searchQuery.value.toLowerCase();
  return props.options.filter(o => 
    (o[props.labelKey] || '').toLowerCase().includes(query)
  );
});

const toggleDropdown = () => {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    searchQuery.value = '';
  }
};

const selectOption = (value) => {
  emit('update:modelValue', value);
  emit('change', value);
  isOpen.value = false;
};

const handleClickOutside = (event) => {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target)) {
    isOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
});
</script>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #d1d5db;
  border-radius: 4px;
}
.custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: #9ca3af;
}
:deep(.dark) .custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: #4b5563;
}
:deep(.dark) .custom-scrollbar:hover::-webkit-scrollbar-thumb {
  background-color: #6b7280;
}
</style>
