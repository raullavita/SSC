import { canDeleteForEveryone, canEditMessage } from '../messageActions';

describe('messageActions policy helpers', () => {
  const userId = 'user_a';

  it('allows edit for own recent text message', () => {
    const message = {
      id: 'm1',
      sender_id: userId,
      message_kind: 'message',
      text: 'hello',
      created_at: new Date().toISOString(),
    };
    expect(canEditMessage(message, userId)).toBe(true);
  });

  it('denies edit for deleted messages', () => {
    const message = {
      id: 'm1',
      sender_id: userId,
      message_kind: 'deleted',
      text: 'hello',
      created_at: new Date().toISOString(),
    };
    expect(canEditMessage(message, userId)).toBe(false);
  });

  it('denies delete for everyone after window', () => {
    const old = new Date(Date.now() - 61 * 60 * 1000).toISOString();
    const message = {
      id: 'm1',
      sender_id: userId,
      message_kind: 'message',
      created_at: old,
    };
    expect(canDeleteForEveryone(message, userId)).toBe(false);
  });
});