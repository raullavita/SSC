import { isInstalledClient } from './platform';
import { ensurePreKeysUploaded } from './signal/prekeys';

/**
 * Installed clients must upload libsignal prekeys before chat (unified identity).
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
export async function bootstrapSignalIdentity(refreshUser) {
  if (!isInstalledClient()) {
    return { ok: true, skipped: true };
  }
  try {
    const result = await ensurePreKeysUploaded();
    if (refreshUser) await refreshUser();
    if (result?.skipped && result?.reason === 'web') {
      return { ok: false, reason: 'libsignal_unavailable' };
    }
    return { ok: true, result };
  } catch (err) {
    return { ok: false, reason: err?.message || 'prekey_upload_failed' };
  }
}

export function userHasUnifiedIdentity(user) {
  return !!(
    user?.identity_primary === 'signal_v1'
    || user?.signal_prekeys_ready
  );
}