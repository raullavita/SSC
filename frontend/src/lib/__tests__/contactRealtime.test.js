import {
  CONTACTS_REFRESH_EVENT,
  CONTACT_WS_TYPES,
  dispatchContactsRefresh,
  isContactRealtimeEvent,
  subscribeContactsRefresh,
} from '../contactRealtime';

describe('contactRealtime', () => {
  it('dispatches refresh event', () => {
    const handler = jest.fn();
    const unsub = subscribeContactsRefresh(handler);
    dispatchContactsRefresh({ type: 'friend_request' });
    expect(handler).toHaveBeenCalledWith({ type: 'friend_request' });
    unsub();
  });

  it('recognizes contact WS event types', () => {
    expect(isContactRealtimeEvent({ type: 'friend-request' })).toBe(true);
    expect(isContactRealtimeEvent({ type: 'message' })).toBe(false);
    expect(CONTACT_WS_TYPES.has('friend-accepted')).toBe(true);
    expect(CONTACTS_REFRESH_EVENT).toBe('ssc-contacts-refresh');
  });
});