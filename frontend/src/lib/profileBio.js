/**
 * Profile bio helpers — Q.38 optional about text.
 */

export const BIO_MAX_LEN = 280;

export function userBio(user) {
  const raw = (user?.bio || '').trim();
  return raw || null;
}

/** Single-line preview for list rows. */
export function bioPreviewLine(bio, maxLen = 80) {
  if (!bio) return '';
  const oneLine = String(bio).replace(/\s+/g, ' ').trim();
  if (!oneLine) return '';
  if (oneLine.length <= maxLen) return oneLine;
  return `${oneLine.slice(0, maxLen - 1)}…`;
}

export function normalizeProfileBioInput(raw) {
  const text = String(raw || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!text) return null;
  if (/[\x00-\x08\x0b-\x1f\x7f]/.test(text)) throw new Error('BIO_INVALID');
  const cleaned = text.replace(/\n{3,}/g, '\n\n');
  if (!cleaned) return null;
  if (cleaned.length > BIO_MAX_LEN) throw new Error('BIO_TOO_LONG');
  return cleaned;
}