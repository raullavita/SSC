/**
 * On-device translation bridge — Engine 9 desktop (Transformers.js / ONNX).
 * Plaintext never leaves the machine; models download on first use (like ML Kit).
 */
import path from 'node:path';
import { env, pipeline } from '@xenova/transformers';
import {
  createProgressCallback,
  markTranslateDownloadError,
} from './progress.mjs';
import {
  modelForPair,
  planTranslationRoute,
  SUPPORTED,
} from './routing.mjs';

export const PROVIDER = 'transformers_on_device';

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
  const modelId = modelForPair(...pairKey.split('-'));
  if (!modelId) return null;
  if (!pipelines.has(pairKey)) {
    const progress_callback = createProgressCallback();
    const promise = pipeline('translation', modelId, { progress_callback }).catch((err) => {
      pipelines.delete(pairKey);
      markTranslateDownloadError(err?.message || String(err));
      throw err;
    });
    pipelines.set(pairKey, promise);
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
  const route = planTranslationRoute(source, target);
  if (route.length === 0) return text;

  let current = text;
  for (const leg of route) {
    const modelId = modelForPair(leg.source, leg.target);
    if (!modelId) {
      throw new Error(`unsupported language pair ${leg.source}->${leg.target}`);
    }
    const out = await translatePair(current, leg.source, leg.target);
    if (!out) throw new Error(`${leg.source}-${leg.target} translation failed`);
    current = out;
  }
  return current;
}

export async function getTranslateCapabilities() {
  return {
    on_device: true,
    provider: PROVIDER,
    requires_model_download: true,
    languages: [...SUPPORTED].sort(),
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