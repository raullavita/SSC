import { useEffect, useRef, useState } from 'react';
import styles from './CallModal.module.css';

const STATUS_LABELS = {
  idle: 'Idle',
  ringing: 'Ringing…',
  incoming: 'Incoming call',
  connecting: 'Connecting…',
  connected: 'Connected',
  failed: 'Call failed',
  declined: 'Declined',
  missed: 'Missed call',
  ended: 'Call ended',
  busy: 'Line busy',
};

export default function CallModal({
  open,
  status,
  peerLabel,
  isVideo,
  localStream,
  remoteStream,
  errorMessage,
  onAnswer,
  onDecline,
  onEnd,
}) {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localStream || null;
    }
  }, [localStream]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream || null;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream || null;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (!localStream?.getAudioTracks) return;
    localStream.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }, [muted, localStream]);

  if (!open) return null;

  const showVideo = isVideo && (localStream || remoteStream);
  const isIncoming = status === 'incoming' || status === 'ringing';
  const isConnected = status === 'connected' || status === 'connecting';
  const isTerminal = ['failed', 'declined', 'missed', 'ended', 'busy'].includes(status);
  const statusLabel = STATUS_LABELS[status] || status;

  return (
    <div className={styles.overlay} role="dialog" aria-label="Call">
      <div className={styles.modal}>
        <div className={styles.header}>
          <strong>{peerLabel || 'Call'}</strong>
          <span className={`${styles.status} ${status === 'failed' ? styles.statusError : ''}`}>
            {statusLabel}
          </span>
        </div>

        {errorMessage && <p className={styles.error}>{errorMessage}</p>}

        {showVideo ? (
          <div className={styles.videoGrid}>
            <div className={styles.videoWrap}>
              <video ref={remoteVideoRef} className={styles.video} autoPlay playsInline />
              <span className={styles.label}>Remote</span>
            </div>
            <div className={styles.videoWrap}>
              <video ref={localVideoRef} className={styles.video} autoPlay playsInline muted />
              <span className={styles.label}>You</span>
            </div>
          </div>
        ) : (
          <div className={styles.audioOnly}>
            <div className={styles.avatar}>{isVideo ? '📹' : '📞'}</div>
            <p>
              {isIncoming
                ? 'Incoming call…'
                : isConnected
                  ? 'Connected'
                  : isTerminal
                    ? statusLabel
                    : 'Calling…'}
            </p>
            <audio ref={remoteAudioRef} autoPlay playsInline />
          </div>
        )}

        <div className={styles.controls}>
          {isIncoming && onAnswer && (
            <button type="button" className={styles.answerBtn} onClick={onAnswer}>
              Answer
            </button>
          )}
          {isIncoming && onDecline && (
            <button type="button" className={styles.declineBtn} onClick={onDecline}>
              Decline
            </button>
          )}
          {isConnected && (
            <button
              type="button"
              className={`${styles.muteBtn} ${muted ? styles.muted : ''}`}
              onClick={() => setMuted((m) => !m)}
            >
              {muted ? 'Unmute' : 'Mute'}
            </button>
          )}
          {onEnd && !isTerminal && status !== 'idle' && (
            <button type="button" className={styles.endBtn} onClick={onEnd}>
              End call
            </button>
          )}
          {onEnd && isTerminal && (
            <button type="button" className={styles.endBtn} onClick={onEnd}>
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
}