<script setup lang="ts">
// Second panel row. `crumbs`: path, last = current (earlier ones are clickable when they carry onClick).
// `back`: when set, shows a back button + crumbs; when absent renders the root variant with `title` (+ `subtitle`),
// falling back to the last crumb's label. Default slot = right side (counts, open-in-X button).
import { computed } from 'vue';
import XmIcon from './XmIcon.vue';

export interface XmCrumb {
  label: string;
  onClick?: () => void;
}

const props = defineProps<{
  crumbs?: XmCrumb[];
  back?: () => void;
  title?: string;
  subtitle?: string;
}>();

const rootTitle = computed(() => props.title ?? props.crumbs?.[props.crumbs.length - 1]?.label ?? '');
</script>

<template>
  <div class="xm-navbar" :class="{ 'xm-navbar--root': !back }">
    <template v-if="back">
      <button type="button" class="xm-iconbtn" title="返回" aria-label="返回" data-nav="back" @click="back">
        <XmIcon name="back" />
      </button>
      <div class="xm-crumbs" role="navigation" aria-label="路径">
        <template v-for="(crumb, i) in crumbs ?? []" :key="i">
          <span v-if="i > 0" class="xm-crumb-sep" aria-hidden="true">/</span>
          <span v-if="i === (crumbs?.length ?? 0) - 1" class="xm-crumb xm-crumb--current" aria-current="page" :title="crumb.label">{{ crumb.label }}</span>
          <button v-else-if="crumb.onClick" type="button" class="xm-crumb" data-nav="crumb" :title="crumb.label" @click="crumb.onClick">{{ crumb.label }}</button>
          <span v-else class="xm-crumb" :title="crumb.label">{{ crumb.label }}</span>
        </template>
      </div>
    </template>
    <div v-else class="xm-navbar__title" :title="subtitle ? `${rootTitle} ${subtitle}` : rootTitle">{{ rootTitle }}<small v-if="subtitle">{{ subtitle }}</small></div>
    <slot />
  </div>
</template>
