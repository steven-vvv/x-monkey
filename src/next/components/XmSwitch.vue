<script setup lang="ts">
// Toggle switch (role=switch). v-model boolean; `label` = accessible name.
defineProps<{ modelValue: boolean; label?: string; disabled?: boolean }>();
const emit = defineEmits<{ (e: 'update:modelValue', value: boolean): void }>();
</script>

<template>
  <span
    class="xm-switch"
    :class="{ 'xm-switch--on': modelValue, 'xm-switch--disabled': disabled }"
    role="switch"
    :tabindex="disabled ? -1 : 0"
    :aria-checked="modelValue"
    :aria-label="label"
    :aria-disabled="disabled || undefined"
    @click="!disabled && emit('update:modelValue', !modelValue)"
    @keydown.space.prevent="!disabled && emit('update:modelValue', !modelValue)"
    @keydown.enter.prevent="!disabled && emit('update:modelValue', !modelValue)"
  ></span>
</template>
