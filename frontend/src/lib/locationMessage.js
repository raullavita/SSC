/** One-shot location messages — Q.24 (E2E coordinates in ciphertext). */

export function serializeLocationPayload({ lat, lng, accuracy }) {
  const payload = { lat, lng };
  if (typeof accuracy === 'number' && Number.isFinite(accuracy)) {
    payload.accuracy = accuracy;
  }
  return JSON.stringify(payload);
}

export function parseLocationPayload(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') return null;
  try {
    const data = JSON.parse(plaintext);
    const lat = Number(data?.lat);
    const lng = Number(data?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    const accuracy = Number(data?.accuracy);
    return {
      lat,
      lng,
      accuracy: Number.isFinite(accuracy) ? accuracy : null,
    };
  } catch {
    return null;
  }
}

export function buildLocationPayload({ lat, lng, accuracy }) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) {
    return { ok: false, errorKey: 'locationInvalid' };
  }
  if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
    return { ok: false, errorKey: 'locationInvalid' };
  }
  const accNum = Number(accuracy);
  return {
    ok: true,
    payload: {
      lat: latNum,
      lng: lngNum,
      accuracy: Number.isFinite(accNum) ? accNum : null,
    },
  };
}

export function formatCoordinates(lat, lng) {
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

export function buildStaticMapUrl(lat, lng, { width = 280, height = 140, zoom = 15 } = {}) {
  const latFixed = lat.toFixed(6);
  const lngFixed = lng.toFixed(6);
  return `https://staticmap.openstreetmap.de/staticmap.php?center=${latFixed},${lngFixed}&zoom=${zoom}&size=${width}x${height}&markers=${latFixed},${lngFixed}`;
}

export function buildMapsDeepLink(lat, lng) {
  const latFixed = lat.toFixed(6);
  const lngFixed = lng.toFixed(6);
  return `https://www.openstreetmap.org/?mlat=${latFixed}&mlon=${lngFixed}#map=16/${latFixed}/${lngFixed}`;
}

export async function openMapsLink(lat, lng) {
  const url = buildMapsDeepLink(lat, lng);
  const { isNativeApp } = await import('./platform');
  if (isNativeApp()) {
    const { Browser } = await import('@capacitor/browser');
    await Browser.open({ url });
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}