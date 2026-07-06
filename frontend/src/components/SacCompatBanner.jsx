import styles from './SacCompatBanner.module.css';

export default function SacCompatBanner() {
  if (process.env.REACT_APP_SSC_SAC_COMPAT !== 'true') return null;

  return (
    <div className={styles.banner} role="alert">
      <strong>Limited mode (Windows Smart App Control):</strong> native encryption is disabled in
      this build so the app can run. Messages are <strong>not</strong> end-to-end encrypted until a
      signed release is installed.
    </div>
  );
}