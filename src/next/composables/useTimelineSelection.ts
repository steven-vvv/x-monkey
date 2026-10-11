/**
 * Multi-select + batch submit for a timeline (ported from the classic FeatureTab; same behaviour, new copy).
 * `entryIds`: ids of the visible timeline entries; `resetKey`: changes when the list changes (resets mode, selection
 * and banner). `available`: whether remote actions are shown at all (changes reset mode and selection).
 */
import { computed, onBeforeUnmount, reactive, ref, watch, type Ref } from 'vue';
import { archiveRecords, enqueueRemoteSyncStatusRefresh } from '../../lib/db-service';
import { buildArchiveBatch, submitRemoteDbArchive } from '../../lib/remote-db';
import { submitSuccessMessage, toRemoteErrorMessage, type RemoteMessage } from '../remote-messages';

const SUCCESS_DISMISS_MS = 6000;

export function useTimelineSelection(entryIds: Ref<string[]>, resetKey: Ref<string>, available: Ref<boolean>) {
  const active = ref(false);
  const selected = reactive(new Set<string>());
  const submitting = ref(false);
  const banner = ref<RemoteMessage | null>(null);
  let dismissTimer: ReturnType<typeof setTimeout> | undefined;

  const selectedIds = computed(() => entryIds.value.filter((id) => selected.has(id)));
  const selectedCount = computed(() => selectedIds.value.length);
  const allSelected = computed(() => entryIds.value.length > 0 && entryIds.value.every((id) => selected.has(id)));
  const submitDisabled = computed(() => submitting.value || selectedCount.value === 0);

  function clearBanner(): void {
    clearTimeout(dismissTimer);
    dismissTimer = undefined;
    banner.value = null;
  }

  function reset(): void {
    active.value = false;
    selected.clear();
    clearBanner();
  }

  function toggleMode(): void {
    if (active.value) {
      reset();
      return;
    }
    active.value = true;
    clearBanner();
  }

  function toggle(id: string): void {
    if (selected.has(id)) selected.delete(id);
    else selected.add(id);
    clearBanner();
  }

  function toggleAll(): void {
    if (allSelected.value) {
      selected.clear();
      clearBanner();
      return;
    }
    active.value = true;
    for (const id of entryIds.value) selected.add(id);
    clearBanner();
  }

  async function submit(): Promise<void> {
    const ids = selectedIds.value;
    const { batch } = buildArchiveBatch(ids, archiveRecords);
    submitting.value = true;
    clearBanner();
    try {
      const result = await submitRemoteDbArchive(batch);
      enqueueRemoteSyncStatusRefresh(ids);
      selected.clear();
      active.value = false;
      banner.value = submitSuccessMessage(result);
      // A clean result fades out; one with failed records stays until dismissed.
      if (banner.value.tone === 'ok') dismissTimer = setTimeout(clearBanner, SUCCESS_DISMISS_MS);
    } catch (error) {
      banner.value = toRemoteErrorMessage(error);
    } finally {
      submitting.value = false;
    }
  }

  // A new list resets everything. When remote actions disappear (e.g. a 401 turned the session anonymous) the
  // mode and selection reset but the banner stays, otherwise the "session expired" message could never be seen.
  watch(resetKey, reset);
  watch(available, (now) => {
    active.value = false;
    selected.clear();
    if (now) clearBanner();
  });

  watch(
    () => entryIds.value.join('|'),
    () => {
      const current = new Set(entryIds.value);
      for (const id of [...selected]) if (!current.has(id)) selected.delete(id);
    },
  );

  onBeforeUnmount(() => clearTimeout(dismissTimer));

  return {
    active, selected, submitting, banner,
    selectedCount, allSelected, submitDisabled,
    toggleMode, toggle, toggleAll, submit, reset, dismissBanner: clearBanner,
  };
}
