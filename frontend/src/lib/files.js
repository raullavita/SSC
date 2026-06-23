/**
 * Authenticated file fetch — Engine 2 Step 2.3.
 * JWT is sent via Authorization header only (never in URLs).
 */
import { api } from './api';

export async function fetchFileBlob(fileId) {
  const { data } = await api.get(`/files/${fileId}`, { responseType: 'blob' });
  return data;
}

export async function fetchFileBytes(fileId) {
  const { data } = await api.get(`/files/${fileId}`, { responseType: 'arraybuffer' });
  return new Uint8Array(data);
}