/** Saves a JSON document through the userscript manager's download; reports failures through `onError`. */
import { GM_download } from '$';

export function downloadJson(text: string, name: string, onError: (message: string) => void): void {
  const blobUrl = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const release = () => URL.revokeObjectURL(blobUrl);
  GM_download({
    url: blobUrl,
    name,
    onload: release,
    onerror: (event) => {
      release();
      onError(`${event.error}${event.details ? `（${event.details}）` : ''}`);
    },
    ontimeout: () => {
      release();
      onError('浏览器没有在限定时间内响应。');
    },
  });
}
