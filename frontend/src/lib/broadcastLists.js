import { api } from './api';

export async function listBroadcastLists() {
  const data = await api.get('/api/broadcast_lists');
  return data.broadcast_lists || [];
}

export async function createBroadcastList({ name, recipientIds }) {
  const data = await api.post('/api/broadcast_lists', {
    name,
    recipient_ids: recipientIds,
  });
  return data.broadcast_list;
}

export async function updateBroadcastList(listId, { name, recipientIds }) {
  const body = {};
  if (name != null) body.name = name;
  if (recipientIds != null) body.recipient_ids = recipientIds;
  const data = await api.patch(`/api/broadcast_lists/${encodeURIComponent(listId)}`, body);
  return data.broadcast_list;
}

export async function deleteBroadcastList(listId) {
  return api.delete(`/api/broadcast_lists/${encodeURIComponent(listId)}`);
}