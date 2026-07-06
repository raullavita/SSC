import { useEffect, useRef, useState } from 'react';
import {
  isImageAttachment,
  isPdfAttachment,
  isVoiceAttachment,
  needsDownloadWarning,
} from '../../chat/attachments';
import { canDeleteForEveryone, canEditMessage } from '../../chat/messageActions';
import { QUICK_REACTION_EMOJI } from '../../chat/reactionEmojis';
import { fetchPreviewsForText } from '../../lib/linkPreview';
import { decryptFileBytes } from '../../signal/signalBridge';
import LinkPreviewCard from './LinkPreviewCard';
import PollBubble from './PollBubble';
import ReactionPicker from './ReactionPicker';
import ReadReceiptIndicator from './ReadReceiptIndicator';
import styles from './MessageBubble.module.css';

function formatTime(iso) {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}

function formatSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function AttachmentContent({ attachment, downloadFile }) {
  const [blobUrl, setBlobUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [downloadConfirmed, setDownloadConfirmed] = useState(false);
  const showWarning = needsDownloadWarning(attachment);

  useEffect(() => {
    let revoked = false;
    let url = null;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await downloadFile(attachment.file_id);
        const buffer = await decryptFileBytes(data.ciphertext);
        if (!buffer) throw new Error('decrypt_failed');
        const blob = new Blob([buffer], { type: attachment.mime || 'application/octet-stream' });
        url = URL.createObjectURL(blob);
        if (!revoked) setBlobUrl(url);
      } catch (e) {
        if (!revoked) setError(e.message || 'Failed to load attachment');
      } finally {
        if (!revoked) setLoading(false);
      }
    }

    load();
    return () => {
      revoked = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment.file_id, attachment.mime, downloadFile]);

  if (loading) return <span className={styles.loading}>Loading attachment…</span>;
  if (error) return <span className={styles.error}>{error}</span>;
  if (!blobUrl) return null;

  if (isVoiceAttachment(attachment)) {
    return (
      <audio className={styles.voicePlayer} controls src={blobUrl} preload="metadata">
        <track kind="captions" />
      </audio>
    );
  }

  if (isImageAttachment(attachment)) {
    return <img className={styles.imagePreview} src={blobUrl} alt={attachment.name || 'Image'} />;
  }

  if (isPdfAttachment(attachment)) {
    return (
      <a className={styles.fileLink} href={blobUrl} download={attachment.name || 'document.pdf'}>
        <span>📄</span>
        <span>
          {attachment.name || 'PDF'} ({formatSize(attachment.size)})
        </span>
      </a>
    );
  }

  if (showWarning && !downloadConfirmed) {
    return (
      <div className={styles.fileWarning}>
        <p>
          Unknown or unsupported file type ({attachment.mime || 'unknown'}). Download only if you
          trust the sender.
        </p>
        <button
          type="button"
          className={styles.fileWarningBtn}
          onClick={() => setDownloadConfirmed(true)}
        >
          Download {attachment.name || 'file'} ({formatSize(attachment.size)})
        </button>
      </div>
    );
  }

  return (
    <a className={styles.fileLink} href={blobUrl} download={attachment.name || 'download'}>
      <span>📎</span>
      <span>
        {attachment.name || 'File'} ({formatSize(attachment.size)})
      </span>
    </a>
  );
}

export default function MessageBubble({
  message,
  isOutgoing,
  userId,
  inlineTranslation,
  reactions = [],
  replyPreview,
  highlighted = false,
  onReply,
  onEdit,
  onDelete,
  onForward,
  onReaction,
  onTranslate,
  downloadFile,
  readReceipts = [],
  isGroup = false,
  nameForId,
  poll,
  pollTallies,
  pollViewerVote,
  onPollVote,
  disappearingRemaining,
  reactionPending = false,
}) {
  const {
    text,
    attachment,
    created_at: createdAt,
    disappearing_seconds: disappearing,
    message_kind: messageKind,
    edited_at: editedAt,
    forwarded_from: forwardedFrom,
  } = message;
  const isDeleted = messageKind === 'deleted';
  const canReact = Boolean(onReaction && !isDeleted);
  const [linkPreviews, setLinkPreviews] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const bubbleRef = useRef(null);
  const showEdit = onEdit && canEditMessage(message, userId);
  const showDeleteEveryone = onDelete && canDeleteForEveryone(message, userId);

  useEffect(() => {
    if (isDeleted || !text) {
      setLinkPreviews([]);
      return undefined;
    }

    let active = true;
    fetchPreviewsForText(text).then((previews) => {
      if (active) setLinkPreviews(previews);
    });
    return () => {
      active = false;
    };
  }, [text, isDeleted]);

  useEffect(() => {
    if (!actionsOpen) return undefined;
    function closeActions(event) {
      if (bubbleRef.current?.contains(event.target)) return;
      setActionsOpen(false);
    }
    document.addEventListener('mousedown', closeActions);
    return () => document.removeEventListener('mousedown', closeActions);
  }, [actionsOpen]);

  const bubbleClass = [
    styles.bubble,
    isOutgoing ? styles.outgoing : styles.incoming,
    highlighted ? styles.highlighted : '',
    actionsOpen ? styles.actionsOpen : '',
  ]
    .filter(Boolean)
    .join(' ');

  function handleReactionPick(emoji) {
    if (!canReact || reactionPending) return;
    onReaction(emoji, message.id);
  }

  function handleQuickReact() {
    if (!canReact || reactionPending) return;
    handleReactionPick(QUICK_REACTION_EMOJI);
  }

  function handleBubbleClick() {
    if (window.matchMedia('(hover: hover)').matches) return;
    setActionsOpen((open) => !open);
  }

  return (
    <div
      ref={bubbleRef}
      className={bubbleClass}
      data-message-id={message.id}
      onClick={handleBubbleClick}
      onDoubleClick={handleQuickReact}
    >
      {replyPreview && <p className={styles.replyPreview}>↩ {replyPreview}</p>}

      {forwardedFrom && <p className={styles.forwardedLabel}>↪ Forwarded</p>}

      {isDeleted ? (
        <span className={styles.deletedText}>This message was deleted</span>
      ) : (
        text && <span className={styles.text}>{text}</span>
      )}

      {!isDeleted &&
        linkPreviews.map((preview) => (
          <LinkPreviewCard key={preview.url} preview={preview} />
        ))}

      {!isDeleted && poll && (
        <PollBubble
          poll={poll}
          tallies={pollTallies}
          viewerVote={pollViewerVote}
          onVote={onPollVote}
        />
      )}

      {!isDeleted && attachment && (
        <div className={styles.attachment}>
          <AttachmentContent attachment={attachment} downloadFile={downloadFile} />
        </div>
      )}

      {inlineTranslation && <p className={styles.translation}>{inlineTranslation}</p>}

      {reactions.length > 0 && (
        <div className={styles.reactionRow} aria-label="Message reactions">
          {reactions.map((r) => (
            <button
              key={`${message.id}-${r.emoji}`}
              type="button"
              className={`${styles.reactionChip} ${r.mine ? styles.reactionChipMine : ''}`}
              title={
                r.mine
                  ? 'Tap to remove your reaction'
                  : `React with ${r.emoji} (${r.count} total)`
              }
              disabled={reactionPending || !canReact}
              aria-label={`${r.emoji} ${r.count} reactions${r.mine ? ', yours' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleReactionPick(r.emoji);
              }}
            >
              <span className={styles.reactionEmoji}>{r.emoji}</span>
              {r.count > 1 ? <span className={styles.reactionCount}>{r.count}</span> : null}
            </button>
          ))}
        </div>
      )}

      <div className={styles.meta}>
        {disappearingRemaining != null && disappearingRemaining > 0 ? (
          <span className={styles.timer}>⏱ {disappearingRemaining}s</span>
        ) : disappearing ? (
          <span className={styles.timer}>⏱ {disappearing}s</span>
        ) : null}
        {editedAt && <span className={styles.editedLabel}>edited</span>}
        <span className={styles.timestamp}>{formatTime(createdAt)}</span>
        {isOutgoing && readReceipts?.length > 0 ? (
          <ReadReceiptIndicator
            readers={readReceipts}
            isGroup={isGroup}
            nameForId={nameForId}
            currentUserId={userId}
          />
        ) : isOutgoing ? (
          <span className={styles.status} title="Sent">
            ✓
          </span>
        ) : null}
      </div>

      <div className={styles.messageActions}>
        {!isDeleted && onReply && (
          <button type="button" className={styles.actionBtn} onClick={() => onReply(message)}>
            Reply
          </button>
        )}
        {showEdit && (
          <button type="button" className={styles.actionBtn} onClick={() => onEdit(message)}>
            Edit
          </button>
        )}
        {onDelete && !isDeleted && (
          <>
            <button type="button" className={styles.actionBtn} onClick={() => onDelete(message, 'me')}>
              Delete
            </button>
            {showDeleteEveryone && (
              <button
                type="button"
                className={styles.actionBtn}
                onClick={() => onDelete(message, 'everyone')}
              >
                Delete for all
              </button>
            )}
          </>
        )}
        {!isDeleted && onForward && text && (
          <button type="button" className={styles.actionBtn} onClick={() => onForward(message)}>
            Forward
          </button>
        )}
        {onTranslate && text && !isDeleted && (
          <button type="button" className={styles.translateBtn} onClick={() => onTranslate(message)}>
            Translate
          </button>
        )}
        {canReact && (
          <div className={styles.reactWrap}>
            <button
              type="button"
              className={styles.reactBtn}
              aria-label="Add reaction"
              aria-expanded={pickerOpen}
              disabled={reactionPending}
              onClick={(e) => {
                e.stopPropagation();
                setPickerOpen((open) => !open);
              }}
            >
              {reactionPending ? '…' : '😀'}
            </button>
            <ReactionPicker
              open={pickerOpen}
              onClose={() => setPickerOpen(false)}
              onPick={handleReactionPick}
              existingReactions={reactions}
              disabled={reactionPending}
            />
          </div>
        )}
      </div>
    </div>
  );
}