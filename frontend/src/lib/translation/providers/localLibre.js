/**
 * Self-hosted or local LibreTranslate instance (user-configured URL).
 */

import { getLocalTranslateUrl } from '../../chatPrefs';

export function localLibreConfigured() {
  return Boolean(getLocalTranslateUrl()?.trim());
}

export async function fetchLocalLibreLanguages() {
  const local = getLocalTranslateUrl();
  if (!local) return null;
  try {
    const res = await fetch(`${local.replace(/\/$/, '')}/languages`);
    if (!res.ok) return null;
    const data = await res.json();
    const codes = (data || []).map((l) => l.code || l).filter(Boolean);
    return codes.length ? codes : null;
  } catch {
    return null;
  }
}

export async function translateLocalLibre(text, { source = 'auto', target = 'en' } = {}) {
  const local = getLocalTranslateUrl();
  if (!local) {
    return { status: 'unavailable', provider: 'local-libre', reason: 'not_configured' };
  }

  try {
    const res = await fetch(`${local.replace(/\/$/, '')}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source, target, format: 'text' }),
    });
    if (!res.ok) {
      return { status: 'error', provider: 'local-libre', reason: `http_${res.status}` };
    }
    const data = await res.json();
    return {
      status: 'ok',
      text: data.translatedText || data.translated_text || '',
      provider: 'local-libre',
      target,
    };
  } catch {
    return { status: 'error', provider: 'local-libre', reason: 'network_error' };
  }
}