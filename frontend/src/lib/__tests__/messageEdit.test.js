import {
  applyMessageEdited,
  canEditMessage,
  EDIT_WINDOW_MINUTES,
  messageWithinEditWindow,
} from '../messageEdit';

describe('messageEdit', () => {
  const now = Date.now();
  const recent = new Date(now - 5 * 60 * 1000).toISOString();
  const old = new Date(now - (EDIT_WINDOW_MINUTES + 1) * 60 * 1000).toISOString();
  const future = new Date(now + 3600000).toISOString();

  it('allows edit for own recent text message', () => {
    const msg = {
      sender_id: 'u_me',
      message_type: 'text',
      created_at: recent,
      expires_at: future,
    };
    expect(canEditMessage(msg, 'u_me')).toBe(true);
    expect(canEditMessage(msg, 'u_other')).toBe(false);
  });

  it('blocks edit after window', () => {
    const msg = {
      sender_id: 'u_me',
      message_type: 'text',
      created_at: old,
      expires_at: future,
    };
    expect(messageWithinEditWindow(msg, now)).toBe(false);
    expect(canEditMessage(msg, 'u_me')).toBe(false);
  });

  it('applies edited payload to thread', () => {
    const messages = [
      { message_id: 'm_1', ciphertext: 'a' },
      { message_id: 'm_2', ciphertext: 'b' },
    ];
    const next = applyMessageEdited(messages, {
      message_id: 'm_1',
      ciphertext: 'c',
      edited_at: '2026-06-29T12:00:00+00:00',
    });
    expect(next[0].ciphertext).toBe('c');
    expect(next[0].edited_at).toBeTruthy();
    expect(next[1].ciphertext).toBe('b');
  });
});