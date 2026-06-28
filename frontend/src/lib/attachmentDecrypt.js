import { useEffect, useState } from 'react';
import { decryptBytes } from './crypto';
import { fetchFileBytes } from './files';
import { registerBlobUrl, subscribeMemoryWipe, unregisterBlobUrl } from './memoryWipe';
import {
  decryptAttachmentBytes,
  decryptSignalAttachmentBody,
  isSignalV1AttachmentMessage,
  parseSignalAttachmentEnvelope,
} from './signal/attachments';
import { decryptGroupText } from './signal/groupMessages';
import { signalRemoteUserId } from './signal/messages';

export async function decryptAttachment(msg, fileId, privateKey, myUserId, peerUserId) {
  const cipher = await fetchFileBytes(fileId);
  if (isSignalV1AttachmentMessage(msg)) {
    let meta;
    if (msg.protocol === 'signal_group_v1') {
      const senderId = msg.sender_id;
      if (!senderId || !myUserId) throw new Error('NO_KEY');
      const envelopeText = await decryptGroupText(senderId, msg);
      meta = parseSignalAttachmentEnvelope(envelopeText);
    } else {
      const remoteId = signalRemoteUserId(msg, { myUserId, peerUserId });
      if (!remoteId || !myUserId) throw new Error('NO_KEY');
      meta = await decryptSignalAttachmentBody(remoteId, myUserId, msg);
    }
    if (!meta) throw new Error('DECRYPT_FAIL');
    const plain = await decryptAttachmentBytes(cipher, meta);
    const mime = meta.content_type || msg.attachment_content_type || 'application/octet-stream';
    return new Blob([plain], { type: mime });
  }
  const key = msg.attachment_encrypted_keys?.[myUserId];
  if (!key || !privateKey) throw new Error('NO_KEY');
  const plain = await decryptBytes(privateKey, cipher, msg.attachment_iv, key);
  const mime = msg.attachment_content_type || 'application/octet-stream';
  return new Blob([plain], { type: mime });
}

export function useDecryptedAttachment(msg, fileId, privateKey, myUserId, peerUserId) {
  const [objectUrl, setObjectUrl] = useState(null);
  const [blob, setBlob] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const needsVault = !isSignalV1AttachmentMessage(msg);

  useEffect(() => {
    let mounted = true;
    let url = null;
    (async () => {
      if (needsVault && !privateKey) { setLoading(false); return; }
      try {
        const decrypted = await decryptAttachment(msg, fileId, privateKey, myUserId, peerUserId);
        url = URL.createObjectURL(decrypted);
        registerBlobUrl(url);
        if (mounted) {
          setObjectUrl(url);
          setBlob(decrypted);
          setError(null);
        }
      } catch (e) {
        if (mounted) setError(e?.message === 'NO_KEY' ? 'NO_KEY' : 'DECRYPT_FAIL');
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    const unsubWipe = subscribeMemoryWipe(() => {
      if (url) unregisterBlobUrl(url);
      url = null;
      setObjectUrl(null);
      setBlob(null);
      setError(null);
      setLoading(false);
    });
    return () => {
      mounted = false;
      unsubWipe();
      if (url) unregisterBlobUrl(url);
    };
  }, [msg, fileId, privateKey, myUserId, peerUserId, needsVault]);

  return { objectUrl, blob, error, loading };
}