/**
 * Local linked-device id — Q.51 (per installed client instance).
 */
const LOCAL_DEVICE_ID_KEY = 'ssc_local_device_id';

export function getLocalDeviceId() {
  if (typeof localStorage === 'undefined') return 1;
  const raw = parseInt(localStorage.getItem(LOCAL_DEVICE_ID_KEY) || '1', 10);
  if (!Number.isFinite(raw) || raw < 1 || raw > 5) return 1;
  return raw;
}

export function setLocalDeviceId(deviceId) {
  if (typeof localStorage === 'undefined') return;
  const id = parseInt(deviceId, 10);
  if (!Number.isFinite(id) || id < 1 || id > 5) return;
  localStorage.setItem(LOCAL_DEVICE_ID_KEY, String(id));
}

export function clearLocalDeviceId() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(LOCAL_DEVICE_ID_KEY);
}