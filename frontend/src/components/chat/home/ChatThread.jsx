import Composer from '../Composer';
import MessageBubble from '../MessageBubble';
import GroupE2EBanner from '../GroupE2EBanner';
import TrustBanner from '../TrustBanner';
import ChatPrivacyPanel from '../ChatPrivacyPanel';
import ChatThreadHeader from './ChatThreadHeader';
import ChatEmptyState from './ChatEmptyState';
import MessageSearchBar from './MessageSearchBar';
import ThreadActionBars from './ThreadActionBars';
import { enrichDirectReadReceipts } from '../../../lib/readReceipts';
import styles from '../../../pages/ChatHome.module.css';

/**
 * Right pane: empty state or open conversation thread.
 */
export default function ChatThread({
  active,
  isGroup,
  mobileChat,
  onMobileBack,
  threadTitle,
  presenceLabel,
  peerTyping,
  encryptionError,
  trust,
  trustLoading,
  onOpenSafetyVerify,
  showPrivacyPanel,
  onTogglePrivacy,
  onClosePrivacy,
  onPatchPrivacy,
  globalPrivacy,
  // calls
  onStartAudioCall,
  onStartVideoCall,
  onStartGroupAudioCall,
  onStartGroupVideoCall,
  groupCallError,
  groupCallMode,
  groupParticipantCount,
  // search
  searchQuery,
  onSearchQueryChange,
  searchHits,
  onSelectSearchHit,
  // messages
  messages,
  messagesLoading,
  messagesError,
  onReloadMessages,
  userId,
  inlineTranslations,
  reactionsByTarget,
  getReplyPreview,
  highlightedId,
  onReply,
  onEdit,
  onDelete,
  onForward,
  onReaction,
  isReactionPending,
  onTranslateMessage,
  downloadFile,
  readByMessage,
  nameForId,
  pollMeta,
  remainingById,
  votePoll,
  messageRefs,
  messagesEndRef,
  // action bars
  replyTo,
  onClearReply,
  editingMessage,
  onClearEdit,
  forwardingMessage,
  conversations,
  activeId,
  onForwardTo,
  onClearForward,
  showPollForm,
  pollQuestion,
  pollOptions,
  onPollQuestionChange,
  onPollOptionChange,
  onPostPoll,
  onCancelPoll,
  // composer
  chatError,
  draft,
  onDraftChange,
  onSend,
  onTranslateDraft,
  translatedPreview,
  onUseTranslation,
  onDismissTranslation,
  translateTarget,
  onTranslateTargetChange,
  userLang,
  onUserLangChange,
  languages,
  disappearingSeconds,
  onDisappearingChange,
  recording,
  onVoiceToggle,
  uploading,
  onFileSelected,
  onCreatePoll,
  broadcastLists,
  onBroadcastSend,
}) {
  if (!active) {
    return (
      <main className={styles.thread}>
        <ChatEmptyState />
      </main>
    );
  }

  return (
    <main className={styles.thread}>
      <ChatThreadHeader
        showMobileBack={mobileChat}
        onMobileBack={onMobileBack}
        title={threadTitle}
        presenceLabel={presenceLabel}
        peerTyping={peerTyping}
        muted={active.muted}
        pinned={active.pinned}
        isGroup={isGroup}
        encryptionError={encryptionError}
        trust={trust}
        trustLoading={trustLoading}
        onOpenSafetyVerify={onOpenSafetyVerify}
        onTogglePrivacy={onTogglePrivacy}
        onStartAudioCall={onStartAudioCall}
        onStartVideoCall={onStartVideoCall}
        onStartGroupAudioCall={onStartGroupAudioCall}
        onStartGroupVideoCall={onStartGroupVideoCall}
        groupCallError={groupCallError}
        groupCallMode={groupCallMode}
        groupParticipantCount={groupParticipantCount}
      />

      {isGroup && <GroupE2EBanner />}
      {!isGroup && <TrustBanner trust={trust} onVerify={onOpenSafetyVerify} />}

      <ChatPrivacyPanel
        open={showPrivacyPanel}
        onClose={onClosePrivacy}
        overrides={active.privacy || {}}
        globalSettings={globalPrivacy}
        onPatch={onPatchPrivacy}
      />

      <MessageSearchBar
        query={searchQuery}
        onQueryChange={onSearchQueryChange}
        hits={searchHits}
        onSelectHit={onSelectSearchHit}
      />

      <div className={styles.messages}>
        {messagesLoading && <p className={styles.muted}>Loading messages…</p>}
        {messagesError && !messagesLoading && (
          <div className={styles.messagesError}>
            <p>{messagesError}</p>
            <button type="button" onClick={onReloadMessages}>
              Retry
            </button>
          </div>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            ref={(el) => {
              if (messageRefs?.current) messageRefs.current[m.id] = el;
            }}
          >
            <MessageBubble
              message={m}
              isOutgoing={m.sender_id === userId}
              userId={userId}
              inlineTranslation={inlineTranslations[m.id]}
              reactions={reactionsByTarget[m.id] || []}
              replyPreview={getReplyPreview(m)}
              highlighted={highlightedId === m.id}
              onReply={onReply}
              onEdit={onEdit}
              onDelete={onDelete}
              onForward={onForward}
              onReaction={onReaction}
              reactionPending={isReactionPending(m.id)}
              onTranslate={onTranslateMessage}
              downloadFile={downloadFile}
              readReceipts={enrichDirectReadReceipts(
                readByMessage[m.id] || [],
                isGroup ? null : active.peer_id
              )}
              isGroup={isGroup}
              nameForId={nameForId}
              poll={m.poll}
              pollTallies={m.poll_id ? pollMeta[m.poll_id]?.tallies : undefined}
              pollViewerVote={m.poll_id ? pollMeta[m.poll_id]?.viewerVote : null}
              onPollVote={m.poll_id ? (index) => votePoll(m.poll_id, index) : undefined}
              disappearingRemaining={remainingById[m.id]}
              onRetryDecrypt={onReloadMessages}
            />
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <ThreadActionBars
        replyTo={replyTo}
        onClearReply={onClearReply}
        editingMessage={editingMessage}
        onClearEdit={onClearEdit}
        forwardingMessage={forwardingMessage}
        conversations={conversations}
        activeId={activeId}
        onForwardTo={onForwardTo}
        onClearForward={onClearForward}
        showPollForm={showPollForm && !isGroup}
        pollQuestion={pollQuestion}
        pollOptions={pollOptions}
        onPollQuestionChange={onPollQuestionChange}
        onPollOptionChange={onPollOptionChange}
        onPostPoll={onPostPoll}
        onCancelPoll={onCancelPoll}
      />

      <Composer
        error={chatError}
        draft={draft}
        onDraftChange={onDraftChange}
        onSend={onSend}
        onTranslate={onTranslateDraft}
        translatedPreview={translatedPreview}
        onUseTranslation={onUseTranslation}
        onDismissTranslation={onDismissTranslation}
        translateTarget={translateTarget}
        onTranslateTargetChange={onTranslateTargetChange}
        userLang={userLang}
        onUserLangChange={onUserLangChange}
        languages={languages}
        disappearingSeconds={disappearingSeconds}
        onDisappearingChange={onDisappearingChange}
        recording={recording}
        onVoiceToggle={onVoiceToggle}
        uploading={uploading}
        onFileSelected={onFileSelected}
        onCreatePoll={!isGroup && active.peer_id ? onCreatePoll : undefined}
        broadcastLists={broadcastLists}
        onBroadcastSend={broadcastLists?.length ? onBroadcastSend : undefined}
      />
    </main>
  );
}
