/**
 * Android WebView — route API calls through native HTTP (cookies + client header).
 */

function bridgeCallback(id) {
  return new Promise((resolve, reject) => {
    const bridge = window.__sscBridge;
    if (!bridge) {
      reject(new Error('ssc_bridge_missing'));
      return;
    }
    const prior = bridge._callback;
    bridge._callbacks = bridge._callbacks || {};
    bridge._callbacks[id] = (ok, payload) => {
      if (prior) bridge._callback = prior;
      if (!ok) {
        reject(new Error(typeof payload === 'string' ? payload : 'ssc_api_error'));
        return;
      }
      resolve(payload);
    };
    bridge._callback = (cbId, ok, payload) => {
      const fn = bridge._callbacks?.[cbId];
      if (fn) {
        delete bridge._callbacks[cbId];
        fn(ok, payload);
      } else if (prior) {
        prior(cbId, ok, payload);
      }
    };
  });
}

export function androidApiFetchEnabled() {
  return Boolean(
    typeof window !== 'undefined' &&
      window.__SSC_ANDROID_CLIENT &&
      window.__sscBridge?.fetchApi
  );
}

export async function androidApiFetch(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const headers = options.headers || {};
  const body = options.body != null ? String(options.body) : '';
  const id = `api_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const wait = bridgeCallback(id);
  window.__sscBridge.fetchApi(url, method, JSON.stringify(headers), body, id);
  const result = await wait;
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