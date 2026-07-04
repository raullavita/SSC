import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { decryptMessage, encryptMessage } from '../signal/signalBridge';
import { useUserSocket } from '../hooks/useUserSocket';

export function useCall({ conversationId, peerId, userId, enabled, wsToken }) {
  const [activeCall, setActiveCall] = useState(null);
  const [status, setStatus] = useState('idle');
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const callIdRef = useRef(null);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    callIdRef.current = null;
    setStatus('idle');
    setActiveCall(null);
  }, []);

  useEffect(() => () => cleanup(), [cleanup]);

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

  const ensurePeerConnection = useCallback(() => {
    if (pcRef.current) return pcRef.current;
    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    });
    pc.onicecandidate = (event) => {
      if (!event.candidate || !callIdRef.current) return;
      relaySignal(callIdRef.current, 'ice', { candidate: event.candidate }).catch(() => {});
    };
    pcRef.current = pc;
    return pc;
  }, [relaySignal]);

  const attachLocalMedia = useCallback(
    async (video) => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
      localStreamRef.current = stream;
      const pc = ensurePeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      return pc;
    },
    [ensurePeerConnection]
  );

  const handleRemoteSignal = useCallback(
    async (callId, signalType, ciphertext, fromPeerId) => {
      const plaintext = await decryptMessage(ciphertext, { peerId: fromPeerId });
      const payload = JSON.parse(plaintext);
      const pc = ensurePeerConnection();
      callIdRef.current = callId;

      if (signalType === 'offer') {
        setActiveCall((prev) => prev || { id: callId });
        setStatus('incoming');
        await pc.setRemoteDescription(payload.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await relaySignal(callId, 'answer', { sdp: answer });
        setStatus('connected');
      } else if (signalType === 'answer') {
        await pc.setRemoteDescription(payload.sdp);
        setStatus('connected');
      } else if (signalType === 'ice' && payload.candidate) {
        try {
          await pc.addIceCandidate(payload.candidate);
        } catch {
          /* ignore stale ice */
        }
      }
    },
    [ensurePeerConnection, relaySignal]
  );

  useUserSocket({
    userId: enabled ? userId : null,
    wsToken: enabled ? wsToken : null,
    onEvent: async (data) => {
      const payload = data?.payload || data;
      if (payload?.type === 'incoming_call' && payload.call) {
        callIdRef.current = payload.call.id;
        setActiveCall(payload.call);
        setStatus('ringing');
      }
      if (payload?.type === 'call_signal' && payload.call_id) {
        const remotePeer = payload.from || peerId;
        await handleRemoteSignal(
          payload.call_id,
          payload.signal_type,
          payload.ciphertext,
          remotePeer
        );
      }
    },
  });

  const startCall = useCallback(
    async (video = false) => {
      if (!conversationId || !peerId) return;
      const data = await api.post('/api/calls', {
        conversation_id: conversationId,
        callee_id: peerId,
        video,
      });
      const call = data.call;
      callIdRef.current = call.id;
      setActiveCall(call);
      setStatus('ringing');

      const pc = await attachLocalMedia(video);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await relaySignal(call.id, 'offer', { sdp: offer });
    },
    [conversationId, peerId, attachLocalMedia, relaySignal]
  );

  const answerCall = useCallback(async () => {
    if (!activeCall?.id) return;
    setStatus('connecting');
    await attachLocalMedia(Boolean(activeCall.video));
  }, [activeCall, attachLocalMedia]);

  return { activeCall, status, startCall, answerCall, cleanup };
}