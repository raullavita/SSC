import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

const DEBOUNCE_MS = 400;
const STOP_MS = 3000;

export function useTypingIndicator({ conversationId, userId, enabled = true }) {
  const [peerTyping, setPeerTyping] = useState(false);
  const timerRef = useRef(null);
  const stopRef = useRef(null);
  const activeRef = useRef(false);

  const handleSocketPayload = useCallback(
    (data) => {
      const payload = data?.payload || data;
      if (payload?.type !== 'typing') return;
      if (payload.user_id === userId) return;
      setPeerTyping(Boolean(payload.active));
      if (payload.active) {
        clearTimeout(stopRef.current);
        stopRef.current = setTimeout(() => setPeerTyping(false), STOP_MS);
      }
    },
    [userId]
  );

  const notifyTyping = useCallback(
    (active) => {
      if (!conversationId || !enabled) return;
      api.post(`/api/conversations/${conversationId}/typing`, { active }).catch(() => {});
    },
    [conversationId, enabled]
  );

  const onDraftChange = useCallback(
    (text) => {
      if (!conversationId || !enabled) return;
      const isActive = Boolean(text?.trim());
      if (!isActive) {
        if (activeRef.current) {
          activeRef.current = false;
          notifyTyping(false);
        }
        return;
      }
      clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        if (!activeRef.current) {
          activeRef.current = true;
          notifyTyping(true);
        }
        clearTimeout(stopRef.current);
        stopRef.current = setTimeout(() => {
          activeRef.current = false;
          notifyTyping(false);
        }, STOP_MS);
      }, DEBOUNCE_MS);
    },
    [conversationId, enabled, notifyTyping]
  );

  useEffect(() => {
    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(stopRef.current);
      if (activeRef.current) notifyTyping(false);
    };
  }, [conversationId, notifyTyping]);

  return { peerTyping, onDraftChange, handleSocketPayload };
}