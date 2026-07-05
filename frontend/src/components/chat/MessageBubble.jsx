import { useEffect, useState } from 'react';
import { isImageAttachment, isVoiceAttachment } from '../../chat/attachments';
import { canDeleteForEveryone, canEditMessage } from '../../chat/messageActions';
import { fetchPreviewsForText } from '../../lib/linkPreview';
import { decryptFileBytes } from '../../signal/signalBridge';
import LinkPreviewCard from './LinkPreviewCard';
import PollBubble from './PollBubble';
import styles from './MessageBubble.module.css';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

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
  readAt,
  poll,
  pollTallies,
  pollViewerVote,
  onPollVote,
  disappearingRemaining,
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
  const [linkPreviews, setLinkPreviews] = useState([]);
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
  const bubbleClass = [
    styles.bubble,
    isOutgoing ? styles.outgoing : styles.incoming,
    highlighted ? styles.highlighted : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={bubbleClass} data-message-id={message.id}>
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

      <div className={styles.meta}>
        {disappearingRemaining != null && disappearingRemaining > 0 ? (
          <span className={styles.timer}>⏱ {disappearingRemaining}s</span>
        ) : disappearing ? (
          <span className={styles.timer}>⏱ {disappearing}s</span>
        ) : null}
        {editedAt && <span className={styles.editedLabel}>edited</span>}
        <span className={styles.timestamp}>{formatTime(createdAt)}</span>
        {isOutgoing && (
          <span
            className={`${styles.status} ${readAt ? styles.read : ''}`}
            title={readAt ? 'Read' : 'Sent'}
          >
            {readAt ? '✓✓' : '✓'}
          </span>
        )}
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
        {onReaction &&
          REACTION_EMOJIS.map((emoji) => (
            <button
              key={`${message.id}-${emoji}`}
              type="button"
              className={styles.reactionBtn}
              onClick={() => onReaction(emoji, message.id)}
            >
              {emoji}
            </button>
          ))}
      </div>

      {reactions.length > 0 && (
        <div className={styles.reactionRow}>
          {reactions.map((r) => (
            <button
              key={`${message.id}-${r.emoji}`}
              type="button"
              className={`${styles.reactionChip} ${r.mine ? styles.reactionChipMine : ''}`}
              title={r.mine ? 'Tap to remove your reaction' : `${r.count} reaction(s)`}
              onClick={() => r.mine && onReaction && onReaction(r.emoji, message.id)}
            >
              {r.emoji}
              {r.count > 1 ? <span className={styles.reactionCount}>{r.count}</span> : null}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}