export function ensureH5OverlayRoot(): HTMLElement | null {
  if (process.env.TARO_ENV !== 'h5') return null;
  if (typeof document === 'undefined') return null;
  const id = 'app-overlay-root';
  const existing = document.getElementById(id);
  if (existing) return existing as HTMLElement;

  const el = document.createElement('div');
  el.id = id;
  // Keep overlays outside `.taro_router` to avoid H5 white-screen issues caused by DOM order.
  document.body.appendChild(el);
  return el;
}
