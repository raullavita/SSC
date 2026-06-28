import { isChatImageMessage, listChatImageMedia } from '../chatMediaGallery';

describe('chatMediaGallery', () => {
  const messages = [
    { message_id: 'm1', message_type: 'image', attachment_id: 'f1', created_at: '2026-01-01T10:00:00Z' },
    { message_id: 'm2', message_type: 'text', created_at: '2026-01-01T11:00:00Z' },
    { message_id: 'm3', message_type: 'image', attachment_id: 'f2', created_at: '2026-01-02T09:00:00Z' },
    { message_id: 'm4', message_type: 'image', attachment_id: 'f3', deleted_for_everyone_at: 'x', created_at: '2026-01-03T09:00:00Z' },
  ];

  it('detects image messages', () => {
    expect(isChatImageMessage(messages[0])).toBe(true);
    expect(isChatImageMessage(messages[1])).toBe(false);
    expect(isChatImageMessage(messages[3])).toBe(false);
  });

  it('lists image media newest first', () => {
    const items = listChatImageMedia(messages);
    expect(items.map((i) => i.message_id)).toEqual(['m3', 'm1']);
  });
});