import React, { useEffect, useState } from 'react';
import { Translate, Paperclip, Check, Checks, Play, Pause, DownloadSimple } from '@phosphor-icons/react';
import { decryptBytes } from '../lib/crypto';
import {
  decryptAttachmentBytes,
  decryptSignalAttachmentBody,
  isSignalV1AttachmentMessage,
  parseSignalAttachmentEnvelope,
} from '../lib/signal/attachments';
import { decryptGroupText } from '../lib/signal/groupMessages';
import { decryptMessageBody } from '../lib/signal/migration';
import { signalRemoteUserId } from '../lib/signal/messages';

import { translateMessageText } from '../lib/translation/translateClient';
import { fetchFileBytes } from '../lib/files';
import { registerBlobUrl, subscribeMemoryWipe, unregisterBlobUrl } from '../lib/memoryWipe';
import { formatFileSize, filenameFromCaption } from '../lib/attachmentUtils';
import ImagePreviewModal from './ImagePreviewModal';
import CountdownBadge from './CountdownBadge';

export default function Message({
  msg, isMine, myUserId, privateKey, peerUserId = null, autoTranslate, translationEnabled = false,
  translationOnDevice = false, serverTranslationAllowed = false,
  targetLang, sourceLang, reads = [], participantsCount = 2,
}) {
  const [plaintext, setPlaintext] = useState(null);
  const [translated, setTranslated] = useState(null);
  const [translating, setTranslating] = useState(false);
  const [showTranslated, setShowTranslated] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => subscribeMemoryWipe(() => {
    setPlaintext(null);
    setTranslated(null);
    setTranslating(false);
    setShowTranslated(false);
    setError(null);
  }), []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const pt = await decryptMessageBody(msg, { myUserId, peerUserId, privateKey });
        if (mounted) {
          setPlaintext(pt);
          setError(null);
        }
      } catch (e) {
        if (!mounted) return;
        const code = e?.message;
        if (code === 'VAULT_LOCKED') {
          setPlaintext(null);
          setError(null);
          return;
        }
        if (code === 'NO_KEY') setError('NO_KEY');
        else setError('DECRYPT_FAIL');
      }
    })();
    return () => { mounted = false; };
  }, [msg, myUserId, privateKey, peerUserId]);

  const sameLanguage = Boolean(
    sourceLang && targetLang && sourceLang.toLowerCase() === targetLang.toLowerCase(),
  );

  useEffect(() => {
    if (sameLanguage) {
      setTranslated(null);
      setShowTranslated(false);
      return;
    }
    if (translationEnabled && autoTranslate && plaintext && !isMine && targetLang) {
      translateNow();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [translationEnabled, autoTranslate, plaintext, targetLang, sourceLang, sameLanguage]);

  const translateNow = async () => {
    if (!translationEnabled || !plaintext || translating || sameLanguage) return;
    setTranslating(true);
    try {
      const result = await translateMessageText({
        text: plaintext,
        sourceLang,
        targetLang,
        serverAllowed: serverTranslationAllowed,
      });
      if (result.note === 'same language' || !result.translated) {
        setTranslated(null);
        return;
      }
      setTranslated(result.translated);
      setShowTranslated(true);
    } catch {
      setTranslated(null);
    } finally {
      setTranslating(false);
    }
  };

  const bubbleClass = isMine
    ? 'bg-[#1E2A38] text-white rounded-md rounded-tr-sm self-end'
    : 'bg-[#232323] text-[#F0F0F0] rounded-md rounded-tl-sm self-start';

  const attachmentEncrypted = isSignalV1AttachmentMessage(msg)
    || Boolean(msg.attachment_iv && msg.attachment_encrypted_keys);

  return (
    <div className={`flex flex-col max-w-[78%] ${isMine ? 'self-end items-end' : 'self-start items-start'} fade-up`}>
      <div className={`px-3 py-2 ${bubbleClass} text-sm leading-relaxed break-words shadow`} data-testid={`message-${msg.message_id}`}>
        {error === 'DECRYPT_FAIL' && <span className="font-mono text-xs text-[#FF3B30]">[unable to decrypt]</span>}
        {error === 'NO_KEY' && <span className="font-mono text-xs text-[#FF3B30]">[no key for this device]</span>}
        {!error && plaintext === null && (
          <span className="font-mono text-xs text-[#A1A1AA]">decrypting…</span>
        )}
        {!error && plaintext !== null && (
          <>
            {msg.message_type === 'image' && msg.attachment_id ? (
              attachmentEncrypted ? (
                <EncryptedImageAttachment
                  msg={msg} fileId={msg.attachment_id} caption={plaintext}
                  privateKey={privateKey} myUserId={myUserId} peerUserId={peerUserId}
                />
              ) : (
                <LegacyAttachmentPlaceholder kind="image" caption={plaintext} />
              )
            ) : msg.message_type === 'file' && msg.attachment_id ? (
              attachmentEncrypted ? (
                <EncryptedFileAttachment
                  msg={msg} fileId={msg.attachment_id} caption={plaintext}
                  privateKey={privateKey} myUserId={myUserId} peerUserId={peerUserId}
                />
              ) : (
                <LegacyAttachmentPlaceholder kind="file" caption={plaintext} />
              )
            ) : msg.message_type === 'voice' && msg.attachment_id ? (
              attachmentEncrypted ? (
                <EncryptedVoiceAttachment
                  msg={msg} fileId={msg.attachment_id}
                  privateKey={privateKey} myUserId={myUserId} peerUserId={peerUserId}
                />
              ) : (
                <LegacyAttachmentPlaceholder kind="voice" />
              )
            ) : (
              <div>{showTranslated && translated ? translated : plaintext}</div>
            )}
            {!isMine && translated && (
              <div className="mt-1 text-[10px] font-mono text-[#A1A1AA] tracking-wider uppercase">
                {showTranslated ? `TRANSLATED · ${targetLang.toUpperCase()}` : 'ORIGINAL'}
                <button onClick={() => setShowTranslated(!showTranslated)} className="ml-2 underline hover:text-white" data-testid={`toggle-translation-${msg.message_id}`}>
                  {showTranslated ? 'show original' : 'show translated'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
      <div className={`mt-1 flex items-center gap-2 text-[10px] font-mono text-[#A1A1AA] tracking-wider ${isMine ? 'justify-end' : 'justify-start'}`}>
        <span>{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        <span className="opacity-50">·</span>
        <CountdownBadge expiresAt={msg.expires_at} />
        {isMine && (() => {
          const otherReaders = reads.filter((r) => r.user_id !== myUserId && r.last_read_message_id);
          const readByCount = otherReaders.filter((r) => {
            return r.last_read_message_id === msg.message_id || (r.last_read_at && new Date(r.last_read_at) >= new Date(msg.created_at));
          }).length;
          const expected = participantsCount - 1;
          if (readByCount >= expected && expected > 0) {
            return <Checks size={12} className="text-[#00E5FF]" weight="bold" data-testid={`read-${msg.message_id}`} title="Read by all" />;
          }
          if (readByCount > 0) {
            return <Checks size={12} className="text-[#A1A1AA]" data-testid={`read-${msg.message_id}`} title={`Read by ${readByCount}`} />;
          }
          return <Check size={12} className="text-[#A1A1AA]" data-testid={`delivered-${msg.message_id}`} title="Sent" />;
        })()}
        {translationEnabled && !isMine && !sameLanguage && plaintext && !translated && !translating && (
          <button onClick={translateNow} className="ml-1 hover:text-[#FFD600] flex items-center gap-1" data-testid={`translate-button-${msg.message_id}`} title={translationOnDevice ? 'on-device' : 'server'}>
            <Translate size={10} /> translate
          </button>
        )}
        {translating && <span>translating…</span>}
      </div>
    </div>
  );
}

async function decryptAttachment(msg, fileId, privateKey, myUserId, peerUserId) {
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

function useDecryptedAttachment(msg, fileId, privateKey, myUserId, peerUserId) {
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

function EncryptedImageAttachment({ msg, fileId, caption, privateKey, myUserId, peerUserId }) {
  const { objectUrl, error, loading } = useDecryptedAttachment(msg, fileId, privateKey, myUserId, peerUserId);
  const [previewOpen, setPreviewOpen] = useState(false);

  if (loading) return <span className="font-mono text-xs text-[#A1A1AA]">decrypting attachment…</span>;
  if (error) return <span className="font-mono text-xs text-[#FF3B30]">[{error === 'NO_KEY' ? 'no key for attachment' : 'unable to decrypt attachment'}]</span>;

  const alt = filenameFromCaption(caption, 'image');

  return (
    <div>
      <button
        type="button"
        onClick={() => setPreviewOpen(true)}
        className="block rounded-md overflow-hidden hover:brightness-110 transition"
        data-testid={`image-${fileId}`}
      >
        <img src={objectUrl} alt={alt} className="rounded-md max-w-[280px] max-h-[280px] object-cover cursor-zoom-in" />
      </button>
      {caption && <div className="mt-1 text-sm">{caption}</div>}
      {previewOpen && (
        <ImagePreviewModal src={objectUrl} alt={alt} onClose={() => setPreviewOpen(false)} />
      )}
    </div>
  );
}

function EncryptedFileAttachment({ msg, fileId, caption, privateKey, myUserId, peerUserId }) {
  const { objectUrl, blob, error, loading } = useDecryptedAttachment(msg, fileId, privateKey, myUserId, peerUserId);
  if (loading) return <span className="font-mono text-xs text-[#A1A1AA]">decrypting file…</span>;
  if (error) return <span className="font-mono text-xs text-[#FF3B30]">[{error === 'NO_KEY' ? 'no key for file' : 'unable to decrypt file'}]</span>;

  const name = filenameFromCaption(caption);
  const sizeLabel = blob ? formatFileSize(blob.size) : '';

  return (
    <a
      href={objectUrl}
      download={name}
      className="flex items-center gap-3 p-2 rounded-md bg-[#1A1A1A] tac-border hover:bg-[#232323] transition min-w-[200px]"
      data-testid={`file-${fileId}`}
    >
      <Paperclip size={18} className="text-[#00E5FF] shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{name}</div>
        {sizeLabel && (
          <div className="text-[10px] font-mono text-[#A1A1AA] tracking-wider">{sizeLabel}</div>
        )}
      </div>
      <DownloadSimple size={16} className="text-[#A1A1AA] shrink-0" />
    </a>
  );
}

function EncryptedVoiceAttachment({ msg, fileId, privateKey, myUserId, peerUserId }) {
  const { objectUrl, blob, error, loading } = useDecryptedAttachment(msg, fileId, privateKey, myUserId, peerUserId);
  const audioRef = React.useRef(null);
  const [playing, setPlaying] = useState(false);

  if (loading) return <span className="font-mono text-xs text-[#A1A1AA]">decrypting voice…</span>;
  if (error) return <span className="font-mono text-xs text-[#FF3B30]">[{error === 'NO_KEY' ? 'no key for voice' : 'unable to decrypt voice'}]</span>;

  const togglePlay = () => {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  };

  return (
    <div className="flex items-center gap-2 min-w-[200px]" data-testid={`voice-${fileId}`}>
      <button
        type="button"
        onClick={togglePlay}
        className="w-10 h-10 rounded-full bg-[#00E5FF] text-black flex items-center justify-center shrink-0 hover:brightness-110"
        data-testid={`voice-play-${fileId}`}
      >
        {playing ? <Pause size={18} weight="fill" /> : <Play size={18} weight="fill" />}
      </button>
      <audio
        ref={audioRef}
        src={objectUrl}
        preload="metadata"
        className="flex-1 max-w-[160px] h-8"
        controls
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        data-testid={`voice-audio-${fileId}`}
      >
        {blob && (
          <a href={objectUrl} download={`voice-${fileId}`}>Download voice note</a>
        )}
      </audio>
    </div>
  );
}

function LegacyAttachmentPlaceholder({ kind, caption }) {
  return (
    <div className="font-mono text-xs text-[#A1A1AA]" data-testid={`legacy-attachment-${kind}`}>
      loading attachment…
      {caption && kind !== 'voice' && <div className="mt-1 text-sm text-[#F0F0F0]">{caption}</div>}
    </div>
  );
}