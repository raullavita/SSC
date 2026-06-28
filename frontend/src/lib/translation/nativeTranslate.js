import { Capacitor, registerPlugin } from '@capacitor/core';
import { isElectronApp } from '../platform';

const SscTranslate = registerPlugin('SscTranslate', {
  web: () => import('./nativeTranslateWeb').then((m) => new m.SscTranslateWeb()),
});

function getTranslateClient() {
  if (Capacitor.isNativePlatform()) return SscTranslate;
  if (isElectronApp() && window.sscDesktop?.translate) return window.sscDesktop.translate;
  return null;
}

export function isOnDeviceTranslationAvailable() {
  return !!getTranslateClient();
}

export async function getTranslationCapabilities() {
  const client = getTranslateClient();
  if (!client) {
    return { on_device: false, provider: 'web-unavailable' };
  }
  return client.getCapabilities();
}

export async function translateOnDevice(text, sourceLanguage, targetLanguage) {
  const client = getTranslateClient();
  if (!client) {
    throw new Error('ON_DEVICE_UNAVAILABLE');
  }
  return client.translate({
    text,
    source_language: sourceLanguage || undefined,
    target_language: targetLanguage,
  });
}