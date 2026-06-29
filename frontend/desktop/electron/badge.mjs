import { nativeImage } from 'electron';

/** 16×16 red dot for Windows/Linux taskbar overlay when unread > 0. */
const OVERLAY_B64 = 'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAKklEQVQ4T2NkYGD4z0BFwMjAwMDIwMDwH4GBgYGBgYGBgYGBgYGBgYGBgQEAAP//AwD5ZQhBqZJ0LQAAAABJRU5ErkJggg==';

let overlayImage = null;

export function badgeOverlayImage() {
  if (!overlayImage) {
    overlayImage = nativeImage.createFromDataURL(`data:image/png;base64,${OVERLAY_B64}`);
  }
  return overlayImage;
}

export function formatBadgeLabel(count) {
  const n = Math.max(0, Math.floor(count));
  if (n <= 0) return '';
  return n > 99 ? '99+' : String(n);
}

export function trayTooltipForCount(count) {
  const n = Math.max(0, Math.floor(count));
  if (n <= 0) return 'SSC — Super Secure Chat';
  const noun = n === 1 ? 'notification' : 'notifications';
  return `SSC — ${n} new ${noun}`;
}