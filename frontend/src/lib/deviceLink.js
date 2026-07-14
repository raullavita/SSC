/**
 * Multi-device helpers — numeric device IDs for libsignal compatibility.
 */

const DEVICE_ID_KEY = 'ssc_device_id';
const LINKED_DEVICE_KEY = 'ssc_linked_device_id';
const PRIMARY_DEVICE_ID = '1';

/** Primary installed client (Electron/Android main app) always uses device 1. */
export function getPrimaryDeviceId() {
  return PRIMARY_DEVICE_ID;
}

/** Local device id for crypto + API headers. */
export function getLocalDeviceId() {
  try {
    const linked = localStorage.getItem(LINKED_DEVICE_KEY);
    if (linked && /^\d{1,4}$/.test(linked)) return linked;
    return PRIMARY_DEVICE_ID;
  } catch {
    return PRIMARY_DEVICE_ID;
  }
}

export function setLinkedDeviceId(deviceId) {
  if (!deviceId || !/^\d{1,4}$/.test(String(deviceId))) return;
  try {
    localStorage.setItem(LINKED_DEVICE_KEY, String(deviceId));
    localStorage.setItem(DEVICE_ID_KEY, String(deviceId));
  } catch {
    /* ignore */
  }
}

export function clearLinkedDeviceId() {
  try {
    localStorage.removeItem(LINKED_DEVICE_KEY);
    localStorage.removeItem(DEVICE_ID_KEY);
  } catch {
    /* ignore */
  }
}

function deviceLinkPath(token) {
  if (!token) return '/link-device';
  return `/link-device?token=${encodeURIComponent(token)}`;
}

export function deviceLinkWebUrl(token, origin = '') {
  const base = (origin || '').replace(/\/$/, '');
  return `${base}${deviceLinkPath(token)}`;
}

export function deviceLinkDeepLink(token) {
  if (!token) return 'ssc://link-device';
  return `ssc://link-device?token=${encodeURIComponent(token)}`;
}

export function parseDeviceLinkToken(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  try {
    if (raw.startsWith('ssc://')) {
      const url = new URL(raw.replace('ssc://', 'https://ssc.local/'));
      return url.searchParams.get('token') || '';
    }
    if (raw.includes('://')) {
      const url = new URL(raw);
      return url.searchParams.get('token') || '';
    }
    if (raw.includes('token=')) {
      const query = raw.startsWith('?') ? raw : `?${raw}`;
      const url = new URL(`https://ssc.local/${query}`);
      return url.searchParams.get('token') || '';
    }
  } catch {
    return '';
  }
  return raw;
}

export function platformLabel(platform) {
  switch (platform) {
    case 'android':
      return 'Android';
    case 'electron':
      return 'Desktop';
    case 'windows':
      return 'Windows';
    case 'mac':
      return 'Mac';
    case 'ios':
      return 'iOS';
    default:
      return platform || 'Device';
  }
}

export function formatExpiryCountdown(expiresAtMs) {
  if (!expiresAtMs) return '';
  const remaining = Math.max(0, expiresAtMs - Date.now());
  const mins = Math.floor(remaining / 60000);
  const secs = Math.floor((remaining % 60000) / 1000);
  if (remaining <= 0) return 'Expired';
  return `${mins}:${String(secs).padStart(2, '0')}`;
}