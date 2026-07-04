import { useCallback, useState } from 'react';
import { api } from '../lib/api';
import { encryptFileBytes } from '../signal/signalBridge';
import { sendAttachmentMessage } from './attachments';

export function useFileTransfer(conversationId, peerId) {
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
        const fileDoc = data.file;
        await sendAttachmentMessage(conversationId, {
          fileId: fileDoc.id,
          mime: file.type || 'application/octet-stream',
          name: file.name,
          size: file.size,
          peerId,
        });
        return fileDoc;
      } catch (e) {
        setError(e.message || 'Upload failed');
        return null;
      } finally {
        setUploading(false);
      }
    },
    [conversationId, peerId]
  );

  const downloadFile = useCallback(async (fileId) => {
    const data = await api.get(`/api/files/${fileId}`);
    return data.file;
  }, []);

  return { uploadFile, downloadFile, uploading, error };
}