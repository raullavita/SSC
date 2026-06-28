import {
  buildPrivacyPayload,
  privacyFromUser,
  readReceiptsEnabled,
  typingIndicatorsEnabled,
} from '../privacySettings';

describe('privacySettings', () => {
  it('defaults when privacy missing', () => {
    expect(privacyFromUser({})).toMatchObject({
      read_receipts: true,
      typing_indicators: true,
      last_seen: 'contacts',
      profile_photo: 'contacts',
    });
  });

  it('reads user overrides', () => {
    const p = privacyFromUser({
      privacy: {
        read_receipts: false,
        typing_indicators: false,
        last_seen: 'hidden',
        profile_photo: 'hidden',
      },
    });
    expect(readReceiptsEnabled({ privacy: p })).toBe(false);
    expect(typingIndicatorsEnabled({ privacy: p })).toBe(false);
  });

  it('builds partial privacy patch', () => {
    const user = { privacy: { read_receipts: true, typing_indicators: true, last_seen: 'contacts', profile_photo: 'contacts' } };
    const patch = buildPrivacyPayload(user, {
      read_receipts: false,
      typing_indicators: true,
      last_seen: 'contacts',
      profile_photo: 'contacts',
    });
    expect(patch).toEqual({ read_receipts: false });
  });
});