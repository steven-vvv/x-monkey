<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import type { DbTweet } from '../lib/db-service';
import { getDbUser, getMediaForTweet } from '../lib/db-service';
import {
  getRemoteDbClientState,
  queryRemoteDbPostStatus,
  submitRemoteDbSubmission,
} from '../lib/remote-db';
import {
  buildRemoteDbSubmission,
  compareRemoteDbPostStatus,
} from '../lib/remote-db';

const props = defineProps<{ tweet: DbTweet }>();

type QueryState = 'idle' | 'loading' | 'ready' | 'error';
type SyncState = 'idle' | 'submitting' | 'success' | 'error';

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

let queryToken = 0;

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
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

  return `Missing media: ${state.remoteItem.missingMediaSourceIds.length}`;
});

const statusText = computed(() => {
  if (!state.remoteItem || !comparison.value) return '-';
  if (!comparison.value.exists) return 'Not Found';
  return comparison.value.consistent ? 'In Sync' : 'Mismatch';
});

const refreshDisabled = computed(() => {
  return state.queryState === 'loading' || state.syncState === 'submitting';
});

const refreshButtonText = computed(() => {
  if (state.queryState !== 'loading') {
    return 'Refresh';
  }

  return state.remoteItem ? 'Refreshing...' : 'Loading...';
});

const syncDisabled = computed(() => {
  return !author.value || state.syncState === 'submitting' || state.queryState === 'loading';
});

const syncDisabledText = computed(() => {
  if (!author.value) {
    return 'Author data is missing';
  }

  return null;
});

const syncButtonText = computed(() => {
  return state.syncState === 'submitting' ? 'Syncing...' : 'Sync To Remote';
});

async function syncCurrentTweet(): Promise<void> {
  const submission = buildRemoteDbSubmission(props.tweet, author.value, media.value);
  if (!submission) {
    state.syncState = 'error';
    state.syncMessage = 'Author data is missing, unable to submit';
    return;
  }

  state.syncState = 'submitting';
  state.syncMessage = null;

  try {
    const result = await submitRemoteDbSubmission(submission);
    const warning = result.warnings[0] ? ` First warning: ${result.warnings[0]}` : '';
    state.syncState = 'success';
    state.syncMessage = `Submission ${result.status}; accepted ${result.acceptedCount}; transfer jobs ${result.transferJobsEnqueued}.${warning}`;
    await loadRemoteStatus();
  } catch (error) {
    state.syncState = 'error';
    state.syncMessage = toErrorMessage(error, 'Failed to sync current tweet to remote database');
  }
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
        <strong class="xd-remote-metric-value">{{ statusText }}</strong>
      </div>
      <div class="xd-remote-metric">
        <span class="xd-remote-metric-label">Transfer</span>
        <strong class="xd-remote-metric-value">{{ transferText }}</strong>
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
