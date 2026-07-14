import { useEffect, useState } from 'react';
import { useGroupChat } from '../../chat/useGroupChat';
import styles from './GroupPanel.module.css';

export default function GroupPanel({ onGroupCreated }) {
  const { groups, loadGroups, createGroup, leaveGroup, dissolveGroup, loading, error } =
    useGroupChat();
  const [name, setName] = useState('');
  const [members, setMembers] = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (expanded) loadGroups();
  }, [expanded, loadGroups]);

  async function handleCreate(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const memberIds = members
      .split(/[,\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (!memberIds.length) return;
    const data = await createGroup(name.trim(), memberIds);
    if (data?.conversation_id) {
      onGroupCreated?.(data.conversation_id, data.group);
      setName('');
      setMembers('');
      setExpanded(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <button type="button" className={styles.toggle} onClick={() => setExpanded((v) => !v)}>
        {expanded ? '▼ Groups' : '▶ Groups'}
      </button>
      {expanded && (
        <>
          <form className={styles.form} onSubmit={handleCreate}>
            <input
              className={styles.input}
              placeholder="Group name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className={styles.input}
              placeholder="Member IDs (comma-separated)"
              value={members}
              onChange={(e) => setMembers(e.target.value)}
            />
            <button type="submit" className={styles.btn} disabled={loading}>
              {loading ? '…' : 'Create group'}
            </button>
          </form>
          {error && <p className={styles.error}>{error}</p>}
          {groups.length > 0 && (
            <ul className={styles.list}>
              {groups.map((g) => (
                <li key={g.id} className={styles.groupRow}>
                  <span>
                    {g.name} ({g.member_count} members)
                  </span>
                  <span className={styles.groupActions}>
                    <button
                      type="button"
                      className={styles.smallBtn}
                      onClick={async () => {
                        await leaveGroup(g.id);
                        loadGroups();
                      }}
                    >
                      Leave
                    </button>
                    <button
                      type="button"
                      className={styles.smallBtn}
                      onClick={async () => {
                        await dissolveGroup(g.id);
                        loadGroups();
                      }}
                    >
                      Dissolve
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}