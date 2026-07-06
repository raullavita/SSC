/**
 * Cloudflare Turnstile config from public /api/config.
 */

import { api } from './api';

let cached = null;

export async function getCaptchaConfig() {
  if (cached) return cached;
  try {
    const config = await api.get('/api/config');
    cached = {
      required: Boolean(config.captcha_required),
      siteKey: config.turnstile_site_key || null,
    };
  } catch {
    cached = { required: false, siteKey: null };
  }
  return cached;
}

export function resetCaptchaConfigCache() {
  cached = null;
}