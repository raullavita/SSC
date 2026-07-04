/**
 * Group call hook — mesh (≤8) or SFU (>8) — Engine 9/11.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { fetchIceServers } from './iceServers';
import { connectSfuRoom, createSfuRoom, fetchSfuConfig } from './sfuClient';

const MESH_MAX = 8;

export function useGroupCall({ conversationId, participantCount, userId }) {
  const [call, setCall] = useState(null);
  const [mode, setMode] = useState(null);
  const [sfuRoom, setSfuRoom] = useState(null);
  const [sfuSession, setSfuSession] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState([]);
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);
  const sessionRef = useRef(null);
  const remoteTracksRef = useRef(new Map());

  const cleanup = useCallback(() => {
    remoteTracksRef.current.forEach((stream) => {
      stream.getTracks().forEach((t) => t.stop());
    });
    remoteTracksRef.current.clear();
    setRemoteStreams([]);
    if (localStream) {
      localStream.getTracks().forEach((t) => t.stop());
      setLocalStream(null);
    }
    if (sessionRef.current?.close) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setSfuSession(null);
    setSfuRoom(null);
    setCall(null);
    setMode(null);
    setStatus('idle');
  }, [localStream]);

  useEffect(() => () => cleanup(), [cleanup]);

  const handleRemoteTrack = useCallback(({ producerId, track }) => {
    let stream = remoteTracksRef.current.get(producerId);
    if (!stream) {
      stream = new MediaStream();
      remoteTracksRef.current.set(producerId, stream);
    }
    stream.addTrack(track);
    setRemoteStreams(Array.from(remoteTracksRef.current.values()));
  }, []);

  const startGroupCall = useCallback(
    async (video = false) => {
      if (!conversationId) return null;
      setError(null);
      setStatus('starting');
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

        const data = await api.post('/api/calls', {
          conversation_id: conversationId,
          group_call: true,
          video,
        });
        setCall(data.call);
        setMode(data.mode || 'mesh');
        setStatus('connected');
        return data;
      } catch (e) {
        setError(e.message || 'Failed to start group call');
        setStatus('error');
        cleanup();
        return null;
      }
    },
    [conversationId, participantCount, userId, handleRemoteTrack, cleanup]
  );

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
    endGroupCall: cleanup,
    error,
    callOpen: status === 'connected' || status === 'joining' || status === 'starting',
  };
}