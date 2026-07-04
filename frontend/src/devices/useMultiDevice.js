/**
 * Multi-device linking — create link, confirm, list, revoke.
 */

import { useCallback, useState } from 'react';
import { api, apiFetch } from '../lib/api';

export function useMultiDevice() {
  const [linkToken, setLinkToken] = useState(null);
  const [devices, setDevices] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.get('/api/devices');
      setDevices(data.devices || []);
      return data.devices || [];
    } catch (e) {
      setError(e.message || 'Failed to load devices');
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const createLink = useCallback(async (deviceName = 'New device') => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.post('/api/devices/link', { device_name: deviceName });
      setLinkToken(data.link_token);
      return data;
    } catch (e) {
      setError(e.message || 'Failed to create link');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const confirmLink = useCallback(async ({ linkToken: token, deviceId, name, platform }) => {
    setLoading(true);
    setError(null);
    try {
      return await api.post('/api/devices/link/confirm', {
        link_token: token,
        device_id: deviceId,
        name,
        platform,
      });
    } catch (e) {
      setError(e.message || 'Failed to confirm link');
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const revokeDevice = useCallback(
    async (deviceId) => {
      setLoading(true);
      setError(null);
      try {
        const response = await apiFetch(`/api/devices/${encodeURIComponent(deviceId)}`, {
          method: 'DELETE',
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        setDevices((prev) => prev.filter((d) => d.id !== deviceId));
        return true;
      } catch (e) {
        setError(e.message || 'Failed to revoke device');
        return false;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    linkToken,
    devices,
    createLink,
    confirmLink,
    loadDevices,
    revokeDevice,
    loading,
    error,
  };
}

