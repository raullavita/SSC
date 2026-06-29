jest.mock('../crypto', () => ({
  unwrapPrivateKey: jest.fn(),
  wrapPrivateKey: jest.fn(),
}));

jest.mock('../api', () => ({
  api: { get: jest.fn(), post: jest.fn() },
}));

import {
  formatRecoveryCode,
  normalizeRecoveryCode,
  parseRecoveryCodesInput,
  recoverySecretFromCodes,
  RECOVERY_CODE_COUNT,
} from '../recoveryKey';

describe('recoveryKey', () => {
  it('normalizes recovery codes', () => {
    expect(normalizeRecoveryCode('abcd-ef12')).toBe('ABCDEF12');
  });

  it('formats recovery codes for display', () => {
    expect(formatRecoveryCode('ABCDEF12')).toBe('ABCD-EF12');
  });

  it('builds recovery secret from codes', () => {
    const codes = Array(RECOVERY_CODE_COUNT).fill('ABCD1234');
    expect(recoverySecretFromCodes(codes)).toHaveLength(RECOVERY_CODE_COUNT * 8);
  });

  it('parses space-separated recovery codes', () => {
    const codes = Array(RECOVERY_CODE_COUNT).fill('ABCD1234');
    expect(parseRecoveryCodesInput(codes.join(' '))).toEqual(codes);
  });

  it('parses continuous hex recovery input', () => {
    const codes = Array(RECOVERY_CODE_COUNT).fill('ABCD1234');
    const parsed = parseRecoveryCodesInput(codes.join(''));
    expect(parsed).toEqual(codes);
  });
});