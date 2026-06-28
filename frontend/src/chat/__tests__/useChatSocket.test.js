const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

jest.mock('../../lib/socket', () => {
  return {
    __esModule: true,
    ChatSocket: class ChatSocket {
      constructor(token, options) {
        global.mockSocketOptions = options;
      }
      connect() {}
      close() {}
    }
  };
});

jest.mock('sonner', () => ({
  toast: {
    error: jest.fn(),
    message: jest.fn(),
    success: jest.fn(),
  },
}));

const React = require('react');
const { render } = require('@testing-library/react');
const { toast } = require('sonner');
const { useChatSocket } = require('../useChatSocket');

function TestComponent({ hookArgs }) {
  useChatSocket(hookArgs);
  return <div data-testid="test-hook" />;
}

describe('useChatSocket - signaling-error handling', () => {
  let mockArgs;
  const mockT = jest.fn((key) => key); 

  beforeEach(() => {
    jest.clearAllMocks();
    global.mockSocketOptions = null;
    mockT.mockImplementation((key) => key);

    mockArgs = {
      user: { user_id: 'user_123' },
      activeId: 'conv_456',
      peer: { user_id: 'peer_789' },
      t: mockT,
      leaveChat: jest.fn(),
      loadConversations: jest.fn(),
      setMessages: jest.fn(),
      setTypingFrom: jest.fn(),
      setCallState: jest.fn(),
      setGroupCallState: jest.fn(),
      setReads: jest.fn(),
      socketRef: { current: null },
      conversationsRef: { current: [] },
      myContactsRef: { current: [] },
      refreshContactsRosterRef: { current: jest.fn() },
    };
  });

  it('should trigger toast.error with callSignalingRejected key when signaling-error occurs', () => {
    render(<TestComponent hookArgs={mockArgs} />);

    expect(global.mockSocketOptions).toBeDefined();
    expect(global.mockSocketOptions.onMessage).toBeInstanceOf(Function);

    const errorPayload = {
      type: 'signaling-error',
      detail: 'Testing server rejection handler',
    };

    global.mockSocketOptions.onMessage(errorPayload);

    expect(mockT).toHaveBeenCalledWith('callSignalingRejected');
    expect(toast.error).toHaveBeenCalledWith('callSignalingRejected');
  });

  it('applies message-deleted tombstone in active conversation', () => {
    const setMessages = jest.fn((fn) => {
      if (typeof fn === 'function') {
        return fn([{ message_id: 'm_1', message_type: 'text', ciphertext: 'hi' }]);
      }
      return fn;
    });
    render(<TestComponent hookArgs={{ ...mockArgs, setMessages }} />);

    global.mockSocketOptions.onMessage({
      type: 'message-deleted',
      conversation_id: 'conv_456',
      message_id: 'm_1',
      deleted_at: '2026-06-29T12:00:00+00:00',
    });

    expect(setMessages).toHaveBeenCalled();
    const updater = setMessages.mock.calls[0][0];
    const next = updater([{ message_id: 'm_1', message_type: 'text', ciphertext: 'hi' }]);
    expect(next[0].message_type).toBe('deleted');
    expect(next[0].ciphertext).toBe('');
  });

  it('applies message-edited payload in active conversation', () => {
    const setMessages = jest.fn();
    render(<TestComponent hookArgs={{ ...mockArgs, setMessages }} />);

    global.mockSocketOptions.onMessage({
      type: 'message-edited',
      data: {
        conversation_id: 'conv_456',
        message_id: 'm_1',
        ciphertext: 'new',
        edited_at: '2026-06-29T12:00:00+00:00',
      },
    });

    expect(setMessages).toHaveBeenCalled();
    const updater = setMessages.mock.calls[0][0];
    const next = updater([{ message_id: 'm_1', ciphertext: 'old' }]);
    expect(next[0].ciphertext).toBe('new');
    expect(next[0].edited_at).toBeTruthy();
  });

  it('applies message-reaction update in active conversation', () => {
    const setMessages = jest.fn();
    render(<TestComponent hookArgs={{ ...mockArgs, setMessages }} />);

    global.mockSocketOptions.onMessage({
      type: 'message-reaction',
      conversation_id: 'conv_456',
      message_id: 'm_1',
      reactions: [{ user_id: 'peer_789', emoji: '👍' }],
    });

    expect(setMessages).toHaveBeenCalled();
    const updater = setMessages.mock.calls[0][0];
    const next = updater([{ message_id: 'm_1', reactions: [] }]);
    expect(next[0].reactions).toHaveLength(1);
  });
});