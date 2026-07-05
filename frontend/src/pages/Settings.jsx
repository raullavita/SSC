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
import { runClientFootprintAudit } from '../lib/clientFootprintOrchestrator';
import { executePanicWipe } from '../lib/panicWipe';
import { fetchLanguages } from '../lib/translation';
import { updatePrivacySettings } from '../lib/presence';
import InviteQr from '../components/InviteQr';
import { api } from '../lib/api';
import { inviteAppUrl, inviteWebUrl } from '../lib/inviteLink';
import BackupPanel from '../components/BackupPanel';
import LinkedDevicesPanel from '../components/LinkedDevicesPanel';
import { useMultiDevice } from '../devices/useMultiDevice';
import styles from './Settings.module.css';

export default function Settings() {
  const { user, loading, logout, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [privacy, setPrivacy] = useState({ last_seen_visible: false, read_receipts: false });
  const [autoTranslate, setAutoTranslate] = useState(false);
  const [sealedSender, setSealedSender] = useState(true);
  const [linkPreviews, setLinkPreviews] = useState(false);
  const [localTranslateUrl, setLocalTranslateUrlState] = useState('');
  const [userLang, setUserLang] = useState('en');
  const [languages, setLanguages] = useState(['en', 'es', 'fr', 'de']);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [panicConfirm, setPanicConfirm] = useState('');
  const [footprintAudit, setFootprintAudit] = useState(null);
  const {
    devices,
    linkSession,
    createLink,
    loadDevices,
    revokeDevice,
    loading: deviceLoading,
    error: deviceError,
  } = useMultiDevice();
  const [linkLabel, setLinkLabel] = useState('New device');
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameBusy, setUsernameBusy] = useState(false);

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
    setUsernameInput(user.username || '');
    setFootprintAudit(runClientFootprintAudit());
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
    setMessage(
      enabled
        ? 'Auto-translate enabled — decrypted message text is sent to a translation service'
        : 'Auto-translate disabled'
    );
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

  async function saveUsername(e) {
    e.preventDefault();
    const value = usernameInput.trim();
    if (!value) return;
    setUsernameBusy(true);
    setMessage(null);
    try {
      const data = await api.patch('/api/users/me/username', { username: value });
      await refreshUser();
      setUsernameInput(data.user?.username || value);
      setMessage(`Username set to @${data.user?.username || value}`);
    } catch (err) {
      setMessage(err.body?.detail || err.message || 'Could not save username');
    } finally {
      setUsernameBusy(false);
    }
  }

  async function copyInvite() {
    if (!user?.username) return;
    const url = inviteWebUrl(user.username, window.location.origin);
    try {
      await navigator.clipboard.writeText(url);
      setMessage('Invite link copied');
    } catch {
      setMessage(url);
    }
  }

  function runSecurityCheck() {
    const audit = runClientFootprintAudit();
    setFootprintAudit(audit);
    if (audit.localStorage.ok) {
      setMessage('Device storage footprint is clean — no tokens in localStorage');
    } else {
      setMessage(
        `Security issue: remove forbidden localStorage keys: ${audit.localStorage.violations.join(', ')}`
      );
    }
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
        <p className={styles.hint}>
          Translation is off by default. When enabled, decrypted message plaintext is sent to the SSC
          proxy or your LibreTranslate URL — this is not end-to-end encrypted.
        </p>
        {autoTranslate && (
          <p className={styles.warning}>
            Privacy notice: auto-translate exposes message content to a third-party translation
            service. Use a self-hosted LibreTranslate URL to keep text on your network.
          </p>
        )}
        <label className={styles.row}>
          <input
            type="checkbox"
            checked={autoTranslate}
            onChange={(e) => handleAutoTranslateChange(e.target.checked)}
          />
          <span>Auto-translate incoming messages (off by default)</span>
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
        <h2>Encrypted backup</h2>
        <BackupPanel userId={user.id} onMessage={setMessage} />
      </section>

      <section className={styles.section}>
        <h2>Linked devices</h2>
        <LinkedDevicesPanel
          devices={devices}
          linkSession={linkSession}
          linkLabel={linkLabel}
          onLinkLabelChange={setLinkLabel}
          onCreateLink={() => createLink(linkLabel)}
          onRevoke={revokeDevice}
          loading={deviceLoading}
          error={deviceError}
          onMessage={setMessage}
        />
      </section>

      <section className={styles.section}>
        <h2>Username &amp; invites</h2>
        <p className={styles.hint}>
          Pick a public @username so people can find you without copying opaque IDs. No phone
          numbers required.
        </p>
        <form className={styles.rowStack} onSubmit={saveUsername}>
          <span>Username</span>
          <div className={styles.usernameRow}>
            <span className={styles.at}>@</span>
            <input
              className={styles.textInput}
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value.replace(/^@/, '').toLowerCase())}
              placeholder="alice"
              pattern="[a-z][a-z0-9_]{2,31}"
              title="3–32 chars: lowercase letters, numbers, underscore; must start with a letter"
            />
            <button type="submit" className={styles.logout} disabled={usernameBusy}>
              Save
            </button>
          </div>
        </form>
        {user.username && (
          <>
            <p className={styles.hint}>
              Invite link: <code>{inviteWebUrl(user.username, window.location.origin)}</code>
            </p>
            <p className={styles.hint}>
              App deep link: <code>{inviteAppUrl(user.username)}</code>
            </p>
            <button type="button" className={styles.logout} onClick={copyInvite}>
              Copy invite link
            </button>
            <InviteQr
              url={inviteWebUrl(user.username, window.location.origin)}
              label="Scan to add this contact in SSC"
            />
          </>
        )}
      </section>

      <section className={styles.section}>
        <h2>Account</h2>
        <p className={styles.account}>
          <strong>{user.display_name || user.id}</strong>
          {user.username && <span className={styles.handle}>@{user.username}</span>}
          <code>{user.id}</code>
        </p>
      </section>

      <section className={styles.section}>
        <h2>Device security check</h2>
        <p className={styles.hint}>
          SSC stores session tokens in httpOnly cookies only. This scan flags any JWT or token
          material accidentally left in localStorage.
        </p>
        <button type="button" className={styles.logout} onClick={runSecurityCheck}>
          Run storage footprint audit
        </button>
        {footprintAudit && (
          <p className={footprintAudit.localStorage.ok ? styles.hint : styles.warning}>
            {footprintAudit.localStorage.ok
              ? 'No forbidden auth material found in localStorage.'
              : `Violations: ${footprintAudit.localStorage.violations.join(', ')}`}
          </p>
        )}
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