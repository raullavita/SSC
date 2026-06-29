import { useEffect, useRef, useState } from 'react';
import { createQualitySampler } from '../lib/callQuality';

const POLL_MS = 2000;

export function useCallQualityMonitor(pcRef, active) {
  const [quality, setQuality] = useState({
    level: 'unknown',
    packetLossPercent: null,
    rttMs: null,
    jitterMs: null,
  });
  const samplerRef = useRef(null);

  useEffect(() => {
    if (!active) {
      samplerRef.current?.reset?.();
      setQuality({ level: 'unknown', packetLossPercent: null, rttMs: null, jitterMs: null });
      return undefined;
    }
    if (!samplerRef.current) samplerRef.current = createQualitySampler();

    const tick = async () => {
      const pc = pcRef.current;
      if (!pc || pc.connectionState !== 'connected') return;
      try {
        const sample = await samplerRef.current.sample(pc);
        setQuality(sample);
      } catch {
        /* ignore transient getStats failures */
      }
    };

    tick();
    const id = setInterval(tick, POLL_MS);
    return () => clearInterval(id);
  }, [active, pcRef]);

  return quality;
}