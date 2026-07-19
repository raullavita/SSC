import { Link } from 'react-router-dom';
import ConversationRow from './ConversationRow';
import NewChatSheet from './NewChatSheet';
import styles from '../../../pages/ChatHome.module.css';

/**
 * P1 chat list: header + search + conversations + FAB.
 * New chat / group / friends / stories open in NewChatSheet.
 */
export default function ConversationSidebar({
  convFilter,
  onConvFilterChange,
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
  listError,
  fileError,
  conversations,
  activeId,
  presenceMap,
  titleFor,
  onSelectConversation,
  onTogglePin,
  onToggleMute,
  showWebsiteLink,
  newChatOpen,
  onOpenNewChat,
  onCloseNewChat,
}) {
  return (
    <aside className={styles.sidebar}>
      <header className={styles.sideTop}>
        <div className={styles.brandRow}>
          <div className={styles.appLogo} aria-hidden="true">
            ssc
          </div>
          <h1 className={styles.sideTitle}>Chats</h1>
        </div>
        <div className={styles.sideActions}>
          <Link to="/settings" className={styles.iconBtn} title="Settings" aria-label="Settings">
            ⚙
          </Link>
        </div>
      </header>

      <label className={styles.convSearchWrap}>
        <span className={styles.srOnly}>Search conversations</span>
        <input
          className={styles.convSearch}
          placeholder="Search chats"
          value={convFilter}
          onChange={(e) => onConvFilterChange(e.target.value)}
          autoComplete="off"
        />
      </label>

      {(listError || fileError) && (
        <div className={styles.listAlerts}>
          {listError && <p className={styles.error}>{String(listError)}</p>}
          {fileError && <p className={styles.error}>{String(fileError)}</p>}
        </div>
      )}

      <ul className={styles.convList}>
        {conversations.length === 0 && !convFilter.trim() && (
          <li className={styles.convEmpty}>
            No chats yet.
            <br />
            Tap <strong>+</strong> to start one.
          </li>
        )}
        {conversations.length === 0 && convFilter.trim() && (
          <li className={styles.convEmpty}>No chats match your search.</li>
        )}
        {conversations.map((c) => (
          <ConversationRow
            key={c.id}
            conversation={c}
            isActive={c.id === activeId}
            title={titleFor ? titleFor(c) : undefined}
            presenceLabel={presenceMap[c.peer_id]}
            onSelect={() => onSelectConversation(c.id)}
            onTogglePin={() => onTogglePin(c.id, !c.pinned)}
            onToggleMute={() => onToggleMute(c.id, !c.muted)}
          />
        ))}
      </ul>

      {showWebsiteLink && (
        <Link to="/" className={styles.homeLink}>
          ← Website
        </Link>
      )}

      <button
        type="button"
        className={styles.fab}
        onClick={onOpenNewChat}
        aria-label="New chat"
        title="New chat"
      >
        <span className={styles.fabIcon} aria-hidden="true">
          +
        </span>
      </button>

      <NewChatSheet
        open={newChatOpen}
        onClose={onCloseNewChat}
        storiesByUser={storiesByUser}
        userId={userId}
        peerIds={peerIds}
        storiesLoading={storiesLoading}
        storyPeerId={storyPeerId}
        onPostStory={onPostStory}
        onDeleteStory={onDeleteStory}
        onStartChat={onStartChat}
        onFriendAccepted={onFriendAccepted}
        onGroupCreated={onGroupCreated}
      />
    </aside>
  );
}
