/**
 * Remote-archive status + sync for one post (ported from the classic RemoteDbTweetPanel; same data logic, new copy).
 * Reloads when the post id, remote base URL, lifecycle or session state change; a query token drops stale responses.
 * `post`: the focal post; `batchPosts`: posts sent by "同步全部" (the post is always included, ids are deduped).
 */
import { computed, onBeforeUnmount, reactive, watch, type Ref } from 'vue';
import type { Post } from '../../archive/model';
import { archiveRecords, enqueueRemoteSyncStatusRefresh } from '../../lib/db-service';
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
} from '../../lib/remote-db';
import { ARCHIVE_STATUS_PILLS, SYNC_NOTE_PREFIX } from '../labels';
import { submitResultMessage, toRemoteErrorMessage, type RemoteMessage } from '../remote-messages';

type QueryState = 'idle' | 'loading' | 'ready' | 'error';
type SyncState = 'idle' | 'submitting_single' | 'submitting_batch';

function queryErrorText(error: unknown): string {
  if (error instanceof RemoteDbHttpError && (error.status === 401 || error.status === 403)) return toRemoteErrorMessage(error).title;
  return error instanceof Error && error.message.trim() ? error.message : '查询远端状态失败';
}

export function useArchiveStatus(post: Ref<Post>, batchPosts: Ref<Post[] | undefined>) {
  const remoteDbState = getRemoteDbClientState();
  const state = reactive({
    queryState: 'idle' as QueryState,
    syncState: 'idle' as SyncState,
    queryError: null as string | null,
    comparison: null as RemoteBatchComparison | null,
    message: null as RemoteMessage | null,
  });

  const singleBatch = computed(() => buildArchiveBatch([post.value.id], archiveRecords).batch);
  const batchPostIds = computed(() => [...new Set([post.value.id, ...(batchPosts.value ?? []).map((item) => item.id)])]);
  const fullBatch = computed(() => buildArchiveBatch(batchPostIds.value, archiveRecords).batch);
  const batchCount = computed(() => batchPostIds.value.length);

  let queryToken = 0;
  onBeforeUnmount(() => { queryToken += 1; });

  async function load(): Promise<void> {
    if (!isRemoteDbReady()) {
      queryToken += 1;
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
      state.queryError = queryErrorText(error);
    }
  }

  watch(
    () => post.value.id,
    () => {
      state.syncState = 'idle';
      state.message = null;
      void load();
    },
    { immediate: true },
  );
  // Connection changes reload the status. A result banner survives going offline (a 401 turns the session off right
  // before its "会话已过期" message is set) and is dropped once the connection is usable again.
  watch(
    () => [remoteDbState.baseUrl, remoteDbState.lifecycle, remoteDbState.sessionState] as const,
    () => {
      if (isRemoteDbReady()) state.message = null;
      void load();
    },
  );

  function record(kind: RemoteRecordComparison['kind'], id: string | undefined): RemoteRecordComparison | undefined {
    return state.comparison?.records.find((item) => item.kind === kind && item.id === id);
  }

  /** Pill for the post row. */
  const postRecord = computed(() => record('post', post.value.id));
  /** Pill for the author row; `null` status = author missing locally. */
  const authorMissingLocally = computed(() => !archiveRecords.getUser(post.value.authorId));
  const authorRecord = computed(() => record('user', post.value.authorId));
  const mediaSummary = computed(() => {
    const media = state.comparison?.records.filter((item) => item.kind === 'media') ?? [];
    if (media.length === 0) return null;
    const synced = media.filter((item) => item.status === 'in_sync' || item.status === 'stale').length;
    return { text: `${synced} / ${media.length} 已同步`, allSynced: synced === media.length };
  });

  /** One small line per status that needs attention, listing the affected records. */
  const notes = computed(() => {
    const records = state.comparison?.records ?? [];
    return (['missing', 'mismatch', 'stale'] as const).flatMap((status) => {
      const ids = records.filter((item) => item.status === status).map((item) => `${item.kind} ${item.id}`);
      return ids.length > 0 ? [`${SYNC_NOTE_PREFIX[status]}：${ids.join('，')}`] : [];
    });
  });
  const errorNotes = computed(() => (state.comparison?.records ?? [])
    .filter((item) => item.status === 'failed')
    .map((item) => `${ARCHIVE_STATUS_PILLS.failed}：${item.kind} ${item.id}：${item.error ?? '未知错误'}`));

  const submitting = computed(() => state.syncState !== 'idle');
  const busy = computed(() => state.queryState === 'loading' || submitting.value);

  async function submit(mode: 'single' | 'batch'): Promise<void> {
    state.syncState = mode === 'single' ? 'submitting_single' : 'submitting_batch';
    state.message = null;
    const ids = mode === 'single' ? [post.value.id] : batchPostIds.value;
    const forPost = post.value.id;
    try {
      const result = await submitRemoteDbArchive(mode === 'single' ? singleBatch.value : fullBatch.value);
      if (forPost !== post.value.id) return;
      state.message = submitResultMessage(result, '同步');
      state.syncState = 'idle';
      await load();
      enqueueRemoteSyncStatusRefresh(ids);
    } catch (error) {
      if (forPost !== post.value.id) return;
      state.syncState = 'idle';
      state.message = toRemoteErrorMessage(error);
    }
  }

  return {
    state, batchCount, postRecord, authorRecord, authorMissingLocally, mediaSummary, notes, errorNotes,
    submitting, busy, load, submit, dismissMessage: () => { state.message = null; },
  };
}
