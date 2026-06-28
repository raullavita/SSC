import {
  canForwardMessage,
  eligibleForwardTargets,
} from '../messageForward';

describe('messageForward', () => {
  const contacts = [
    { user_id: 'u_alice', username: 'alice', blocked: false },
    { user_id: 'u_bob', username: 'bob', blocked: true },
  ];
  const conversations = [
    { conversation_id: 'c_src', is_group: false, peer: { user_id: 'u_alice', username: 'alice' } },
    { conversation_id: 'c_bob', is_group: false, peer: { user_id: 'u_bob', username: 'bob' } },
    { conversation_id: 'g_1', is_group: true, members: [] },
  ];

  it('allows forward for text messages', () => {
    expect(canForwardMessage({ message_type: 'text' })).toBe(true);
    expect(canForwardMessage({ message_type: 'image', attachment_id: 'f_1' })).toBe(false);
    expect(canForwardMessage({ message_type: 'deleted', deleted_for_everyone_at: 'x' })).toBe(false);
  });

  it('lists mutual contacts and groups, excluding source chat', () => {
    const targets = eligibleForwardTargets(conversations, contacts, {
      excludeConversationId: 'c_src',
    });
    expect(targets.map((c) => c.conversation_id)).toEqual(['g_1']);
  });
});