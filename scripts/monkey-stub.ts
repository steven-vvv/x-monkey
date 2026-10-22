export const unsafeWindow = { location: { href: 'https://x.com/home' } };

export const GM_log = () => {};
export const GM_xmlhttpRequest = () => {
  throw new Error('GM_xmlhttpRequest is unavailable in parser verification');
};
export const GM_getValue = async <T>(_key: string, fallback: T): Promise<T> => fallback;
export const GM_setValue = () => {};
export const GM_addValueChangeListener = () => 0;
export const GM_removeValueChangeListener = () => {};
export const GM_deleteValue = () => {};
export const GM_listValues = async (): Promise<string[]> => [];
