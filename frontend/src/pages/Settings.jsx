import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getAutoTranslateEnabled,
  getLinkPreviewsEnabled,
  getLocalTranslateUrl,
  getPreferredLanguage,
  getSealedSenderEnabled,
  setAutoTranslateEnabled,
  setLinkPreviewsEnabled,
  setLocalTranslateUrl,
  setPreferredLanguage,
  setSealedSenderEnabled,
} from '../lib/chatPrefs';
import { executePanicWipe } from '../lib/panicWipe';
import { fetchLanguages } from '../lib/translation';
import { updatePrivacySettings } from '../lib/presence';
import { api } from '../lib/api';
import { useMultiDevice } from '../devices/useMultiDevice';
import styles from './Settings.module.css';

export default function Settings() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();
  const [privacy, setPrivacy] = useState({ last_seen_visible: false, read_receipts: false });
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [sealedSender, setSealedSender] = useState(true);
  const [linkPreviews, setLinkPreviews] = useState(false);
  const [localTranslateUrl, setLocalTranslateUrlState] = useState('');
  const [userLang, setUserLang] = useState('en');
  const [languages, setLanguages] = useState(['en', 'es', 'fr', 'de']);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [panicConfirm, setPanicConfirm] = useState('');
  const {
    devices,
    linkToken,
    createLink,
    loadDevices,
    revokeDevice,
    loading: deviceLoading,
    error: deviceError,
  } = useMultiDevice();
  const [linkLabel, setLinkLabel] = useState('New device');

  useEffect(() => {
    if (!user) return;
    api
      .get('/api/privacy')
      .then((data) => setPrivacy(data.privacy_settings || {}))
      .catch(() => {});
    setAutoTranslate(getAutoTranslateEnabled());
    setSealedSender(getSealedSenderEnabled());
    setLinkPreviews(getLinkPreviewsEnabled());
    setLocalTranslateUrlState(getLocalTranslateUrl());
    setUserLang(getPreferredLanguage());
    fetchLanguages()
      .then(setLanguages)
      .catch(() => {});
    loadDevices();
  }, [user, loadDevices]);

  if (!loading && !user) return <Navigate to="/login" replace />;
  if (loading) return <div className={styles.page}>Loading…</div>;

  async function savePrivacy(patch) {
    setSaving(true);
    setMessage(null);
    try {
      const data = await updatePrivacySettings(patch);
      setPrivacy(data.privacy_settings);
      setMessage('Privacy settings saved');
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleAutoTranslateChange(enabled) {
    setAutoTranslate(enabled);
    setAutoTranslateEnabled(enabled);
    setMessage('Translation preference saved locally');
  }

  function handleSealedSenderChange(enabled) {
    setSealedSender(enabled);
    setSealedSenderEnabled(enabled);
    setMessage('Sealed sender preference saved');
  }

  function handleLinkPreviewsChange(enabled) {
    setLinkPreviews(enabled);
    setLinkPreviewsEnabled(enabled);
    setMessage(enabled ? 'Link previews enabled (client-only)' : 'Link previews disabled');
  }

  function handleLocalTranslateSave(url) {
    setLocalTranslateUrlState(url);
    setLocalTranslateUrl(url);
    setMessage(url ? 'Local LibreTranslate URL saved' : 'Using SSC translation proxy');
  }

  function handleLangChange(lang) {
    setUserLang(lang);
    setPreferredLanguage(lang);
    setMessage('Language preference saved locally');
  }

  async function handlePanicWipe() {
    if (panicConfirm !== 'DELETE') return;
    setSaving(true);
    setMessage(null);
    try {
      await executePanicWipe();
      await logout();
      navigate('/login', { replace: true });
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
          ← Back to chat
        </Link>
        <h1>Settings</h1>
        <button type="button" onClick={logout} className={styles.logout}>
          Log out
        </button>
      </header>

      <section className={styles.section}>
        <h2>Privacy</h2>
        <label className={styles.row}>
          <input
            type="checkbox"
            checked={Boolean(privacy.last_seen_visible)}
            onChange={(e) => savePrivacy({ last_seen_visible: e.target.checked })}
            disabled={saving}
          />
          <span>Show last seen to contacts</span>
        </label>
        <label className={styles.row}>
          <input
            type="checkbox"
            checked={Boolean(privacy.read_receipts)}
            onChange={(e) => savePrivacy({ read_receipts: e.target.checked })}
            disabled={saving}
          />
          <span>Send read receipts</span>
        </label>
        <label className={styles.row}>
          <input
            type="checkbox"
            checked={sealedSender}
            onChange={(e) => handleSealedSenderChange(e.target.checked)}
          />
          <span>Sealed sender (on by default — hides your ID from recipients)</span>
        </label>
        <label className={styles.row}>
          <input
            type="checkbox"
            checked={linkPreviews}
            onChange={(e) => handleLinkPreviewsChange(e.target.checked)}
          />
          <span>Link previews (off by default — opt in)</span>
        </label>
        <p className={styles.hint}>
          SSC minimizes metadata. Read receipts, last seen, and link previews are opt-in only.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Translation</h2>
        <label className={styles.row}>
          <input
            type="checkbox"
            checked={autoTranslate}
            onChange={(e) => handleAutoTranslateChange(e.target.checked)}
          />
          <span>Auto-translate incoming messages</span>
        </label>
        <label className={styles.row}>
          <span>Preferred language</span>
          <select value={userLang} onChange={(e) => handleLangChange(e.target.value)}>
            {languages.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.rowStack}>
          <span>Local LibreTranslate URL (optional)</span>
          <input
            type="url"
            className={styles.textInput}
            placeholder="http://localhost:5000"
            value={localTranslateUrl}
            onChange={(e) => handleLocalTranslateSave(e.target.value)}
          />
        </label>
        <p className={styles.hint}>
          Point to a self-hosted LibreTranslate instance so translation never leaves your network.
          Leave empty to use the SSC proxy.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Linked devices</h2>
        <p className={styles.hint}>Link Android or another desktop. Max 5 devices per account.</p>
        <label className={styles.rowStack}>
          <span>New device label</span>
          <input
            className={styles.textInput}
            value={linkLabel}
            onChange={(e) => setLinkLabel(e.target.value)}
          />
        </label>
        <button
          type="button"
          className={styles.logout}
          disabled={deviceLoading}
          onClick={() => createLink(linkLabel)}
        >
          Generate link
        </button>
        {linkToken && (
          <p className={styles.hint}>
            Open on the new device:{' '}
            <code>{`${window.location.origin}/link-device?token=${linkToken}`}</code>
          </p>
        )}
        {devices.map((d) => (
          <p key={d.id} className={styles.account}>
            {d.name} ({d.platform}) — <code>{d.id}</code>{' '}
            <button type="button" onClick={() => revokeDevice(d.id)} disabled={deviceLoading}>
              Revoke
            </button>
          </p>
        ))}
        {deviceError && <p className={styles.hint}>{deviceError}</p>}
      </section>

      <section className={styles.section}>
        <h2>Account</h2>
        <p className={styles.account}>
          <strong>{user.display_name || user.id}</strong>
          <code>{user.id}</code>
        </p>
      </section>

      <section className={`${styles.section} ${styles.danger}`}>
        <h2>Panic wipe</h2>
        <p className={styles.hint}>
          Deletes your account, devices, keys, and local storage on this device. Removes you from
          shared chats without deleting other people&apos;s messages. This cannot be undone.
        </p>
        <label className={styles.rowStack}>
          <span>Type DELETE to confirm</span>
          <input
            type="text"
            className={styles.textInput}
            value={panicConfirm}
            onChange={(e) => setPanicConfirm(e.target.value)}
            placeholder="DELETE"
          />
        </label>
        <button
          type="button"
          className={styles.panicBtn}
          disabled={panicConfirm !== 'DELETE' || saving}
          onClick={handlePanicWipe}
        >
          Wipe all data
        </button>
      </section>

      {message && <p className={styles.toast}>{message}</p>}
    </div>
  );
}