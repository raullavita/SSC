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

export async function electronApiFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = options.headers || {};
  const body = options.body != null ? String(options.body) : '';
  const result = await window.sscShell.fetchApi(url, method, JSON.stringify(headers), body);
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