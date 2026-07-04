/**
 * Group call hook — mesh (≤8) or SFU (>8) — Engine 9/11.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { connectSfuRoom, createSfuRoom, fetchSfuConfig } from './sfuClient';

const MESH_MAX = 8;

export function useGroupCall({ conversationId, participantCount }) {
  const [call, setCall] = useState(null);
  const [mode, setMode] = useState(null);
  const [sfuRoom, setSfuRoom] = useState(null);
  const [sfuSession, setSfuSession] = useState(null);
  const [error, setError] = useState(null);
  const sessionRef = useRef(null);

  useEffect(() => {
    return () => {
      if (sessionRef.current?.close) {
        sessionRef.current.close();
      }
    };
  }, []);

  const startGroupCall = useCallback(
    async (video = false) => {
      if (!conversationId) return null;
      setError(null);
      try {
        const useSfu = participantCount > MESH_MAX;
        if (useSfu) {
          const cfg = await fetchSfuConfig();
          if (!cfg.enabled) {
            throw new Error('SFU not enabled on server');
          }
          const room = await createSfuRoom(conversationId, participantCount);
          setSfuRoom(room);
          setMode('sfu');

          let localStream = null;
          if (navigator.mediaDevices?.getUserMedia) {
            try {
              localStream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video,
              });
            } catch {
              localStream = null;
            }
          }

          const conn = await connectSfuRoom({
            wsUrl: room.ws_url,
            roomId: room.room_id,
            joinToken: room.join_token,
            localStream,
          });
          if (!conn.connected) {
            throw new Error(conn.reason || 'sfu_connect_failed');
          }
          sessionRef.current = conn.session;
          setSfuSession(conn.session);
          return { ...room, sfuConnected: true };
        }

        const data = await api.post('/api/calls', {
          conversation_id: conversationId,
          group_call: true,
          video,
        });
        setCall(data.call);
        setMode(data.mode || 'mesh');
        return data;
      } catch (e) {
        setError(e.message || 'Failed to start group call');
        return null;
      }
    },
    [conversationId, participantCount]
  );

  return { call, mode, sfuRoom, sfuSession, startGroupCall, error };
}