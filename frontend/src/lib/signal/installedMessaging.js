/**
 * Installed clients use Signal only — no vault/password UX (Engine 8 unified identity).
 */
import { isInstalledClient } from '../platform';
import { bootstrapSignalIdentity } from '../signalIdentityBootstrap';
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

  await bootstrapSignalIdentity(refreshUser).catch(() => {});
  if (refreshUser) {
    const fresh = await refreshUser();
    if (fresh) user = fresh;
  }

  if (!isGroup && peer?.user_id) {
    await ensureSignalSession(peer.user_id, user.user_id).catch(() => {});
  }

  return shouldSendWithSignal({ isGroup, peer, user, members });
}