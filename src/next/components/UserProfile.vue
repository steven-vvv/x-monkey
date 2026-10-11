<script setup lang="ts">
// User page body: banner, overlapping avatar, name + badge, handle, chips, bio, location / website / join date, stats.
// Renders inside the caller's `xm-body`. The "在 X 打开主页" button is in the navbar.
import { computed } from 'vue';
import type { User } from '../../archive/model';
import { formatUrlForDisplay, getAvatarUrl, getPlainText } from '../../lib/post-view';
import { formatJoined, profileInterstitialLabel, toProfileStats, verifiedBadge, withheldLabel } from '../labels';
import XmIcon from './XmIcon.vue';
import XmStats from './XmStats.vue';

const props = defineProps<{ user: User }>();

const avatarUrl = computed(() => getAvatarUrl(props.user));
const badge = computed(() => verifiedBadge(props.user));
const bio = computed(() => getPlainText(props.user.bio));
const joined = computed(() => formatJoined(props.user.createdAt));
const stats = computed(() => toProfileStats(props.user));
const withheld = computed(() => (props.user.withheldIn ? withheldLabel(props.user.withheldIn) : ''));
const hasChips = computed(() => Boolean(
  props.user.affiliation?.name || props.user.parody || props.user.protected || props.user.interstitial || props.user.withheldIn,
));
const website = computed(() => props.user.website);
</script>

<template>
  <div class="xm-profile__banner"><img v-if="user.bannerUrl" :src="user.bannerUrl + '/600x200'" alt="" loading="lazy" /></div>
  <div class="xm-profile__top">
    <img v-if="avatarUrl" class="xm-profile__avatar" :src="avatarUrl" alt="" loading="lazy" />
    <div v-else class="xm-profile__avatar xm-profile__avatar--none" aria-hidden="true">{{ Array.from(user.name.trim())[0]?.toUpperCase() ?? '?' }}</div>
  </div>
  <div class="xm-profile__body">
    <div>
      <div class="xm-profile__name">
        <span class="xm-profile__nametext" :title="user.name">{{ user.name }}</span>
        <span v-if="badge" class="xm-badge"><XmIcon name="verified" />{{ badge }}</span>
      </div>
      <div class="xm-profile__handle" :title="'@' + user.handle">@{{ user.handle }}</div>
    </div>

    <div v-if="hasChips" class="xm-chips">
      <span v-if="user.affiliation?.name" class="xm-chip">{{ user.affiliation.name }}</span>
      <span v-if="user.parody" class="xm-chip">{{ user.parody }}</span>
      <span v-if="user.protected" class="xm-chip"><XmIcon name="lock" />受保护</span>
      <span v-if="user.interstitial" class="xm-chip xm-chip--warn"><XmIcon name="alert" />{{ profileInterstitialLabel(user.interstitial) }}</span>
      <span v-if="withheld" class="xm-chip">{{ withheld }}</span>
    </div>

    <div v-if="bio" class="xm-profile__bio">{{ bio }}</div>

    <div v-if="user.location || website || joined" class="xm-profile__meta">
      <span v-if="user.location"><XmIcon name="pin" class="xm-ico--sm" />{{ user.location }}</span>
      <span v-if="website" class="xm-link" :title="website"><XmIcon name="link" class="xm-ico--sm" />{{ formatUrlForDisplay(website) }}</span>
      <span v-if="joined"><XmIcon name="calendar" class="xm-ico--sm" />{{ joined }}</span>
    </div>

    <XmStats :items="stats" five />
  </div>
</template>

<style scoped>
.xm-profile__avatar--none { display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 600; color: var(--xm-text-2); }
.xm-profile__nametext { min-width: 0; overflow-wrap: anywhere; }
</style>
