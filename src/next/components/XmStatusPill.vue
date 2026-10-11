<script setup lang="ts">
// Status capsule. `tone`: ok|stale|missing|warn|danger|accent|neutral (plain = no leading dot); slot = text.
defineProps<{ tone?: 'ok' | 'stale' | 'missing' | 'warn' | 'danger' | 'accent' | 'neutral'; plain?: boolean }>();
</script>

<template>
  <span class="xm-pill" :class="[tone && tone !== 'neutral' ? `xm-pill--${tone}` : '', plain ? 'xm-pill--plain' : '']"><slot /></span>
</template>
