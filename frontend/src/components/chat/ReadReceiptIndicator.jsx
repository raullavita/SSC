import { useState } from 'react';
import { formatReadReceiptDetail, formatReadReceiptLabel } from '../../lib/readReceipts';
import styles from './ReadReceiptIndicator.module.css';

function formatEntryTime(readAt) {
  if (!readAt) return '';
  try {
    return new Date(readAt).toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export default function ReadReceiptIndicator({
  readers = [],
  isGroup = false,
  nameForId,
  currentUserId,
}) {
  const [expanded, setExpanded] = useState(false);
  const resolveName = (id) =>
    typeof nameForId === 'function' ? nameForId(id, currentUserId) : id?.slice(0, 10);

  const detail = formatReadReceiptDetail(readers, { isGroup, nameForId: resolveName });
  if (!detail?.short) return null;

  const tooltip = formatReadReceiptLabel(readers, { isGroup, nameForId: resolveName });
  const showExpand = isGroup && (detail.entries?.length || 0) > 1;

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.status} ${styles.read}`}
        title={tooltip}
        aria-label={tooltip}
        onClick={(e) => {
          e.stopPropagation();
          if (showExpand) setExpanded((open) => !open);
        }}
      >
        ✓✓
      </button>
      <span className={styles.summary}>{detail.short}</span>
      {showExpand && expanded && (
        <ul className={styles.detailList}>
          {detail.entries.map((entry) => (
            <li key={`${entry.name}-${entry.readAt}`}>
              <span>{entry.name}</span>
              {entry.readAt ? (
                <time className={styles.detailTime}>{formatEntryTime(entry.readAt)}</time>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}