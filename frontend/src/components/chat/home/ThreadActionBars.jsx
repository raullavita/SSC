import styles from '../../../pages/ChatHome.module.css';

/** Reply / edit / forward / poll chrome above the composer. */
export default function ThreadActionBars({
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
}) {
  return (
    <>
      {replyTo && (
        <div className={styles.replyBar}>
          <span>
            Replying to:{' '}
            {replyTo.text?.slice(0, 60) || replyTo.attachment?.name || 'Message'}
          </span>
          <button type="button" onClick={onClearReply}>
            ✕
          </button>
        </div>
      )}

      {editingMessage && (
        <div className={styles.replyBar}>
          <span>Editing message</span>
          <button type="button" onClick={onClearEdit}>
            ✕
          </button>
        </div>
      )}

      {forwardingMessage && (
        <div className={styles.replyBar}>
          <span>Forward to:</span>
          <select
            value=""
            onChange={(e) => {
              const conv = conversations.find((c) => c.id === e.target.value);
              if (conv) onForwardTo(conv);
            }}
          >
            <option value="">Choose chat…</option>
            {conversations
              .filter((c) => c.id !== activeId)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.type === 'group'
                    ? `Group ${c.id.slice(0, 8)}`
                    : c.peer_id?.slice(0, 12)}
                </option>
              ))}
          </select>
          <button type="button" onClick={onClearForward}>
            ✕
          </button>
        </div>
      )}

      {showPollForm && (
        <div className={styles.replyBar}>
          <input
            placeholder="Poll question"
            value={pollQuestion}
            onChange={(e) => onPollQuestionChange(e.target.value)}
          />
          {pollOptions.map((opt, idx) => (
            <input
              key={`poll-opt-${idx}`}
              placeholder={`Option ${idx + 1}`}
              value={opt}
              onChange={(e) => onPollOptionChange(idx, e.target.value)}
            />
          ))}
          <button type="button" onClick={onPostPoll}>
            Post poll
          </button>
          <button type="button" onClick={onCancelPoll}>
            Cancel
          </button>
        </div>
      )}
    </>
  );
}
