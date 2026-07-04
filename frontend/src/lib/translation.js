/**
 * Translation client — LibreTranslate via SSC backend proxy, or local instance.
 */

import { api } from './api';
import { getLocalTranslateUrl } from './chatPrefs';

export async function fetchLanguages() {
  const local = getLocalTranslateUrl();
  if (local) {
    try {
      const res = await fetch(`${local.replace(/\/$/, '')}/languages`);
      if (res.ok) {
        const data = await res.json();
        const codes = (data || []).map((l) => l.code || l).filter(Boolean);
        if (codes.length) return codes;
      }
    } catch {
      /* fall through to proxy */
    }
  }
  const data = await api.get('/api/translation/languages');
  return data.languages || [];
}

export async function translateText(text, { source = 'auto', target = 'en' } = {}) {
  const local = getLocalTranslateUrl();
  if (local) {
    try {
      const res = await fetch(`${local.replace(/\/$/, '')}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source, target, format: 'text' }),
      });
      if (res.ok) {
        const data = await res.json();
        return data.translatedText || data.translated_text || '';
      }
    } catch {
      /* fall through */
    }
  }
  const data = await api.post('/api/translation/translate', { text, source, target });
  return data.translated_text || '';
}