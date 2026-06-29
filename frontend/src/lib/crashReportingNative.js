import { Capacitor, registerPlugin } from '@capacitor/core';

const SscCrashReporting = registerPlugin('SscCrashReporting');

export async function syncCrashReportingOptIn(enabled) {
  if (!Capacitor.isNativePlatform()) return { synced: false };
  return SscCrashReporting.setOptIn({ enabled: !!enabled });
}

export async function recordNativeCrash(payload) {
  if (!Capacitor.isNativePlatform()) return { recorded: false };
  return SscCrashReporting.recordException({
    message: payload?.message || 'unknown',
    stack: payload?.stack || '',
  });
}