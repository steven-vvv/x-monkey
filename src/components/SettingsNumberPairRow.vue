<script setup lang="ts">
import { useShadowStyle } from '../lib/use-shadow-style';

const props = defineProps<{
  leftLabel: string;
  rightLabel: string;
  leftValue: number;
  rightValue: number;
}>();

const emit = defineEmits<{
  (e: 'update:left', value: number): void;
  (e: 'update:right', value: number): void;
}>();

function onInput(event: Event, side: 'left' | 'right') {
  const n = parseInt((event.target as HTMLInputElement).value, 10);
  if (Number.isNaN(n)) return;
  if (side === 'left') emit('update:left', n);
  else emit('update:right', n);
}

const STYLE_TEXT = `
.xd-settings-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.xd-settings-label {
  font-size: 11px;
  color: var(--xd-text-muted);
  min-width: 14px;
}

.xd-settings-input {
  width: 70px;
  padding: 3px 6px;
  border: 1px solid var(--xd-border);
  border-radius: var(--xd-radius);
  background: var(--xd-bg-tertiary);
  color: var(--xd-text-primary);
  font-size: 11px;
  font-family: var(--xd-font);
  outline: none;
}

.xd-settings-input:focus {
  border-color: var(--xd-accent);
}
`;

useShadowStyle('settings-number-pair-row', STYLE_TEXT);
</script>

<template>
  <div class="xd-settings-row">
    <label class="xd-settings-label">{{ props.leftLabel }}</label>
    <input
      class="xd-settings-input"
      type="number"
      :value="String(Math.round(props.leftValue))"
      @change="onInput($event, 'left')"
    />
    <label class="xd-settings-label">{{ props.rightLabel }}</label>
    <input
      class="xd-settings-input"
      type="number"
      :value="String(Math.round(props.rightValue))"
      @change="onInput($event, 'right')"
    />
  </div>
</template>
