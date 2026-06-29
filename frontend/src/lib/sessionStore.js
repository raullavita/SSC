/**
 * Client session token storage — Engine 5 + TASK B.
 * Web (5.3): HttpOnly cookie only — never localStorage.
 * Native (5.4 + B): in-memory Bearer at runtime; encrypted wrap via nativeSessionStore.js.
 */
import { isInstalledClient } from './platform';
import { migrateDeviceWrapKeyToHardware } from './deviceWrapCrypto';
import {
  clearNativeSession,
  persistNativeSession,
  restoreNativeSession,
} from './nativeSessionStore';

import { LEGACY_JWT_KEY } from './sessionConstants';

let nativeMemoryToken = null;

/** Browser dev shell uses cookie auth; installed clients use in-memory Bearer token. */
export function usesCookieAuth() {
  return !isInstalledClient();
}

/** Purge legacy JWT from localStorage (pre-5.3 web / pre-5.4 native installs). */
export function purgeLegacyJwtFromStorage() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(LEGACY_JWT_KEY);
}

/** @deprecated Use purgeLegacyJwtFromStorage */
export function purgeLegacyWebJwtFromStorage() {
  purgeLegacyJwtFromStorage();
}

/** Restore encrypted session from device before first API call (cold start). */
export async function bootstrapSessionFromDevice() {
  if (usesCookieAuth()) return null;
  if (nativeMemoryToken) return nativeMemoryToken;
  await migrateDeviceWrapKeyToHardware();
  const token = await restoreNativeSession();
  if (token) nativeMemoryToken = token;
  return nativeMemoryToken;
}

export async function persistSessionToken(token) {
  if (!token || usesCookieAuth()) return;
  nativeMemoryToken = token;
  await persistNativeSession(token);
}

export function getSessionToken() {
  if (usesCookieAuth()) return null;
  return nativeMemoryToken;
}

export function clearSessionToken() {
  nativeMemoryToken = null;
  clearNativeSession();
  purgeLegacyJwtFromStorage();
}

export function hasNativeSessionToken() {
  return !usesCookieAuth() && !!nativeMemoryToken;
}

/** Whether Bearer header is required for API calls on this platform. */
export function usesBearerAuth() {
  return !usesCookieAuth();
}