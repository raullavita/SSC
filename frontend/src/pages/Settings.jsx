import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updatePrivacySettings } from '../lib/presence';
import { executePanicWipe } from '../lib/panicWipe';
import { api } from '../lib/api';
import { inviteWebUrl } from '../lib/inviteLink';
import { needsUsernameSetup } from '../lib/onboarding';
import {
  getPreferredLanguage,
  setPreferredLanguage,
  getAutoTranslateEnabled,
} from '../lib/chatPrefs';
import { DEFAULT_LANGUAGES, getTranslationProviderStatus } from '../lib/translation';
import { fetchTranslationConfig, getTranslationConfig } from '../lib/translationConfig';
import {
  clientFootprintClean,
  runClientFootprintAudit,
} from '../lib/clientFootprintOrchestrator';
import ChatPreferencesSection, {
  loadChatPreferenceDefaults,
} from '../components/settings/ChatPreferencesSection';
import InviteQr from '../components/InviteQr';
import BroadcastListsPanel from '../components/BroadcastListsPanel';
import AbuseReportPanel from '../components/AbuseReportPanel';
import BlockedUsersPanel from '../components/BlockedUsersPanel';
import BackupPanel from '../components/BackupPanel';
import RecoveryPanel from '../components/RecoveryPanel';
import styles from './Settings.module.css';

export default function Settings() {
  const { user, loading, logout } = useAuth();
  const [privacy, setPrivacy] = useState({
    last_seen_visible: false,
    read_receipts: false,
    push_rich_labels: false,
  });
  const [chatPrefs, setChatPrefs] = useState(() => loadChatPreferenceDefaults());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [panicConfirm, setPanicConfirm] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [preferredLang, setPreferredLang] = useState(() => getPreferredLanguage());
  const [providerStatus, setProviderStatus] = useState(() => getTranslationProviderStatus());
  const [translationReady, setTranslationReady] = useState(() => getTranslationConfig().enabled);
  const [footprintOk, setFootprintOk] = useState(null);

  useEffect(() => {
    if (!user) return;
    api
      .get('/api/privacy')
      .then((data) => setPrivacy(data.privacy_settings || {}))
      .catch(() => {});
    fetchTranslationConfig()
      .then((cfg) => {
        setTranslationReady(cfg.enabled);
        setProviderStatus(getTranslationProviderStatus());
      })
      .catch(() => {});
  }, [user]);

  if (!loading && !user) return <Navigate to="/login" replace />;
  if (!loading && user && needsUsernameSetup(user)) return <Navigate to="/setup-username" replace />;
  if (loading) return <div className={styles.page}>Loading…</div>;

  function notifyPrefChange(text) {
    setMessage(text);
  }

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

  function runFootprintCheck() {
    const audit = runClientFootprintAudit();
    const ok = clientFootprintClean();
    setFootprintOk(ok);
    if (ok) {
      setMessage('Device footprint check passed');
    } else {
      setMessage(
        `Footprint issues: ${audit.localStorage.violations.join(', ') || 'unknown'}`
      );
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
          <>
            <button type="button" className={styles.logout} onClick={copyInvite}>
              Copy invite link
            </button>
            <InviteQr username={user.username} />
          </>
        ) : (
          <Link to="/setup-username" className={styles.linkBtn}>
            Set your @username
          </Link>
        )}
      </section>

      <ChatPreferencesSection
        sealedSender={chatPrefs.sealedSender}
        linkPreviews={chatPrefs.linkPreviews}
        autoTranslate={chatPrefs.autoTranslate}
        pushRichLabels={Boolean(privacy.push_rich_labels)}
        saving={saving}
        onSealedSenderChange={(enabled) => {
          setChatPrefs((prev) => ({ ...prev, sealedSender: enabled }));
          notifyPrefChange(enabled ? 'Sealed sender enabled' : 'Sealed sender disabled');
        }}
        onLinkPreviewsChange={(enabled) => {
          setChatPrefs((prev) => ({ ...prev, linkPreviews: enabled }));
          notifyPrefChange(enabled ? 'Link previews enabled' : 'Link previews disabled');
        }}
        onAutoTranslateChange={(enabled) => {
          setChatPrefs((prev) => ({ ...prev, autoTranslate: enabled }));
          notifyPrefChange(enabled ? 'Auto-translate enabled' : 'Auto-translate disabled');
        }}
        onPushRichLabelsChange={(enabled) => savePrivacy({ push_rich_labels: enabled })}
      />

      <section className={styles.section}>
        <h2>Language</h2>
        <p className={styles.hint}>
          Auto-translate is controlled in Chat &amp; notifications above. SSC provides translation
          from the server when enabled — no API keys or setup on your device.
        </p>
        {getAutoTranslateEnabled() && !translationReady && (
          <p className={styles.warning}>
            Auto-translate is on, but the SSC translation service is not enabled yet. Messages stay
            in their original language until we turn the service on.
          </p>
        )}
        <label className={styles.rowStack}>
          <span>Your language</span>
          <select
            className={styles.textInput}
            value={preferredLang}
            onChange={(e) => {
              setPreferredLang(e.target.value);
              setPreferredLanguage(e.target.value);
              setMessage('Language saved');
            }}
          >
            {DEFAULT_LANGUAGES.map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>
        </label>
        <p className={styles.hint}>
          Translation service:{' '}
          {translationReady ? 'available (SSC server)' : 'coming soon'}
          {providerStatus.serverProxy === 'available' ? '' : ''}
        </p>
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
        <h2>Broadcast lists</h2>
        <BroadcastListsPanel onMessage={setMessage} />
      </section>

      <section className={styles.section}>
        <h2>Backup &amp; restore</h2>
        <BackupPanel userId={user.id} onMessage={setMessage} />
      </section>

      <section className={styles.section}>
        <h2>Security check</h2>
        <p className={styles.hint}>
          Scan local storage for tokens or other data that should not persist on this device.
        </p>
        <button type="button" className={styles.logout} onClick={runFootprintCheck}>
          Run footprint audit
        </button>
        {footprintOk === true && <p className={styles.toastInline}>Footprint clean</p>}
        {footprintOk === false && (
          <p className={styles.warning}>Review footprint issues above.</p>
        )}
      </section>

      <section className={styles.section}>
        <button type="button" className={styles.toggle} onClick={() => setShowAdvanced((v) => !v)}>
          {showAdvanced ? '▼ Hide advanced' : '▶ Advanced'}
        </button>
        {showAdvanced && (
          <div className={styles.advanced}>
            <Link to="/link-device" className={styles.linkBtn}>
              Linked devices
            </Link>
            <RecoveryPanel onMessage={setMessage} />
            <AbuseReportPanel onMessage={setMessage} />
            <BlockedUsersPanel />
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