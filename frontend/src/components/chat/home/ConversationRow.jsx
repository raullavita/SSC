import GroupE2EBadge from '../GroupE2EBadge';
import { getPeerTrust } from '../../../lib/trustStore';
import { getInitials, avatarHue } from '../../../chat/home/displayUtils';
import {
  formatPreviewLine,
  getConversationPreview,
} from '../../../chat/home/conversationPreviews';
import { formatListTime } from '../../../chat/home/formatListTime';
import styles from '../../../pages/ChatHome.module.css';

/**
 * P5: WhatsApp-style row — avatar · name · preview · time · unread.
 */
export default function ConversationRow({
  conversation,
  isActive,
  title,
  presenceLabel,
  onSelect,
  onTogglePin,
  onToggleMute,
}) {
  const c = conversation;
  const trust =
    c.type !== 'group' && c.peer_id ? getPeerTrust(c.peer_id) : null;
  const displayTitle = title || (c.type === 'group' ? 'Group' : 'Chat');
  const preview = getConversationPreview(c.id);
  const previewText = formatPreviewLine(preview);
  const timeLabel = formatListTime(preview?.atMs || c.updated_at);
  const hue = avatarHue(c.peer_id || c.group_id || c.id);
  const online = presenceLabel === 'Online';

  return (
    <li
      className={`${styles.convItem} ${c.muted ? styles.convMuted : ''} ${
        c.pinned ? styles.convPinned : ''
      } ${isActive ? styles.convItemActive : ''}`}
    >
      <button type="button" className={styles.convMainBtn} onClick={onSelect}>
        <span
          className={styles.convAvatar}
          style={{
            background: `linear-gradient(145deg, hsl(${hue} 42% 38%), hsl(${hue} 48% 28%))`,
          }}
          aria-hidden="true"
        >
          {c.type === 'group' ? '👥' : getInitials(displayTitle)}
          {online && <span className={styles.convOnlineDot} title="Online" />}
        </span>

        <span className={styles.convBody}>
          <span className={styles.convTopLine}>
            <span className={styles.convName}>
              {c.pinned ? (
                <span className={styles.convPinMark} title="Pinned" aria-hidden="true">
                  📌
                </span>
              ) : null}
              {displayTitle}
              {c.type === 'group' && <GroupE2EBadge compact />}
              {trust?.status === 'verified' && (
                <span className={styles.trustVerified} title="Verified">
                  ✓
                </span>
              )}
              {trust?.status === 'changed' && (
                <span className={styles.trustChanged} title="Safety number changed">
                  ⚠
                </span>
              )}
            </span>
            {timeLabel && (
              <span
                className={`${styles.convTime} ${
                  c.unread_count > 0 && !isActive ? styles.convTimeUnread : ''
                }`}
              >
                {timeLabel}
              </span>
            )}
          </span>

          <span className={styles.convBottomLine}>
            <span className={styles.convPreview}>
              {c.muted ? <span className={styles.convMutedIcon}>🔇 </span> : null}
              {previewText || (c.type === 'group' ? 'Group chat' : 'Encrypted chat')}
            </span>
            {c.unread_count > 0 && !isActive && (
              <span className={styles.unreadBadge}>{c.unread_count}</span>
            )}
          </span>
        </span>
      </button>

      <span className={styles.convActions}>
        <button
          type="button"
          title={c.pinned ? 'Unpin' : 'Pin'}
          aria-label={c.pinned ? 'Unpin chat' : 'Pin chat'}
          onClick={(e) => {
            e.stopPropagation();
            onTogglePin?.();
          }}
        >
          {c.pinned ? '📌' : '📍'}
        </button>
        <button
          type="button"
          title={c.muted ? 'Unmute' : 'Mute'}
          aria-label={c.muted ? 'Unmute chat' : 'Mute chat'}
          onClick={(e) => {
            e.stopPropagation();
            onToggleMute?.();
          }}
        >
          {c.muted ? '🔇' : '🔔'}
        </button>
      </span>
    </li>
  );
}
