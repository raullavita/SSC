/**
 * Signal v1 attachments — Engine 8.9.
 * File bytes: AES-256-GCM (random key). Key + IV wrapped in ratchet message body.
 */
import { b64, b64ToBytes } from '../crypto';
import { decryptSignalText, encryptSignalText } from './messages';

const ENVELOPE_VERSION = 1;
const ENVELOPE_PREFIX = 'ssc_attach:';

/** @typedef {{ file_id: string, iv: string, key: string, content_type: string, caption?: string }} SignalAttachmentMeta */

export function isSignalAttachmentEnvelope(plaintext) {
  return typeof plaintext === 'string' && plaintext.startsWith(ENVELOPE_PREFIX);
}

export function parseSignalAttachmentEnvelope(plaintext) {
  if (!isSignalAttachmentEnvelope(plaintext)) return null;
  try {
    const json = plaintext.slice(ENVELOPE_PREFIX.length);
    const obj = JSON.parse(json);
    if (obj?.v !== ENVELOPE_VERSION || !obj?.fid || !obj?.iv || !obj?.k) return null;
    return {
      file_id: obj.fid,
      iv: obj.iv,
      key: obj.k,
      content_type: obj.ct || 'application/octet-stream',
      caption: obj.cap || '',
    };
  } catch {
    return null;
  }
}

export function buildSignalAttachmentEnvelope(meta) {
  const payload = {
    v: ENVELOPE_VERSION,
    fid: meta.file_id,
    iv: meta.iv,
    k: meta.key,
    ct: meta.content_type || 'application/octet-stream',
  };
  if (meta.caption) payload.cap = meta.caption;
  return `${ENVELOPE_PREFIX}${JSON.stringify(payload)}`;
}

/** Encrypt raw bytes for GridFS upload (single AES key, not per-recipient RSA). */
export async function encryptAttachmentBytes(rawBytes) {
  const bytes = rawBytes instanceof ArrayBuffer ? new Uint8Array(rawBytes) : rawBytes;
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ctBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, bytes);
  const rawAes = await crypto.subtle.exportKey('raw', aesKey);
  return {
    ciphertext: b64(ctBuf),
    iv: b64(iv),
    key: b64(rawAes),
  };
}

/** Decrypt downloaded attachment ciphertext using envelope metadata. */
export async function decryptAttachmentBytes(cipherBytes, meta) {
  const aesKey = await crypto.subtle.importKey(
    'raw', b64ToBytes(meta.key), { name: 'AES-GCM' }, false, ['decrypt'],
  );
  const iv = b64ToBytes(meta.iv);
  const ct = cipherBytes instanceof Uint8Array ? cipherBytes : b64ToBytes(cipherBytes);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, aesKey, ct);
  return new Uint8Array(pt);
}

export function isSignalV1AttachmentMessage(msg) {
  const proto = msg?.protocol;
  return (proto === 'signal_v1' || proto === 'signal_group_v1') && Boolean(msg?.attachment_id);
}

export async function encryptSignalAttachment(peerUserId, ourUserId, meta) {
  const envelope = buildSignalAttachmentEnvelope(meta);
  return encryptSignalText(peerUserId, ourUserId, envelope);
}

export async function decryptSignalAttachmentBody(peerUserId, ourUserId, msg) {
  const { decryptSignalTextForLocalDevice } = await import('./multiDeviceMessaging');
  const plaintext = await decryptSignalTextForLocalDevice(msg, peerUserId, ourUserId);
  return parseSignalAttachmentEnvelope(plaintext);
}