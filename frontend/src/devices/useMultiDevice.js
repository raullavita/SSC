/**
 * Multi-device linking hook — Engine 9 (scaffold, no app packaging).
 */

import { useCallback, useState } from 'react';
import { api } from '../lib/api';

export function useMultiDevice() {
  const [linkToken, setLinkToken] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

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

  return { linkToken, createLink, confirmLink, loading, error };
}