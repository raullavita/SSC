import {
  DEFAULT_MAX_BROADCAST_LISTS,
  DEFAULT_MAX_BROADCAST_RECIPIENTS,
  broadcastRecipientLabel,
  clearBroadcastListLimitsCache,
  findDmConversation,
} from '../broadcastLists';

describe('broadcastLists', () => {
  afterEach(() => {
    clearBroadcastListLimitsCache();
  });

  it('labels recipients from contacts', () => {
    const contacts = [{ user_id: 'u_a', username: 'alice' }];
    expect(broadcastRecipientLabel(contacts, 'u_a')).toBe('@alice');
    expect(broadcastRecipientLabel(contacts, 'u_missing')).toBe('u_missing');
  });

  it('exposes default limits', () => {
    expect(DEFAULT_MAX_BROADCAST_LISTS).toBe(20);
    expect(DEFAULT_MAX_BROADCAST_RECIPIENTS).toBe(50);
  });

  it('finds an existing 1:1 conversation by peer id', () => {
    const conversations = [
      { conversation_id: 'c_group', is_group: true, members: [] },
      { conversation_id: 'c_dm', is_group: false, peer: { user_id: 'u_bob' } },
    ];
    expect(findDmConversation(conversations, 'u_bob')?.conversation_id).toBe('c_dm');
    expect(findDmConversation(conversations, 'u_missing')).toBeNull();
  });
});