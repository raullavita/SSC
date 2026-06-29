/** Broadcast list API + limits — Q.30 */

import { api } from './api';
import { getBackendUrl } from './platform';

export const DEFAULT_MAX_BROADCAST_LISTS = 20;
export const DEFAULT_MAX_BROADCAST_RECIPIENTS = 50;

let cachedLimits = null;

export async function fetchBroadcastListLimits() {
  if (cachedLimits) return cachedLimits;
  try {
    const res = await fetch(`${getBackendUrl()}/api/config`);
    const cfg = await res.json();
    const maxLists = Number(cfg?.broadcast_lists?.max_lists);
    const maxRecipients = Number(cfg?.broadcast_lists?.max_recipients);
    cachedLimits = {
      maxLists: Number.isFinite(maxLists) && maxLists > 0
        ? maxLists
        : DEFAULT_MAX_BROADCAST_LISTS,
      maxRecipients: Number.isFinite(maxRecipients) && maxRecipients > 0
        ? maxRecipients
        : DEFAULT_MAX_BROADCAST_RECIPIENTS,
    };
  } catch {
    cachedLimits = {
      maxLists: DEFAULT_MAX_BROADCAST_LISTS,
      maxRecipients: DEFAULT_MAX_BROADCAST_RECIPIENTS,
    };
  }
  return cachedLimits;
}

export async function listBroadcastLists() {
  const { data } = await api.get('/broadcast-lists');
  return data;
}

export async function createBroadcastList({ name, recipientIds }) {
  const { data } = await api.post('/broadcast-lists', {
    name,
    recipient_ids: recipientIds,
  });
  return data;
}

export async function updateBroadcastList(listId, patch) {
  const body = {};
  if (patch.name != null) body.name = patch.name;
  if (patch.recipientIds != null) body.recipient_ids = patch.recipientIds;
  const { data } = await api.patch(`/broadcast-lists/${listId}`, body);
  return data;
}

export async function deleteBroadcastList(listId) {
  const { data } = await api.delete(`/broadcast-lists/${listId}`);
  return data;
}

export function findDmConversation(conversations, recipientUserId) {
  return conversations.find(
    (c) => !c.is_group && c.peer?.user_id === recipientUserId,
  ) || null;
}

export function contactByUserId(contacts, userId) {
  return contacts.find((c) => c.user_id === userId) || null;
}

export function broadcastRecipientLabel(contacts, userId) {
  const contact = contactByUserId(contacts, userId);
  return contact ? `@${contact.username}` : userId;
}

export function clearBroadcastListLimitsCache() {
  cachedLimits = null;
}