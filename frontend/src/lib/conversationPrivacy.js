/**
 * Per-chat privacy helpers — Step 14.
 */

const GLOBAL_DEFAULTS = {
  read_receipts: false,
  typing_visible: true,
  last_seen_visible: false,
  disappearing_seconds_default: 0,
};

export function effectivePrivacy(overrides = {}, globalSettings = {}) {
  const merged = { ...GLOBAL_DEFAULTS, ...globalSettings };
  return {
    read_receipts:
      overrides.read_receipts !== undefined ? overrides.read_receipts : merged.read_receipts,
    typing_visible:
      overrides.typing_visible !== undefined
        ? overrides.typing_visible
        : merged.typing_visible,
    last_seen_visible:
      overrides.last_seen_visible !== undefined
        ? overrides.last_seen_visible
        : merged.last_seen_visible,
    disappearing_seconds_default:
      overrides.disappearing_seconds_default !== undefined
        ? overrides.disappearing_seconds_default || 0
        : 0,
  };
}

export function privacyInherits(overrides = {}, key) {
  return overrides[key] === undefined;
}