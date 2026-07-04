/**
 * Translation client — LibreTranslate via SSC backend proxy (Engine 8).
 */

import { api } from './api';

export async function fetchLanguages() {
  const data = await api.get('/api/translation/languages');
  return data.languages || [];
}

export async function translateText(text, { source = 'auto', target = 'en' } = {}) {
  const data = await api.post('/api/translation/translate', { text, source, target });
  return data.translated_text || '';
}