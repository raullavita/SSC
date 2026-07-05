import { effectivePrivacy, privacyInherits } from '../conversationPrivacy';

describe('conversationPrivacy', () => {
  it('inherits global defaults when overrides absent', () => {
    const eff = effectivePrivacy({}, { read_receipts: true, last_seen_visible: false });
    expect(eff.read_receipts).toBe(true);
    expect(eff.last_seen_visible).toBe(false);
    expect(eff.typing_visible).toBe(true);
  });

  it('applies per-chat overrides', () => {
    const eff = effectivePrivacy(
      { typing_visible: false, disappearing_seconds_default: 3600 },
      { read_receipts: false }
    );
    expect(eff.typing_visible).toBe(false);
    expect(eff.disappearing_seconds_default).toBe(3600);
  });

  it('detects inherited fields', () => {
    expect(privacyInherits({}, 'read_receipts')).toBe(true);
    expect(privacyInherits({ read_receipts: true }, 'read_receipts')).toBe(false);
  });
});