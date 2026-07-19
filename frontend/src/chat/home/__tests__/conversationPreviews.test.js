import {
  formatPreviewLine,
  getConversationPreview,
  setConversationPreview,
} from '../conversationPreviews';

describe('conversationPreviews', () => {
  test('stores and reads text preview', () => {
    setConversationPreview('c1', {
      text: '  hello world  ',
      at: '2026-07-01T12:00:00Z',
      kind: 'text',
    });
    const p = getConversationPreview('c1');
    expect(p.text).toBe('hello world');
    expect(formatPreviewLine(p)).toBe('hello world');
  });

  test('keeps newer message', () => {
    setConversationPreview('c2', {
      text: 'old',
      at: '2026-07-01T10:00:00Z',
    });
    setConversationPreview('c2', {
      text: 'new',
      at: '2026-07-01T12:00:00Z',
    });
    setConversationPreview('c2', {
      text: 'stale',
      at: '2026-07-01T11:00:00Z',
    });
    expect(getConversationPreview('c2').text).toBe('new');
  });

  test('attachment kind label', () => {
    setConversationPreview('c3', {
      kind: 'attachment',
      at: Date.now(),
    });
    expect(getConversationPreview('c3').text).toBe('Attachment');
  });
});
