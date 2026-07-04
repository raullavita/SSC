/**
 * ICE server config — STUN + ephemeral TURN credentials from API (Step 3).
 */

import { api } from '../lib/api';

const DEFAULT_STUN = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
];

let cache = null;
let cacheUntil = 0;

function normalizeIceServers(servers) {
  if (!Array.isArray(servers) || !servers.length) return DEFAULT_STUN;
  return servers.map((s) => {
    const entry = { urls: s.urls };
    if (s.username) entry.username = s.username;
    if (s.credential) entry.credential = s.credential;
    return entry;
  });
}

export function clearIceServerCache() {
  cache = null;
  cacheUntil = 0;
}

export async function fetchIceServers({ force = false } = {}) {
  const now = Date.now();
  if (!force && cache && now < cacheUntil) {
    return cache;
  }
  try {
    const data = await api.get('/api/calls/ice-servers');
    const servers = normalizeIceServers(data.ice_servers);
    const ttlMs = (data.ttl_seconds || 3600) * 1000;
    cache = servers;
    cacheUntil = now + Math.max(ttlMs * 0.85, 60_000);
    return servers;
  } catch {
    return DEFAULT_STUN;
  }
}