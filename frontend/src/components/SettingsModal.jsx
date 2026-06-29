import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  X, Gear, Translate, Code, ShieldCheck, LockKey, UserCircle, Camera, Bell, Lifebuoy, Eye,
} from '@phosphor-icons/react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useLocale } from '../context/LocaleContext';
import { LANGS } from '../lib/i18n';
import { isElectronApp, isInstalledClient, isNativeApp } from '../lib/platform';
import { userHasUnifiedIdentity } from '../lib/signalIdentityBootstrap';
import { prepareAvatarFile } from '../lib/avatarUpload';
import {
  COPYLEFT_NOTICES,
  SSC_LICENSE_LABEL,
  SSC_SOURCE_REPO_URL,
} from '../lib/openSourceLicenses';
import { fetchRetentionConfig } from '../lib/publicConfig';
import {
  DEFAULT_RETENTION_HOURS,
  formatRetentionDuration,
  normalizeRetentionHours,
  retentionOptionLabel,
  RETENTION_HOUR_OPTIONS,
} from '../lib/retentionDisplay';
import Avatar from './Avatar';
import TwoFAModal from './TwoFAModal';
import RecoveryKeyModal from './RecoveryKeyModal';
import HelpCenterModal from './HelpCenterModal';
import PanicButton from './PanicButton';
import { subscribePush } from '../lib/push';
import { subscribeNativePush } from '../lib/native-push';
import {
  areDesktopNotificationsEnabled,
  setDesktopNotificationsEnabled,
} from '../lib/desktopNotifications';
import { collectEncryptionDiagnostics } from '../chat/encryptionDiagnostics';
import { unwrapPrivateKey, wrapPrivateKey } from '../lib/crypto';
import { saveVaultCredential } from '../lib/vaultCredentialStore';
import { getAppVersion } from '../lib/appVersion';
import {
  checkForClientUpdate,
  downloadDesktopUpdate,
  installDesktopUpdate,
  openAndroidUpdateUrl,
} from '../lib/clientUpdates';
import {
  getDesktopUpdateStatus,
  subscribeDesktopUpdateStatus,
} from '../lib/desktopUpdates';
import {
  buildPrivacyPayload,
  DEFAULT_PRIVACY,
  LAST_SEEN_OPTIONS,
  privacyFromUser,
  PROFILE_PHOTO_OPTIONS,
} from '../lib/privacySettings';
import {
  linkPreviewsEnabled,
  setLinkPreviewsEnabled,
} from '../lib/linkPreviewPrefs';
import {
  gifSearchEnabled,
  setGifSearchEnabled,
} from '../lib/gifSearchPrefs';
import { normalizeDisplayNameInput } from '../lib/displayName';
import { BIO_MAX_LEN, normalizeProfileBioInput } from '../lib/profileBio';
import {
  deletePasskey,
  fetchPasskeyConfig,
  isPasskeySupported,
  listPasskeys,
  registerPasskey,
} from '../lib/passkeyAuth';

const APP_VERSION = getAppVersion();

function platformLabel(t) {
  if (isNativeApp()) return t('settingsPlatformAndroid');
  if (isElectronApp()) return t('settingsPlatformDesktop');
  if (isInstalledClient()) return t('settingsPlatformInstalled');
  return t('settingsPlatformDev');
}

function Section({ icon: Icon, title, children, testId }) {
  return (
    <section className="mb-5" data-testid={testId}>
      <div className="flex items-center gap-2 mb-3">
        <Icon size={14} className="text-[#00E5FF]" />
        <h4 className="text-[10px] font-mono tracking-[0.25em] uppercase text-[#A1A1AA]">{title}</h4>
      </div>
      {children}
    </section>
  );
}

const SUPPORT_EMAIL = 'contact@supersecurechat.com';
const SITE_URL = 'https://www.supersecurechat.com';

export default function SettingsModal({ open, onClose }) {
  const { user, refreshUser, panicWipe, logout } = useAuth();
  const { t, setLocale } = useLocale();
  const [language, setLanguage] = useState(user?.language || 'en');
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [twoFAOpen, setTwoFAOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [passkeysEnabled, setPasskeysEnabled] = useState(false);
  const [passkeys, setPasskeys] = useState([]);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [retentionHours, setRetentionHours] = useState(DEFAULT_RETENTION_HOURS);
  const [retentionOptions, setRetentionOptions] = useState(RETENTION_HOUR_OPTIONS);
  const [privacy, setPrivacy] = useState(() => ({ ...DEFAULT_PRIVACY }));
  const [blockedContacts, setBlockedContacts] = useState([]);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushOk, setPushOk] = useState(false);
  const [desktopNotifEnabled, setDesktopNotifEnabled] = useState(
    () => areDesktopNotificationsEnabled(),
  );
  const [linkPreviewOn, setLinkPreviewOn] = useState(() => linkPreviewsEnabled());
  const [gifSearchOn, setGifSearchOn] = useState(() => gifSearchEnabled());
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [encryptionDiag, setEncryptionDiag] = useState(null);
  const [updateBusy, setUpdateBusy] = useState(false);
  const [updateState, setUpdateState] = useState('idle');
  const [updateInfo, setUpdateInfo] = useState(null);
  const avatarInputRef = useRef(null);

  const canChangePassword = user?.auth_provider === 'password';

  useEffect(() => {
    if (open && user) {
      setLanguage(user.language || 'en');
      setDisplayName(user.display_name || '');
      setBio(user.bio || '');
      setRetentionHours(normalizeRetentionHours(user.retention_hours));
      setPrivacy(privacyFromUser(user));
    }
    if (open && isElectronApp()) {
      setDesktopNotifEnabled(areDesktopNotificationsEnabled());
    }
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const retention = await fetchRetentionConfig();
      if (!cancelled) {
        if (retention.allowedHours?.length) setRetentionOptions(retention.allowedHours);
        if (!user?.retention_hours) {
          setRetentionHours(normalizeRetentionHours(retention.hours));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [open, user?.retention_hours]);

  useEffect(() => {
    if (!open || !isInstalledClient() || !user) return undefined;
    let cancelled = false;
    (async () => {
      const diag = await collectEncryptionDiagnostics({ user });
      if (!cancelled) setEncryptionDiag(diag);
    })();
    return () => { cancelled = true; };
  }, [open, user]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      const cfg = await fetchPasskeyConfig();
      if (cancelled) return;
      setPasskeysEnabled(!!cfg.enabled && isPasskeySupported());
      if (cfg.enabled && isPasskeySupported()) {
        try {
          const rows = await listPasskeys();
          if (!cancelled) setPasskeys(rows);
        } catch {
          if (!cancelled) setPasskeys([]);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const { data } = await api.get('/contacts');
        if (!cancelled) {
          setBlockedContacts((data || []).filter((c) => c.blocked));
        }
      } catch {
        if (!cancelled) setBlockedContacts([]);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open || !isElectronApp()) return undefined;
    let cancelled = false;
    getDesktopUpdateStatus().then((status) => {
      if (!cancelled && status?.state) {
        setUpdateState(status.state);
        setUpdateInfo(status);
      }
    }).catch(() => {});
    return subscribeDesktopUpdateStatus((status) => {
      if (status?.state) {
        setUpdateState(status.state);
        setUpdateInfo(status);
      }
    });
  }, [open]);

  const updateStatusLabel = () => {
    const version = updateInfo?.version || updateInfo?.latestVersion;
    switch (updateState) {
      case 'checking':
        return t('settingsUpdateChecking');
      case 'current':
        return t('settingsUpdateCurrent');
      case 'available':
        return t('settingsUpdateAvailable', { version: version || '?' });
      case 'downloading':
        return t('settingsUpdateDownloading', {
          percent: Math.round(updateInfo?.percent ?? 0),
        });
      case 'ready':
        return t('settingsUpdateReady', { version: version || '?' });
      case 'installing':
        return t('settingsUpdateInstalling');
      case 'error':
        return t('settingsUpdateError');
      case 'unsupported':
        return t('settingsUpdateUnsupported');
      default:
        return t('settingsUpdateIdle');
    }
  };

  const runUpdateCheck = async () => {
    setUpdateBusy(true);
    try {
      const result = await checkForClientUpdate({ manual: true });
      setUpdateState(result.state);
      setUpdateInfo(result);
      if (result.state === 'current') toast.success(t('settingsUpdateCurrent'));
      else if (result.state === 'available') {
        toast.info(t('settingsUpdateAvailable', {
          version: result.version || result.latestVersion || '?',
        }));
      } else if (result.state === 'error') {
        toast.error(t('settingsUpdateError'));
      }
    } catch {
      setUpdateState('error');
      toast.error(t('settingsUpdateError'));
    } finally {
      setUpdateBusy(false);
    }
  };

  const runDesktopDownload = async () => {
    setUpdateBusy(true);
    try {
      const result = await downloadDesktopUpdate();
      if (result?.state === 'error') toast.error(t('settingsUpdateError'));
    } catch {
      toast.error(t('settingsUpdateError'));
    } finally {
      setUpdateBusy(false);
    }
  };

  const runDesktopInstall = async () => {
    setUpdateBusy(true);
    try {
      await installDesktopUpdate();
    } catch {
      toast.error(t('settingsUpdateError'));
      setUpdateBusy(false);
    }
  };

  const runAndroidUpdate = async () => {
    const url = updateInfo?.downloadUrl;
    if (!url) {
      toast.error(t('settingsUpdateError'));
      return;
    }
    setUpdateBusy(true);
    try {
      await openAndroidUpdateUrl(url);
    } catch {
      toast.error(t('settingsUpdateError'));
    } finally {
      setUpdateBusy(false);
    }
  };

  const enablePush = async () => {
    setPushBusy(true);
    try {
      await subscribePush().catch(() => {});
      const ok = await subscribeNativePush().catch(() => false);
      if (ok || !isNativeApp()) {
        setPushOk(true);
        toast.success(t('settingsPushEnabled'));
      } else {
        toast.error(t('settingsPushFailed'));
      }
    } catch {
      toast.error(t('settingsPushFailed'));
    } finally {
      setPushBusy(false);
    }
  };

  const toggleDesktopNotifications = () => {
    const next = !desktopNotifEnabled;
    setDesktopNotificationsEnabled(next);
    setDesktopNotifEnabled(next);
    toast.success(next ? t('settingsDesktopNotifOn') : t('settingsDesktopNotifOff'));
  };

  const deleteAccount = async (e) => {
    e.preventDefault();
    if ((deleteConfirm || '').trim() !== (user?.username || '')) {
      toast.error(t('settingsDeleteUsernameMismatch'));
      return;
    }
    if (canChangePassword && !deletePassword) {
      toast.error(t('settingsDeletePasswordRequired'));
      return;
    }
    if (!window.confirm(t('settingsDeleteConfirmDialog'))) return;
    setDeleteBusy(true);
    try {
      await api.post('/auth/delete-account', {
        username_confirmation: deleteConfirm.trim(),
        password: deletePassword || undefined,
      });
      toast.success(t('settingsDeleteSuccess'));
      onClose();
      await logout();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(detail || t('settingsDeleteFailed'));
    } finally {
      setDeleteBusy(false);
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pwNew.length < 8) {
      toast.error(t('settingsPasswordTooShort'));
      return;
    }
    if (pwNew !== pwConfirm) {
      toast.error(t('settingsPasswordMismatch'));
      return;
    }
    if (!user?.encrypted_private_key || !user?.pk_salt) {
      toast.error(t('settingsPasswordNoVault'));
      return;
    }
    setPwBusy(true);
    try {
      const pk = await unwrapPrivateKey(user.encrypted_private_key, user.pk_salt, pwCurrent);
      const jwk = await crypto.subtle.exportKey('jwk', pk);
      const wrapped = await wrapPrivateKey(jwk, pwNew);
      await api.post('/auth/change-password', {
        current_password: pwCurrent,
        new_password: pwNew,
        encrypted_private_key: wrapped.encrypted_private_key,
        pk_salt: wrapped.pk_salt,
      });
      if (user?.user_id) await saveVaultCredential(user.user_id, pwNew);
      await refreshUser();
      setPwCurrent('');
      setPwNew('');
      setPwConfirm('');
      toast.success(t('settingsPasswordChanged'));
    } catch (err) {
      const detail = err?.response?.data?.detail;
      toast.error(detail || t('settingsPasswordFailed'));
    } finally {
      setPwBusy(false);
    }
  };

  const unblockContact = async (uid) => {
    try {
      await api.post(`/contacts/${uid}/unblock`);
      setBlockedContacts((prev) => prev.filter((c) => c.user_id !== uid));
      toast.success(t('contactUnblocked'));
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('couldNotSave'));
    }
  };

  const saveProfile = async () => {
    setBusy(true);
    try {
      const payload = {};
      const savedDisplayName = (user?.display_name || '').trim() || null;
      let nextDisplayName = savedDisplayName;
      try {
        nextDisplayName = displayName.trim() ? normalizeDisplayNameInput(displayName) : null;
      } catch (err) {
        if (err?.message === 'DISPLAY_NAME_TOO_LONG') toast.error(t('settingsDisplayNameTooLong'));
        else if (err?.message === 'DISPLAY_NAME_AT') toast.error(t('settingsDisplayNameAt'));
        else toast.error(t('couldNotSave'));
        return;
      }
      if (nextDisplayName !== savedDisplayName) {
        payload.display_name = nextDisplayName ?? '';
      }
      const savedBio = (user?.bio || '').trim() || null;
      let nextBio = savedBio;
      try {
        nextBio = bio.trim() ? normalizeProfileBioInput(bio) : null;
      } catch (err) {
        if (err?.message === 'BIO_TOO_LONG') toast.error(t('settingsBioTooLong'));
        else if (err?.message === 'BIO_INVALID') toast.error(t('settingsBioInvalid'));
        else toast.error(t('couldNotSave'));
        return;
      }
      if (nextBio !== savedBio) {
        payload.bio = nextBio ?? '';
      }
      if (language !== (user?.language || 'en')) payload.language = language;
      const savedRetention = normalizeRetentionHours(user?.retention_hours);
      if (retentionHours !== savedRetention) payload.retention_hours = retentionHours;
      const privacyPatch = buildPrivacyPayload(user, privacy);
      if (privacyPatch) payload.privacy = privacyPatch;
      if (Object.keys(payload).length === 0) {
        onClose?.();
        return;
      }
      await api.patch('/users/me', payload);
      await refreshUser();
      if (payload.language) setLocale(payload.language);
      toast.success(t('settingsSaved'));
      onClose?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('couldNotSave'));
    } finally {
      setBusy(false);
    }
  };

  const onAvatarPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAvatarBusy(true);
    try {
      const prepared = await prepareAvatarFile(file);
      const form = new FormData();
      form.append('file', prepared);
      await api.post('/users/me/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      await refreshUser();
      toast.success(t('settingsAvatarUpdated'));
    } catch (err) {
      const code = err?.message;
      if (code === 'AVATAR_TYPE') toast.error(t('settingsAvatarTypeError'));
      else if (code === 'AVATAR_TOO_LARGE') toast.error(t('settingsAvatarSizeError'));
      else toast.error(err?.response?.data?.detail || t('settingsAvatarFailed'));
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    try {
      await api.delete('/users/me/avatar');
      await refreshUser();
      toast.success(t('settingsAvatarRemoved'));
    } catch {
      toast.error(t('settingsAvatarFailed'));
    } finally {
      setAvatarBusy(false);
    }
  };

  if (!open) return null;

  const messagesProtected = userHasUnifiedIdentity(user);
  const savedDisplayName = (user?.display_name || '').trim() || null;
  const draftDisplayName = displayName.replace(/\s+/g, ' ').trim() || null;
  const savedBio = (user?.bio || '').trim() || null;
  const draftBio = bio.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim() || null;
  const profileDirty = language !== (user?.language || 'en')
    || draftDisplayName !== savedDisplayName
    || draftBio !== savedBio
    || retentionHours !== normalizeRetentionHours(user?.retention_hours)
    || buildPrivacyPayload(user, privacy) != null;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-start justify-center pt-10 px-4 pb-8" onClick={onClose}>
        <div
          className="w-full max-w-md bg-[#121212] tac-border rounded-md fade-up max-h-[88vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272A] shrink-0">
            <div className="flex items-center gap-2">
              <Gear size={18} className="text-[#00E5FF]" />
              <h3 className="font-mono text-xs tracking-[0.25em]">{t('settings').toUpperCase()}</h3>
            </div>
            <button onClick={onClose} className="text-[#A1A1AA] hover:text-white" data-testid="settings-close">
              <X size={16} />
            </button>
          </div>

          <div className="overflow-y-auto px-4 py-4 flex-1">
            <Section icon={UserCircle} title={t('settingsProfile')} testId="settings-profile-section">
              <div className="flex items-center gap-4 p-3 bg-[#1A1A1A] rounded-md tac-border">
                <div className="relative">
                  <Avatar user={user} size="lg" />
                  <button
                    type="button"
                    disabled={avatarBusy}
                    onClick={() => avatarInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-[#00E5FF] text-black flex items-center justify-center shadow-lg"
                    data-testid="settings-avatar-upload"
                  >
                    <Camera size={14} weight="bold" />
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/*" hidden onChange={onAvatarPick} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{user?.email}</div>
                  {user?.avatar && (
                    <button
                      type="button"
                      onClick={removeAvatar}
                      disabled={avatarBusy}
                      className="mt-2 text-[10px] font-mono text-[#FF3B30] hover:underline"
                      data-testid="settings-avatar-remove"
                    >
                      {t('settingsRemoveAvatar')}
                    </button>
                  )}
                </div>
              </div>

              <label className="block mt-3 text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wider">
                {t('displayName')}
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('displayNamePlaceholder')}
                maxLength={48}
                className="w-full mt-1 px-3 py-2.5 text-sm bg-[#1A1A1A] border border-[#27272A] rounded-md text-[#F0F0F0]"
                data-testid="settings-display-name-input"
              />
              <p className="mt-1 text-[10px] font-mono text-[#71717A]">{t('displayNameHint')}</p>

              <label className="block mt-3 text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wider">
                {t('profileBio')}
              </label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t('profileBioPlaceholder')}
                maxLength={BIO_MAX_LEN}
                rows={3}
                className="w-full mt-1 px-3 py-2.5 text-sm bg-[#1A1A1A] border border-[#27272A] rounded-md text-[#F0F0F0] resize-y min-h-[4.5rem]"
                data-testid="settings-bio-input"
              />
              <p className="mt-1 text-[10px] font-mono text-[#71717A]">{t('profileBioHint', { max: BIO_MAX_LEN })}</p>

              <label className="block mt-3 text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wider">
                {t('username')}
              </label>
              <div
                className="w-full mt-1 px-3 py-2.5 text-sm bg-[#1A1A1A] border border-[#27272A] rounded-md font-mono text-[#F0F0F0]"
                data-testid="settings-username-display"
              >
                @{user?.username || '—'}
              </div>
              <p className="mt-1 text-[10px] font-mono text-[#71717A]">{t('settingsUsernameLocked')}</p>
            </Section>

            <Section icon={ShieldCheck} title={t('settingsSecurity')} testId="settings-security-section">
              <div className="p-3 bg-[#1A1A1A] rounded-md tac-border space-y-2 text-xs">
                <div className="flex justify-between gap-2">
                  <span className="text-[#A1A1AA]">{t('settingsMessagesProtected')}</span>
                  <span className={`font-mono ${messagesProtected ? 'text-[#34C759]' : 'text-[#FF9500]'}`}>
                    {messagesProtected ? t('settingsStatusReady') : t('settingsStatusPending')}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#A1A1AA]">{t('settingsAutoDelete')}</span>
                  <span className="font-mono text-[#34C759]" data-testid="settings-retention-value">
                    {formatRetentionDuration(retentionHours, t)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-[#A1A1AA]">{t('settingsTwoFa')}</span>
                  <span className={`font-mono ${user?.totp_enabled ? 'text-[#34C759]' : 'text-[#71717A]'}`}>
                    {user?.totp_enabled ? t('on') : t('off')}
                  </span>
                </div>
              </div>

              <div className="mt-3" data-testid="settings-retention-picker">
                <label className="block text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wider mb-1">
                  {t('settingsRetention')}
                </label>
                <select
                  value={retentionHours}
                  onChange={(e) => setRetentionHours(normalizeRetentionHours(e.target.value))}
                  className="w-full px-3 py-2.5 text-sm bg-[#1A1A1A] border border-[#27272A] rounded-md text-[#F0F0F0]"
                  data-testid="settings-retention-select"
                >
                  {retentionOptions.map((hours) => (
                    <option key={hours} value={hours}>
                      {retentionOptionLabel(hours, t)}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-[10px] text-[#71717A]">{t('settingsRetentionHint')}</p>
              </div>

              {canChangePassword && (
                <form onSubmit={changePassword} className="mt-3 space-y-2" data-testid="settings-change-password-form">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA]">{t('settingsChangePassword')}</p>
                  <input
                    type="password"
                    value={pwCurrent}
                    onChange={(e) => setPwCurrent(e.target.value)}
                    placeholder={t('settingsCurrentPassword')}
                    className="w-full px-3 py-2 text-sm bg-[#1A1A1A] border border-[#27272A] rounded-md"
                    autoComplete="current-password"
                    data-testid="settings-current-password"
                  />
                  <input
                    type="password"
                    value={pwNew}
                    onChange={(e) => setPwNew(e.target.value)}
                    placeholder={t('settingsNewPassword')}
                    className="w-full px-3 py-2 text-sm bg-[#1A1A1A] border border-[#27272A] rounded-md"
                    autoComplete="new-password"
                    data-testid="settings-new-password"
                  />
                  <input
                    type="password"
                    value={pwConfirm}
                    onChange={(e) => setPwConfirm(e.target.value)}
                    placeholder={t('settingsConfirmPassword')}
                    className="w-full px-3 py-2 text-sm bg-[#1A1A1A] border border-[#27272A] rounded-md"
                    autoComplete="new-password"
                    data-testid="settings-confirm-password"
                  />
                  <button
                    type="submit"
                    disabled={pwBusy || !pwCurrent || pwNew.length < 8 || pwNew !== pwConfirm}
                    className="w-full py-2.5 text-xs font-mono tracking-wider border border-[#27272A] rounded-md hover:bg-[#232323] disabled:opacity-40"
                    data-testid="settings-change-password-submit"
                  >
                    {pwBusy ? t('processing') : t('settingsChangePasswordSubmit')}
                  </button>
                </form>
              )}

              <div className="flex flex-col gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setTwoFAOpen(true)}
                  className="w-full py-2.5 text-xs font-mono tracking-wider border border-[#27272A] rounded-md hover:bg-[#232323]"
                  data-testid="settings-open-2fa"
                >
                  {user?.totp_enabled ? t('settingsManage2fa') : t('settingsEnable2fa')}
                </button>
              </div>

              {user?.encrypted_private_key && (
                <div className="mt-4" data-testid="settings-recovery-key">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA] mb-2">
                    {t('settingsRecoveryKey')}
                  </p>
                  <p className="text-[10px] text-[#71717A] mb-3">{t('settingsRecoveryKeyHint')}</p>
                  {user?.recovery_enabled && (
                    <p className="text-xs text-[#34C759] mb-2">{t('settingsRecoveryKeyEnabled')}</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setRecoveryOpen(true)}
                    className="w-full py-2.5 text-xs font-mono tracking-wider border border-[#27272A] rounded-md hover:bg-[#232323]"
                    data-testid="settings-open-recovery"
                  >
                    {user?.recovery_enabled ? t('settingsRecoveryKeyManage') : t('settingsRecoveryKeySetup')}
                  </button>
                </div>
              )}

              {passkeysEnabled && (
                <div className="mt-4" data-testid="settings-passkeys">
                  <p className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA] mb-2">{t('settingsPasskeys')}</p>
                  <p className="text-[10px] text-[#71717A] mb-3">{t('settingsPasskeysHint')}</p>
                  {passkeys.length === 0 ? (
                    <p className="text-xs text-[#71717A] mb-2">{t('settingsPasskeysEmpty')}</p>
                  ) : (
                    <ul className="space-y-2 mb-3">
                      {passkeys.map((pk) => (
                        <li
                          key={pk.credential_id}
                          className="flex items-center justify-between gap-2 p-2.5 bg-[#1A1A1A] rounded-md tac-border text-xs"
                        >
                          <span className="truncate">{pk.device_name || t('settingsPasskeyUnnamed')}</span>
                          <button
                            type="button"
                            disabled={passkeyBusy}
                            onClick={async () => {
                              setPasskeyBusy(true);
                              try {
                                await deletePasskey(pk.credential_id);
                                setPasskeys((prev) => prev.filter((row) => row.credential_id !== pk.credential_id));
                                toast.success(t('settingsPasskeyRemoved'));
                              } catch (e) {
                                toast.error(e?.response?.data?.detail || t('couldNotSave'));
                              } finally {
                                setPasskeyBusy(false);
                              }
                            }}
                            className="text-[10px] font-mono text-[#FF3B30] hover:underline shrink-0"
                            data-testid={`settings-passkey-remove-${pk.credential_id}`}
                          >
                            {t('settingsPasskeyRemove')}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                  <button
                    type="button"
                    disabled={passkeyBusy}
                    onClick={async () => {
                      setPasskeyBusy(true);
                      try {
                        await registerPasskey({ deviceName: t('settingsPasskeyDefaultName') });
                        const rows = await listPasskeys();
                        setPasskeys(rows);
                        toast.success(t('settingsPasskeyAdded'));
                      } catch (e) {
                        if (e?.message === 'PASSKEY_CANCELLED') toast.message(t('settingsPasskeyCancelled'));
                        else toast.error(e?.response?.data?.detail || t('settingsPasskeyFailed'));
                      } finally {
                        setPasskeyBusy(false);
                      }
                    }}
                    className="w-full py-2.5 text-xs font-mono tracking-wider border border-[#27272A] rounded-md hover:bg-[#232323] disabled:opacity-40"
                    data-testid="settings-add-passkey"
                  >
                    {passkeyBusy ? t('processing') : t('settingsPasskeyAdd')}
                  </button>
                </div>
              )}

              <div className="mt-4">
                <p className="text-[10px] font-mono uppercase tracking-wider text-[#A1A1AA] mb-2">{t('settingsEmergency')}</p>
                <p className="text-[10px] text-[#71717A] leading-relaxed mb-3 normal-case">{t('settingsEmergencyHint')}</p>
                <PanicButton onWipe={panicWipe} />
              </div>

              <form onSubmit={deleteAccount} className="mt-5 pt-4 border-t border-[#3F1010]" data-testid="settings-delete-account-form">
                <p className="text-[10px] font-mono uppercase tracking-wider text-[#FF453A] mb-2">{t('settingsDeleteAccount')}</p>
                <p className="text-[10px] text-[#71717A] leading-relaxed mb-3 normal-case">{t('settingsDeleteAccountHint')}</p>
                <input
                  type="text"
                  value={deleteConfirm}
                  onChange={(e) => setDeleteConfirm(e.target.value)}
                  placeholder={t('settingsDeleteUsernamePlaceholder', { username: user?.username || '' })}
                  className="w-full px-3 py-2 text-sm bg-[#1A1A1A] border border-[#3F1010] rounded-md mb-2"
                  autoComplete="off"
                  data-testid="settings-delete-username"
                />
                {canChangePassword && (
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                    placeholder={t('settingsDeletePasswordPlaceholder')}
                    className="w-full px-3 py-2 text-sm bg-[#1A1A1A] border border-[#3F1010] rounded-md mb-2"
                    autoComplete="current-password"
                    data-testid="settings-delete-password"
                  />
                )}
                <button
                  type="submit"
                  disabled={deleteBusy || deleteConfirm.trim() !== (user?.username || '') || (canChangePassword && !deletePassword)}
                  className="w-full py-2.5 text-xs font-mono tracking-wider border border-[#FF453A]/50 text-[#FF453A] rounded-md hover:bg-[#FF453A]/10 disabled:opacity-40"
                  data-testid="settings-delete-submit"
                >
                  {deleteBusy ? t('processing') : t('settingsDeleteAccountSubmit')}
                </button>
              </form>
            </Section>

            <Section icon={Eye} title={t('settingsPrivacy')} testId="settings-privacy-section">
              <label className="flex items-center justify-between gap-3 py-2 cursor-pointer">
                <span className="text-xs text-[#A1A1AA]">{t('settingsPrivacyReadReceipts')}</span>
                <input
                  type="checkbox"
                  checked={privacy.read_receipts}
                  onChange={(e) => setPrivacy((p) => ({ ...p, read_receipts: e.target.checked }))}
                  className="accent-[#00E5FF]"
                  data-testid="settings-privacy-read-receipts"
                />
              </label>
              <label className="flex items-center justify-between gap-3 py-2 cursor-pointer">
                <span className="text-xs text-[#A1A1AA]">{t('settingsPrivacyTyping')}</span>
                <input
                  type="checkbox"
                  checked={privacy.typing_indicators}
                  onChange={(e) => setPrivacy((p) => ({ ...p, typing_indicators: e.target.checked }))}
                  className="accent-[#00E5FF]"
                  data-testid="settings-privacy-typing"
                />
              </label>
              <div className="mt-2">
                <label className="block text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wider mb-1">
                  {t('settingsPrivacyLastSeen')}
                </label>
                <select
                  value={privacy.last_seen}
                  onChange={(e) => setPrivacy((p) => ({ ...p, last_seen: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm bg-[#1A1A1A] border border-[#27272A] rounded-md text-[#F0F0F0]"
                  data-testid="settings-privacy-last-seen"
                >
                  {LAST_SEEN_OPTIONS.map((mode) => (
                    <option key={mode} value={mode}>{t(`settingsPrivacyLastSeen_${mode}`)}</option>
                  ))}
                </select>
              </div>
              <div className="mt-3">
                <label className="block text-[10px] font-mono text-[#A1A1AA] uppercase tracking-wider mb-1">
                  {t('settingsPrivacyProfilePhoto')}
                </label>
                <select
                  value={privacy.profile_photo}
                  onChange={(e) => setPrivacy((p) => ({ ...p, profile_photo: e.target.value }))}
                  className="w-full px-3 py-2.5 text-sm bg-[#1A1A1A] border border-[#27272A] rounded-md text-[#F0F0F0]"
                  data-testid="settings-privacy-profile-photo"
                >
                  {PROFILE_PHOTO_OPTIONS.map((mode) => (
                    <option key={mode} value={mode}>{t(`settingsPrivacyProfilePhoto_${mode}`)}</option>
                  ))}
                </select>
              </div>
              <p className="mt-2 text-[10px] text-[#71717A]">{t('settingsPrivacyHint')}</p>
              <label className="flex items-center justify-between gap-3 py-2 mt-2 cursor-pointer border-t border-[#27272A]">
                <span className="text-xs text-[#A1A1AA]">{t('settingsLinkPreviews')}</span>
                <input
                  type="checkbox"
                  checked={linkPreviewOn}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setLinkPreviewOn(next);
                    setLinkPreviewsEnabled(next);
                  }}
                  className="accent-[#00E5FF]"
                  data-testid="settings-link-previews"
                />
              </label>
              <p className="text-[10px] text-[#71717A]">{t('settingsLinkPreviewsHint')}</p>
              <label className="flex items-center justify-between gap-3 py-2 mt-2 cursor-pointer border-t border-[#27272A]">
                <span className="text-xs text-[#A1A1AA]">{t('settingsGifSearch')}</span>
                <input
                  type="checkbox"
                  checked={gifSearchOn}
                  onChange={(e) => {
                    const next = e.target.checked;
                    setGifSearchOn(next);
                    setGifSearchEnabled(next);
                  }}
                  className="accent-[#00E5FF]"
                  data-testid="settings-gif-search"
                />
              </label>
              <p className="text-[10px] text-[#71717A]">{t('settingsGifSearchHint')}</p>
            </Section>

            <Section icon={UserCircle} title={t('settingsBlockedContacts')} testId="settings-blocked-section">
              {blockedContacts.length === 0 ? (
                <p className="text-xs text-[#71717A]">{t('settingsBlockedEmpty')}</p>
              ) : (
                <ul className="space-y-2">
                  {blockedContacts.map((c) => (
                    <li
                      key={c.user_id}
                      className="flex items-center justify-between gap-2 p-2.5 bg-[#1A1A1A] rounded-md tac-border text-sm"
                    >
                      <span className="truncate">{c.display_name || `@${c.username}`}</span>
                      <button
                        type="button"
                        onClick={() => unblockContact(c.user_id)}
                        className="text-[10px] font-mono text-[#00E5FF] hover:underline shrink-0"
                        data-testid={`settings-unblock-${c.user_id}`}
                      >
                        {t('settingsUnblock')}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            {isInstalledClient() && encryptionDiag && (
              <Section icon={ShieldCheck} title={t('settingsEncryptionDiag')} testId="settings-encryption-diag">
                <ul className="text-[10px] font-mono text-[#A1A1AA] space-y-1">
                  <li>{t('settingsEncryptionLibsignal')}: {encryptionDiag.libsignal_available ? '✓' : '✗'}</li>
                  {encryptionDiag.desktop_libsignal_init_error && (
                    <li className="text-[#FF3B30]">{t('settingsEncryptionDesktopInit')}: {encryptionDiag.desktop_libsignal_init_error}</li>
                  )}
                  <li>{t('settingsEncryptionSelfPrekeys')}: {encryptionDiag.self_prekeys_ready ? '✓' : '✗'}</li>
                  <li>{t('settingsEncryptionServerKeys')}: {encryptionDiag.server_identity_ready ? '✓' : '✗'}</li>
                  <li>{t('settingsEncryptionIdentityMatch')}: {
                    encryptionDiag.identity_matches_server === true ? '✓'
                      : encryptionDiag.identity_matches_server === false ? '✗' : '—'
                  }</li>
                </ul>
              </Section>
            )}

            <Section icon={Bell} title={t('settingsNotifications')} testId="settings-notifications-section">
              {isElectronApp() ? (
                <>
                  <button
                    type="button"
                    onClick={toggleDesktopNotifications}
                    className="w-full py-2.5 text-xs font-mono tracking-wider border border-[#27272A] rounded-md hover:bg-[#232323]"
                    data-testid="settings-desktop-notifications"
                  >
                    {desktopNotifEnabled ? t('settingsDesktopNotifOn') : t('settingsEnableDesktopNotif')}
                  </button>
                  <p className="mt-2 text-[10px] text-[#71717A]">{t('settingsDesktopNotifHint')}</p>
                </>
              ) : (
                <button
                  type="button"
                  disabled={pushBusy || pushOk}
                  onClick={enablePush}
                  className="w-full py-2.5 text-xs font-mono tracking-wider border border-[#27272A] rounded-md hover:bg-[#232323] disabled:opacity-50"
                  data-testid="settings-enable-push"
                >
                  {pushBusy ? t('processing') : pushOk ? t('settingsPushEnabled') : t('settingsEnablePush')}
                </button>
              )}
            </Section>

            <Section icon={Lifebuoy} title={t('settingsHelp')} testId="settings-help-section">
              <p className="text-xs text-[#A1A1AA] mb-3">{t('settingsHelpHint')}</p>
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="w-full mb-3 py-2.5 text-xs font-mono tracking-wider border border-[#27272A] rounded-md hover:bg-[#232323] text-left px-3"
                data-testid="settings-open-help-center"
              >
                {t('helpCenterOpen')}
              </button>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="text-xs text-[#00E5FF] hover:underline break-all block mb-2"
                data-testid="settings-support-email"
              >
                {SUPPORT_EMAIL}
              </a>
              <a
                href={SITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#71717A] hover:text-[#A1A1AA] hover:underline break-all"
              >
                {SITE_URL}
              </a>
            </Section>

            <Section icon={Translate} title={t('settingsPreferences')} testId="settings-preferences-section">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full px-3 py-2.5 text-sm bg-[#1A1A1A] border border-[#27272A] rounded-md text-[#F0F0F0]"
                data-testid="settings-language-select"
              >
                {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
              <p className="mt-2 text-[10px] text-[#71717A]">{t('settingsLanguageHint')}</p>
            </Section>

            <Section icon={Code} title={t('settingsAbout')} testId="settings-about">
              <div className="p-3 bg-[#1A1A1A] rounded-md tac-border mb-3">
                <div className="text-[10px] font-mono text-[#71717A]" data-testid="settings-app-version">
                  {t('settingsVersion')} {APP_VERSION} · {platformLabel(t)}
                </div>
              </div>
              {isInstalledClient() && (
                <div className="mb-3" data-testid="settings-updates">
                  <p className="text-[10px] text-[#A1A1AA] mb-2" data-testid="settings-update-status">
                    {updateStatusLabel()}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={runUpdateCheck}
                      disabled={updateBusy || updateState === 'checking' || updateState === 'downloading'}
                      data-testid="settings-check-updates"
                      className="px-3 py-2 text-xs rounded-md border border-[#27272A] text-[#F0F0F0] hover:bg-[#1A1A1A] transition disabled:opacity-40"
                    >
                      {updateBusy && updateState === 'checking' ? t('settingsUpdateChecking') : t('settingsCheckForUpdates')}
                    </button>
                    {isElectronApp() && updateState === 'available' && (
                      <button
                        type="button"
                        onClick={runDesktopDownload}
                        disabled={updateBusy}
                        data-testid="settings-download-update"
                        className="px-3 py-2 text-xs rounded-md bg-[#00E5FF] text-black font-medium hover:brightness-110 transition disabled:opacity-40"
                      >
                        {t('settingsUpdateDownload')}
                      </button>
                    )}
                    {isElectronApp() && updateState === 'ready' && (
                      <button
                        type="button"
                        onClick={runDesktopInstall}
                        disabled={updateBusy}
                        data-testid="settings-install-update"
                        className="px-3 py-2 text-xs rounded-md bg-[#00E5FF] text-black font-medium hover:brightness-110 transition disabled:opacity-40"
                      >
                        {t('settingsUpdateInstall')}
                      </button>
                    )}
                    {isNativeApp() && updateState === 'available' && (
                      <button
                        type="button"
                        onClick={runAndroidUpdate}
                        disabled={updateBusy}
                        data-testid="settings-open-update"
                        className="px-3 py-2 text-xs rounded-md bg-[#00E5FF] text-black font-medium hover:brightness-110 transition disabled:opacity-40"
                      >
                        {t('settingsUpdateOpen')}
                      </button>
                    )}
                  </div>
                </div>
              )}
              <p className="text-[10px] text-[#A1A1AA] mb-2">{t('settingsOpenSourceHint')}</p>
              <p className="text-[10px] font-mono text-[#71717A] mb-2">{SSC_LICENSE_LABEL}</p>
              <a href={SSC_SOURCE_REPO_URL} target="_blank" rel="noopener noreferrer" className="text-xs text-[#00E5FF] hover:underline break-all" data-testid="settings-source-link">
                {SSC_SOURCE_REPO_URL}
              </a>
            </Section>

            <p className="text-[10px] text-[#71717A] leading-relaxed flex gap-2 items-start">
              <LockKey size={12} className="shrink-0 mt-0.5 text-[#00E5FF]" />
              {t('settingsInstalledOnlyHint')}
            </p>
          </div>

          <div className="px-4 py-3 border-t border-[#27272A] shrink-0">
            <button
              type="button"
              onClick={saveProfile}
              disabled={busy || !profileDirty}
              data-testid="settings-save"
              className="w-full py-2.5 bg-[#00E5FF] text-black font-medium text-sm rounded-md hover:brightness-110 transition disabled:opacity-40"
            >
              {busy ? t('processing') : t('settingsSaveChanges')}
            </button>
          </div>
        </div>
      </div>

      <TwoFAModal open={twoFAOpen} onClose={() => { setTwoFAOpen(false); refreshUser(); }} />
      <RecoveryKeyModal
        open={recoveryOpen}
        onClose={() => { setRecoveryOpen(false); refreshUser(); }}
        recoveryEnabled={!!user?.recovery_enabled}
      />
      <HelpCenterModal open={helpOpen} onClose={() => setHelpOpen(false)} />
    </>
  );
}