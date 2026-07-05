import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updatePrivacySettings } from '../lib/presence';
import { executePanicWipe } from '../lib/panicWipe';
import { api } from '../lib/api';
import { inviteWebUrl } from '../lib/inviteLink';
import { needsUsernameSetup } from '../lib/onboarding';
import styles from './Settings.module.css';

export default function Settings() {
  const { user, loading, logout, refreshUser } = useAuth();
  const [privacy, setPrivacy] = useState({ last_seen_visible: false, read_receipts: false });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [panicConfirm, setPanicConfirm] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    if (!user) return;
    api
      .get('/api/privacy')
      .then((data) => setPrivacy(data.privacy_settings || {}))
      .catch(() => {});
  }, [user]);

  if (!loading && !user) return <Navigate to="/login" replace />;
  if (!loading && user && needsUsernameSetup(user)) return <Navigate to="/setup-username" replace />;
  if (loading) return <div className={styles.page}>Loading…</div>;

  async function savePrivacy(patch) {
    setSaving(true);
    setMessage(null);
    try {
      const data = await updatePrivacySettings(patch);
      setPrivacy(data.privacy_settings);
      setMessage('Saved');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function copyInvite() {
    if (!user?.username) return;
    const url = inviteWebUrl(user.username, 'https://www.supersecurechat.com');
    try {
      await navigator.clipboard.writeText(url);
      setMessage('Invite link copied');
    } catch {
      setMessage(url);
    }
  }

  async function handlePanicWipe() {
    if (panicConfirm !== 'DELETE') return;
    setSaving(true);
    try {
      await executePanicWipe();
      await logout();
    } catch (err) {
      setMessage(err.message || 'Panic wipe failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link to="/chat" className={styles.back}>
          ← Back
        </Link>
        <h1>Settings</h1>
      </header>

      <section className={styles.section}>
        <h2>Profile</h2>
        <p className={styles.account}>
          <strong>{user.display_name || 'SSC user'}</strong>
          {user.username && <span className={styles.handle}>@{user.username}</span>}
        </p>
        {user.username ? (
          <button type="button" className={styles.logout} onClick={copyInvite}>
            Copy invite link
          </button>
        ) : (
          <Link to="/setup-username" className={styles.linkBtn}>
            Set your @username
          </Link>
        )}
      </section>

      <section className={styles.section}>
        <h2>Privacy</h2>
        <label className={styles.row}>
          <input
            type="checkbox"
            checked={Boolean(privacy.last_seen_visible)}
            onChange={(e) => savePrivacy({ last_seen_visible: e.target.checked })}
            disabled={saving}
          />
          <span>Show last seen</span>
        </label>
        <label className={styles.row}>
          <input
            type="checkbox"
            checked={Boolean(privacy.read_receipts)}
            onChange={(e) => savePrivacy({ read_receipts: e.target.checked })}
            disabled={saving}
          />
          <span>Read receipts</span>
        </label>
      </section>

      <section className={styles.section}>
        <button type="button" className={styles.toggle} onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? '▼ Hide advanced' : '▶ Advanced'}
        </button>
        {showAdvanced && (
          <div className={styles.advanced}>
            <Link to="/link-device" className={styles.linkBtn}>
              Link another device
            </Link>
            <p className={styles.hint}>Recovery keys, backups, and reports are in the web admin for now.</p>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <button type="button" onClick={logout} className={styles.logout}>
          Log out
        </button>
      </section>

      <section className={`${styles.section} ${styles.danger}`}>
        <h2>Delete everything</h2>
        <p className={styles.hint}>Type DELETE to wipe this account and device data.</p>
        <input
          type="text"
          className={styles.textInput}
          value={panicConfirm}
          onChange={(e) => setPanicConfirm(e.target.value)}
          placeholder="DELETE"
        />
        <button
          type="button"
          className={styles.panicBtn}
          disabled={panicConfirm !== 'DELETE' || saving}
          onClick={handlePanicWipe}
        >
          Panic wipe
        </button>
      </section>

      {message && <p className={styles.toast}>{message}</p>}
    </div>
  );
}