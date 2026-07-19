import styles from '../../../pages/ChatHome.module.css';

/** Empty thread pane when no conversation is selected. */
export default function ChatEmptyState() {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyLogo} aria-hidden="true">
        ssc
      </div>
      <h2 className={styles.emptyTitle}>Super Secure Chat</h2>
      <p className={styles.emptySub}>
        Select a conversation, or tap <strong>+</strong> to start a new encrypted chat.
      </p>
      <p className={styles.emptyHint}>
        Messages are encrypted on your device before they leave.
      </p>
    </div>
  );
}
