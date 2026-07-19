import { useEffect, useRef, useState } from 'react';
import EncryptionStatusChip from '../EncryptionStatusChip';
import { trustBadgeLabel } from '../../../lib/trustStore';
import styles from '../../../pages/ChatHome.module.css';

/**
 * P2: Single-row thread header — back · title · call · ⋮
 * Privacy, verify, video, and group extras live in the overflow menu.
 */
export default function ChatThreadHeader({
  showMobileBack,
  onMobileBack,
  title,
  presenceLabel,
  peerTyping,
  muted,
  pinned,
  isGroup,
  encryptionError,
  trust,
  trustLoading,
  onOpenSafetyVerify,
  onTogglePrivacy,
  onStartAudioCall,
  onStartVideoCall,
  onStartGroupAudioCall,
  onStartGroupVideoCall,
  groupCallError,
  groupCallMode,
  groupParticipantCount,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function onDoc(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const trustStatus = trust?.status || 'default';
  const verifyLabel =
    trustStatus === 'verified'
      ? 'Safety verified'
      : trustStatus === 'changed'
        ? 'Verify keys (changed)'
        : 'Verify safety number';

  const subtitle = peerTyping
    ? 'typing…'
    : presenceLabel || (muted ? 'Muted' : pinned ? 'Pinned' : '');

  function runAndClose(fn) {
    setMenuOpen(false);
    fn?.();
  }

  function onPrimaryCall() {
    if (isGroup) onStartGroupAudioCall?.();
    else onStartAudioCall?.();
  }

  return (
    <header className={styles.threadHeader}>
      <div className={styles.threadTitleRow}>
        <div className={styles.threadTitle}>
          {showMobileBack && (
            <button
              type="button"
              className={styles.mobileBack}
              onClick={onMobileBack}
              aria-label="Back to chats"
            >
              <span className={styles.mobileBackIcon} aria-hidden="true">
                ‹
              </span>
            </button>
          )}
          <span className={styles.threadTitleMain}>
            <strong title={title}>{title}</strong>
            {(subtitle || muted || pinned) && (
              <span className={styles.threadSubtitle}>
                {peerTyping ? (
                  <span className={styles.typing}>typing…</span>
                ) : presenceLabel ? (
                  <span className={styles.presenceLabel}>{presenceLabel}</span>
                ) : null}
                {!peerTyping && muted && (
                  <span className={styles.threadMetaChip} title="Notifications muted">
                    Muted
                  </span>
                )}
                {!peerTyping && pinned && (
                  <span className={styles.threadMetaChip} title="Pinned chat">
                    Pinned
                  </span>
                )}
              </span>
            )}
          </span>
        </div>

        <div className={styles.threadHeaderActions} ref={menuRef}>
          <EncryptionStatusChip error={encryptionError} compact />

          <button
            type="button"
            className={styles.headerIconBtn}
            onClick={onPrimaryCall}
            title={isGroup ? 'Group call' : 'Voice call'}
            aria-label={isGroup ? 'Start group call' : 'Start voice call'}
          >
            <span aria-hidden="true">📞</span>
          </button>

          <button
            type="button"
            className={`${styles.headerIconBtn} ${menuOpen ? styles.headerIconBtnActive : ''}`}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Chat options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            title="More"
          >
            <span aria-hidden="true">⋮</span>
          </button>

          {menuOpen && (
            <div className={styles.threadMenu} role="menu">
              {!isGroup ? (
                <button
                  type="button"
                  role="menuitem"
                  className={styles.threadMenuItem}
                  onClick={() => runAndClose(onStartVideoCall)}
                >
                  Video call
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    role="menuitem"
                    className={styles.threadMenuItem}
                    onClick={() => runAndClose(onStartGroupVideoCall)}
                  >
                    Group video
                  </button>
                  {groupCallMode === 'sfu' && (
                    <div className={styles.threadMenuMeta}>
                      SFU · {groupParticipantCount} participants
                    </div>
                  )}
                  {groupCallError && (
                    <div className={styles.threadMenuMeta} role="status">
                      {groupCallError}
                    </div>
                  )}
                </>
              )}

              <button
                type="button"
                role="menuitem"
                className={styles.threadMenuItem}
                onClick={() => runAndClose(onTogglePrivacy)}
              >
                Privacy
              </button>

              {!isGroup && (
                <button
                  type="button"
                  role="menuitem"
                  className={styles.threadMenuItem}
                  disabled={trustLoading}
                  onClick={() => runAndClose(onOpenSafetyVerify)}
                >
                  {verifyLabel}
                  <span className={styles.threadMenuHint}>
                    {trustBadgeLabel(trustStatus)}
                  </span>
                </button>
              )}

              {isGroup && (
                <div className={styles.threadMenuMeta}>Group end-to-end encryption</div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
