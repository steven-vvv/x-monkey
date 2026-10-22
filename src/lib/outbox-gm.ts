import { GM_addValueChangeListener, GM_deleteValue, GM_getValue, GM_listValues, GM_removeValueChangeListener, GM_setValue } from '$';
import { OUTBOX_PREFIX, type OutboxKv } from './outbox';

/** Userscript storage behind the outbox; shared by every x.com tab of this script. Only keys under `xd_outbox:`. */
export const gmOutboxKv: OutboxKv = {
  async get(key) {
    const value = await GM_getValue<string | undefined>(key, undefined);
    return typeof value === 'string' ? value : undefined;
  },
  async set(key, value) {
    await GM_setValue(key, value);
  },
  async delete(key) {
    await GM_deleteValue(key);
  },
  async keys() {
    return (await GM_listValues()).filter((name) => name.startsWith(OUTBOX_PREFIX));
  },
  watch(key, listener) {
    const id = GM_addValueChangeListener(key, (_name, _old, value, remote) => {
      listener(typeof value === 'string' ? value : undefined, !!remote);
    });
    return () => GM_removeValueChangeListener(id);
  },
};
