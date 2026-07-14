/**
 * Unified WebSocket sync — single connection, multiple topic subscriptions.
 * Replaces separate useChatSocket / useUserSocket / useReadReceipts WS / useUserConversationSync.
 */

import { useEffect, useRef } from 'react';
import { wsAuthPayload, wsUrl } from '../lib/api';
import { buildSubscribePayload } from '../lib/wsSubscribe';

const listeners = new Set();
let sharedWs = null;
let sharedUserId = null;
let sharedWsToken = null;
let subscribedTopics = new Set();
let connectPromise = null;
let reconnectTimer = null;
let reconnectAttempt = 0;

function normalizePayload(data) {
  return data?.payload || data;
}

function dispatch(raw) {
  let data;
  try {
    data = typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return;
  }
  const payload = normalizePayload(data);
  const envelope = { raw: data, payload, topic: data?.topic || null };
  listeners.forEach((fn) => {
    try {
      fn(envelope);
    } catch {
      /* listener error */
    }
  });
}

function clearReconnectTimer() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect() {
  if (!listeners.size || !sharedUserId) return;
  if (reconnectTimer) return;
  const delay = Math.min(30_000, 500 * 2 ** reconnectAttempt);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    openSharedSocket(sharedUserId, sharedWsToken)
      .then(() => ensureTopics([...subscribedTopics]))
      .catch(() => scheduleReconnect());
  }, delay);
}

async function ensureTopics(topics) {
  if (!sharedWs || sharedWs.readyState !== WebSocket.OPEN) return;
  for (const topic of topics) {
    if (subscribedTopics.has(topic)) continue;
    sharedWs.send(await buildSubscribePayload(topic));
    subscribedTopics.add(topic);
  }
}

function closeSharedSocket() {
  clearReconnectTimer();
  if (sharedWs) {
    sharedWs.close();
    sharedWs = null;
  }
  subscribedTopics = new Set();
  connectPromise = null;
}

async function openSharedSocket(userId, wsToken) {
  if (sharedWs && sharedUserId === userId && sharedWsToken === wsToken) {
    if (sharedWs.readyState === WebSocket.OPEN) return sharedWs;
    if (sharedWs.readyState === WebSocket.CONNECTING && connectPromise) return connectPromise;
  }
  if (connectPromise) return connectPromise;

  closeSharedSocket();
  sharedUserId = userId;
  sharedWsToken = wsToken;

  connectPromise = new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl());
    sharedWs = ws;

    ws.onopen = () => {
      reconnectAttempt = 0;
      const auth = wsAuthPayload(wsToken);
      if (auth) ws.send(auth);
      connectPromise = null;
      resolve(ws);
    };

    ws.onmessage = (event) => dispatch(event.data);

    ws.onerror = () => {
      connectPromise = null;
      reject(new Error('sync_socket_error'));
    };

    ws.onclose = () => {
      if (sharedWs === ws) {
        sharedWs = null;
        subscribedTopics = new Set();
      }
      connectPromise = null;
      if (listeners.size && sharedUserId === userId) {
        scheduleReconnect();
      }
    };
  });

  return connectPromise;
}

/**
 * Subscribe to one or more WS topics on the shared sync socket.
 * @param {{ userId, wsToken, topics: string[], onEvent, enabled?: boolean }} opts
 */
export function useSyncSocket({ userId, wsToken, topics = [], onEvent, enabled = true }) {
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;
  const topicsKey = [...topics].sort().join('|');

  useEffect(() => {
    if (!enabled || !userId) return undefined;

    const listener = (envelope) => onEventRef.current?.(envelope);
    listeners.add(listener);

    let cancelled = false;
    (async () => {
      try {
        await openSharedSocket(userId, wsToken);
        if (!cancelled) await ensureTopics(topics);
      } catch {
        if (!cancelled) scheduleReconnect();
      }
    })();

    return () => {
      cancelled = true;
      listeners.delete(listener);
      if (listeners.size === 0) {
        closeSharedSocket();
        sharedUserId = null;
        sharedWsToken = null;
        reconnectAttempt = 0;
      }
    };
  }, [enabled, userId, wsToken, topicsKey]);
}

export function __resetSyncSocketForTests() {
  listeners.clear();
  closeSharedSocket();
  sharedUserId = null;
  sharedWsToken = null;
  reconnectAttempt = 0;
}