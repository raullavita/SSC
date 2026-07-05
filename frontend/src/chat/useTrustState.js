import { useCallback, useEffect, useState } from 'react';
import {
  clearPeerTrust,
  getPeerTrust,
  markPeerVerified,
  syncPeerSafetyNumber,
  TRUST_STATUS,
} from '../lib/trustStore';
import { computeSafetyNumber } from '../signal/safetyNumber';

export function useTrustState(peerId) {
  const [trust, setTrust] = useState(() => getPeerTrust(peerId));
  const [safetyNumber, setSafetyNumber] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    if (!peerId) {
      setTrust(getPeerTrust(null));
      setSafetyNumber(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const sn = await computeSafetyNumber(peerId);
      setSafetyNumber(sn);
      syncPeerSafetyNumber(peerId, sn.displayable);
      setTrust(getPeerTrust(peerId));
    } catch (e) {
      setSafetyNumber(null);
      setError(e.message || 'Failed to load safety number');
      setTrust(getPeerTrust(peerId));
    } finally {
      setLoading(false);
    }
  }, [peerId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const markVerified = useCallback(() => {
    if (!peerId || !safetyNumber?.displayable) return;
    markPeerVerified(peerId, safetyNumber.displayable);
    setTrust(getPeerTrust(peerId));
  }, [peerId, safetyNumber]);

  const resetTrust = useCallback(() => {
    if (!peerId) return;
    clearPeerTrust(peerId);
    if (safetyNumber?.displayable) {
      syncPeerSafetyNumber(peerId, safetyNumber.displayable);
    }
    setTrust(getPeerTrust(peerId));
  }, [peerId, safetyNumber]);

  return {
    trust,
    safetyNumber,
    loading,
    error,
    refresh,
    markVerified,
    resetTrust,
    isVerified: trust.status === TRUST_STATUS.VERIFIED,
    isChanged: trust.status === TRUST_STATUS.CHANGED,
  };
}