/**
 * Server translation availability from public /api/config (admin-configured, not user API keys).
 */

import { api } from './api';

let cached = null;

export async function fetchTranslationConfig() {
  try {
    const config = await api.get('/api/config');
    cached = {
      enabled: Boolean(config.translation_enabled),
      provider: config.translation_provider || 'libretranslate',
    };
  } catch {
    cached = { enabled: false, provider: null };
  }
  return cached;
}

export function getTranslationConfig() {
  return cached || { enabled: false, provider: null };
}

export function isServerTranslationAvailable() {
  return Boolean(getTranslationConfig().enabled);
}