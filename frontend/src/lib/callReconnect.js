/** 1:1 call ICE restart reconnect — Q.32 */

export const MAX_RECONNECT_ATTEMPTS = 3;
export const DISCONNECTED_GRACE_MS = 4000;
export const RECONNECT_OFFER_DELAY_MS = 800;

export function shouldAttemptReconnect(connectionState, attempt, maxAttempts = MAX_RECONNECT_ATTEMPTS) {
  if (attempt >= maxAttempts) return false;
  return connectionState === 'disconnected' || connectionState === 'failed';
}

export function reconnectDelayMs(attempt) {
  return RECONNECT_OFFER_DELAY_MS + attempt * 1200;
}