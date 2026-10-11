/**
 * Position, size and pointer interactions of the floating launcher / panel (ported from ClassicApp.vue).
 * The anchor (cfg.anchorX/anchorY) is the launcher's icon center and the panel's top-left corner. The panel is
 * clamped into the viewport at render time without writing the config; the config is only written by user drags.
 */
import { computed, onMounted, onUnmounted, reactive, type CSSProperties } from 'vue';
import { unsafeWindow } from '$';
import { clampAnchor, getConfig, pausePersistence, resumePersistence, updateConfig } from '../../lib/config-service';

export const MIN_PANEL_W = 280;
export const MIN_PANEL_H = 200;
const LAUNCHER_R = 16;
const CLICK_THRESHOLD = 4;
const Z_INDEX = 2147483647;

/** Follows pointer moves on the document (capture phase, like the classic UI) until the button is released. */
function trackPointer(onMove: (event: PointerEvent) => void, onEnd: (event: PointerEvent) => void): void {
  pausePersistence();
  const up = (event: PointerEvent) => {
    document.removeEventListener('pointermove', onMove, true);
    document.removeEventListener('pointerup', up, true);
    resumePersistence();
    onEnd(event);
  };
  document.addEventListener('pointermove', onMove, true);
  document.addEventListener('pointerup', up, true);
}

export function usePanelGeometry() {
  const cfg = getConfig();
  const viewport = reactive({ width: unsafeWindow.innerWidth, height: unsafeWindow.innerHeight });

  function onWindowResize(): void {
    viewport.width = unsafeWindow.innerWidth;
    viewport.height = unsafeWindow.innerHeight;
    clampAnchor(viewport.width, viewport.height);
  }

  onMounted(() => unsafeWindow.addEventListener('resize', onWindowResize));
  onUnmounted(() => unsafeWindow.removeEventListener('resize', onWindowResize));

  const launcherStyle = computed<CSSProperties>(() => ({
    position: 'fixed',
    left: `${cfg.anchorX - LAUNCHER_R}px`,
    top: `${cfg.anchorY - LAUNCHER_R}px`,
    zIndex: Z_INDEX,
  }));

  /** Panel top-left: the anchor, clamped so the whole panel stays inside the viewport. */
  const panelPosition = computed(() => ({
    left: Math.max(0, Math.min(cfg.anchorX, viewport.width - cfg.panelWidth)),
    top: Math.max(0, Math.min(cfg.anchorY, viewport.height - cfg.panelHeight)),
  }));

  const panelStyle = computed<CSSProperties>(() => ({
    position: 'fixed',
    left: `${panelPosition.value.left}px`,
    top: `${panelPosition.value.top}px`,
    width: `${cfg.panelWidth}px`,
    height: `${cfg.panelHeight}px`,
    zIndex: Z_INDEX,
  }));

  /** uiScale is applied as a transform on an inner layer; the layer is enlarged/shrunk so it still fills the panel. */
  const contentScaleStyle = computed<CSSProperties>(() => {
    const scale = cfg.uiScale / 100;
    return {
      position: 'absolute',
      left: '0',
      top: '0',
      transform: `scale(${scale})`,
      transformOrigin: 'top left',
      width: `${100 / scale}%`,
      height: `${100 / scale}%`,
    };
  });

  /** Moves the anchor by the pointer delta from `(startX, startY)`. */
  function dragAnchorFrom(event: PointerEvent, startX: number, startY: number, onEnd?: (event: PointerEvent) => void): void {
    const originX = event.clientX;
    const originY = event.clientY;
    trackPointer(
      (move) => {
        updateConfig({ anchorX: startX + move.clientX - originX, anchorY: startY + move.clientY - originY });
        clampAnchor(viewport.width, viewport.height);
      },
      (up) => onEnd?.(up),
    );
  }

  /** Drag the launcher; a release within 4px of the press counts as a click. */
  function onLauncherPointerDown(event: PointerEvent, onClick: () => void): void {
    event.preventDefault();
    const { clientX, clientY } = event;
    dragAnchorFrom(event, cfg.anchorX, cfg.anchorY, (up) => {
      if (Math.hypot(up.clientX - clientX, up.clientY - clientY) < CLICK_THRESHOLD) onClick();
    });
  }

  /** Drag the panel by its header; presses on buttons and form controls are left alone. */
  function onHeaderPointerDown(event: PointerEvent): void {
    if ((event.target as Element | null)?.closest('button, input, select, textarea')) return;
    event.preventDefault();
    dragAnchorFrom(event, panelPosition.value.left, panelPosition.value.top);
  }

  function onResizePointerDown(event: PointerEvent): void {
    event.preventDefault();
    event.stopPropagation();
    const { clientX, clientY } = event;
    const startW = cfg.panelWidth;
    const startH = cfg.panelHeight;
    trackPointer(
      (move) => {
        updateConfig({
          panelWidth: Math.max(MIN_PANEL_W, startW + move.clientX - clientX),
          panelHeight: Math.max(MIN_PANEL_H, startH + move.clientY - clientY),
        });
      },
      () => {},
    );
  }

  return { cfg, launcherStyle, panelStyle, contentScaleStyle, onLauncherPointerDown, onHeaderPointerDown, onResizePointerDown };
}
