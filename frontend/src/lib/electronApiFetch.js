/**
 * Electron shell — route API calls through main-process fetch (cookies + cert pinning).
 * Renderer fetch from file:// origins fails production CORS preflight (Origin: null).
 */

export function electronApiFetchEnabled() {
  return Boolean(
    typeof window !== 'undefined' &&
      window.__SSC_ELECTRON_CLIENT &&
      window.sscShell?.fetchApi
  );
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function electronApiFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = options.headers || {};
  const body = options.body != null ? String(options.body) : '';
  let result;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      result = await window.sscShell.fetchApi(url, method, JSON.stringify(headers), body);
      break;
    } catch (err) {
      const message = String(err?.message || err);
      const retryable = /ERR_INSUFFICIENT_RESOURCES|ERR_FAILED|fetch failed/i.test(message);
      if (!retryable || attempt === 3) throw err;
      await sleep(120 * attempt);
    }
  }
  const status = result.status ?? 0;
  const text = result.body ?? '';
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() {
      try {
        return JSON.parse(text);
      } catch {
        return null;
      }
    },
    async text() {
      return text;
    },
  };
}