import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { decryptMessage, encryptMessage } from '../signal/signalBridge';
import { useUserSocket } from '../hooks/useUserSocket';

export function useCall({ conversationId, peerId, userId, enabled, wsToken }) {
  const [activeCall, setActiveCall] = useState(null);
  const [status, setStatus] = useState('idle');
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const callIdRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const isCalleeRef = useRef(false);

  const cleanup = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    remoteStreamRef.current = null;
    callIdRef.current = null;
    pendingOfferRef.current = null;
    isCalleeRef.current = false;
    setLocalStream(null);
    setRemoteStream(null);
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
    pc.ontrack = (event) => {
      const stream = event.streams?.[0];
      if (!stream) return;
      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
      }
      stream.getTracks().forEach((track) => {
        const exists = remoteStreamRef.current
          .getTracks()
          .some((t) => t.id === track.id);
        if (!exists) remoteStreamRef.current.addTrack(track);
      });
      setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
    };
    pcRef.current = pc;
    return pc;
  }, [relaySignal]);

  const attachLocalMedia = useCallback(
    async (video) => {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
      localStreamRef.current = stream;
      setLocalStream(stream);
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
        isCalleeRef.current = true;
        setActiveCall((prev) => prev || { id: callId });
        pendingOfferRef.current = payload.sdp;
        setStatus('incoming');
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
    [ensurePeerConnection]
  );

  useUserSocket({
    userId: enabled ? userId : null,
    wsToken: enabled ? wsToken : null,
    onEvent: async (data) => {
      const payload = data?.payload || data;
      if (payload?.type === 'incoming_call' && payload.call) {
        callIdRef.current = payload.call.id;
        isCalleeRef.current = true;
        setActiveCall(payload.call);
        setStatus('incoming');
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
      isCalleeRef.current = false;
      const data = await api.post('/api/calls', {
        conversation_id: conversationId,
        callee_id: peerId,
        video,
      });
      const call = data.call;
      callIdRef.current = call.id;
      setActiveCall({ ...call, video });
      setStatus('ringing');

      const pc = await attachLocalMedia(video);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await relaySignal(call.id, 'offer', { sdp: offer });
    },
    [conversationId, peerId, attachLocalMedia, relaySignal]
  );

  const answerCall = useCallback(async () => {
    if (!activeCall?.id || !pendingOfferRef.current) return;
    setStatus('connecting');
    const video = Boolean(activeCall.video);
    const pc = await attachLocalMedia(video);
    await pc.setRemoteDescription(pendingOfferRef.current);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    await relaySignal(activeCall.id, 'answer', { sdp: answer });
    pendingOfferRef.current = null;
    setStatus('connected');
  }, [activeCall, attachLocalMedia, relaySignal]);

  const declineCall = useCallback(() => {
    cleanup();
  }, [cleanup]);

  const callOpen = status !== 'idle';

  return {
    activeCall,
    status,
    localStream,
    remoteStream,
    callOpen,
    startCall,
    answerCall,
    declineCall,
    cleanup,
  };
}