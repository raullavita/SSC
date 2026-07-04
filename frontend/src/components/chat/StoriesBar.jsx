import { useState } from 'react';
import styles from './StoriesBar.module.css';

export default function StoriesBar({
  byUser,
  userId,
  peerIds = [],
  loading,
  onPost,
  onDelete,
}) {
  const [draft, setDraft] = useState('');
  const [activeUser, setActiveUser] = useState(null);
  const [posting, setPosting] = useState(false);

  const users = [...new Set([userId, ...peerIds].filter(Boolean))];
  const activeStories = activeUser ? byUser[activeUser] || [] : [];

  async function handlePost(e) {
    e.preventDefault();
    if (!draft.trim() || posting) return;
    setPosting(true);
    try {
      await onPost(draft.trim(), { peerId: userId });
      setDraft('');
    } finally {
      setPosting(false);
    }
  }

  return (
    <section aria-label="Stories">
      <div className={styles.bar}>
        {users.map((uid) => {
          const count = (byUser[uid] || []).length;
          const label = uid === userId ? 'You' : uid.slice(0, 8);
          return (
            <button
              key={uid}
              type="button"
              className={`${styles.chip} ${uid === userId ? styles.chipOwn : ''} ${
                activeUser === uid ? styles.chipActive : ''
              }`}
              onClick={() => setActiveUser(activeUser === uid ? null : uid)}
              title={`${label} — ${count} story/stories`}
            >
              {label}
              {count > 0 ? ` (${count})` : ''}
            </button>
          );
        })}
        {loading && <span className={styles.muted}>…</span>}
      </div>

      <form className={styles.form} onSubmit={handlePost}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Post encrypted status (24h)"
          maxLength={280}
          aria-label="Story text"
        />
        <button type="submit" disabled={posting || !draft.trim()}>
          Story
        </button>
      </form>

      {activeUser && activeStories.length > 0 && (
        <div className={styles.panel}>
          {activeStories.map((story) => (
            <div key={story.id}>
              <p className={styles.text}>{story.text}</p>
              {story.user_id === userId && (
                <div className={styles.actions}>
                  <button type="button" onClick={() => onDelete(story.id)}>
                    Delete
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      {activeUser && activeStories.length === 0 && (
        <p className={styles.muted}>No active stories for this contact.</p>
      )}
    </section>
  );
}