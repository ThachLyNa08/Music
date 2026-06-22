<template>
  <div class="input-group">
    <label v-if="label" :for="id" class="input-label">
      {{ label }}
    </label>
    <div class="relative group w-full">
      <span v-if="$slots.icon" class="absolute left-5 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-[#30d158] transition-colors z-10 flex pointer-events-none">
        <slot name="icon"></slot>
      </span>
      <input 
        :id="id"
        :type="type" 
        :value="modelValue"
        @input="$emit('update:modelValue', $event.target.value)"
        @keyup.enter="$emit('enter')"
        :placeholder="placeholder"
        :required="required"
        :minlength="minlength"
        class="input-field"
        :class="{ 'pl-12': $slots.icon, 'pl-5': !$slots.icon, 'pr-12': $slots.right, 'pr-5': !$slots.right }"
      />
      <span v-if="$slots.right" class="absolute right-3 top-1/2 -translate-y-1/2 z-10 flex">
        <slot name="right"></slot>
      </span>
    </div>
  </div>
</template>

<script setup>
defineProps({
  modelValue: {
    type: String,
    default: ''
  },
  label: String,
  id: String,
  type: {
    type: String,
    default: 'text'
  },
  placeholder: String,
  required: Boolean,
  minlength: String
})
defineEmits(['update:modelValue', 'enter'])
</script>

<style scoped>
.input-group {
  margin-bottom: 1.25rem;
  position: relative;
  width: 100%;
}

.input-label {
  display: block;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(255,255,255,0.3);
  margin-bottom: 0.5rem;
  transition: color 0.3s ease;
  margin-left: 0.5rem;
}

.input-field {
  width: 100%;
  padding-top: 1rem;
  padding-bottom: 1rem;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 16px;
  color: #ffffff;
  font-size: 0.95rem;
  transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
  outline: none;
  position: relative;
}

.input-field::placeholder {
  color: rgba(255,255,255,0.2);
}

.input-field:hover {
  border-color: rgba(255,255,255,0.2);
  background: rgba(255,255,255,0.06);
}

.input-field:focus {
  border-color: rgba(48,209,88,0.5);
  background: rgba(48,209,88,0.04);
  box-shadow: 
      0 0 0 4px rgba(48,209,88,0.1),
      0 0 40px rgba(48,209,88,0.1);
}

.input-group:focus-within .input-label {
  color: #30d158;
}
</style>
