/**
 * SSC API client — attaches installed-client header on every request.
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

export async function apiFetch(path, options = {}) {
  const headers = getInstalledClientHeaders(options.headers || {});
  const response = await fetch(buildUrl(path), {
    ...options,
    headers,
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
};