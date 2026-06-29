/**
 * Android notification inline-reply — queue native text, encrypt and send in JS (Q.43).
 */
import { registerPlugin } from '@capacitor/core';
import { getPlatform, isNativeApp } from './platform';

export const PENDING_REPLY_SESSION_KEY = 'ssc_pending_reply';

const SscNotificationReply = registerPlugin('SscNotificationReply');

let initialized = false;
let replyHandler = null;

export function setNotificationReplyHandler(handler) {
  replyHandler = handler;
}

export function queueNotificationReplyFallback(conversationId, text) {
  if (!conversationId || !text?.trim()) return;
  sessionStorage.setItem(
    PENDING_REPLY_SESSION_KEY,
    JSON.stringify({ conversationId, text: text.trim() }),
  );
  const target = `/chat/${conversationId}`;
  if (!window.location.pathname.startsWith(target)) {
    window.location.assign(target);
  } else {
    window.dispatchEvent(new CustomEvent('ssc-pending-reply-draft', {
      detail: { conversationId, text: text.trim() },
    }));
  }
}

export function peekPendingReplyDraft() {
  const raw = sessionStorage.getItem(PENDING_REPLY_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed?.conversationId || !parsed?.text) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingReplyDraft() {
  sessionStorage.removeItem(PENDING_REPLY_SESSION_KEY);
}

async function processReplyPayload({ conversationId, text }) {
  if (!conversationId || !text?.trim()) return;
  await SscNotificationReply.clearPendingReply().catch(() => {});

  if (!replyHandler) {
    queueNotificationReplyFallback(conversationId, text);
    return;
  }

  const result = await replyHandler({ conversationId, text: text.trim() });
  if (!result?.sent) {
    queueNotificationReplyFallback(conversationId, text);
  } else {
    clearPendingReplyDraft();
  }
}

export async function drainPendingNotificationReplies() {
  if (!isNativeApp() || getPlatform() !== 'android') return;
  try {
    const pending = await SscNotificationReply.getPendingReply();
    if (pending?.conversationId && pending?.text) {
      await processReplyPayload(pending);
      return;
    }
    const draft = peekPendingReplyDraft();
    if (draft && replyHandler) {
      const result = await replyHandler(draft);
      if (result?.sent) clearPendingReplyDraft();
    }
  } catch (e) {
    console.warn('[SSC] drain pending notification reply failed', e);
  }
}

export async function initNotificationReply() {
  if (!isNativeApp() || getPlatform() !== 'android') return;
  if (initialized) return;
  initialized = true;

  try {
    await SscNotificationReply.addListener('notificationReply', async (event) => {
      await processReplyPayload(event || {});
    });
    await drainPendingNotificationReplies();
  } catch (e) {
    console.warn('[SSC] notification reply init failed', e);
  }
}