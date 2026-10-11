<script setup lang="ts" generic="T extends string | number">
// Segmented control. `options`: {value,label}[]; v-model = selected value.
defineProps<{ options: { value: T; label: string }[]; modelValue: T }>();
defineEmits<{ (e: 'update:modelValue', value: T): void }>();
</script>

<template>
  <div class="xm-seg" role="group">
    <button
      v-for="option in options"
      :key="option.value"
      type="button"
      :aria-pressed="modelValue === option.value"
      @click="$emit('update:modelValue', option.value)"
    >{{ option.label }}</button>
  </div>
</template>
