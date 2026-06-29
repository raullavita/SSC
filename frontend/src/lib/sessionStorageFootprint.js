/**
 * sessionStorage footprint — Engine 3 Step 3.6.
 */
import { PENDING_REPLY_SESSION_KEY } from './notificationReply';

export const SESSION_PENDING_KEYS = ['ssc_pending_call', PENDING_REPLY_SESSION_KEY];

/**
 * @param {'logout'|'panic'} reason
 */
export function clearSessionStorageFootprint(reason) {
  if (typeof sessionStorage === 'undefined') return;
  if (reason === 'panic') {
    sessionStorage.clear();
    return;
  }
  for (const key of SESSION_PENDING_KEYS) {
    sessionStorage.removeItem(key);
  }
}