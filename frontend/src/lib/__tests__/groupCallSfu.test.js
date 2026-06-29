import { wsUrlFromConfig } from '../groupCallSfu';

describe('groupCallSfu', () => {
  it('normalizes wss SFU base URL to /ws path', () => {
    expect(wsUrlFromConfig('wss://sfu.example.com')).toBe('wss://sfu.example.com/ws');
    expect(wsUrlFromConfig('wss://sfu.example.com/ws')).toBe('wss://sfu.example.com/ws');
  });

  it('rejects missing or invalid SFU URL', () => {
    expect(() => wsUrlFromConfig('')).toThrow(/SFU_URL_MISSING/);
    expect(() => wsUrlFromConfig('https://sfu.example.com')).toThrow(/SFU_URL_INVALID/);
  });
});