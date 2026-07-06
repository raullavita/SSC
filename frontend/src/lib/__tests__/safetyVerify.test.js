import {
  buildSafetyQrPayload,
  comparePastedSafetyValue,
  splitSafetyNumberGroups,
} from '../safetyVerify';

describe('safetyVerify', () => {
  const sample = '12345 67890 11111 22222 33333 44444';

  test('splitSafetyNumberGroups', () => {
    expect(splitSafetyNumberGroups(sample)).toHaveLength(6);
  });

  test('buildSafetyQrPayload', () => {
    expect(buildSafetyQrPayload('u_peer', sample)).toBe(
      'ssc://verify/u_peer/123456789011111222223333344444'
    );
  });

  test('comparePastedSafetyValue detects text match', () => {
    const result = comparePastedSafetyValue(sample, '123456789011111222223333344444');
    expect(result.match).toBe(true);
    expect(result.reason).toBe('text_match');
  });

  test('comparePastedSafetyValue detects QR match', () => {
    const qr = buildSafetyQrPayload('u_peer', sample);
    const result = comparePastedSafetyValue(sample, qr);
    expect(result.match).toBe(true);
    expect(result.peerId).toBe('u_peer');
  });
});