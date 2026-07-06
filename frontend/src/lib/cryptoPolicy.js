/**
 * Production crypto policy — Step 4.
 * Installed production builds require real libsignal; dev envelope is development-only.
 */

export function requiresProductionCrypto() {
  return process.env.REACT_APP_SSC_REQUIRE_LIBCRYPTO === 'true';
}

export function isLibsignalRuntimeAvailable() {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.sscCrypto?.encryptMessage && window.sscCrypto?.decryptMessage
  );
}

function isGroupLibsignalAvailable() {
  if (typeof window === 'undefined') return false;
  return Boolean(
    window.sscCrypto?.encryptGroupMessage && window.sscCrypto?.decryptGroupMessage
  );
}

export function assertLibsignalRuntime(operation = 'crypto') {
  if (!requiresProductionCrypto()) return;
  if (!isLibsignalRuntimeAvailable()) {
    throw new Error(`libsignal_required:${operation}`);
  }
}

export function assertGroupLibsignalRuntime(operation = 'group_crypto') {
  if (!requiresProductionCrypto()) return;
  if (!isGroupLibsignalAvailable()) {
    throw new Error(`libsignal_group_required:${operation}`);
  }
}