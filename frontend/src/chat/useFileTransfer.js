import { useCallback, useState } from 'react';
import { api } from '../lib/api';
import { encryptFileBytes } from '../signal/signalBridge';

export function useFileTransfer(conversationId) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const uploadFile = useCallback(
    async (file) => {
      if (!conversationId || !file) return null;
      setUploading(true);
      setError(null);
      try {
        const buffer = await file.arrayBuffer();
        const { ciphertext, protocol } = await encryptFileBytes(buffer);
        const data = await api.post('/api/files', {
          conversation_id: conversationId,
          ciphertext,
          protocol,
          mime_hint: file.type || 'application/octet-stream',
        });
        return data.file;
      } catch (e) {
        setError(e.message || 'Upload failed');
        return null;
      } finally {
        setUploading(false);
      }
    },
    [conversationId]
  );

  const downloadFile = useCallback(async (fileId) => {
    const data = await api.get(`/api/files/${fileId}`);
    return data.file;
  }, []);

  return { uploadFile, downloadFile, uploading, error };
}