/** Edit sent message — Q.9 (15-minute window, text only). */

import { isMessageDeleted } from './messageDelete';

export const EDIT_WINDOW_MINUTES = 15;
const EDIT_WINDOW_MS = EDIT_WINDOW_MINUTES * 60 * 1000;

export function messageCreatedAt(msg) {
  if (!msg?.created_at) return null;
  const d = new Date(msg.created_at);
  return Number.isFinite(d.getTime()) ? d : null;
}

export function messageWithinEditWindow(msg, now = Date.now()) {
  const created = messageCreatedAt(msg);
  if (!created) return false;
  return now - created.getTime() <= EDIT_WINDOW_MS;
}

export function isEditableTextMessage(msg) {
  if (!msg) return false;
  if (isMessageDeleted(msg)) return false;
  if (msg.message_type !== 'text') return false;
  if (msg.attachment_id) return false;
  return true;
}

export function canEditMessage(msg, userId) {
  if (!msg || !userId) return false;
  if (!isEditableTextMessage(msg)) return false;
  if (msg.sender_id !== userId) return false;
  if (!messageWithinEditWindow(msg)) return false;
  if (msg.expires_at) {
    const exp = new Date(msg.expires_at);
    if (Number.isFinite(exp.getTime()) && exp <= new Date()) return false;
  }
  return true;
}

export function applyMessageEdited(messages, editedMsg) {
  if (!editedMsg?.message_id || !Array.isArray(messages)) return messages;
  return messages.map((m) => (
    m.message_id === editedMsg.message_id ? { ...m, ...editedMsg } : m
  ));
}