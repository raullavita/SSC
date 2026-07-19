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
import { DEFAULT_LANGUAGES } from '../lib/translation';
import { fetchTranslationConfig, getTranslationConfig } from '../lib/translationConfig';
import {
  clientFootprintClean,
  runClientFootprintAudit,
} from '../lib/clientFootprintOrchestrator';
import ChatPreferencesSection, {
  loadChatPreferenceDefaults,
} from '../components/settings/ChatPreferencesSection';
import SettingsSection from '../components/settings/SettingsSection';
import InviteQr from '../components/InviteQr';
import BroadcastListsPanel from '../components/BroadcastListsPanel';
import AbuseReportPanel from '../components/AbuseReportPanel';
import BlockedUsersPanel from '../components/BlockedUsersPanel';
import BackupPanel from '../components/BackupPanel';
import RecoveryPanel from '../components/RecoveryPanel';
import styles from './Settings.module.css';

/**
 * P4: Settings IA — grouped sections instead of one long dump.
 * Account → Privacy → Chats → Broadcast → Devices → Backup → Advanced → Danger
 */
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
  const [preferredLang, setPreferredLang] = useState(() => getPreferredLanguage());
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
      })
      .catch(() => {});
  }, [user]);

  if (!loading && !user) return <Navigate to="/login" replace />;
  if (!loading && user && needsUsernameSetup(user)) {
    return <Navigate to="/setup-username" replace />;
  }
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
        <Link to="/chat" className={styles.back} aria-label="Back to chats">
          ‹ Chats
        </Link>
        <h1>Settings</h1>
      </header>

      {/* 1. Account */}
      <SettingsSection id="account" title="Account" defaultOpen>
        <p className={styles.account}>
          <strong>{user.display_name || 'SSC user'}</strong>
          {user.username && <span className={styles.handle}>@{user.username}</span>}
        </p>
        {user.username ? (
          <div className={styles.accountActions}>
            <button type="button" className={styles.secondaryBtn} onClick={copyInvite}>
              Copy invite link
            </button>
            <InviteQr username={user.username} />
          </div>
        ) : (
          <Link to="/setup-username" className={styles.linkBtn}>
            Set your @username
          </Link>
        )}
        <button type="button" onClick={logout} className={styles.logoutBtn}>
          Log out
        </button>
      </SettingsSection>

      {/* 2. Privacy */}
      <SettingsSection id="privacy" title="Privacy" defaultOpen>
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
      </SettingsSection>

      {/* 3. Chats & notifications (includes language) */}
      <SettingsSection id="chats" title="Chat & notifications" defaultOpen>
        <ChatPreferencesSection
          embedded
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

        <div className={styles.divider} />

        <h3 className={styles.subheading}>Language</h3>
        <p className={styles.hint}>
          Auto-translate is controlled above. SSC translates on the server when enabled — no keys on
          your device.
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
          {translationReady
            ? 'available on SSC servers'
            : 'not enabled on the server yet — messages stay in their original language'}
        </p>
      </SettingsSection>

      {/* 4. Broadcast — secondary */}
      <SettingsSection id="broadcast" title="Broadcast lists" defaultOpen={false}>
        <BroadcastListsPanel onMessage={setMessage} />
      </SettingsSection>

      {/* 5. Devices */}
      <SettingsSection id="devices" title="Devices" defaultOpen={false}>
        <p className={styles.hint}>Link another phone or desktop and manage multi-device sync.</p>
        <Link to="/link-device" className={styles.linkBtn}>
          Linked devices &amp; sync →
        </Link>
      </SettingsSection>

      {/* 6. Backup */}
      <SettingsSection id="backup" title="Backup & recovery" defaultOpen={false}>
        <BackupPanel userId={user.id} onMessage={setMessage} />
        <div className={styles.divider} />
        <h3 className={styles.subheading}>Recovery</h3>
        <RecoveryPanel onMessage={setMessage} />
      </SettingsSection>

      {/* 7. Advanced */}
      <SettingsSection id="advanced" title="Advanced" defaultOpen={false}>
        <h3 className={styles.subheading}>Security check</h3>
        <p className={styles.hint}>
          Scan local storage for tokens or other data that should not persist on this device.
        </p>
        <button type="button" className={styles.secondaryBtn} onClick={runFootprintCheck}>
          Run footprint audit
        </button>
        {footprintOk === true && <p className={styles.toastInline}>Footprint clean</p>}
        {footprintOk === false && (
          <p className={styles.warning}>Review footprint issues above.</p>
        )}

        <div className={styles.divider} />
        <h3 className={styles.subheading}>Safety</h3>
        <AbuseReportPanel onMessage={setMessage} />
        <BlockedUsersPanel />
      </SettingsSection>

      {/* 8. Danger zone */}
      <SettingsSection id="danger" title="Delete everything" defaultOpen={false} danger>
        <p className={styles.hint}>Type DELETE to wipe this account and device data.</p>
        <input
          type="text"
          className={styles.textInput}
          value={panicConfirm}
          onChange={(e) => setPanicConfirm(e.target.value)}
          placeholder="DELETE"
          autoComplete="off"
        />
        <button
          type="button"
          className={styles.panicBtn}
          disabled={panicConfirm !== 'DELETE' || saving}
          onClick={handlePanicWipe}
        >
          Panic wipe
        </button>
      </SettingsSection>

      {message && (
        <p className={styles.toast} role="status">
          {message}
        </p>
      )}
    </div>
  );
}
