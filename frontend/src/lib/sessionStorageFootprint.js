/**
 * sessionStorage footprint — Engine 3 Step 3.6.
 */
export const SESSION_PENDING_KEYS = ['ssc_pending_call'];

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