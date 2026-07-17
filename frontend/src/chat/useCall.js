import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { fetchIceServers } from '../calls/iceServers';
import { acquireCallMedia, callErrorMessage } from './callMedia';
import { decryptMessage, encryptMessage } from '../signal/signalBridge';
import { useUserSocket } from '../hooks/useUserSocket';

const RING_TIMEOUT_MS = 45_000;

export function useCall({ conversationId, peerId, userId, enabled, wsToken }) {
  const [activeCall, setActiveCall] = useState(null);
  const [status, setStatus] = useState('idle');
  const [errorCode, setErrorCode] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteStreamRef = useRef(null);
  const callIdRef = useRef(null);
  const pendingOfferRef = useRef(null);
  const isCalleeRef = useRef(false);
  const iceServersRef = useRef(null);
  const iceQueueRef = useRef([]);
  const ringTimerRef = useRef(null);
  const busyRef = useRef(false);

  const clearRingTimer = useCallback(() => {
    if (ringTimerRef.current) {
      clearTimeout(ringTimerRef.current);
      ringTimerRef.current = null;
    }
  }, []);

  const cleanup = useCallback(
    (nextStatus = 'idle') => {
      clearRingTimer();
      if (pcRef.current) {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
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
      iceQueueRef.current = [];
      busyRef.current = false;
      setLocalStream(null);
      setRemoteStream(null);
      setStatus(nextStatus === 'idle' ? 'idle' : nextStatus);
      if (nextStatus === 'idle') {
        setActiveCall(null);
        setErrorCode(null);
      }
    },
    [clearRingTimer]
  );

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

  const flushIceQueue = useCallback(async (pc) => {
    const queue = [...iceQueueRef.current];
    iceQueueRef.current = [];
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        /* stale */
      }
    }
  }, []);

  const notifyCallEnd = useCallback(async (callId, reason) => {
    if (!callId) return;
    try {
      await api.post(`/api/calls/${callId}/end`, { reason });
    } catch {
      /* offline */
    }
  }, []);

  const sendHangup = useCallback(
    async (callId) => {
      if (!callId) return;
      try {
        await relaySignal(callId, 'hangup', { reason: 'ended' });
      } catch {
        /* ignore */
      }
    },
    [relaySignal]
  );

  const ensurePeerConnection = useCallback(async () => {
    if (pcRef.current) return pcRef.current;
    if (!iceServersRef.current) {
      iceServersRef.current = await fetchIceServers();
    }
    const pc = new RTCPeerConnection({
      iceServers: iceServersRef.current,
      iceCandidatePoolSize: 4,
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
        const exists = remoteStreamRef.current.getTracks().some((t) => t.id === track.id);
        if (!exists) remoteStreamRef.current.addTrack(track);
      });
      setRemoteStream(new MediaStream(remoteStreamRef.current.getTracks()));
    };
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        setStatus('connected');
        clearRingTimer();
      } else if (state === 'failed') {
        setErrorCode('connection_failed');
        setStatus('failed');
      } else if (state === 'disconnected') {
        setStatus('connecting');
      }
    };
    pcRef.current = pc;
    return pc;
  }, [relaySignal, clearRingTimer]);

  const attachLocalMedia = useCallback(
    async (video) => {
      const stream = await acquireCallMedia(video);
      localStreamRef.current = stream;
      setLocalStream(stream);
      const pc = await ensurePeerConnection();
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      return pc;
    },
    [ensurePeerConnection]
  );

  const addRemoteIce = useCallback(
    async (candidate) => {
      const pc = await ensurePeerConnection();
      if (!pc.remoteDescription) {
        iceQueueRef.current.push(candidate);
        return;
      }
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        /* ignore stale ice */
      }
    },
    [ensurePeerConnection]
  );

  const handleRemoteHangup = useCallback(() => {
    clearRingTimer();
    cleanup('ended');
  }, [cleanup, clearRingTimer]);

  const handleRemoteSignal = useCallback(
    async (callId, signalType, ciphertext, fromPeerId) => {
      if (signalType === 'hangup') {
        handleRemoteHangup();
        return;
      }

      const plaintext = await decryptMessage(ciphertext, { peerId: fromPeerId });
      const payload = JSON.parse(plaintext);
      const pc = await ensurePeerConnection();
      callIdRef.current = callId;

      if (signalType === 'offer') {
        if (busyRef.current) {
          await notifyCallEnd(callId, 'busy');
          return;
        }
        isCalleeRef.current = true;
        setActiveCall((prev) => prev || { id: callId });
        pendingOfferRef.current = payload.sdp;
        setStatus('incoming');
      } else if (signalType === 'answer') {
        await pc.setRemoteDescription(payload.sdp);
        await flushIceQueue(pc);
        setStatus('connected');
        clearRingTimer();
      } else if (signalType === 'ice' && payload.candidate) {
        await addRemoteIce(payload.candidate);
      }
    },
    [
      ensurePeerConnection,
      flushIceQueue,
      addRemoteIce,
      handleRemoteHangup,
      notifyCallEnd,
      clearRingTimer,
    ]
  );

  useUserSocket({
    userId: enabled ? userId : null,
    wsToken: enabled ? wsToken : null,
    onEvent: async (data) => {
      const payload = data?.payload || data;
      if (payload?.type === 'incoming_call' && payload.call) {
        if (busyRef.current) {
          await notifyCallEnd(payload.call.id, 'busy');
          return;
        }
        callIdRef.current = payload.call.id;
        isCalleeRef.current = true;
        setActiveCall(payload.call);
        setStatus('incoming');
      }
      if (payload?.type === 'call_ended' && payload.call_id === callIdRef.current) {
        const reason = payload.reason || 'ended';
        cleanup(reason === 'declined' ? 'declined' : reason === 'missed' ? 'missed' : 'ended');
      }
      if (payload?.type === 'call_signal' && payload.call_id) {
        const remotePeer = payload.from || peerId;
        if (payload.signal_type === 'hangup') {
          handleRemoteHangup();
          return;
        }
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
      if (busyRef.current) return;
      busyRef.current = true;
      setErrorCode(null);
      isCalleeRef.current = false;
      try {
        const data = await api.post('/api/calls', {
          conversation_id: conversationId,
          callee_id: peerId,
          video,
        });
        const call = data.call;
        callIdRef.current = call.id;
        setActiveCall({ ...call, video });
        setStatus('ringing');

        ringTimerRef.current = setTimeout(async () => {
          if (callIdRef.current === call.id) {
            await notifyCallEnd(call.id, 'missed');
            await sendHangup(call.id);
            setErrorCode('peer_unavailable');
            cleanup('missed');
          }
        }, RING_TIMEOUT_MS);

        const pc = await attachLocalMedia(video);
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: video });
        await pc.setLocalDescription(offer);
        await relaySignal(call.id, 'offer', { sdp: offer });
      } catch (err) {
        busyRef.current = false;
        const code = err?.message || 'media_unavailable';
        setErrorCode(code);
        setStatus('failed');
        if (callIdRef.current) {
          await notifyCallEnd(callIdRef.current, 'ended');
        }
        cleanup('failed');
      }
    },
    [
      conversationId,
      peerId,
      attachLocalMedia,
      relaySignal,
      notifyCallEnd,
      sendHangup,
      cleanup,
    ]
  );

  const answerCall = useCallback(async () => {
    if (!activeCall?.id || !pendingOfferRef.current) return;
    busyRef.current = true;
    setErrorCode(null);
    setStatus('connecting');
    try {
      const video = Boolean(activeCall.video);
      const pc = await attachLocalMedia(video);
      await pc.setRemoteDescription(pendingOfferRef.current);
      await flushIceQueue(pc);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await relaySignal(activeCall.id, 'answer', { sdp: answer });
      pendingOfferRef.current = null;
      setStatus('connected');
      clearRingTimer();
    } catch (err) {
      busyRef.current = false;
      setErrorCode(err?.message || 'media_unavailable');
      setStatus('failed');
      await notifyCallEnd(activeCall.id, 'ended');
      cleanup('failed');
    }
  }, [activeCall, attachLocalMedia, relaySignal, flushIceQueue, notifyCallEnd, cleanup, clearRingTimer]);

  const declineCall = useCallback(async () => {
    const callId = callIdRef.current || activeCall?.id;
    if (callId) {
      await notifyCallEnd(callId, 'declined');
      await sendHangup(callId);
    }
    cleanup('declined');
  }, [activeCall, notifyCallEnd, sendHangup, cleanup]);

  const endCall = useCallback(async () => {
    const callId = callIdRef.current || activeCall?.id;
    const activeStatuses = new Set(['ringing', 'incoming', 'connecting', 'connected']);
    if (callId && activeStatuses.has(status)) {
      await notifyCallEnd(callId, 'ended');
      await sendHangup(callId);
    }
    cleanup('idle');
  }, [activeCall, status, notifyCallEnd, sendHangup, cleanup]);

  const callOpen = status !== 'idle';

  return {
    activeCall,
    status,
    errorCode,
    errorMessage: errorCode ? callErrorMessage(errorCode) : null,
    localStream,
    remoteStream,
    callOpen,
    startCall,
    answerCall,
    declineCall,
    endCall,
    cleanup,
  };
}