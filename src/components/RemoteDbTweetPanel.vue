<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import type { Post } from '../archive/model';
import { archiveRecords, enqueueRemoteSyncStatusRefresh } from '../lib/db-service';
import {
  buildArchiveBatch,
  compareArchiveBatch,
  getRemoteDbClientState,
  isRemoteDbReady,
  queryRemoteDbArchive,
  RemoteDbHttpError,
  submitRemoteDbArchive,
  toArchiveQuery,
  type RemoteBatchComparison,
  type RemoteRecordComparison,
  type RemoteRecordStatus,
  type RemoteDbSubmitResponse,
} from '../lib/remote-db';

const props = withDefaults(defineProps<{
  post: Post;
  /** Posts sent by Sync All, such as the post and its captured replies. */
  batchSyncPosts?: Post[];
}>(), {
  batchSyncPosts: () => [],
});

type QueryState = 'idle' | 'loading' | 'ready' | 'error';
type SyncState = 'idle' | 'submitting_single' | 'submitting_batch' | 'success' | 'error';

const remoteDbState = getRemoteDbClientState();
const state = reactive({
  queryState: 'idle' as QueryState,
  syncState: 'idle' as SyncState,
  queryError: null as string | null,
  syncMessage: null as string | null,
  comparison: null as RemoteBatchComparison | null,
});

const singleBatch = computed(() => buildArchiveBatch([props.post.id], archiveRecords).batch);
const batchPostIds = computed(() => [...new Set([props.post.id, ...props.batchSyncPosts.map((post) => post.id)])]);
const fullBatch = computed(() => buildArchiveBatch(batchPostIds.value, archiveRecords).batch);
const hasBatchSync = computed(() => batchPostIds.value.length > 1);

let queryToken = 0;

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof RemoteDbHttpError) {
    if (error.status === 401) return 'Remote database session expired. Open Settings and sign in again.';
    if (error.status === 403) return 'Remote database sync requires a contributor or administrator account.';
  }
  return error instanceof Error && error.message.trim() ? error.message : fallback;
}

const STATUS_TEXT: Record<RemoteRecordStatus, string> = {
  in_sync: 'In Sync',
  stale: 'Older Counts',
  mismatch: 'Mismatch',
  missing: 'Missing',
  failed: 'Failed',
};

function formatSubmitMessage(actionLabel: string, result: RemoteDbSubmitResponse): string {
  const { summary } = result;
  const issue = [...result.posts, ...result.users, ...result.media].find((item) => item.status === 'failed' || item.status === 'partial');
  const counts = `accepted ${summary.accepted}, unchanged ${summary.unchanged}, partial ${summary.partial}, failed ${summary.failed}`;
  return issue
    ? `${actionLabel} ${counts}. First issue: ${issue.id}: ${issue.reason ?? issue.status}`
    : `${actionLabel} ${counts}.`;
}

async function loadRemoteStatus(): Promise<void> {
  if (!isRemoteDbReady()) {
    state.comparison = null;
    state.queryError = null;
    state.queryState = 'idle';
    return;
  }

  const currentToken = ++queryToken;
  const batch = singleBatch.value;
  state.queryState = 'loading';
  state.queryError = null;

  try {
    const response = await queryRemoteDbArchive(toArchiveQuery(batch));
    if (currentToken !== queryToken) return;
    state.comparison = compareArchiveBatch(batch, response);
    state.queryState = 'ready';
  } catch (error) {
    if (currentToken !== queryToken) return;
    state.comparison = null;
    state.queryState = 'error';
    state.queryError = toErrorMessage(error, 'Failed to load remote state');
  }
}

watch(
  () => [props.post.id, remoteDbState.baseUrl, remoteDbState.lifecycle, remoteDbState.sessionState] as const,
  () => {
    state.syncState = 'idle';
    state.syncMessage = null;
    void loadRemoteStatus();
  },
  { immediate: true },
);

function recordStatus(kind: RemoteRecordComparison['kind'], id: string | undefined): string {
  const record = state.comparison?.records.find((item) => item.kind === kind && item.id === id);
  return record ? STATUS_TEXT[record.status] : '-';
}

const postStatusText = computed(() => recordStatus('post', props.post.id));
const authorStatusText = computed(() => {
  if (!archiveRecords.getUser(props.post.authorId)) return 'Local Missing';
  return recordStatus('user', props.post.authorId);
});
const mediaStatusText = computed(() => {
  const media = state.comparison?.records.filter((item) => item.kind === 'media') ?? [];
  if (media.length === 0) return '-';
  return `${media.filter((item) => item.status === 'in_sync' || item.status === 'stale').length}/${media.length} in sync`;
});
const overallStatusText = computed(() => state.comparison ? STATUS_TEXT[state.comparison.status] : '-');

/** One line per status that needs attention, listing the affected records. */
const detailNotes = computed(() => {
  const records = state.comparison?.records ?? [];
  return (['missing', 'mismatch', 'stale'] as const).flatMap((status) => {
    const ids = records.filter((item) => item.status === status).map((item) => `${item.kind} ${item.id}`);
    return ids.length > 0 ? [`${STATUS_TEXT[status]}: ${ids.join(', ')}`] : [];
  });
});
const errorNotes = computed(() => (state.comparison?.records ?? [])
  .filter((item) => item.status === 'failed')
  .map((item) => `${item.kind} ${item.id}: ${item.error ?? 'failed'}`));

const busy = computed(() => state.queryState === 'loading'
  || state.syncState === 'submitting_single'
  || state.syncState === 'submitting_batch');
const refreshButtonText = computed(() => {
  if (state.queryState !== 'loading') return 'Refresh';
  return state.comparison ? 'Refreshing...' : 'Loading...';
});
const syncButtonText = computed(() => state.syncState === 'submitting_single' ? 'Syncing...' : 'Sync');
const syncAllButtonText = computed(() => state.syncState === 'submitting_batch' ? 'Syncing...' : 'Sync All');

async function submit(mode: 'single' | 'batch'): Promise<void> {
  state.syncState = mode === 'single' ? 'submitting_single' : 'submitting_batch';
  state.syncMessage = null;
  try {
    const result = await submitRemoteDbArchive(mode === 'single' ? singleBatch.value : fullBatch.value);
    state.syncState = 'success';
    state.syncMessage = formatSubmitMessage(mode === 'single' ? 'Sync' : 'Sync All', result);
    await loadRemoteStatus();
    enqueueRemoteSyncStatusRefresh(mode === 'single' ? [props.post.id] : batchPostIds.value);
  } catch (error) {
    state.syncState = 'error';
    state.syncMessage = toErrorMessage(error, mode === 'single'
      ? 'Failed to sync the current post to remote database'
      : 'Failed to sync the current posts to remote database');
  }
}
</script>

<template>
  <section class="xd-remote-panel">
    <div class="xd-remote-panel-header">
      <div class="xd-remote-panel-title">Remote Database</div>
      <div class="xd-remote-panel-actions">
        <button class="xd-btn xd-btn--sm" :disabled="busy" @click="loadRemoteStatus">{{ refreshButtonText }}</button>
        <button class="xd-btn xd-btn--sm xd-btn--accent" :disabled="busy" @click="submit('single')">{{ syncButtonText }}</button>
        <button v-if="hasBatchSync" class="xd-btn xd-btn--sm" :disabled="busy" @click="submit('batch')">{{ syncAllButtonText }}</button>
      </div>
    </div>

    <div v-if="state.queryState === 'loading' && !state.comparison" class="xd-remote-note">
      Loading remote state...
    </div>
    <div v-else-if="state.queryState === 'error'" class="xd-remote-note xd-remote-note--error">
      {{ state.queryError }}
    </div>
    <div v-else-if="state.comparison" class="xd-remote-grid">
      <div class="xd-remote-metric">
        <span class="xd-remote-metric-label">Post</span>
        <span class="xd-remote-metric-value">{{ postStatusText }}</span>
      </div>
      <div class="xd-remote-metric">
        <span class="xd-remote-metric-label">Author</span>
        <span class="xd-remote-metric-value">{{ authorStatusText }}</span>
      </div>
      <div class="xd-remote-metric">
        <span class="xd-remote-metric-label">Media</span>
        <span class="xd-remote-metric-value">{{ mediaStatusText }}</span>
      </div>
      <div class="xd-remote-metric">
        <span class="xd-remote-metric-label">Consistency</span>
        <span class="xd-remote-metric-value">{{ overallStatusText }}</span>
      </div>
      <div v-for="note in detailNotes" :key="note" class="xd-remote-note">{{ note }}</div>
      <div v-for="note in errorNotes" :key="note" class="xd-remote-note xd-remote-note--error">{{ note }}</div>
    </div>

    <div
      v-if="state.syncMessage"
      class="xd-remote-note"
      :class="{
        'xd-remote-note--error': state.syncState === 'error',
        'xd-remote-note--success': state.syncState === 'success',
      }"
    >
      {{ state.syncMessage }}
    </div>
  </section>
</template>

