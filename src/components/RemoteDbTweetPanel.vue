<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import type { DbTweet } from '../lib/db-service';
import { getDbUser, getMediaForTweet } from '../lib/db-service';
import { formatDateTime } from '../lib/view-format';
import {
  getRemoteDbClientState,
  queryRemoteDbPostStatus,
  submitRemoteDbSubmission,
} from '../lib/remote-db';
import {
  buildRemoteDbSubmissionBatch,
  compareRemoteDbPostStatus,
} from '../lib/remote-db';
import type { RemoteDbSubmissionEnvelope } from '../lib/remote-db';

const props = withDefaults(defineProps<{
  tweet: DbTweet;
  batchSyncTweets?: DbTweet[];
}>(), {
  batchSyncTweets: () => [],
});

type QueryState = 'idle' | 'loading' | 'ready' | 'error';
type SyncState = 'idle' | 'submitting_single' | 'submitting_batch' | 'success' | 'error';

interface RemotePanelState {
  queryState: QueryState;
  syncState: SyncState;
  remoteItem: Awaited<ReturnType<typeof queryRemoteDbPostStatus>> | null;
  queryError: string | null;
  syncMessage: string | null;
}

const remoteDbState = getRemoteDbClientState();

const state = reactive<RemotePanelState>({
  queryState: 'idle',
  syncState: 'idle',
  remoteItem: null,
  queryError: null,
  syncMessage: null,
});

const author = computed(() => getDbUser(props.tweet.authorId));
const media = computed(() => getMediaForTweet(props.tweet.id));
const batchSyncTweets = computed(() => {
  const source = props.batchSyncTweets.length > 0 ? props.batchSyncTweets : [props.tweet];
  const uniqueTweets: DbTweet[] = [];
  const seenTweetIds = new Set<string>();

  for (const tweet of source) {
    if (seenTweetIds.has(tweet.id)) continue;
    seenTweetIds.add(tweet.id);
    uniqueTweets.push(tweet);
  }

  return uniqueTweets;
});
const batchSyncSources = computed(() => {
  return batchSyncTweets.value.map((tweet) => ({
    tweet,
    author: getDbUser(tweet.authorId),
    media: getMediaForTweet(tweet.id),
  }));
});

let queryToken = 0;

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function formatTimestampPair(
  timestamps: { lastObservedAt: string; updatedAt: string } | null | undefined,
): string {
  if (!timestamps) {
    return '-';
  }

  return `obs ${formatDateTime(timestamps.lastObservedAt)} / upd ${formatDateTime(timestamps.updatedAt)}`;
}

async function loadRemoteStatus(): Promise<void> {
  queryToken += 1;
  const currentToken = queryToken;
  state.queryState = 'loading';
  state.queryError = null;

  try {
    const remoteItem = await queryRemoteDbPostStatus(props.tweet.id);
    if (currentToken !== queryToken) return;

    state.remoteItem = remoteItem;
    state.queryState = 'ready';
  } catch (error) {
    if (currentToken !== queryToken) return;

    state.remoteItem = null;
    state.queryState = 'error';
    state.queryError = toErrorMessage(error, 'Failed to load remote tweet status');
  }
}

watch(
  () => [props.tweet.id, remoteDbState.baseUrl, remoteDbState.lifecycle, remoteDbState.sessionState] as const,
  () => {
    state.syncState = 'idle';
    state.syncMessage = null;
    void loadRemoteStatus();
  },
  { immediate: true },
);

const comparison = computed(() => {
  if (!state.remoteItem) return null;
  return compareRemoteDbPostStatus(props.tweet, author.value, media.value, state.remoteItem);
});

const transferText = computed(() => {
  if (!state.remoteItem || !comparison.value || !comparison.value.exists) {
    return '-';
  }

  return `${comparison.value.transferSummary.succeeded}/${comparison.value.expectedMediaCount}`;
});

const transferBreakdownText = computed(() => {
  if (!state.remoteItem || !comparison.value || !comparison.value.exists) {
    return null;
  }

  const summary = comparison.value.transferSummary;
  return `pending ${summary.pending}, processing ${summary.processing}, succeeded ${summary.succeeded}, failed ${summary.failed}`;
});

const mismatchText = computed(() => {
  if (!comparison.value || comparison.value.consistent || !comparison.value.mismatchReason) {
    return null;
  }

  return comparison.value.mismatchReason;
});

const missingMediaText = computed(() => {
  if (!state.remoteItem || state.remoteItem.missingMediaSourceIds.length === 0) {
    return null;
  }

  return `Missing media on remote: ${state.remoteItem.missingMediaSourceIds.length}`;
});

const statusText = computed(() => {
  if (!state.remoteItem || !comparison.value) return '-';
  if (!comparison.value.exists) return 'Missing on remote';
  return comparison.value.consistent ? 'Present, in sync' : 'Present, mismatch';
});

const postTimesText = computed(() => {
  if (!state.remoteItem?.post?.timestamps) {
    return '-';
  }

  return formatTimestampPair(state.remoteItem.post.timestamps.post);
});

const metricsTimesText = computed(() => {
  if (!state.remoteItem?.post?.timestamps) {
    return '-';
  }

  if (state.remoteItem.post.timestamps.metrics === null) {
    return 'No metrics snapshot';
  }

  return formatTimestampPair(state.remoteItem.post.timestamps.metrics);
});

const refreshDisabled = computed(() => {
  return state.queryState === 'loading'
    || state.syncState === 'submitting_single'
    || state.syncState === 'submitting_batch';
});

const refreshButtonText = computed(() => {
  if (state.queryState !== 'loading') {
    return 'Refresh';
  }

  return state.remoteItem ? 'Refreshing...' : 'Loading...';
});

const singleSyncBuildResult = computed(() => {
  return buildRemoteDbSubmissionBatch([{
    tweet: props.tweet,
    author: author.value,
    media: media.value,
  }]);
});

const batchSyncBuildResult = computed(() => {
  return buildRemoteDbSubmissionBatch(batchSyncSources.value);
});

const hasBatchSync = computed(() => {
  return batchSyncTweets.value.length > 1;
});

const singleSyncSubmission = computed(() => {
  return singleSyncBuildResult.value.submission;
});

const syncDisabled = computed(() => {
  return !singleSyncSubmission.value || refreshDisabled.value;
});

const syncDisabledText = computed(() => {
  if (singleSyncBuildResult.value.missingAuthorTweetIds.length > 0) {
    return 'Sync unavailable: author data is missing';
  }

  if (singleSyncBuildResult.value.invalidUserCreatedAtIds.length > 0) {
    return 'Sync unavailable: author createdAt is invalid for the remote API';
  }

  if (singleSyncBuildResult.value.invalidTweetCreatedAtIds.length > 0) {
    return 'Sync unavailable: tweet createdAt is invalid for the remote API';
  }

  return null;
});

const syncButtonText = computed(() => {
  return state.syncState === 'submitting_single' ? 'Syncing...' : 'Sync';
});

const syncAllDisabled = computed(() => {
  return !hasBatchSync.value || !batchSyncBuildResult.value.submission || refreshDisabled.value;
});

const syncAllDisabledText = computed(() => {
  if (!hasBatchSync.value) {
    return null;
  }

  const missingCount = batchSyncBuildResult.value.missingAuthorTweetIds.length;
  if (missingCount > 0) {
    if (!singleSyncSubmission.value && missingCount === 1) {
      return null;
    }
    return `Sync All unavailable: author data is missing for ${missingCount} tweet${missingCount > 1 ? 's' : ''}`;
  }

  const invalidUserCount = batchSyncBuildResult.value.invalidUserCreatedAtIds.length;
  if (invalidUserCount > 0) {
    return `Sync All unavailable: invalid author createdAt for ${invalidUserCount} user${invalidUserCount > 1 ? 's' : ''}`;
  }

  const invalidTweetCount = batchSyncBuildResult.value.invalidTweetCreatedAtIds.length;
  if (invalidTweetCount > 0) {
    return `Sync All unavailable: invalid tweet createdAt for ${invalidTweetCount} tweet${invalidTweetCount > 1 ? 's' : ''}`;
  }

  return null;
});

const syncAllButtonText = computed(() => {
  return state.syncState === 'submitting_batch' ? 'Syncing...' : 'Sync All';
});

function formatSubmissionMessage(actionLabel: string, acceptedCount: number, transferJobsEnqueued: number, status: string, warnings: string[]): string {
  const warning = warnings[0] ? ` First warning: ${warnings[0]}` : '';
  return `${actionLabel} ${status}; accepted ${acceptedCount}; transfer jobs ${transferJobsEnqueued}.${warning}`;
}

async function submitSubmission(
  submission: RemoteDbSubmissionEnvelope,
  mode: 'single' | 'batch',
): Promise<void> {
  state.syncState = mode === 'single' ? 'submitting_single' : 'submitting_batch';
  state.syncMessage = null;

  try {
    const result = await submitRemoteDbSubmission(submission);
    state.syncState = 'success';
    state.syncMessage = formatSubmissionMessage(
      mode === 'single' ? 'Sync' : 'Sync All',
      result.acceptedCount,
      result.transferJobsEnqueued,
      result.status,
      result.warnings,
    );
    await loadRemoteStatus();
  } catch (error) {
    state.syncState = 'error';
    state.syncMessage = toErrorMessage(
      error,
      mode === 'single'
        ? 'Failed to sync current tweet to remote database'
        : 'Failed to sync tweet batch to remote database',
    );
  }
}

async function syncCurrentTweet(): Promise<void> {
  if (!singleSyncSubmission.value) {
    state.syncState = 'error';
    state.syncMessage = 'Author data is missing, unable to submit';
    return;
  }

  await submitSubmission(singleSyncSubmission.value, 'single');
}

async function syncTweetBatch(): Promise<void> {
  if (!batchSyncBuildResult.value.submission) {
    state.syncState = 'error';
    state.syncMessage = syncAllDisabledText.value ?? 'Unable to build the remote batch submission';
    return;
  }

  await submitSubmission(batchSyncBuildResult.value.submission, 'batch');
}

async function refreshRemoteStatus(): Promise<void> {
  await loadRemoteStatus();
}
</script>

<template>
  <section class="xd-remote-panel">
    <div class="xd-remote-panel-header">
      <div class="xd-remote-panel-title">Remote Database</div>
      <div class="xd-remote-panel-actions">
        <button class="xd-btn xd-btn--sm" :disabled="refreshDisabled" @click="refreshRemoteStatus">{{ refreshButtonText }}</button>
        <button class="xd-btn xd-btn--sm xd-btn--accent" :disabled="syncDisabled" @click="syncCurrentTweet">{{ syncButtonText }}</button>
        <button
          v-if="hasBatchSync"
          class="xd-btn xd-btn--sm"
          :disabled="syncAllDisabled"
          @click="syncTweetBatch"
        >
          {{ syncAllButtonText }}
        </button>
      </div>
    </div>

    <div v-if="state.queryState === 'loading' && !state.remoteItem" class="xd-remote-note">
      Loading remote status...
    </div>
    <div v-else-if="state.queryState === 'error'" class="xd-remote-note xd-remote-note--error">
      {{ state.queryError }}
    </div>
    <div v-else-if="state.remoteItem && comparison" class="xd-remote-grid">
      <div class="xd-remote-metric">
        <span class="xd-remote-metric-label">Status</span>
        <span class="xd-remote-metric-value">{{ statusText }}</span>
      </div>
      <div class="xd-remote-metric">
        <span class="xd-remote-metric-label">Transfer</span>
        <span class="xd-remote-metric-value">{{ transferText }}</span>
      </div>
      <div class="xd-remote-metric">
        <span class="xd-remote-metric-label">Post Times</span>
        <span class="xd-remote-metric-value">{{ postTimesText }}</span>
      </div>
      <div class="xd-remote-metric">
        <span class="xd-remote-metric-label">Metrics Times</span>
        <span class="xd-remote-metric-value">{{ metricsTimesText }}</span>
      </div>
      <div v-if="transferBreakdownText" class="xd-remote-note">
        {{ transferBreakdownText }}
      </div>
      <div v-if="missingMediaText" class="xd-remote-note">
        {{ missingMediaText }}
      </div>
      <div v-if="mismatchText" class="xd-remote-note">
        {{ mismatchText }}
      </div>
    </div>
    <div v-if="state.queryState === 'loading' && state.remoteItem" class="xd-remote-note">
      Refreshing remote status...
    </div>

    <div v-if="syncDisabledText" class="xd-remote-note xd-remote-note--error">
      {{ syncDisabledText }}
    </div>
    <div v-if="syncAllDisabledText" class="xd-remote-note xd-remote-note--error">
      {{ syncAllDisabledText }}
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

<style scoped>
.xd-remote-panel {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  margin: 8px 0;
  border: 1px solid var(--xd-border);
  border-radius: var(--xd-radius);
  background: var(--xd-bg-secondary);
}

.xd-remote-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.xd-remote-panel-title {
  font-size: 11px;
  font-weight: 600;
  color: var(--xd-text-secondary);
}

.xd-remote-panel-actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 6px;
}

.xd-remote-grid {
  display: grid;
  gap: 6px;
}

.xd-remote-metric {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
}

.xd-remote-metric-label {
  color: var(--xd-text-muted);
}

.xd-remote-metric-value {
  color: var(--xd-text-primary);
  text-align: right;
  word-break: break-word;
  font-weight: 400;
}

.xd-remote-note {
  font-size: 10px;
  line-height: 1.35;
  color: var(--xd-text-secondary);
}

.xd-remote-note--error {
  color: var(--xd-error);
}

.xd-remote-note--success {
  color: var(--xd-success);
}
</style>
