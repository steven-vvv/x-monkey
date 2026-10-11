<script setup lang="ts">
import { getConfig } from './lib/config-service';
import ClassicApp from './ClassicApp.vue';
import NextApp from './next/NextApp.vue';

const cfg = getConfig();
</script>

<template>
  <NextApp v-if="cfg.uiVersion === 'next'" />
  <ClassicApp v-else />
</template>
