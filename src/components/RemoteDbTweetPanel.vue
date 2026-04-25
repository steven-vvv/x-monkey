<script setup lang="ts">
import { computed, reactive, watch } from 'vue';
import type { DbTweet } from '../lib/db-service';
import { getDbUser, getMediaForTweet } from '../lib/db-service';
import {
  buildRemoteDbSubmissionBatch,
  compareRemoteDbTweetBundle,
  getRemoteDbClientState,
  isRemoteDbTweetApiReady,
  queryRemoteDbTweetBundle,
  RemoteDbHttpError,
  submitRemoteDbSubmission,
  type RemoteDbSubmissionSourceItem,
} from '../lib/remote-db';

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
  queryError: string | null;
  syncMessage: string | null;
  bundle: Awaited<ReturnType<typeof queryRemoteDbTweetBundle>> | null;
}

const remoteDbState = getRemoteDbClientState();
const state = reactive<RemotePanelState>({
  queryState: 'idle',
  syncState: 'idle',
  queryError: null,
  syncMessage: null,
  bundle: null,
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

const batchSyncSources = computed<RemoteDbSubmissionSourceItem[]>(() => {
  return batchSyncTweets.value.map((tweet) => ({
    tweet,
    author: getDbUser(tweet.authorId),
    media: getMediaForTweet(tweet.id),
  }));
});

let queryToken = 0;

function toErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof RemoteDbHttpError) {
    if (error.status === 401) {
      return 'Remote database session expired. Open Settings and sign in again.';
    }

    if (error.status === 403) {
      return 'Remote database sync requires an administrator account.';
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

function formatSelectorStatus(status: 'found' | 'missing' | 'failed'): string {
  if (status === 'found') return 'Found';
  if (status === 'missing') return 'Missing';
  return 'Failed';
}

function formatOverallStatus(status: 'in_sync' | 'mismatch' | 'missing' | 'failed'): string {
  if (status === 'in_sync') return 'In Sync';
  if (status === 'mismatch') return 'Mismatch';
  if (status === 'missing') return 'Missing';
  return 'Failed';
}

function firstSubmitIssue(
  result: Awaited<ReturnType<typeof submitRemoteDbSubmission>>,
): string | null {
  for (const collection of [result.users, result.tweets, result.media]) {
    for (const item of collection) {
      if (item.error) {
        return item.error;
      }

      const failedOperation = item.operations.find((operation) => operation.status === 'failed');
      if (failedOperation?.reason) {
        return `${item.id ?? 'unknown'}: ${failedOperation.reason}`;
      }
    }
  }

  return null;
}

function formatSubmitMessage(
  actionLabel: string,
  result: Awaited<ReturnType<typeof submitRemoteDbSubmission>>,
): string {
  const summary = result.summary;
  const issue = firstSubmitIssue(result);
  return issue
    ? `${actionLabel} accepted ${summary.accepted}, skipped ${summary.skipped}, partial ${summary.partial}, failed ${summary.failed}. First issue: ${issue}`
    : `${actionLabel} accepted ${summary.accepted}, skipped ${summary.skipped}, partial ${summary.partial}, failed ${summary.failed}.`;
}

async function loadRemoteStatus(): Promise<void> {
  if (!isRemoteDbTweetApiReady()) {
    state.bundle = null;
    state.queryError = null;
    state.queryState = 'idle';
    return;
  }

  queryToken += 1;
  const currentToken = queryToken;
  state.queryState = 'loading';
  state.queryError = null;

  try {
    const bundle = await queryRemoteDbTweetBundle({
      tweetId: props.tweet.id,
      authorId: author.value?.id,
      mediaIds: media.value.map((item) => item.id),
    });
    if (currentToken !== queryToken) return;

    state.bundle = bundle;
    state.queryState = 'ready';
  } catch (error) {
    if (currentToken !== queryToken) return;

    state.bundle = null;
    state.queryState = 'error';
    state.queryError = toErrorMessage(error, 'Failed to load remote tweet state');
  }
}

watch(
  () => [
    props.tweet.id,
    author.value?.id ?? '',
    media.value.map((item) => item.id).join(','),
    remoteDbState.baseUrl,
    remoteDbState.lifecycle,
    remoteDbState.sessionState,
  ] as const,
  () => {
    state.syncState = 'idle';
    state.syncMessage = null;
    void loadRemoteStatus();
  },
  { immediate: true },
);

const comparison = computed(() => {
  if (!state.bundle) return null;
  return compareRemoteDbTweetBundle(props.tweet, author.value, media.value, state.bundle);
});

const querySummaryText = computed(() => {
  if (!state.bundle) return null;
  const summary = state.bundle.summary;
  return `selectors found ${summary.found}, missing ${summary.missing}, failed ${summary.failed}`;
});

const tweetStatusText = computed(() => {
  if (!comparison.value) return '-';
  return formatSelectorStatus(comparison.value.tweet.remoteStatus);
});

const authorStatusText = computed(() => {
  if (!author.value) return 'Local Missing';
  if (!comparison.value?.author) return '-';
  return formatSelectorStatus(comparison.value.author.remoteStatus);
});

const mediaStatusText = computed(() => {
  if (!comparison.value) return '-';
  const summary = comparison.value.media;
  return `${summary.consistent}/${summary.total} in sync`;
});

const consistencyText = computed(() => {
  if (!comparison.value) return '-';
  return formatOverallStatus(comparison.value.overallStatus);
});

const mediaBreakdownText = computed(() => {
  if (!comparison.value) return null;
  const summary = comparison.value.media;
  return `found ${summary.found}, missing ${summary.missing}, failed ${summary.failed}, mismatch ${summary.mismatchIds.length}`;
});

const mismatchText = computed(() => {
  return comparison.value?.message ?? null;
});

const selectorErrors = computed(() => {
  const messages: string[] = [];
  if (comparison.value?.tweet.error) {
    messages.push(`Tweet: ${comparison.value.tweet.error}`);
  }
  if (comparison.value?.author?.error) {
    messages.push(`Author: ${comparison.value.author.error}`);
  }
  if (state.bundle) {
    for (const item of state.bundle.media) {
      if (item.status === 'failed' && item.error) {
        messages.push(`Media ${item.id ?? 'unknown'}: ${item.error}`);
      }
    }
  }
  return messages;
});

const missingMediaText = computed(() => {
  if (!comparison.value || comparison.value.media.missingIds.length === 0) {
    return null;
  }

  return `Missing media IDs: ${comparison.value.media.missingIds.join(', ')}`;
});

const mismatchMediaText = computed(() => {
  if (!comparison.value || comparison.value.media.mismatchIds.length === 0) {
    return null;
  }

  return `Mismatched media IDs: ${comparison.value.media.mismatchIds.join(', ')}`;
});

const singleBuildResult = computed(() => {
  return buildRemoteDbSubmissionBatch([{
    tweet: props.tweet,
    author: author.value,
    media: media.value,
  }]);
});

const batchBuildResult = computed(() => {
  return buildRemoteDbSubmissionBatch(batchSyncSources.value);
});

const hasBatchSync = computed(() => batchSyncTweets.value.length > 1);

const refreshDisabled = computed(() => {
  return state.queryState === 'loading'
    || state.syncState === 'submitting_single'
    || state.syncState === 'submitting_batch';
});

const refreshButtonText = computed(() => {
  if (state.queryState !== 'loading') return 'Refresh';
  return state.bundle ? 'Refreshing...' : 'Loading...';
});

const singleSyncIssue = computed(() => {
  const result = singleBuildResult.value;
  if (result.missingAuthorTweetIds.length > 0) {
    return 'Sync unavailable: author data is missing';
  }
  if (result.invalidUserCreatedAtIds.length > 0) {
    return `Sync unavailable: invalid user time for ${result.invalidUserCreatedAtIds.join(', ')}`;
  }
  if (result.invalidTweetCreatedAtIds.length > 0) {
    return `Sync unavailable: invalid tweet time for ${result.invalidTweetCreatedAtIds.join(', ')}`;
  }
  return null;
});

const batchSyncIssue = computed(() => {
  if (!hasBatchSync.value) return null;

  const result = batchBuildResult.value;
  if (result.missingAuthorTweetIds.length > 0) {
    return `Sync All unavailable: author data is missing for ${result.missingAuthorTweetIds.join(', ')}`;
  }
  if (result.invalidUserCreatedAtIds.length > 0) {
    return `Sync All unavailable: invalid user time for ${result.invalidUserCreatedAtIds.join(', ')}`;
  }
  if (result.invalidTweetCreatedAtIds.length > 0) {
    return `Sync All unavailable: invalid tweet time for ${result.invalidTweetCreatedAtIds.join(', ')}`;
  }
  return null;
});

const syncDisabled = computed(() => {
  return refreshDisabled.value || !singleBuildResult.value.submission;
});

const syncAllDisabled = computed(() => {
  return refreshDisabled.value || !hasBatchSync.value || !batchBuildResult.value.submission;
});

const syncButtonText = computed(() => {
  return state.syncState === 'submitting_single' ? 'Syncing...' : 'Sync';
});

const syncAllButtonText = computed(() => {
  return state.syncState === 'submitting_batch' ? 'Syncing...' : 'Sync All';
});

async function submitBatch(
  submission: NonNullable<ReturnType<typeof buildRemoteDbSubmissionBatch>['submission']>,
  mode: 'single' | 'batch',
): Promise<void> {
  state.syncState = mode === 'single' ? 'submitting_single' : 'submitting_batch';
  state.syncMessage = null;

  try {
    const result = await submitRemoteDbSubmission(submission);
    state.syncState = 'success';
    state.syncMessage = formatSubmitMessage(mode === 'single' ? 'Sync' : 'Sync All', result);
    await loadRemoteStatus();
  } catch (error) {
    state.syncState = 'error';
    state.syncMessage = toErrorMessage(
      error,
      mode === 'single'
        ? 'Failed to sync current tweet to remote database'
        : 'Failed to sync the current tweet batch to remote database',
    );
  }
}

async function refreshRemoteStatus(): Promise<void> {
  await loadRemoteStatus();
}

async function syncCurrentTweet(): Promise<void> {
  const submission = singleBuildResult.value.submission;
  if (!submission) {
    state.syncState = 'error';
    state.syncMessage = singleSyncIssue.value ?? 'Unable to build the current tweet submission';
    return;
  }

  await submitBatch(submission, 'single');
}

async function syncTweetBatch(): Promise<void> {
  const submission = batchBuildResult.value.submission;
  if (!submission) {
    state.syncState = 'error';
    state.syncMessage = batchSyncIssue.value ?? 'Unable to build the current tweet batch submission';
    return;
  }

  await submitBatch(submission, 'batch');
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

    <div v-if="state.queryState === 'loading' && !state.bundle" class="xd-remote-note">
      Loading remote state...
    </div>
    <div v-else-if="state.queryState === 'error'" class="xd-remote-note xd-remote-note--error">
      {{ state.queryError }}
    </div>
    <div v-else-if="comparison" class="xd-remote-grid">
      <div class="xd-remote-metric">
        <span class="xd-remote-metric-label">Tweet</span>
        <span class="xd-remote-metric-value">{{ tweetStatusText }}</span>
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
        <span class="xd-remote-metric-value">{{ consistencyText }}</span>
      </div>
      <div v-if="querySummaryText" class="xd-remote-note">
        {{ querySummaryText }}
      </div>
      <div v-if="mediaBreakdownText" class="xd-remote-note">
        {{ mediaBreakdownText }}
      </div>
      <div v-if="mismatchText" class="xd-remote-note">
        {{ mismatchText }}
      </div>
      <div v-if="missingMediaText" class="xd-remote-note">
        {{ missingMediaText }}
      </div>
      <div v-if="mismatchMediaText" class="xd-remote-note">
        {{ mismatchMediaText }}
      </div>
      <div
        v-for="message in selectorErrors"
        :key="message"
        class="xd-remote-note xd-remote-note--error"
      >
        {{ message }}
      </div>
    </div>

    <div v-if="singleSyncIssue" class="xd-remote-note xd-remote-note--error">
      {{ singleSyncIssue }}
    </div>
    <div v-if="batchSyncIssue" class="xd-remote-note xd-remote-note--error">
      {{ batchSyncIssue }}
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
