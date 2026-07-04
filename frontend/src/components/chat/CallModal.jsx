import { useEffect, useRef, useState } from 'react';
import styles from './CallModal.module.css';

export default function CallModal({
  open,
  status,
  peerLabel,
  isVideo,
  localStream,
  remoteStream,
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
    if (!localStream) return;
    localStream.getAudioTracks().forEach((t) => {
      t.enabled = !muted;
    });
  }, [muted, localStream]);

  if (!open) return null;

  const showVideo = isVideo && (localStream || remoteStream);
  const isIncoming = status === 'incoming' || status === 'ringing';
  const isConnected = status === 'connected' || status === 'connecting';

  return (
    <div className={styles.overlay} role="dialog" aria-label="Call">
      <div className={styles.modal}>
        <div className={styles.header}>
          <strong>{peerLabel || 'Call'}</strong>
          <span className={styles.status}>{status}</span>
        </div>

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
            <p>{isIncoming ? 'Incoming call…' : isConnected ? 'Connected' : 'Calling…'}</p>
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
          {onEnd && status !== 'idle' && (
            <button type="button" className={styles.endBtn} onClick={onEnd}>
              End call
            </button>
          )}
        </div>
      </div>
    </div>
  );
}