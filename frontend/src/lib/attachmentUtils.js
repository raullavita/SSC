/** Human-readable byte size for file attachments. */
export function formatFileSize(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n < 0) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10 * 1024 ? 1 : 0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export function isImageMime(mime) {
  return typeof mime === 'string' && mime.startsWith('image/');
}

export function filenameFromCaption(caption, fallback = 'attachment') {
  if (!caption || typeof caption !== 'string') return fallback;
  const trimmed = caption.trim();
  return trimmed || fallback;
}