/** Two-step confirmation: `ask()` arms it, it disarms itself after `timeoutMs` and when the owner unmounts. */
import { onBeforeUnmount, ref } from 'vue';

export function useConfirm(timeoutMs = 5000) {
  const pending = ref(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function cancel(): void {
    clearTimeout(timer);
    timer = undefined;
    pending.value = false;
  }

  function ask(): void {
    cancel();
    pending.value = true;
    timer = setTimeout(cancel, timeoutMs);
  }

  onBeforeUnmount(cancel);
  return { pending, ask, cancel };
}
