import {
  applyMessageDeleted,
  canUnsendMessage,
  isMessageDeleted,
} from '../messageDelete';

describe('messageDelete', () => {
  const future = new Date(Date.now() + 3600000).toISOString();
  const past = new Date(Date.now() - 3600000).toISOString();

  it('detects deleted tombstones', () => {
    expect(isMessageDeleted({ message_type: 'deleted' })).toBe(true);
    expect(isMessageDeleted({ message_type: 'text' })).toBe(false);
  });

  it('allows unsend for own non-deleted message within retention', () => {
    const msg = { sender_id: 'u_me', message_type: 'text', expires_at: future };
    expect(canUnsendMessage(msg, 'u_me')).toBe(true);
    expect(canUnsendMessage(msg, 'u_other')).toBe(false);
  });

  it('blocks unsend after retention expiry', () => {
    const msg = { sender_id: 'u_me', message_type: 'text', expires_at: past };
    expect(canUnsendMessage(msg, 'u_me')).toBe(false);
  });

  it('applies tombstone to message list', () => {
    const messages = [
      { message_id: 'm_1', message_type: 'text', ciphertext: 'x' },
      { message_id: 'm_2', message_type: 'text', ciphertext: 'y' },
    ];
    const next = applyMessageDeleted(messages, {
      message_id: 'm_1',
      deleted_at: '2026-06-29T12:00:00+00:00',
    });
    expect(next[0].message_type).toBe('deleted');
    expect(next[0].ciphertext).toBe('');
    expect(next[1].message_type).toBe('text');
  });
});