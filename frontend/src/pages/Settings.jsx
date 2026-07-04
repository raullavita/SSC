import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getAutoTranslateEnabled,
  getPreferredLanguage,
  setAutoTranslateEnabled,
  setPreferredLanguage,
} from '../lib/chatPrefs';
import { fetchLanguages } from '../lib/translation';
import { updatePrivacySettings } from '../lib/presence';
import { api } from '../lib/api';
import styles from './Settings.module.css';

export default function Settings() {
  const { user, loading, logout } = useAuth();
  const [privacy, setPrivacy] = useState({ last_seen_visible: false, read_receipts: false });
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [userLang, setUserLang] = useState('en');
  const [languages, setLanguages] = useState(['en', 'es', 'fr', 'de']);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    if (!user) return;
    api
      .get('/api/privacy')
      .then((data) => setPrivacy(data.privacy_settings || {}))
      .catch(() => {});
    setAutoTranslate(getAutoTranslateEnabled());
    setUserLang(getPreferredLanguage());
    fetchLanguages()
      .then(setLanguages)
      .catch(() => {});
  }, [user]);

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

  function handleLangChange(lang) {
    setUserLang(lang);
    setPreferredLanguage(lang);
    setMessage('Language preference saved locally');
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
        <p className={styles.hint}>
          SSC minimizes metadata. Read receipts and last seen are opt-in only.
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
        <p className={styles.hint}>
          Translation uses LibreTranslate via the SSC proxy. Text is sent only when you translate.
        </p>
      </section>

      <section className={styles.section}>
        <h2>Account</h2>
        <p className={styles.account}>
          <strong>{user.display_name || user.email}</strong>
          <code>{user.id}</code>
        </p>
      </section>

      {message && <p className={styles.toast}>{message}</p>}
    </div>
  );
}