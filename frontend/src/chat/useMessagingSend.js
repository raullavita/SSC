import { useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { encryptBytesForRecipients, encryptMessageForRecipients, b64ToBytes } from '../lib/crypto';
import { evaluateMessagingGate } from './messagingGate';
import { toastEncryptFailure, toastMessagingGateFailure } from './messagingErrors';
import { usesSignalOnlyMessaging } from '../lib/signal/installedMessaging';
import { maySendLegacyRsa } from '../lib/signal/legacyRsaPolicy';
import { encryptAttachmentBytes, encryptSignalAttachment } from '../lib/signal/attachments';
import { ensureGroupSenderKeysDistributed, encryptGroupText } from '../lib/signal/groupMessages';
import { encryptSignalText } from '../lib/signal/messages';
import { ProtocolVersion } from '../lib/signal/constants';
import {
  MIN_VOICE_BLOB_BYTES,
  startVoiceRecording,
  voiceFilenameForMime,
} from '../lib/voiceRecorder';
import { ensureMediaPermissions } from '../lib/mediaPermissions';
import { isPeerBlocked } from '../lib/contactFilters';

export function useMessagingSend({
  activeConv,
  activeId,
  isGroup,
  peer,
  user,
  privateKey,
  myContacts,
  canMessagePeer,
  isRequestPendingPeer,
  recipientsForActive,
  refreshUser,
  setDraft,
  setUploadBusy,
  uploadBusy,
  replyTo,
  setReplyTo,
  t,
}) {
  const voiceRecordingRef = useRef(null);

  const runMessagingGate = useCallback(async () => {
    const gate = await evaluateMessagingGate({
      isGroup,
      peer,
      user,
      members: activeConv?.members || [],
      refreshUser,
    });
    if (usesSignalOnlyMessaging() && !gate.ok) {
      toastMessagingGateFailure(gate, t);
      return null;
    }
    if (!usesSignalOnlyMessaging() && !privateKey && !gate.ok) {
      toast.error(t('encryptionNotReady'));
      return null;
    }
    return gate;
  }, [activeConv, isGroup, peer, user, privateKey, refreshUser, t]);

  const uploadEncryptedAttachment = useCallback(async (blob, filename, mimeType) => {
    const raw = await blob.arrayBuffer();
    const gate = await runMessagingGate();
    if (!gate) throw new Error('encryption_not_ready');
    const useSignal = gate.useSignal;

    let enc;
    if (useSignal) {
      enc = await encryptAttachmentBytes(raw);
    } else {
      const recipients = recipientsForActive;
      if (Object.keys(recipients).length < 2) {
        throw new Error('No recipients have encryption keys yet');
      }
      enc = await encryptBytesForRecipients(raw, recipients);
    }

    const cipherBlob = new Blob([b64ToBytes(enc.ciphertext)], { type: 'application/octet-stream' });
    const form = new FormData();
    form.append('file', cipherBlob, `${filename}.enc`);
    form.append('encrypted', 'true');
    if (mimeType) form.append('original_content_type', mimeType);
    const { data } = await api.post('/files/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
    const contentType = mimeType || 'application/octet-stream';

    if (useSignal) {
      return {
        fileId: data.file_id,
        attachmentEnc: {
          content_type: contentType,
          signal_meta: {
            file_id: data.file_id,
            iv: enc.iv,
            key: enc.key,
            content_type: contentType,
            caption: filename,
          },
        },
      };
    }

    return {
      fileId: data.file_id,
      attachmentEnc: {
        iv: enc.iv,
        encrypted_keys: enc.encrypted_keys,
        content_type: contentType,
      },
    };
  }, [recipientsForActive, runMessagingGate]);

  const sendMessage = useCallback(async (text, type = 'text', attachmentId = null, attachmentEnc = null) => {
    const replyToMessageId = replyTo?.message_id || null;
    if (!activeConv) return;
    if (!text && !attachmentId) return;
    if (!isGroup && peer && isPeerBlocked(peer.user_id, myContacts)) {
      toast.error(t('cannotMessageBlocked'));
      return;
    }
    if (!canMessagePeer) {
      toast.info(isRequestPendingPeer ? t('requestPendingChat') : t('cannotMessageNonMutual'));
      return;
    }
    try {
      const gate = await runMessagingGate();
      if (!gate) return;
      const useSignal = gate.useSignal;

      if (useSignal && isGroup) {
        await ensureGroupSenderKeysDistributed({
          conversationId: activeId,
          members: activeConv.members || [],
          ourUserId: user.user_id,
        });
        let enc;
        if (attachmentId && attachmentEnc?.signal_meta) {
          const { buildSignalAttachmentEnvelope } = await import('../lib/signal/attachments');
          enc = await encryptGroupText(
            activeId,
            user.user_id,
            buildSignalAttachmentEnvelope(attachmentEnc.signal_meta),
          );
        } else {
          enc = await encryptGroupText(activeId, user.user_id, text || '');
        }
        await api.post('/messages', {
          conversation_id: activeId,
          protocol: ProtocolVersion.SIGNAL_GROUP_V1,
          ciphertext: enc.ciphertext,
          signal_message_type: enc.signal_message_type,
          distribution_id: enc.distribution_id,
          message_type: type,
          attachment_id: attachmentId || undefined,
          attachment_content_type: attachmentEnc?.content_type,
          reply_to_message_id: replyToMessageId || undefined,
        });
        setDraft('');
        setReplyTo?.(null);
        return;
      }

      if (useSignal && !isGroup) {
        let enc;
        if (attachmentId && attachmentEnc?.signal_meta) {
          enc = await encryptSignalAttachment(peer.user_id, user.user_id, attachmentEnc.signal_meta);
        } else {
          enc = await encryptSignalText(peer.user_id, user.user_id, text || '');
        }
        await api.post('/messages', {
          conversation_id: activeId,
          protocol: ProtocolVersion.SIGNAL_V1,
          ciphertext: enc.ciphertext,
          signal_message_type: enc.signal_message_type,
          message_type: type,
          attachment_id: attachmentId || undefined,
          attachment_content_type: attachmentEnc?.content_type,
          reply_to_message_id: replyToMessageId || undefined,
        });
        setDraft('');
        setReplyTo?.(null);
        return;
      }

      if (!maySendLegacyRsa()) {
        toast.error(t('encryptionNotReady'));
        return;
      }
      if (!privateKey) {
        toast.error(t('encryptionNotReady'));
        return;
      }
      const recipients = recipientsForActive;
      if (Object.keys(recipients).length < 2) {
        toast.error('No recipients have encryption keys yet');
        return;
      }
      const enc = await encryptMessageForRecipients(text || '', recipients);
      await api.post('/messages', {
        conversation_id: activeId,
        protocol: ProtocolVersion.LEGACY_RSA,
        ciphertext: enc.ciphertext, iv: enc.iv, encrypted_keys: enc.encrypted_keys,
        message_type: type, attachment_id: attachmentId,
        attachment_iv: attachmentEnc?.iv,
        attachment_encrypted_keys: attachmentEnc?.encrypted_keys,
        attachment_content_type: attachmentEnc?.content_type,
        reply_to_message_id: replyToMessageId || undefined,
      });
      setDraft('');
      setReplyTo?.(null);
    } catch (e) {
      if (usesSignalOnlyMessaging()) {
        toastEncryptFailure(e, t);
      } else {
        const detail = e?.response?.data?.detail;
        toast.error(detail || t('sendFailed'));
      }
    }
  }, [
    activeConv, activeId, isGroup, peer, user, privateKey, myContacts,
    canMessagePeer, isRequestPendingPeer, recipientsForActive, runMessagingGate, setDraft, replyTo, setReplyTo, t,
  ]);

  const attachFile = useCallback(async (file, { fromPaste = false } = {}) => {
    if (!file || !activeConv || uploadBusy) return;
    if (file.size > 25 * 1024 * 1024) {
      toast.error(t('fileTooLarge'));
      return;
    }
    const gate = await runMessagingGate();
    if (!gate) return;
    setUploadBusy(true);
    try {
      const type = (file.type || '').startsWith('image/') ? 'image' : 'file';
      const mime = file.type || (type === 'image' ? 'image/png' : 'application/octet-stream');
      const name = file.name || (type === 'image' ? 'screenshot.png' : 'attachment');
      const { fileId, attachmentEnc } = await uploadEncryptedAttachment(file, name, mime);
      await sendMessage(name, type, fileId, attachmentEnc);
      if (fromPaste && type === 'image') {
        toast.success(t('pasteImageAttached'));
      }
    } catch (err) {
      const status = err?.response?.status;
      if (status === 413) toast.error(t('fileTooLarge'));
      else if (err?.message?.includes('encryption keys')) toast.error(err.message);
      else if (err?.message === 'encryption_not_ready') { /* gate already toasted */ }
      else toast.error(err?.response?.data?.detail || t('uploadFailed'));
    } finally {
      setUploadBusy(false);
    }
  }, [activeConv, uploadBusy, runMessagingGate, sendMessage, setUploadBusy, t, uploadEncryptedAttachment]);

  const finishVoiceRecording = useCallback(async (session) => {
    if (!session) return;
    session.stop();
    try {
      const { blob, mimeType } = await session.done;
      if (blob.size < MIN_VOICE_BLOB_BYTES) {
        toast.error(t('voiceNoteTooShort'));
        return;
      }
      const gate = await runMessagingGate();
      if (!gate) return;
      setUploadBusy(true);
      try {
        const filename = voiceFilenameForMime(mimeType);
        const { fileId, attachmentEnc } = await uploadEncryptedAttachment(blob, filename, mimeType);
        await sendMessage('', 'voice', fileId, attachmentEnc);
      } catch {
        toast.error(t('voiceNoteFailed'));
      } finally {
        setUploadBusy(false);
      }
    } catch {
      toast.error(t('voiceNoteFailed'));
    }
  }, [runMessagingGate, sendMessage, setUploadBusy, t, uploadEncryptedAttachment]);

  const startRecording = useCallback(async () => {
    if (voiceRecordingRef.current) return null;
    const gate = await runMessagingGate();
    if (!gate) return null;
    const ok = await ensureMediaPermissions({ audio: true, video: false }, { t });
    if (!ok) return null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const session = startVoiceRecording(stream);
      voiceRecordingRef.current = session;
      return session;
    } catch {
      toast.error(t('micPermissionDenied'));
      return null;
    }
  }, [runMessagingGate, t]);

  const cancelRecording = useCallback(() => {
    const session = voiceRecordingRef.current;
    if (!session) return;
    voiceRecordingRef.current = null;
    session.stop();
    session.done.catch(() => {});
  }, []);

  const stopRecordingAndSend = useCallback(async (existingSession) => {
    const session = existingSession || voiceRecordingRef.current;
    if (!session) return;
    voiceRecordingRef.current = null;
    await finishVoiceRecording(session);
  }, [finishVoiceRecording]);

  return {
    voiceRecordingRef,
    sendMessage,
    attachFile,
    startRecording,
    cancelRecording,
    stopRecordingAndSend,
  };
}