/** Per-user privacy toggles — Q.6. */

export const DEFAULT_PRIVACY = {
  read_receipts: true,
  typing_indicators: true,
  last_seen: 'contacts',
  profile_photo: 'contacts',
};

export const LAST_SEEN_OPTIONS = ['hidden', 'online_only', 'contacts'];
export const PROFILE_PHOTO_OPTIONS = ['hidden', 'contacts'];

export function privacyFromUser(user) {
  const raw = user?.privacy;
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_PRIVACY };
  return {
    read_receipts: typeof raw.read_receipts === 'boolean' ? raw.read_receipts : DEFAULT_PRIVACY.read_receipts,
    typing_indicators: typeof raw.typing_indicators === 'boolean' ? raw.typing_indicators : DEFAULT_PRIVACY.typing_indicators,
    last_seen: LAST_SEEN_OPTIONS.includes(raw.last_seen) ? raw.last_seen : DEFAULT_PRIVACY.last_seen,
    profile_photo: PROFILE_PHOTO_OPTIONS.includes(raw.profile_photo) ? raw.profile_photo : DEFAULT_PRIVACY.profile_photo,
  };
}

export function readReceiptsEnabled(user) {
  return privacyFromUser(user).read_receipts;
}

export function typingIndicatorsEnabled(user) {
  return privacyFromUser(user).typing_indicators;
}

export function privacyPatchChanged(currentUser, nextPrivacy) {
  const saved = privacyFromUser(currentUser);
  return Object.keys(nextPrivacy).some((key) => nextPrivacy[key] !== saved[key]);
}

export function buildPrivacyPayload(currentUser, nextPrivacy) {
  const saved = privacyFromUser(currentUser);
  const patch = {};
  Object.keys(nextPrivacy).forEach((key) => {
    if (nextPrivacy[key] !== saved[key]) patch[key] = nextPrivacy[key];
  });
  return Object.keys(patch).length ? patch : null;
}