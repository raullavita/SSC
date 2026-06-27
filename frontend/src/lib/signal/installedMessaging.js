/**
 * Installed clients use Signal only — no vault/password UX (Engine 8 unified identity).
 */
import { isInstalledClient } from '../platform';
import { bootstrapSignalIdentity } from '../signalIdentityBootstrap';
import { hasSignalSession } from './nativeLibsignal';
import { ensureSignalSession } from './x3dh';
import { shouldSendWithSignal } from './migration';

/** True when this device must never fall back to RSA vault messaging. */
export function usesSignalOnlyMessaging() {
  return isInstalledClient();
}

/**
 * Upload prekeys, refresh user, establish session — then decide Signal send path.
 * @param {object} opts
 * @param {() => Promise<object|null>} [opts.refreshUser]
 */
export async function prepareInstalledMessaging({
  isGroup,
  peer,
  user,
  members,
  refreshUser,
}) {
  if (!usesSignalOnlyMessaging() || !user?.user_id) {
    return shouldSendWithSignal({ isGroup, peer, user, members });
  }

  const boot = await bootstrapSignalIdentity(refreshUser);
  if (!boot?.ok) return false;

  let freshUser = user;
  if (refreshUser) {
    freshUser = await refreshUser() || user;
  }
  if (!freshUser?.signal_prekeys_ready) return false;

  if (!isGroup && peer?.user_id) {
    try {
      await ensureSignalSession(peer.user_id, freshUser.user_id);
      const status = await hasSignalSession(peer.user_id);
      if (!status?.has_session) return false;
    } catch {
      return false;
    }
  }

  return shouldSendWithSignal({ isGroup, peer, user: freshUser, members });
}