import { useEffect, useMemo, useState } from 'react';

function isExpired(message) {
  if (!message?.expires_at) return false;
  return new Date(message.expires_at).getTime() <= Date.now();
}

function secondsRemaining(message) {
  if (!message?.expires_at) return null;
  const ms = new Date(message.expires_at).getTime() - Date.now();
  if (ms <= 0) return 0;
  return Math.ceil(ms / 1000);
}

export function useDisappearingMessages(messages, setMessages) {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const hasDisappearing = messages.some((m) => m.expires_at || m.disappearing_seconds);
    if (!hasDisappearing) return undefined;
    const timer = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(timer);
  }, [messages]);

  useEffect(() => {
    const expired = messages.filter(isExpired);
    if (expired.length === 0) return;
    const expiredIds = new Set(expired.map((m) => m.id));
    setMessages((prev) => prev.filter((m) => !expiredIds.has(m.id)));
  }, [messages, setMessages, tick]);

  const remainingById = useMemo(() => {
    const map = {};
    for (const m of messages) {
      if (m.expires_at || m.disappearing_seconds) {
        map[m.id] = secondsRemaining(m);
      }
    }
    return map;
  }, [messages, tick]);

  return { remainingById };
}