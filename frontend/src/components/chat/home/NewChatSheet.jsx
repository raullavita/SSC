import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import StoriesBar from '../StoriesBar';
import UserLookup from '../UserLookup';
import GroupPanel from '../GroupPanel';
import FriendRequestsPanel from '../../FriendRequestsPanel';
import styles from '../../../pages/ChatHome.module.css';

const TABS = [
  { id: 'chat', label: 'New chat' },
  { id: 'group', label: 'Group' },
  { id: 'friends', label: 'Requests' },
  { id: 'stories', label: 'Stories' },
];

/**
 * P1: Secondary actions (new chat / group / friends / stories) live here —
 * not permanently stacked above the conversation list.
 */
export default function NewChatSheet({
  open,
  onClose,
  storiesByUser,
  userId,
  peerIds,
  storiesLoading,
  storyPeerId,
  onPostStory,
  onDeleteStory,
  onStartChat,
  onFriendAccepted,
  onGroupCreated,
}) {
  const [tab, setTab] = useState('chat');

  useEffect(() => {
    if (open) setTab('chat');
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') onClose?.();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleStartChat(participantId) {
    onStartChat?.(participantId);
    onClose?.();
  }

  function handleGroupCreated(conversationId) {
    onGroupCreated?.(conversationId);
    onClose?.();
  }

  function handleFriendAccepted(conversationId) {
    onFriendAccepted?.(conversationId);
    onClose?.();
  }

  return (
    <div className={styles.sheetRoot} role="dialog" aria-modal="true" aria-label="New chat">
      <button
        type="button"
        className={styles.sheetBackdrop}
        aria-label="Close"
        onClick={onClose}
      />
      <div className={styles.sheetPanel}>
        <header className={styles.sheetHeader}>
          <h2 className={styles.sheetTitle}>New</h2>
          <button type="button" className={styles.sheetClose} onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className={styles.sheetTabs} role="tablist">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`${styles.sheetTab} ${tab === t.id ? styles.sheetTabActive : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className={styles.sheetBody}>
          {tab === 'chat' && <UserLookup onStartChat={handleStartChat} />}
          {tab === 'group' && (
            <GroupPanel onGroupCreated={handleGroupCreated} defaultExpanded />
          )}
          {tab === 'friends' && (
            <FriendRequestsPanel onAccepted={handleFriendAccepted} />
          )}
          {tab === 'stories' && (
            <StoriesBar
              byUser={storiesByUser}
              userId={userId}
              peerIds={peerIds}
              loading={storiesLoading}
              onPost={(text) => onPostStory?.(text, { peerId: storyPeerId })}
              onDelete={onDeleteStory}
            />
          )}
        </div>

        <footer className={styles.sheetFooter}>
          <Link to="/link-device" className={styles.sheetFooterLink} onClick={onClose}>
            Linked devices &amp; sync
          </Link>
        </footer>
      </div>
    </div>
  );
}
