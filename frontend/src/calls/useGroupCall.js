/**
 * Group call hook — mesh (≤8) or SFU (>8) — Engine 9/11.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { acquireCallMedia } from '../chat/callMedia';
import { useUserSocket } from '../hooks/useUserSocket';
import { decryptMessage, encryptMessage } from '../signal/signalBridge';
import { fetchIceServers } from './iceServers';
import { connectSfuRoom, createSfuRoom, endSfuRoom, fetchSfuConfig } from './sfuClient';

const MESH_MAX = 8;

export function useGroupCall({
  conversationId,
  participantCount,
  participantIds = [],
  userId,
  wsToken,
  enabled = true,
}) {
  const [call, setCall] = useState(null);
  const [mode, setMode] = useState(null);
  const [sfuRoom, setSfuRoom] = useState(null);
  const [sfuSession, setSfuSession] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const sessionRef = useRef(null);
  const sfuRoomRef = useRef(null);
  const remoteTracksRef = useRef(new Map());
  const pcsRef = useRef(new Map());
  const iceQueuesRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map());
  const localStreamRef = useRef(null);
  const iceServersRef = useRef(null);
  const callIdRef = useRef(null);
  const isCallerRef = useRef(false);
  const videoRef = useRef(false);

  const syncRemoteStreams = useCallback(() => {
    setRemoteStreams(Array.from(remoteStreamsRef.current.values()));
  }, []);

  const closeMeshPeers = useCallback(() => {
    pcsRef.current.forEach((pc) => {
      pc.onicecandidate = null;
      pc.ontrack = null;
      pc.close();
    });
    pcsRef.current.clear();
    iceQueuesRef.current.clear();
    remoteStreamsRef.current.clear();
    syncRemoteStreams();
  }, [syncRemoteStreams]);

  const cleanup = useCallback(() => {
    remoteTracksRef.current.forEach((stream) => {
      stream.getTracks().forEach((t) => t.stop());
    });
    remoteTracksRef.current.clear();
    closeMeshPeers();
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    setLocalStream(null);
    if (sessionRef.current?.close) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setSfuSession(null);
    setSfuRoom(null);
    sfuRoomRef.current = null;
    setCall(null);
    setMode(null);
    callIdRef.current = null;
    isCallerRef.current = false;
    setStatus('idle');
  }, [closeMeshPeers]);

  const endGroupCall = useCallback(async () => {
    const callId = callIdRef.current;
    if (callId) {
      try {
        await api.post(`/api/calls/${callId}/end`, { reason: 'ended' });
      } catch {
        /* offline */
      }
    }
    const roomId = sfuRoomRef.current?.room_id;
    if (roomId) {
      try {
        await endSfuRoom(roomId);
      } catch {
        /* local cleanup still runs */
      }
    }
    cleanup();
  }, [cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  const relayMeshSignal = useCallback(async (callId, targetPeerId, signalType, payloadObj) => {
    const plaintext = JSON.stringify(payloadObj);
    const { ciphertext, protocol } = await encryptMessage(plaintext, { peerId: targetPeerId });
    await api.post('/api/calls/signal', {
      call_id: callId,
      signal_type: signalType,
      ciphertext,
      protocol,
      target_peer_id: targetPeerId,
    });
  }, []);

  const flushIceQueue = useCallback(async (peerId, pc) => {
    const queue = [...(iceQueuesRef.current.get(peerId) || [])];
    iceQueuesRef.current.set(peerId, []);
    for (const candidate of queue) {
      try {
        await pc.addIceCandidate(candidate);
      } catch {
        /* stale */
      }
    }
  }, []);

  const getOrCreatePc = useCallback(
    async (peerId) => {
      if (pcsRef.current.has(peerId)) return pcsRef.current.get(peerId);
      if (!iceServersRef.current) {
        iceServersRef.current = await fetchIceServers();
      }
      const pc = new RTCPeerConnection({
        iceServers: iceServersRef.current,
        iceCandidatePoolSize: 4,
      });
      pc.onicecandidate = (event) => {
        if (!event.candidate || !callIdRef.current) return;
        relayMeshSignal(callIdRef.current, peerId, 'ice', { candidate: event.candidate }).catch(
          () => {}
        );
      };
      pc.ontrack = (event) => {
        const stream = event.streams?.[0] || new MediaStream([event.track]);
        remoteStreamsRef.current.set(peerId, stream);
        syncRemoteStreams();
      };
      pcsRef.current.set(peerId, pc);
      if (localStreamRef.current) {
        localStreamRef.current
          .getTracks()
          .forEach((track) => pc.addTrack(track, localStreamRef.current));
      }
      return pc;
    },
    [relayMeshSignal, syncRemoteStreams]
  );

  const handleRemoteMeshSignal = useCallback(
    async (callId, fromPeerId, signalType, ciphertext) => {
      if (signalType === 'hangup') {
        cleanup();
        return;
      }
      const plaintext = await decryptMessage(ciphertext, { peerId: fromPeerId });
      const payload = JSON.parse(plaintext);
      const pc = await getOrCreatePc(fromPeerId);
      callIdRef.current = callId;

      if (signalType === 'offer') {
        await pc.setRemoteDescription(payload.sdp);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await relayMeshSignal(callId, fromPeerId, 'answer', { sdp: answer });
        await flushIceQueue(fromPeerId, pc);
        setStatus('connected');
      } else if (signalType === 'answer') {
        await pc.setRemoteDescription(payload.sdp);
        await flushIceQueue(fromPeerId, pc);
        setStatus('connected');
      } else if (signalType === 'ice' && payload.candidate) {
        if (!pc.remoteDescription) {
          const queue = iceQueuesRef.current.get(fromPeerId) || [];
          queue.push(payload.candidate);
          iceQueuesRef.current.set(fromPeerId, queue);
          return;
        }
        try {
          await pc.addIceCandidate(payload.candidate);
        } catch {
          /* stale */
        }
      }
    },
    [cleanup, flushIceQueue, getOrCreatePc, relayMeshSignal]
  );

  const startMeshOffers = useCallback(
    async (callId, remotePeers, video) => {
      const stream = await acquireCallMedia(video);
      localStreamRef.current = stream;
      setLocalStream(stream);
      for (const peerId of remotePeers) {
        const pc = await getOrCreatePc(peerId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await relayMeshSignal(callId, peerId, 'offer', { sdp: offer });
      }
      setStatus('connected');
    },
    [getOrCreatePc, relayMeshSignal]
  );

  const handleRemoteTrack = useCallback(({ producerId, track }) => {
    let stream = remoteTracksRef.current.get(producerId);
    if (!stream) {
      stream = new MediaStream();
      remoteTracksRef.current.set(producerId, stream);
    }
    stream.addTrack(track);
    setRemoteStreams(Array.from(remoteTracksRef.current.values()));
  }, []);

  useUserSocket({
    userId: enabled ? userId : null,
    wsToken: enabled ? wsToken : null,
    onEvent: async (data) => {
      const payload = data?.payload || data;
      if (payload?.type === 'incoming_call' && payload.call?.group_call) {
        callIdRef.current = payload.call.id;
        isCallerRef.current = false;
        setCall(payload.call);
        setMode(payload.call.mode || 'mesh');
        setStatus('incoming');
      }
      if (payload?.type === 'call_signal' && payload.call_id && payload.from) {
        await handleRemoteMeshSignal(
          payload.call_id,
          payload.from,
          payload.signal_type,
          payload.ciphertext
        );
      }
      if (payload?.type === 'call_ended' && payload.call_id === callIdRef.current) {
        cleanup();
      }
    },
  });

  const startGroupCall = useCallback(
    async (video = false) => {
      if (!conversationId) return null;
      setError(null);
      setStatus('starting');
      videoRef.current = video;
      try {
        const useSfu = participantCount > MESH_MAX;
        if (useSfu) {
          const cfg = await fetchSfuConfig();
          if (!cfg.enabled) {
            throw new Error('SFU not enabled on server');
          }
          await fetchIceServers();
          const room = await createSfuRoom(conversationId, participantCount);
          setSfuRoom(room);
          sfuRoomRef.current = room;
          setMode('sfu');

          let stream = null;
          if (navigator.mediaDevices?.getUserMedia) {
            try {
              stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
              setLocalStream(stream);
            } catch {
              stream = null;
            }
          }

          const conn = await connectSfuRoom({
            wsUrl: room.ws_url,
            roomId: room.room_id,
            joinToken: room.join_token,
            peerId: userId,
            localStream: stream,
            onRemoteTrack: handleRemoteTrack,
          });
          if (!conn.connected) {
            throw new Error(conn.reason || 'sfu_connect_failed');
          }
          sessionRef.current = conn.session;
          setSfuSession(conn.session);
          setStatus('connected');
          return { ...room, sfuConnected: true };
        }

        const remotePeers = participantIds.filter((id) => id && id !== userId);
        if (remotePeers.length === 0) {
          throw new Error('group_call_needs_participants');
        }

        const data = await api.post('/api/calls', {
          conversation_id: conversationId,
          group_call: true,
          video,
        });
        const startedCall = data.call;
        callIdRef.current = startedCall.id;
        isCallerRef.current = true;
        setCall(startedCall);
        setMode(data.mode || 'mesh');
        await startMeshOffers(startedCall.id, remotePeers, video);
        return data;
      } catch (e) {
        setError(e.message || 'Failed to start group call');
        setStatus('error');
        cleanup();
        return null;
      }
    },
    [
      conversationId,
      participantCount,
      participantIds,
      userId,
      handleRemoteTrack,
      cleanup,
      startMeshOffers,
    ]
  );

  const answerGroupCall = useCallback(async () => {
    if (!callIdRef.current || isCallerRef.current) return null;
    setError(null);
    setStatus('connecting');
    try {
      const stream = await acquireCallMedia(videoRef.current || Boolean(call?.video));
      localStreamRef.current = stream;
      setLocalStream(stream);
      pcsRef.current.forEach((pc) => {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream));
      });
      setStatus('connected');
      return { ok: true };
    } catch (e) {
      setError(e.message || 'Failed to join group call');
      setStatus('error');
      return null;
    }
  }, [call?.video]);

  const declineGroupCall = useCallback(async () => {
    const callId = callIdRef.current;
    if (callId) {
      try {
        await api.post(`/api/calls/${callId}/end`, { reason: 'declined' });
      } catch {
        /* ignore */
      }
    }
    cleanup();
  }, [cleanup]);

  const joinGroupCall = useCallback(
    async (room, video = false) => {
      if (!room?.room_id || !room?.join_token) return null;
      setError(null);
      setStatus('joining');
      try {
        await fetchIceServers();
        let stream = null;
        if (navigator.mediaDevices?.getUserMedia) {
          try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true, video });
            setLocalStream(stream);
          } catch {
            stream = null;
          }
        }
        const conn = await connectSfuRoom({
          wsUrl: room.ws_url,
          roomId: room.room_id,
          joinToken: room.join_token,
          peerId: userId,
          localStream: stream,
          onRemoteTrack: handleRemoteTrack,
        });
        if (!conn.connected) {
          throw new Error(conn.reason || 'sfu_join_failed');
        }
        sessionRef.current = conn.session;
        setSfuSession(conn.session);
        setSfuRoom(room);
        sfuRoomRef.current = room;
        setMode('sfu');
        setStatus('connected');
        return conn;
      } catch (e) {
        setError(e.message || 'Failed to join group call');
        setStatus('error');
        return null;
      }
    },
    [userId, handleRemoteTrack]
  );

  return {
    call,
    mode,
    sfuRoom,
    sfuSession,
    localStream,
    remoteStreams,
    status,
    startGroupCall,
    joinGroupCall,
    answerGroupCall,
    declineGroupCall,
    endGroupCall,
    error,
    callOpen:
      status === 'connected' ||
      status === 'joining' ||
      status === 'starting' ||
      status === 'incoming' ||
      status === 'connecting',
  };
}