<script setup lang="ts">
// "远端归档" card of the post detail: status of the post / author / media on the remote database, a result banner
// and the sync buttons. Data logic lives in useArchiveStatus. Render only when isRemoteDbReady().
import { toRef, watch } from 'vue';
import type { Post } from '../../archive/model';
import type { RemoteRecordStatus } from '../../lib/remote-db';
import { setActiveTab } from '../../lib/store';
import { useArchiveStatus } from '../composables/useArchiveStatus';
import { ARCHIVE_STATUS_PILLS, SYNC_STATUS_TONES } from '../labels';
import XmBanner from './XmBanner.vue';
import XmIcon from './XmIcon.vue';
import XmStatusPill from './XmStatusPill.vue';

const props = defineProps<{
  post: Post;
  /** Posts sent by "同步全部" (thread above, the post itself, captured replies). */
  batchSyncPosts?: Post[];
}>();

const emit = defineEmits<{ (e: 'pin', pinned: boolean): void }>();

const archive = useArchiveStatus(toRef(props, 'post'), toRef(props, 'batchSyncPosts'));
const { state } = archive;

// While syncing or showing a result banner, ask the parent to keep the card mounted (a 401 drops the session and
// with it isRemoteDbReady(), before the error message is set).
watch(() => state.message !== null || archive.submitting.value, (pinned) => emit('pin', pinned), { immediate: true });

const pillText = (status: RemoteRecordStatus): string => ARCHIVE_STATUS_PILLS[status];
</script>

<template>
  <section class="xm-archive" data-role="archive">
    <div class="xm-archive__head">
      <div class="xm-archive__title">
        <XmIcon name="upload" class="xm-ico--sm" />远端归档
        <XmStatusPill v-if="state.queryState === 'error'" tone="danger">查询失败</XmStatusPill>
        <XmStatusPill v-else-if="state.comparison" :tone="SYNC_STATUS_TONES[state.comparison.status]">{{ pillText(state.comparison.status) }}</XmStatusPill>
        <XmStatusPill v-else-if="state.queryState === 'loading'">查询中…</XmStatusPill>
      </div>
      <button
        type="button" class="xm-iconbtn xm-iconbtn--sm" title="刷新状态" aria-label="刷新状态"
        data-role="refresh" :disabled="archive.busy.value" @click="archive.load()"
      ><XmIcon name="refresh" class="xm-ico--sm" /></button>
    </div>

    <div v-if="state.queryState === 'error'" class="xm-archive__notes xm-archive__notes--lead">
      <div class="xm-archive__note xm-archive__note--danger">{{ state.queryError }}</div>
    </div>
    <template v-else-if="state.comparison">
      <div class="xm-archive__rows">
        <div class="xm-kv">
          <span>帖子</span>
          <XmStatusPill v-if="archive.postRecord.value" :tone="SYNC_STATUS_TONES[archive.postRecord.value.status]">{{ pillText(archive.postRecord.value.status) }}</XmStatusPill>
          <XmStatusPill v-else plain>–</XmStatusPill>
        </div>
        <div class="xm-kv">
          <span>作者</span>
          <XmStatusPill v-if="archive.authorMissingLocally.value" tone="missing" plain>本地缺失</XmStatusPill>
          <XmStatusPill v-else-if="archive.authorRecord.value" :tone="SYNC_STATUS_TONES[archive.authorRecord.value.status]">{{ pillText(archive.authorRecord.value.status) }}</XmStatusPill>
          <XmStatusPill v-else plain>–</XmStatusPill>
        </div>
        <div class="xm-kv">
          <span>媒体</span>
          <XmStatusPill v-if="archive.mediaSummary.value" class="xm-num" :tone="archive.mediaSummary.value.allSynced ? 'ok' : 'missing'">{{ archive.mediaSummary.value.text }}</XmStatusPill>
          <XmStatusPill v-else plain>无</XmStatusPill>
        </div>
      </div>
      <div v-if="archive.notes.value.length > 0 || archive.errorNotes.value.length > 0" class="xm-archive__notes">
        <div v-for="note in archive.notes.value" :key="note" class="xm-archive__note">{{ note }}</div>
        <div v-for="note in archive.errorNotes.value" :key="note" class="xm-archive__note xm-archive__note--danger">{{ note }}</div>
      </div>
    </template>

    <XmBanner
      v-if="state.message"
      :tone="state.message.tone"
      :title="state.message.title"
      :text="state.message.text"
      :action="state.message.openSettings ? { label: '打开设置', onClick: () => setActiveTab('settings') } : undefined"
      class="xm-num"
      @close="archive.dismissMessage()"
    />

    <div class="xm-archive__actions">
      <button type="button" class="xm-btn xm-btn--primary" data-role="sync-one" :disabled="archive.busy.value" @click="archive.submit('single')">
        {{ state.syncState === 'submitting_single' ? '同步中…' : '同步此帖' }}
      </button>
      <button
        v-if="archive.batchCount.value > 1"
        type="button" class="xm-btn" data-role="sync-all" title="包含上文与已捕获的回复"
        :disabled="archive.busy.value" @click="archive.submit('batch')"
      >{{ state.syncState === 'submitting_batch' ? '同步中…' : `同步全部 · ${archive.batchCount.value}` }}</button>
    </div>
  </section>
</template>

<style scoped>
.xm-archive__notes--lead { padding-top: 8px; }
.xm-archive__head + .xm-banner { margin-top: 8px; }
</style>
