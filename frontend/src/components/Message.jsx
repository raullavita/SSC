import React, { useEffect, useState } from 'react';
import { Translate, Image as ImageIcon, Paperclip, ShieldCheck, Check, Checks } from '@phosphor-icons/react';
import { decryptMessage, decryptBytes } from '../lib/crypto';
import { api } from '../lib/api';
import { fetchFileBytes } from '../lib/files';
import { registerBlobUrl, subscribeMemoryWipe, unregisterBlobUrl } from '../lib/memoryWipe';
import CountdownBadge from './CountdownBadge';

export default function Message({
  msg, isMine, myUserId, privateKey, autoTranslate, translationEnabled = false,
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
      if (!privateKey) { setPlaintext(null); return; }
      try {
        const myKey = msg.encrypted_keys?.[myUserId];
        if (!myKey) { setError('NO_KEY'); return; }
        const pt = await decryptMessage(privateKey, msg.ciphertext, msg.iv, myKey);
        if (mounted) setPlaintext(pt);
      } catch (e) {
        if (mounted) setError('DECRYPT_FAIL');
      }
    })();
    return () => { mounted = false; };
  }, [msg, myUserId, privateKey]);

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
      const payload = { text: plaintext, target_language: targetLang };
      if (sourceLang) payload.source_language = sourceLang;
      const { data } = await api.post('/translate', payload);
      if (data.note === 'same language') {
        setTranslated(null);
        return;
      }
      const out = data.translated;
      const bad = !out
        || /PLEASE SELECT TWO DISTINCT LANGUAGES/i.test(out)
        || /MYMEMORY WARNING/i.test(out)
        || /AUTO_DETECT LANGUAGE NOT SUPPORTED/i.test(out)
        || data.note === 'translation service unavailable or same language';
      if (!bad && out.toLowerCase() !== plaintext.toLowerCase()) {
        setTranslated(out);
        setShowTranslated(true);
      } else {
        setTranslated(null);
      }
    } catch {
      setTranslated(null);
    } finally {
      setTranslating(false);
    }
  };

  const bubbleClass = isMine
    ? 'bg-[#1E2A38] text-white rounded-md rounded-tr-sm self-end'
    : 'bg-[#232323] text-[#F0F0F0] rounded-md rounded-tl-sm self-start';

  const attachmentEncrypted = Boolean(msg.attachment_iv && msg.attachment_encrypted_keys);

  return (
    <div className={`flex flex-col max-w-[78%] ${isMine ? 'self-end items-end' : 'self-start items-start'} fade-up`}>
      <div className={`px-3 py-2 ${bubbleClass} text-sm leading-relaxed break-words shadow`} data-testid={`message-${msg.message_id}`}>
        {error === 'DECRYPT_FAIL' && <span className="font-mono text-xs text-[#FF3B30]">[unable to decrypt]</span>}
        {error === 'NO_KEY' && <span className="font-mono text-xs text-[#FF3B30]">[no key for this device]</span>}
        {!error && plaintext === null && (
          <span className="font-mono text-xs text-[#A1A1AA]">
            {!privateKey ? 'unlock vault to read & translate' : 'decrypting…'}
          </span>
        )}
        {!error && plaintext !== null && (
          <>
            {msg.message_type === 'image' && msg.attachment_id ? (
              attachmentEncrypted ? (
                <EncryptedImageAttachment msg={msg} fileId={msg.attachment_id} caption={plaintext} privateKey={privateKey} myUserId={myUserId} />
              ) : (
                <LegacyAttachmentPlaceholder kind="image" caption={plaintext} />
              )
            ) : msg.message_type === 'file' && msg.attachment_id ? (
              attachmentEncrypted ? (
                <EncryptedFileAttachment msg={msg} fileId={msg.attachment_id} caption={plaintext} privateKey={privateKey} myUserId={myUserId} />
              ) : (
                <LegacyAttachmentPlaceholder kind="file" caption={plaintext} />
              )
            ) : msg.message_type === 'voice' && msg.attachment_id ? (
              attachmentEncrypted ? (
                <EncryptedVoiceAttachment msg={msg} fileId={msg.attachment_id} privateKey={privateKey} myUserId={myUserId} />
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
        <ShieldCheck size={10} className="text-[#34C759]" />
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
          <button onClick={translateNow} className="ml-1 hover:text-[#FFD600] flex items-center gap-1" data-testid={`translate-button-${msg.message_id}`}>
            <Translate size={10} /> translate
          </button>
        )}
        {translating && <span>translating…</span>}
      </div>
    </div>
  );
}

async function fetchAttachmentBytes(fileId) {
  return fetchFileBytes(fileId);
}

async function decryptAttachment(msg, fileId, privateKey, myUserId) {
  const key = msg.attachment_encrypted_keys?.[myUserId];
  if (!key) throw new Error('NO_KEY');
  const cipher = await fetchAttachmentBytes(fileId);
  const plain = await decryptBytes(privateKey, cipher, msg.attachment_iv, key);
  const mime = msg.attachment_content_type || 'application/octet-stream';
  return new Blob([plain], { type: mime });
}

function useDecryptedAttachment(msg, fileId, privateKey, myUserId) {
  const [objectUrl, setObjectUrl] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    let url = null;
    (async () => {
      if (!privateKey) { setLoading(false); return; }
      try {
        const blob = await decryptAttachment(msg, fileId, privateKey, myUserId);
        url = URL.createObjectURL(blob);
        registerBlobUrl(url);
        if (mounted) {
          setObjectUrl(url);
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
      setError(null);
      setLoading(false);
    });
    return () => {
      mounted = false;
      unsubWipe();
      if (url) unregisterBlobUrl(url);
    };
  }, [msg, fileId, privateKey, myUserId]);

  return { objectUrl, error, loading };
}

function EncryptedImageAttachment({ msg, fileId, caption, privateKey, myUserId }) {
  const { objectUrl, error, loading } = useDecryptedAttachment(msg, fileId, privateKey, myUserId);
  if (loading) return <span className="font-mono text-xs text-[#A1A1AA]">decrypting attachment…</span>;
  if (error) return <span className="font-mono text-xs text-[#FF3B30]">[{error === 'NO_KEY' ? 'no key for attachment' : 'unable to decrypt attachment'}]</span>;
  return (
    <div>
      <img src={objectUrl} alt={caption || 'attachment'} className="rounded-md max-w-[280px] max-h-[280px] object-cover" data-testid={`image-${fileId}`} />
      {caption && <div className="mt-1 text-sm">{caption}</div>}
    </div>
  );
}

function EncryptedFileAttachment({ msg, fileId, caption, privateKey, myUserId }) {
  const { objectUrl, error, loading } = useDecryptedAttachment(msg, fileId, privateKey, myUserId);
  if (loading) return <span className="font-mono text-xs text-[#A1A1AA]">decrypting file…</span>;
  if (error) return <span className="font-mono text-xs text-[#FF3B30]">[{error === 'NO_KEY' ? 'no key for file' : 'unable to decrypt file'}]</span>;
  return (
    <a href={objectUrl} download={caption || 'attachment'} className="flex items-center gap-2 underline hover:text-[#00E5FF]" data-testid={`file-${fileId}`}>
      <Paperclip size={14} />
      <span className="text-sm">{caption || 'attachment'}</span>
    </a>
  );
}

function EncryptedVoiceAttachment({ msg, fileId, privateKey, myUserId }) {
  const { objectUrl, error, loading } = useDecryptedAttachment(msg, fileId, privateKey, myUserId);
  if (loading) return <span className="font-mono text-xs text-[#A1A1AA]">decrypting voice…</span>;
  if (error) return <span className="font-mono text-xs text-[#FF3B30]">[{error === 'NO_KEY' ? 'no key for voice' : 'unable to decrypt voice'}]</span>;
  return <audio controls src={objectUrl} className="w-full max-w-[220px]" />;
}

function LegacyAttachmentPlaceholder({ kind, caption }) {
  const label = kind === 'voice' ? 'voice note' : kind === 'file' ? 'file' : 'image';
  return (
    <div className="font-mono text-xs text-[#A1A1AA]" data-testid={`legacy-attachment-${kind}`}>
      [legacy {label} — E2E encryption required]
      {caption && kind !== 'voice' && <div className="mt-1 text-sm text-[#F0F0F0]">{caption}</div>}
    </div>
  );
}