<template>
  <div class="relative" ref="containerRef">
    <label v-if="label" class="block text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider mb-1">
      {{ label }} <span v-if="required" class="text-rose-500">*</span>
    </label>
    
    <div 
      class="relative flex items-center w-full px-4 py-3 bg-gray-50 dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl focus-within:bg-white dark:focus-within:bg-bg-surface focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition-all shadow-sm"
      :class="{ 'opacity-60 cursor-not-allowed': disabled }"
    >
      <input
        ref="inputRef"
        type="text"
        v-model="searchQuery"
        :placeholder="placeholder"
        :disabled="disabled"
        class="w-full bg-transparent text-sm font-semibold text-gray-900 dark:text-white outline-none placeholder-gray-400 dark:placeholder-gray-500 disabled:cursor-not-allowed"
        @focus="openDropdown"
        @input="onInput"
        @keydown.down.prevent="navigateDropdown(1)"
        @keydown.up.prevent="navigateDropdown(-1)"
        @keydown.enter.prevent="selectHighlighted"
        @keydown.esc.prevent="closeDropdown"
      />
      <button 
        v-if="searchQuery && !disabled"
        type="button" 
        class="ml-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none"
        @click="clearSelection"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
      </button>
      <div v-else class="ml-2 text-gray-400">
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" :class="{ 'transform rotate-180': isOpen }">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>

    <!-- Dropdown -->
    <Teleport to="body">
      <div 
        v-if="isOpen" 
        ref="dropdownRef"
        class="absolute z-[9999] mt-1 bg-white dark:bg-bg-card border border-gray-200 dark:border-bg-border rounded-xl shadow-xl overflow-hidden"
        :style="dropdownStyle"
      >
        <ul class="max-h-60 overflow-y-auto py-1">
          <!-- Create New Option -->
          <li 
            v-if="allowCreate && showCreateOption && searchQuery.trim()"
            class="px-4 py-2.5 text-sm cursor-pointer border-b border-gray-100 dark:border-bg-border flex items-center gap-2"
            :class="[highlightedIndex === 0 ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400' : 'text-indigo-600 dark:text-indigo-400 hover:bg-gray-50 dark:hover:bg-gray-800']"
            @click="selectCreateNew"
            @mouseenter="highlightedIndex = 0"
          >
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" /></svg>
            <span class="font-bold">+ Tạo mới: <span class="font-normal italic">"{{ searchQuery.trim() }}"</span></span>
          </li>

          <!-- Filtered Options -->
          <li 
            v-for="(option, index) in filteredOptions" 
            :key="option[valueKey]"
            class="px-4 py-2.5 text-sm font-medium cursor-pointer transition-colors"
            :class="[
              highlightedIndex === (allowCreate && showCreateOption && searchQuery.trim() ? index + 1 : index) 
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white' 
                : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-bg-surface',
              isSelected(option) ? 'bg-indigo-50/50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400' : ''
            ]"
            @click="selectOption(option)"
            @mouseenter="highlightedIndex = allowCreate && showCreateOption && searchQuery.trim() ? index + 1 : index"
          >
            {{ option[labelKey] }}
          </li>

          <!-- No Results -->
          <li v-if="filteredOptions.length === 0 && (!allowCreate || !searchQuery.trim())" class="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 text-center italic">
            Không tìm thấy kết quả phù hợp.
          </li>
        </ul>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';

const props = defineProps({
  modelValue: { type: [String, Number, Object], default: null }, // can be ID or object if isNew
  options: { type: Array, default: () => [] },
  label: { type: String, default: '' },
  placeholder: { type: String, default: 'Tìm kiếm hoặc chọn...' },
  valueKey: { type: String, default: 'id' },
  labelKey: { type: String, default: 'name' },
  allowCreate: { type: Boolean, default: false },
  required: { type: Boolean, default: false },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(['update:modelValue', 'change']);

const containerRef = ref(null);
const inputRef = ref(null);
const dropdownRef = ref(null);

const isOpen = ref(false);
const searchQuery = ref('');
const internalSelection = ref(null); // { isNew: boolean, label: string, value: any }
const highlightedIndex = ref(-1);
const dropdownStyle = ref({});

// Normalize text for searching
const normalize = (str) => {
  if (!str) return '';
  return String(str).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
};

// Filter options
const filteredOptions = computed(() => {
  const query = normalize(searchQuery.value.trim());
  if (!query) return props.options;
  return props.options.filter(opt => normalize(opt[props.labelKey]).includes(query));
});

// Check if current search exactly matches an option
const exactMatch = computed(() => {
  const query = normalize(searchQuery.value.trim());
  return props.options.find(opt => normalize(opt[props.labelKey]) === query);
});

// Should show create option?
const showCreateOption = computed(() => {
  return props.allowCreate && !exactMatch.value;
});

// Calculate total items in dropdown (for navigation)
const totalItems = computed(() => {
  let count = filteredOptions.value.length;
  if (showCreateOption.value && searchQuery.value.trim()) count += 1;
  return count;
});

// Initialize from prop
const initFromProp = () => {
  if (props.modelValue === null || props.modelValue === undefined || props.modelValue === '') {
    // Only clear if we're not currently typing a new value that hasn't been committed
    if (!isOpen.value) {
      searchQuery.value = '';
      internalSelection.value = null;
    }
    return;
  }
  
  // If modelValue is an object (from previous create new)
  if (typeof props.modelValue === 'object' && props.modelValue !== null && props.modelValue.isNew !== undefined) {
    internalSelection.value = props.modelValue;
    searchQuery.value = props.modelValue.label;
    return;
  }

  // Find in options
  const found = props.options.find(opt => opt[props.valueKey] === props.modelValue);
  if (found) {
    internalSelection.value = { isNew: false, label: found[props.labelKey], value: found[props.valueKey] };
    searchQuery.value = found[props.labelKey];
  } else if (!isOpen.value) {
     // Wait, if it's a new ID that isn't in options yet? Just set it.
  }
};

watch(() => props.modelValue, initFromProp, { immediate: true });
watch(() => props.options, initFromProp, { deep: true });

const onInput = () => {
  isOpen.value = true;
  highlightedIndex.value = 0;
  internalSelection.value = null; // User is typing, clear internal selection
  updateDropdownPosition();
};

const openDropdown = () => {
  if (props.disabled) return;
  isOpen.value = true;
  if (internalSelection.value) {
    // Select all text if there is an existing selection
    inputRef.value?.select();
  }
  updateDropdownPosition();
};

const closeDropdown = () => {
  isOpen.value = false;
  // If user didn't explicitly select, revert or handle
  if (!internalSelection.value) {
    if (searchQuery.value.trim() && props.allowCreate) {
      // Auto-select exact match if exists, else clear
      if (exactMatch.value) {
        selectOption(exactMatch.value);
      } else {
        clearSelection();
      }
    } else {
      clearSelection();
    }
  } else {
    // Restore the label of the internal selection
    searchQuery.value = internalSelection.value.label;
  }
};

const selectOption = (option) => {
  internalSelection.value = { isNew: false, label: option[props.labelKey], value: option[props.valueKey] };
  searchQuery.value = option[props.labelKey];
  isOpen.value = false;
  emitSelection();
};

const selectCreateNew = () => {
  const newLabel = searchQuery.value.trim();
  if (!newLabel) return;
  internalSelection.value = { isNew: true, label: newLabel, value: null };
  searchQuery.value = newLabel;
  isOpen.value = false;
  emitSelection();
};

const clearSelection = (shouldEmit = true) => {
  searchQuery.value = '';
  internalSelection.value = null;
  if (shouldEmit) {
    emitSelection();
    inputRef.value?.focus();
  }
};

const emitSelection = () => {
  if (!internalSelection.value) {
    emit('update:modelValue', '');
    emit('change', null);
  } else if (internalSelection.value.isNew) {
    // Emit the whole object so parent knows it's a new item
    emit('update:modelValue', internalSelection.value);
    emit('change', internalSelection.value);
  } else {
    // Emit just the value for existing items
    emit('update:modelValue', internalSelection.value.value);
    emit('change', internalSelection.value);
  }
};

const isSelected = (option) => {
  return internalSelection.value && !internalSelection.value.isNew && internalSelection.value.value === option[props.valueKey];
};

const navigateDropdown = (step) => {
  if (!isOpen.value) {
    isOpen.value = true;
    return;
  }
  highlightedIndex.value += step;
  if (highlightedIndex.value < 0) highlightedIndex.value = totalItems.value - 1;
  if (highlightedIndex.value >= totalItems.value) highlightedIndex.value = 0;
};

const selectHighlighted = () => {
  if (!isOpen.value) {
    isOpen.value = true;
    return;
  }
  if (totalItems.value === 0) {
    isOpen.value = false;
    return;
  }

  const hasCreate = showCreateOption.value && searchQuery.value.trim();
  if (hasCreate && highlightedIndex.value === 0) {
    selectCreateNew();
  } else {
    const optionIndex = hasCreate ? highlightedIndex.value - 1 : highlightedIndex.value;
    if (filteredOptions.value[optionIndex]) {
      selectOption(filteredOptions.value[optionIndex]);
    }
  }
};

const updateDropdownPosition = async () => {
  await nextTick();
  if (!containerRef.value) return;
  const rect = containerRef.value.getBoundingClientRect();
  dropdownStyle.value = {
    top: `${rect.bottom + window.scrollY}px`,
    left: `${rect.left + window.scrollX}px`,
    width: `${rect.width}px`,
  };
};

// Click outside to close
const handleClickOutside = (e) => {
  if (isOpen.value && containerRef.value && !containerRef.value.contains(e.target) && (!dropdownRef.value || !dropdownRef.value.contains(e.target))) {
    closeDropdown();
  }
};

onMounted(() => {
  window.addEventListener('mousedown', handleClickOutside);
  window.addEventListener('resize', updateDropdownPosition);
  window.addEventListener('scroll', updateDropdownPosition, true); // true for capturing scroll in modal
});

onBeforeUnmount(() => {
  window.removeEventListener('mousedown', handleClickOutside);
  window.removeEventListener('resize', updateDropdownPosition);
  window.removeEventListener('scroll', updateDropdownPosition, true);
});
</script>
