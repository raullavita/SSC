import styles from './TrustBanner.module.css';

export default function TrustBanner({ trust, onVerify }) {
  if (!trust || trust.status !== 'changed') return null;

  return (
    <div className={styles.banner} role="alert">
      <div className={styles.copy}>
        <strong>Safety number changed</strong>
        <p>
          This contact&apos;s identity key changed since you last verified. Compare safety numbers
          before sharing sensitive information.
        </p>
      </div>
      <button type="button" className={styles.verifyBtn} onClick={onVerify}>
        Verify
      </button>
    </div>
  );
}