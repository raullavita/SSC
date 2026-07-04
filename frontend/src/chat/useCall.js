import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { encryptMessage } from '../signal/signalBridge';
import { wsUrl } from '../lib/api';

export function useCall({ conversationId, peerId, userId, enabled }) {
  const [activeCall, setActiveCall] = useState(null);
  const [status, setStatus] = useState('idle');
  const pcRef = useRef(null);
  const wsRef = useRef(null);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setStatus('idle');
    setActiveCall(null);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

  const ensurePeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pcRef.current = pc;
    return pc;
  }, []);

  const relaySignal = useCallback(
    async (callId, signalType, payloadObj) => {
      if (!callId) return;
      const plaintext = JSON.stringify(payloadObj);
      const { ciphertext, protocol } = await encryptMessage(plaintext, { peerId });
      await api.post('/api/calls/signal', {
        call_id: callId,
        signal_type: signalType,
        ciphertext,
        protocol,
      });
    },
    [peerId]
  );

  const startCall = useCallback(
    async (video = false) => {
      if (!conversationId || !peerId) return;
      const data = await api.post('/api/calls', {
        conversation_id: conversationId,
        callee_id: peerId,
        video,
      });
      const call = data.call;
      setActiveCall(call);
      setStatus('ringing');

      const pc = ensurePeerConnection();
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video,
      });
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await relaySignal(call.id, 'offer', { sdp: offer });
    },
    [conversationId, peerId, ensurePeerConnection, relaySignal]
  );

  return { activeCall, status, startCall, cleanup };
}