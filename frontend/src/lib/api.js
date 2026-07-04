/**
 * SSC API client — installed-client header + httpOnly session cookies (Engine 5).
 */

import { getInstalledClientHeaders } from './installedClient';

const API_BASE = (process.env.REACT_APP_API_URL || '').replace(/\/$/, '');

function buildUrl(path) {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE}${normalized}`;
}

function authHeaders(extra = {}) {
  return getInstalledClientHeaders(extra);
}

export async function apiFetch(path, options = {}) {
  const response = await fetch(buildUrl(path), {
    ...options,
    headers: authHeaders(options.headers || {}),
    credentials: options.credentials ?? 'include',
  });
  return response;
}

export async function apiJson(path, options = {}) {
  const response = await apiFetch(path, options);
  if (!response.ok) {
    const err = new Error(`HTTP ${response.status}`);
    err.status = response.status;
    try {
      err.body = await response.json();
    } catch {
      err.body = null;
    }
    throw err;
  }
  return response.json();
}

export const api = {
  get: (path, options) => apiJson(path, { ...options, method: 'GET' }),
  post: (path, body, options) =>
    apiJson(path, {
      ...options,
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
      body: JSON.stringify(body),
    }),
  patch: (path, body, options) =>
    apiJson(path, {
      ...options,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(options?.headers || {}) },
      body: JSON.stringify(body),
    }),
};

export function wsUrl(wsToken) {
  const base = API_BASE || `${window.location.protocol}//${window.location.host}`;
  const wsBase = base.replace(/^http/, 'ws');
  const url = `${wsBase}/api/ws`;
  if (wsToken) {
    return `${url}?token=${encodeURIComponent(wsToken)}`;
  }
  return url;
}