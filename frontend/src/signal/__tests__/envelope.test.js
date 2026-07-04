import { buildDevSignalEnvelope, parseDevSignalEnvelope } from '../envelope';

describe('signal envelope', () => {
  test('round-trips dev envelope', () => {
    const { ciphertext, protocol } = buildDevSignalEnvelope('hello signal');
    expect(protocol).toBe('signal_v1');
    expect(parseDevSignalEnvelope(ciphertext)).toBe('hello signal');
  });
});