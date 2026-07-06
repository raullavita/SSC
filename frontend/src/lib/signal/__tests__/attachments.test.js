import { webcrypto } from 'crypto';
global.crypto = webcrypto;

jest.mock('../messages', () => ({
  encryptSignalText: jest.fn(),
}));

jest.mock('../multiDeviceMessaging', () => ({
  decryptSignalTextForLocalDevice: jest.fn(),
}));

import { encryptSignalText } from '../messages';
import { decryptSignalTextForLocalDevice } from '../multiDeviceMessaging';
import {
  isSignalAttachmentEnvelope,
  parseSignalAttachmentEnvelope,
  buildSignalAttachmentEnvelope,
  encryptAttachmentBytes,
  decryptAttachmentBytes,
  isSignalV1AttachmentMessage,
  encryptSignalAttachment,
  decryptSignalAttachmentBody,
} from '../attachments';

describe('Signal v1 Attachments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('isSignalAttachmentEnvelope', () => {
    it('returns true for strings starting with ssc_attach:', () => {
      expect(isSignalAttachmentEnvelope('ssc_attach:{}')).toBe(true);
    });

    it('returns false for non-strings or strings without prefix', () => {
      expect(isSignalAttachmentEnvelope(null)).toBe(false);
      expect(isSignalAttachmentEnvelope(123)).toBe(false);
      expect(isSignalAttachmentEnvelope('other_prefix:{}')).toBe(false);
    });
  });

  describe('parseSignalAttachmentEnvelope', () => {
    it('returns null if not starting with prefix', () => {
      expect(parseSignalAttachmentEnvelope('other_prefix:{}')).toBeNull();
    });

    it('returns null on invalid JSON or missing fields', () => {
      expect(parseSignalAttachmentEnvelope('ssc_attach:invalid_json')).toBeNull();
      // missing fid, iv, k
      expect(parseSignalAttachmentEnvelope('ssc_attach:{"v":1}')).toBeNull();
    });

    it('returns null if version is not 1', () => {
      const payload = JSON.stringify({ v: 2, fid: 'f1', iv: 'iv1', k: 'k1' });
      expect(parseSignalAttachmentEnvelope(`ssc_attach:${payload}`)).toBeNull();
    });

    it('returns parsed meta if valid', () => {
      const payload = JSON.stringify({ v: 1, fid: 'f1', iv: 'iv1', k: 'k1', ct: 'image/png', cap: 'test.png' });
      const result = parseSignalAttachmentEnvelope(`ssc_attach:${payload}`);
      expect(result).toEqual({
        file_id: 'f1',
        iv: 'iv1',
        key: 'k1',
        content_type: 'image/png',
        caption: 'test.png',
      });
    });

    it('defaults content_type and caption if not provided', () => {
      const payload = JSON.stringify({ v: 1, fid: 'f1', iv: 'iv1', k: 'k1' });
      const result = parseSignalAttachmentEnvelope(`ssc_attach:${payload}`);
      expect(result).toEqual({
        file_id: 'f1',
        iv: 'iv1',
        key: 'k1',
        content_type: 'application/octet-stream',
        caption: '',
      });
    });
  });

  describe('buildSignalAttachmentEnvelope', () => {
    it('serializes envelope correctly', () => {
      const meta = {
        file_id: 'f1',
        iv: 'iv1',
        key: 'k1',
        content_type: 'image/png',
        caption: 'test.png',
      };
      const result = buildSignalAttachmentEnvelope(meta);
      expect(result.startsWith('ssc_attach:')).toBe(true);
      const json = JSON.parse(result.slice('ssc_attach:'.length));
      expect(json).toEqual({
        v: 1,
        fid: 'f1',
        iv: 'iv1',
        k: 'k1',
        ct: 'image/png',
        cap: 'test.png',
      });
    });
  });

  describe('encryptAttachmentBytes and decryptAttachmentBytes', () => {
    it('performs round-trip AES-GCM encryption and decryption', async () => {
      const originalText = 'Hello Secure World!';
      const encoder = new TextEncoder();
      const rawBytes = encoder.encode(originalText);

      // Encrypt
      const enc = await encryptAttachmentBytes(rawBytes);
      expect(enc.ciphertext).toBeDefined();
      expect(enc.iv).toBeDefined();
      expect(enc.key).toBeDefined();

      // Decrypt
      const meta = {
        file_id: 'f1',
        iv: enc.iv,
        key: enc.key,
        content_type: 'text/plain',
      };
      const decryptedBytes = await decryptAttachmentBytes(enc.ciphertext, meta);
      const decoder = new TextDecoder();
      const decryptedText = decoder.decode(decryptedBytes);

      expect(decryptedText).toBe(originalText);
    });

    it('handles ArrayBuffer input for encryption', async () => {
      const buf = new ArrayBuffer(8);
      const view = new Uint8Array(buf);
      view.set([1, 2, 3, 4, 5, 6, 7, 8]);

      const enc = await encryptAttachmentBytes(buf);
      const meta = {
        file_id: 'f1',
        iv: enc.iv,
        key: enc.key,
        content_type: 'application/octet-stream',
      };
      const decryptedBytes = await decryptAttachmentBytes(enc.ciphertext, meta);
      expect(Array.from(decryptedBytes)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    });
  });

  describe('isSignalV1AttachmentMessage', () => {
    it('returns true only if protocol is signal_v1/signal_group_v1 and attachment_id is present', () => {
      expect(isSignalV1AttachmentMessage({ protocol: 'signal_v1', attachment_id: 'f123' })).toBe(true);
      expect(isSignalV1AttachmentMessage({ protocol: 'signal_group_v1', attachment_id: 'f123' })).toBe(true);
      expect(isSignalV1AttachmentMessage({ protocol: 'signal_v1' })).toBe(false);
      expect(isSignalV1AttachmentMessage({ protocol: 'legacy_rsa', attachment_id: 'f123' })).toBe(false);
    });
  });

  describe('encryptSignalAttachment', () => {
    it('builds envelope and calls encryptSignalText', async () => {
      encryptSignalText.mockResolvedValue({ ciphertext: 'ct123', signal_message_type: 2 });
      const meta = { file_id: 'f1', iv: 'iv1', key: 'k1' };

      const result = await encryptSignalAttachment('peer-1', 'our-1', meta);

      expect(encryptSignalText).toHaveBeenCalledWith(
        'peer-1',
        'our-1',
        buildSignalAttachmentEnvelope(meta)
      );
      expect(result).toEqual({ ciphertext: 'ct123', signal_message_type: 2 });
    });
  });

  describe('decryptSignalAttachmentBody', () => {
    it('decrypts envelope and parses it', async () => {
      const meta = { file_id: 'f_dec', iv: 'iv_dec', key: 'key_dec' };
      const envelope = buildSignalAttachmentEnvelope(meta);
      decryptSignalTextForLocalDevice.mockResolvedValue(envelope);

      const msg = { protocol: 'signal_v1', attachment_id: 'f_dec' };
      const result = await decryptSignalAttachmentBody('peer-1', 'our-1', msg);

      expect(decryptSignalTextForLocalDevice).toHaveBeenCalledWith(msg, 'peer-1', 'our-1');
      expect(result).toEqual({
        file_id: 'f_dec',
        iv: 'iv_dec',
        key: 'key_dec',
        content_type: 'application/octet-stream',
        caption: '',
      });
    });
  });
});
