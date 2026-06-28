/** Bundled sticker pack — Q.22 (offline, no network). */

export const STICKER_SIZE = 128;

export const BUNDLED_STICKERS = [
  { id: 'thumbs', label: '👍', accent: '#00E5FF' },
  { id: 'heart', label: '❤️', accent: '#FF3B30' },
  { id: 'laugh', label: '😂', accent: '#FFD600' },
  { id: 'fire', label: '🔥', accent: '#FF9500' },
  { id: 'party', label: '🎉', accent: '#AF52DE' },
  { id: 'wave', label: '👋', accent: '#34C759' },
  { id: '100', label: '💯', accent: '#5856D6' },
  { id: 'shield', label: '🛡️', accent: '#00E5FF' },
];

export function stickerSvgMarkup(sticker) {
  const emoji = sticker.label;
  const accent = sticker.accent;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${STICKER_SIZE}" height="${STICKER_SIZE}" viewBox="0 0 128 128">
  <rect width="128" height="128" rx="24" fill="${accent}" fill-opacity="0.18"/>
  <rect x="8" y="8" width="112" height="112" rx="20" fill="#121212" stroke="${accent}" stroke-width="3"/>
  <text x="64" y="78" text-anchor="middle" font-size="52">${emoji}</text>
</svg>`;
}

export function findBundledSticker(id) {
  return BUNDLED_STICKERS.find((s) => s.id === id) || null;
}

export async function stickerToPngBlob(sticker) {
  if (typeof document === 'undefined') {
    throw new Error('sticker_render_unavailable');
  }
  const svg = stickerSvgMarkup(sticker);
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = STICKER_SIZE;
      canvas.height = STICKER_SIZE;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, STICKER_SIZE, STICKER_SIZE);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('sticker_encode_failed'));
      }, 'image/png');
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('sticker_render_failed'));
    };
    img.src = url;
  });
}