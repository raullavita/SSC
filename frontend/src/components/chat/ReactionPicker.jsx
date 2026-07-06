import { useEffect, useRef } from 'react';
import { REACTION_EMOJIS } from '../../chat/reactionEmojis';
import styles from './ReactionPicker.module.css';

export default function ReactionPicker({
  open,
  onClose,
  onPick,
  existingReactions = [],
  disabled = false,
}) {
  const panelRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    function onDocClick(event) {
      if (panelRef.current?.contains(event.target)) return;
      onClose?.();
    }
    function onKeyDown(event) {
      if (event.key === 'Escape') onClose?.();
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  const mineByEmoji = new Map(
    (existingReactions || []).filter((r) => r.mine).map((r) => [r.emoji, r])
  );
  const countByEmoji = new Map(
    (existingReactions || []).map((r) => [r.emoji, r.count || 1])
  );

  return (
    <div
      ref={panelRef}
      className={styles.picker}
      role="menu"
      aria-label="Choose reaction"
      onClick={(e) => e.stopPropagation()}
    >
      {REACTION_EMOJIS.map((emoji) => {
        const mine = mineByEmoji.has(emoji);
        const count = countByEmoji.get(emoji) || 0;
        return (
          <button
            key={emoji}
            type="button"
            role="menuitem"
            className={`${styles.emojiBtn} ${mine ? styles.emojiBtnMine : ''}`}
            disabled={disabled}
            aria-label={
              mine
                ? `Remove ${emoji} reaction`
                : count
                  ? `React with ${emoji} (${count})`
                  : `React with ${emoji}`
            }
            onClick={() => {
              onPick?.(emoji);
              onClose?.();
            }}
          >
            <span className={styles.emoji}>{emoji}</span>
            {count > 0 ? <span className={styles.count}>{count}</span> : null}
          </button>
        );
      })}
    </div>
  );
}