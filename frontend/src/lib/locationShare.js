/** Geolocation capture for one-shot location share — Q.24 */

export function isGeolocationAvailable() {
  return typeof navigator !== 'undefined' && Boolean(navigator.geolocation);
}

export function readCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
      ...options,
    });
  });
}

export async function captureCurrentLocation() {
  if (!isGeolocationAvailable()) {
    return { ok: false, errorKey: 'locationUnavailable' };
  }
  try {
    const pos = await readCurrentPosition();
    return {
      ok: true,
      coords: {
        lat: pos.coords.latitude,
        lng: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
      },
    };
  } catch (err) {
    if (err?.code === 1) return { ok: false, errorKey: 'locationPermissionDenied' };
    if (err?.code === 3) return { ok: false, errorKey: 'locationTimeout' };
    return { ok: false, errorKey: 'locationFailed' };
  }
}