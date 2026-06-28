/**
 * On-device translation bridge — Engine 9 desktop (Transformers.js / ONNX).
 * Plaintext never leaves the machine; models download on first use (like ML Kit).
 */
import path from 'node:path';
import { env, pipeline } from '@xenova/transformers';

export const PROVIDER = 'transformers_on_device';

const SUPPORTED = new Set(['en', 'es', 'ro']);

/** Direct OPUS-MT pairs (Xenova ONNX builds). */
const MODEL_BY_PAIR = {
  'en-es': 'Xenova/opus-mt-en-es',
  'es-en': 'Xenova/opus-mt-es-en',
  'en-ro': 'Xenova/opus-mt-en-ro',
  'ro-en': 'Xenova/opus-mt-ro-en',
};

const pipelines = new Map();

export function initTranslateBridge(userDataPath) {
  env.cacheDir = path.join(userDataPath, 'translate-cache');
  env.allowLocalModels = false;
  return { provider: PROVIDER };
}

function normalizeLang(code, fallback = null) {
  if (!code || typeof code !== 'string') return fallback;
  const tag = code.toLowerCase().trim().split('-')[0];
  if (!SUPPORTED.has(tag)) return fallback;
  return tag;
}

async function getPipeline(pairKey) {
  const modelId = MODEL_BY_PAIR[pairKey];
  if (!modelId) return null;
  if (!pipelines.has(pairKey)) {
    pipelines.set(pairKey, pipeline('translation', modelId));
  }
  return pipelines.get(pairKey);
}

async function translatePair(text, source, target) {
  const pairKey = `${source}-${target}`;
  const pipe = await getPipeline(pairKey);
  if (!pipe) return null;
  const out = await pipe(text);
  const row = Array.isArray(out) ? out[0] : out;
  return row?.translation_text ?? null;
}

async function translateText(text, source, target) {
  if (source === 'es' && target === 'ro') {
    const mid = await translatePair(text, 'es', 'en');
    if (!mid) throw new Error('es-en translation failed');
    return translatePair(mid, 'en', 'ro');
  }
  if (source === 'ro' && target === 'es') {
    const mid = await translatePair(text, 'ro', 'en');
    if (!mid) throw new Error('ro-en translation failed');
    return translatePair(mid, 'en', 'es');
  }
  const direct = await translatePair(text, source, target);
  if (!direct) throw new Error(`unsupported language pair ${source}->${target}`);
  return direct;
}

export async function getTranslateCapabilities() {
  return {
    on_device: true,
    provider: PROVIDER,
    requires_model_download: true,
    languages: [...SUPPORTED],
  };
}

export async function invokeTranslate({ text, source_language, target_language }) {
  const raw = typeof text === 'string' ? text.trim() : '';
  if (!raw) throw new Error('text required');

  const target = normalizeLang(target_language, null);
  if (!target) throw new Error(`unsupported target_language: ${target_language}`);

  const source = normalizeLang(source_language, 'en');
  if (source === target) {
    return { translated: raw, provider: PROVIDER, note: 'same language' };
  }

  const translated = await translateText(raw, source, target);
  const result = { translated, provider: PROVIDER };
  if (translated && translated.toLowerCase() === raw.toLowerCase()) {
    result.note = 'same language';
  }
  return result;
}