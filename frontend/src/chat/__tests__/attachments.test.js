import {
  parseAttachmentText,
  isVoiceAttachment,
  isImageAttachment,
  sendAttachmentMessage,
} from '../attachments';

jest.mock('../../lib/api', () => ({
  api: { post: jest.fn() },
}));

jest.mock('../../signal/signalBridge', () => ({
  encryptMessage: jest.fn(),
}));

import { api } from '../../lib/api';
import { encryptMessage } from '../../signal/signalBridge';

describe('attachments', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('parseAttachmentText', () => {
    it('parses valid attachment JSON', () => {
      const raw = JSON.stringify({
        type: 'attachment',
        file_id: 'f_abc',
        mime: 'image/png',
        name: 'photo.png',
        size: 1024,
      });
      expect(parseAttachmentText(raw)).toEqual({
        type: 'attachment',
        file_id: 'f_abc',
        mime: 'image/png',
        name: 'photo.png',
        size: 1024,
      });
    });

    it('returns null for non-attachment JSON', () => {
      expect(parseAttachmentText(JSON.stringify({ type: 'text' }))).toBeNull();
      expect(parseAttachmentText('not json')).toBeNull();
      expect(parseAttachmentText(null)).toBeNull();
    });
  });

  describe('isVoiceAttachment / isImageAttachment', () => {
    it('detects voice and image mime types', () => {
      expect(isVoiceAttachment({ mime: 'audio/ogg' })).toBe(true);
      expect(isVoiceAttachment({ mime: 'image/png' })).toBe(false);
      expect(isImageAttachment({ mime: 'image/jpeg' })).toBe(true);
      expect(isImageAttachment({ mime: 'application/pdf' })).toBe(false);
    });
  });

  describe('sendAttachmentMessage', () => {
    it('encrypts attachment payload and posts with attachment protocol', async () => {
      encryptMessage.mockResolvedValue({ ciphertext: 'ct123' });
      api.post.mockResolvedValue({ message: { id: 'm1' } });

      const result = await sendAttachmentMessage('c_1', {
        fileId: 'f_1',
        mime: 'audio/ogg',
        name: 'voice.ogg',
        size: 2048,
        peerId: 'u_peer',
      });

      expect(encryptMessage).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'attachment',
          file_id: 'f_1',
          mime: 'audio/ogg',
          name: 'voice.ogg',
          size: 2048,
        }),
        { peerId: 'u_peer' }
      );
      expect(api.post).toHaveBeenCalledWith('/api/conversations/c_1/messages', {
        ciphertext: 'ct123',
        protocol: 'signal_v1_attachment',
      });
      expect(result).toEqual({ message: { id: 'm1' } });
    });
  });
});