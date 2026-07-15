import { useRef } from 'react';
import styles from './Composer.module.css';

const DISAPPEAR_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '1m', value: 60 },
  { label: '1h', value: 3600 },
  { label: '24h', value: 86400 },
];

export default function Composer({
  draft,
  onDraftChange,
  onSend,
  onTranslate,
  translatedPreview,
  onUseTranslation,
  onDismissTranslation,
  translateTarget,
  onTranslateTargetChange,
  userLang,
  onUserLangChange,
  languages = [],
  disappearingSeconds,
  onDisappearingChange,
  recording,
  onVoiceToggle,
  uploading,
  onFileClick,
  onFileSelected,
  onCreatePoll,
  broadcastLists = [],
  onBroadcastSend,
  disabled = false,
  error = null,
}) {
  const fileInputRef = useRef(null);

  function handleFileClick() {
    fileInputRef.current?.click();
    onFileClick?.();
  }

  return (
    <form className={styles.composer} onSubmit={onSend}>
      {error && (
        <p className={styles.error} role="alert">
          {String(error)}
        </p>
      )}
      <div className={styles.inputRow}>
        <input
          className={styles.input}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="Type a message"
          disabled={disabled}
          aria-label="Message"
        />
        <button type="submit" className={styles.sendBtn} disabled={disabled || !draft.trim()}>
          Send
        </button>
      </div>

      <div className={styles.toolbar}>
        <button
          type="button"
          className={`${styles.toolBtn} ${recording ? styles.recording : ''}`}
          onClick={onVoiceToggle}
          disabled={disabled}
          title="Voice message"
        >
          {recording ? '● Stop' : '🎤 Voice'}
        </button>
        <button
          type="button"
          className={styles.toolBtn}
          onClick={handleFileClick}
          disabled={disabled || uploading}
          title="Attach file"
        >
          {uploading ? '…' : '📎 File'}
        </button>
        <input ref={fileInputRef} type="file" hidden onChange={onFileSelected} />
        <button
          type="button"
          className={styles.toolBtn}
          onClick={onTranslate}
          disabled={disabled || !draft.trim()}
          title="Translate draft"
        >
          🌐 Translate
        </button>
        <select
          className={styles.select}
          value={userLang}
          onChange={(e) => onUserLangChange(e.target.value)}
          aria-label="Your language"
          title="Auto-translate incoming to"
        >
          {languages.map((lang) => (
            <option key={`ul-${lang}`} value={lang}>
              My: {lang}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={translateTarget}
          onChange={(e) => onTranslateTargetChange(e.target.value)}
          aria-label="Translation target"
          title="Translate draft to"
        >
          {languages.map((lang) => (
            <option key={`tt-${lang}`} value={lang}>
              To: {lang}
            </option>
          ))}
        </select>
        <select
          className={styles.select}
          value={disappearingSeconds}
          onChange={(e) => onDisappearingChange(Number(e.target.value))}
          aria-label="Disappearing timer"
          title="Disappearing messages"
        >
          {DISAPPEAR_OPTIONS.map((o) => (
            <option key={o.label} value={o.value}>
              ⏱ {o.label}
            </option>
          ))}
        </select>
        {onCreatePoll && (
          <button
            type="button"
            className={styles.toolBtn}
            onClick={onCreatePoll}
            disabled={disabled}
            title="Create poll"
          >
            📊 Poll
          </button>
        )}
        {onBroadcastSend && broadcastLists.length > 0 && (
          <select
            className={styles.select}
            defaultValue=""
            disabled={disabled || !draft.trim()}
            aria-label="Broadcast list"
            title="Send to broadcast list"
            onChange={(e) => {
              const listId = e.target.value;
              if (!listId) return;
              onBroadcastSend(listId);
              e.target.value = '';
            }}
          >
            <option value="" disabled>
              📣 Broadcast
            </option>
            {broadcastLists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.name} ({list.recipient_ids.length})
              </option>
            ))}
          </select>
        )}
      </div>

      {translatedPreview && (
        <p className={styles.preview}>
          Translation ({translateTarget}): {translatedPreview}
          <span className={styles.previewActions}>
            <button type="button" onClick={onUseTranslation}>
              Use translation
            </button>
            <button type="button" onClick={onDismissTranslation}>
              Dismiss
            </button>
          </span>
        </p>
      )}
    </form>
  );
}