/**
 * Unified WebSocket sync — single connection, multiple topic subscriptions.
 * Replaces separate useChatSocket / useUserSocket / useReadReceipts WS / useUserConversationSync.
 */

import { useEffect, useRef } from 'react';
import { wsAuthPayload, wsUrl } from '../lib/api';
import { buildSubscribePayload, buildUnsubscribePayload } from '../lib/wsSubscribe';

const listeners = new Set();
const listenerTopics = new Map();
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
      .then(() => syncTopicSubscriptions())
      .catch(() => scheduleReconnect());
  }, delay);
}

function neededTopics() {
  const needed = new Set();
  listenerTopics.forEach((topics) => {
    topics.forEach((topic) => needed.add(topic));
  });
  return needed;
}

async function syncTopicSubscriptions() {
  if (!sharedWs || sharedWs.readyState !== WebSocket.OPEN) return;
  const needed = neededTopics();

  for (const topic of subscribedTopics) {
    if (!needed.has(topic)) {
      sharedWs.send(buildUnsubscribePayload(topic));
      subscribedTopics.delete(topic);
    }
  }

  for (const topic of needed) {
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

    const allowedTopics = new Set(topics);
    const listener = (envelope) => {
      const topic = envelope.topic;
      if (allowedTopics.size && topic && !allowedTopics.has(topic)) return;
      onEventRef.current?.(envelope);
    };
    listeners.add(listener);
    listenerTopics.set(listener, new Set(topics));

    let cancelled = false;
    (async () => {
      try {
        await openSharedSocket(userId, wsToken);
        if (!cancelled) await syncTopicSubscriptions();
      } catch {
        if (!cancelled) scheduleReconnect();
      }
    })();

    return () => {
      cancelled = true;
      listeners.delete(listener);
      listenerTopics.delete(listener);
      if (listeners.size === 0) {
        closeSharedSocket();
        sharedUserId = null;
        sharedWsToken = null;
        reconnectAttempt = 0;
      } else if (sharedWs?.readyState === WebSocket.OPEN) {
        syncTopicSubscriptions().catch(() => {});
      }
    };
  }, [enabled, userId, wsToken, topicsKey]);
}

export function __resetSyncSocketForTests() {
  listeners.clear();
  listenerTopics.clear();
  closeSharedSocket();
  sharedUserId = null;
  sharedWsToken = null;
  reconnectAttempt = 0;
}