import { getCurrentInstance, onMounted } from 'vue';

const injectedStyleIds = new Set<string>();

export function useShadowStyle(styleId: string, cssText: string): void {
  const instance = getCurrentInstance();

  onMounted(() => {
    if (injectedStyleIds.has(styleId)) return;

    const rootNode = (instance?.proxy?.$el as Node | undefined)?.getRootNode?.();
    if (!rootNode || rootNode.nodeType !== Node.DOCUMENT_FRAGMENT_NODE || !('host' in rootNode)) return;
    const shadowRoot = rootNode as ShadowRoot;

    const existed = shadowRoot.querySelector(`style[data-xd-style="${styleId}"]`);
    if (existed) {
      injectedStyleIds.add(styleId);
      return;
    }

    const styleEl = document.createElement('style');
    styleEl.setAttribute('data-xd-style', styleId);
    styleEl.textContent = cssText;
    shadowRoot.appendChild(styleEl);
    injectedStyleIds.add(styleId);
  });
}
