import { api } from './api';

let cachedRequired = null;

async function wsSubscribeTokenRequired() {
  if (cachedRequired !== null) return cachedRequired;
  if (process.env.REACT_APP_SSC_WS_SUBSCRIBE_TOKEN === 'true') {
    cachedRequired = true;
    return true;
  }
  try {
    const cfg = await api.get('/config');
    cachedRequired = Boolean(cfg.ws_subscribe_token_required);
  } catch {
    cachedRequired = false;
  }
  return cachedRequired;
}

async function fetchWsSubscribeToken(topic) {
  const data = await api.get(`/ws/subscribe-token?topic=${encodeURIComponent(topic)}`);
  return data.subscribe_token;
}

export async function buildSubscribePayload(topic) {
  const payload = { type: 'subscribe', topic };
  if (await wsSubscribeTokenRequired()) {
    payload.subscribe_token = await fetchWsSubscribeToken(topic);
  }
  return JSON.stringify(payload);
}