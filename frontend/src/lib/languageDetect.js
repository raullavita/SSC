/**
 * Language detection — franc (OSS) for auto-translate.
 * @see https://github.com/wooorm/franc
 */

import { franc } from 'franc-min';

const ISO3_TO_ISO1 = {
  eng: 'en',
  spa: 'es',
  fra: 'fr',
  deu: 'de',
  por: 'pt',
  ita: 'it',
  nld: 'nl',
  rus: 'ru',
  cmn: 'zh',
  jpn: 'ja',
  kor: 'ko',
  ara: 'ar',
};

export function detectLanguage(text) {
  if (!text?.trim() || text.trim().length < 10) return null;
  const iso3 = franc(text, { minLength: 10 });
  if (!iso3 || iso3 === 'und') return null;
  return ISO3_TO_ISO1[iso3] || iso3.slice(0, 2);
}

export function shouldAutoTranslate(text, userLang = 'en') {
  const detected = detectLanguage(text);
  if (!detected) return false;
  return detected !== userLang;
}