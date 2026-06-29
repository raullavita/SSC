import {
  MAX_RECONNECT_ATTEMPTS,
  reconnectDelayMs,
  shouldAttemptReconnect,
} from '../callReconnect';

describe('callReconnect', () => {
  it('allows reconnect while under max attempts', () => {
    expect(shouldAttemptReconnect('disconnected', 0)).toBe(true);
    expect(shouldAttemptReconnect('failed', 2)).toBe(true);
    expect(shouldAttemptReconnect('failed', MAX_RECONNECT_ATTEMPTS)).toBe(false);
    expect(shouldAttemptReconnect('connected', 0)).toBe(false);
  });

  it('backs off reconnect delay by attempt', () => {
    expect(reconnectDelayMs(0)).toBeLessThan(reconnectDelayMs(2));
  });
});