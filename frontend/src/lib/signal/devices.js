/**
 * Linked devices API — Q.51.
 */
import { api } from '../api';
import { getLocalDeviceId, setLocalDeviceId } from './deviceStore';
import { isNativeLibsignalAvailable, setNativeLocalDeviceId } from './nativeLibsignal';
import { isInstalledClient } from '../platform';

export async function fetchMyDevices() {
  const { data } = await api.get('/devices');
  return data;
}

export async function createDeviceLinkToken() {
  const { data } = await api.post('/devices/link-token');
  return data;
}

export async function linkDeviceWithToken({ token, deviceName, platform }) {
  const { data } = await api.post('/devices/link', {
    token,
    device_name: deviceName || undefined,
    platform: platform || undefined,
  });
  if (data?.device_id) {
    await applyLocalDeviceId(data.device_id);
  }
  return data;
}

export async function registerLocalDevice({ deviceName, platform } = {}) {
  const deviceId = getLocalDeviceId();
  const { data } = await api.post('/devices/register', {
    device_id: deviceId,
    device_name: deviceName || undefined,
    platform: platform || undefined,
  });
  return data;
}

export async function unlinkRemoteDevice(deviceId) {
  const { data } = await api.delete(`/devices/${deviceId}`);
  return data;
}

export async function applyLocalDeviceId(deviceId) {
  setLocalDeviceId(deviceId);
  if (isNativeLibsignalAvailable()) {
    try {
      await setNativeLocalDeviceId(deviceId);
    } catch {
      /* best-effort */
    }
  }
}

export function buildDeviceLinkPayload(token) {
  return JSON.stringify({ type: 'ssc_device_link', token, v: 1 });
}

export function parseDeviceLinkPayload(raw) {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed?.type === 'ssc_device_link' && parsed?.token) {
      return { token: String(parsed.token) };
    }
  } catch {
    /* ignore */
  }
  if (typeof raw === 'string' && raw.length >= 16 && raw.length <= 128) {
    return { token: raw.trim() };
  }
  return null;
}

export function isLinkedDevicesFeatureAvailable() {
  return isInstalledClient();
}