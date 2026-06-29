import {
  PENDING_REPLY_SESSION_KEY,
  clearPendingReplyDraft,
  peekPendingReplyDraft,
  queueNotificationReplyFallback,
  setNotificationReplyHandler,
} from '../notificationReply';

jest.mock('@capacitor/core', () => ({
  registerPlugin: jest.fn(() => ({
    addListener: jest.fn(),
    getPendingReply: jest.fn().mockResolvedValue({ conversationId: null, text: null }),
    clearPendingReply: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock('../platform', () => ({
  isNativeApp: jest.fn(() => true),
  getPlatform: jest.fn(() => 'android'),
}));

describe('notificationReply', () => {
  const assignMock = jest.fn();

  beforeEach(() => {
    sessionStorage.clear();
    setNotificationReplyHandler(null);
    assignMock.mockClear();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, pathname: '/', assign: assignMock },
    });
  });

  it('queues fallback draft and navigates to chat', () => {
    queueNotificationReplyFallback('conv_1', 'hello');
    expect(sessionStorage.getItem(PENDING_REPLY_SESSION_KEY)).toContain('conv_1');
    expect(assignMock).toHaveBeenCalledWith('/chat/conv_1');
  });

  it('dispatches draft event when already on target chat', () => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...window.location, pathname: '/chat/conv_1', assign: assignMock },
    });
    const handler = jest.fn();
    window.addEventListener('ssc-pending-reply-draft', handler);
    queueNotificationReplyFallback('conv_1', 'hi there');
    expect(handler).toHaveBeenCalled();
    expect(assignMock).not.toHaveBeenCalled();
    window.removeEventListener('ssc-pending-reply-draft', handler);
  });

  it('peeks and clears pending reply draft', () => {
    sessionStorage.setItem(PENDING_REPLY_SESSION_KEY, JSON.stringify({
      conversationId: 'c1',
      text: 'draft',
    }));
    expect(peekPendingReplyDraft()).toEqual({ conversationId: 'c1', text: 'draft' });
    clearPendingReplyDraft();
    expect(peekPendingReplyDraft()).toBeNull();
  });
});