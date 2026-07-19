import { useEffect, useRef, useState } from 'react';
import styles from './Composer.module.css';

const DISAPPEAR_OPTIONS = [
  { label: 'Off', value: 0 },
  { label: '1m', value: 60 },
  { label: '1h', value: 3600 },
  { label: '24h', value: 86400 },
];

/**
 * P3: Main row = + · message · send/mic.
 * Translate, disappear, poll, broadcast, attach extras live in the tools panel.
 */
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
  const toolsRef = useRef(null);
  const [toolsOpen, setToolsOpen] = useState(false);

  const hasDraft = Boolean(String(draft || '').trim());
  const showSend = hasDraft && !recording;

  useEffect(() => {
    if (!toolsOpen) return undefined;
    function onDoc(e) {
      if (toolsRef.current && !toolsRef.current.contains(e.target)) {
        setToolsOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setToolsOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [toolsOpen]);

  function handleFileClick() {
    fileInputRef.current?.click();
    onFileClick?.();
    setToolsOpen(false);
  }

  function handlePrimaryAction(e) {
    if (showSend) {
      onSend?.(e);
      return;
    }
    e.preventDefault();
    onVoiceToggle?.();
  }

  return (
    <form className={styles.composer} onSubmit={onSend}>
      {error && (
        <p className={styles.error} role="alert">
          {String(error)}
        </p>
      )}

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

      <div className={styles.mainRow} ref={toolsRef}>
        <button
          type="button"
          className={`${styles.iconBtn} ${toolsOpen ? styles.iconBtnActive : ''}`}
          onClick={() => setToolsOpen((v) => !v)}
          disabled={disabled}
          aria-label="Message tools"
          aria-expanded={toolsOpen}
          title="Attach & tools"
        >
          <span aria-hidden="true">+</span>
        </button>

        <input
          className={styles.input}
          value={draft}
          onChange={(e) => onDraftChange(e.target.value)}
          placeholder="Type a message"
          disabled={disabled}
          aria-label="Message"
        />

        <button
          type={showSend ? 'submit' : 'button'}
          className={`${styles.primaryBtn} ${recording ? styles.recording : ''}`}
          onClick={showSend ? undefined : handlePrimaryAction}
          disabled={disabled || (showSend && !hasDraft)}
          title={recording ? 'Stop recording' : showSend ? 'Send' : 'Voice message'}
          aria-label={recording ? 'Stop recording' : showSend ? 'Send' : 'Voice message'}
        >
          {recording ? '■' : showSend ? '➤' : '🎤'}
        </button>

        <input ref={fileInputRef} type="file" hidden onChange={onFileSelected} />

        {toolsOpen && (
          <div className={styles.toolsPanel} role="menu" aria-label="Message tools">
            <button
              type="button"
              role="menuitem"
              className={styles.toolRow}
              onClick={handleFileClick}
              disabled={disabled || uploading}
              title="Attach file"
            >
              <span aria-hidden="true">📎</span>
              {uploading ? 'Uploading…' : 'Attach file'}
            </button>

            <button
              type="button"
              role="menuitem"
              className={styles.toolRow}
              onClick={() => {
                onTranslate?.();
              }}
              disabled={disabled || !hasDraft}
              title="Translate draft"
            >
              <span aria-hidden="true">🌐</span>
              Translate draft
            </button>

            <label className={styles.toolField}>
              <span>My language</span>
              <select
                className={styles.select}
                value={userLang}
                onChange={(e) => onUserLangChange(e.target.value)}
                aria-label="Your language"
                disabled={disabled}
              >
                {languages.map((lang) => (
                  <option key={`ul-${lang}`} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.toolField}>
              <span>Translate to</span>
              <select
                className={styles.select}
                value={translateTarget}
                onChange={(e) => onTranslateTargetChange(e.target.value)}
                aria-label="Translation target"
                disabled={disabled}
              >
                {languages.map((lang) => (
                  <option key={`tt-${lang}`} value={lang}>
                    {lang}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.toolField}>
              <span>Disappear</span>
              <select
                className={styles.select}
                value={disappearingSeconds}
                onChange={(e) => onDisappearingChange(Number(e.target.value))}
                aria-label="Disappearing timer"
                disabled={disabled}
              >
                {DISAPPEAR_OPTIONS.map((o) => (
                  <option key={o.label} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>

            {onCreatePoll && (
              <button
                type="button"
                role="menuitem"
                className={styles.toolRow}
                onClick={() => {
                  onCreatePoll();
                  setToolsOpen(false);
                }}
                disabled={disabled}
                title="Create poll"
              >
                <span aria-hidden="true">📊</span>
                Create poll
              </button>
            )}

            {onBroadcastSend && broadcastLists.length > 0 && (
              <label className={styles.toolField}>
                <span>Broadcast</span>
                <select
                  className={styles.select}
                  defaultValue=""
                  disabled={disabled || !hasDraft}
                  aria-label="Broadcast list"
                  title="Send to broadcast list"
                  onChange={(e) => {
                    const listId = e.target.value;
                    if (!listId) return;
                    onBroadcastSend(listId);
                    e.target.value = '';
                    setToolsOpen(false);
                  }}
                >
                  <option value="" disabled>
                    Choose list…
                  </option>
                  {broadcastLists.map((list) => (
                    <option key={list.id} value={list.id}>
                      {list.name} ({list.recipient_ids.length})
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        )}
      </div>
    </form>
  );
}
