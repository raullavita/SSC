import React, { useCallback, useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Devices, LinkSimple } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useLocale } from '../context/LocaleContext';
import { getLocalDeviceId } from '../lib/signal/deviceStore';
import {
  buildDeviceLinkPayload,
  createDeviceLinkToken,
  fetchMyDevices,
  isLinkedDevicesFeatureAvailable,
  linkDeviceWithToken,
  parseDeviceLinkPayload,
  unlinkRemoteDevice,
} from '../lib/signal/devices';
import { ensurePreKeysUploaded } from '../lib/signal/prekeys';
import { isElectronApp, isNativeApp } from '../lib/platform';

function Section({ icon: Icon, title, children }) {
  return (
    <section className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Icon size={16} className="text-[#00E5FF]" />
        <h3 className="text-xs font-mono tracking-widest uppercase text-[#A1A1AA]">{title}</h3>
      </div>
      {children}
    </section>
  );
}

export default function LinkedDevicesSettingsSection() {
  const { t } = useLocale();
  const [devices, setDevices] = useState([]);
  const [localDeviceId, setLocalDeviceId] = useState(1);
  const [linkToken, setLinkToken] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [claimToken, setClaimToken] = useState('');
  const [busy, setBusy] = useState(false);

  const platformLabel = isElectronApp() ? 'desktop' : isNativeApp() ? 'android' : 'installed';

  const refresh = useCallback(async () => {
    if (!isLinkedDevicesFeatureAvailable()) return;
    setLocalDeviceId(getLocalDeviceId());
    try {
      const data = await fetchMyDevices();
      setDevices(data?.devices || []);
    } catch {
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!linkToken) {
      setQrDataUrl('');
      return;
    }
    QRCode.toDataURL(buildDeviceLinkPayload(linkToken), { margin: 1, width: 220 })
      .then(setQrDataUrl)
      .catch(() => setQrDataUrl(''));
  }, [linkToken]);

  if (!isLinkedDevicesFeatureAvailable()) return null;

  const startLink = async () => {
    setBusy(true);
    try {
      const data = await createDeviceLinkToken();
      setLinkToken(data?.token || '');
      toast.success(t('settingsLinkedDevicesQrReady'));
    } catch {
      toast.error(t('settingsLinkedDevicesLinkFailed'));
    } finally {
      setBusy(false);
    }
  };

  const claimLink = async () => {
    const parsed = parseDeviceLinkPayload(claimToken.trim());
    if (!parsed?.token) {
      toast.error(t('settingsLinkedDevicesInvalidToken'));
      return;
    }
    setBusy(true);
    try {
      await linkDeviceWithToken({
        token: parsed.token,
        platform: platformLabel,
        deviceName: `${platformLabel} ${new Date().toLocaleDateString()}`,
      });
      await ensurePreKeysUploaded();
      setClaimToken('');
      await refresh();
      toast.success(t('settingsLinkedDevicesLinked'));
    } catch {
      toast.error(t('settingsLinkedDevicesLinkFailed'));
    } finally {
      setBusy(false);
    }
  };

  const unlink = async (deviceId) => {
    if (deviceId === localDeviceId) {
      toast.error(t('settingsLinkedDevicesCannotUnlinkSelf'));
      return;
    }
    setBusy(true);
    try {
      await unlinkRemoteDevice(deviceId);
      await refresh();
      toast.success(t('settingsLinkedDevicesUnlinked'));
    } catch {
      toast.error(t('settingsLinkedDevicesUnlinkFailed'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section icon={Devices} title={t('settingsLinkedDevicesTitle')}>
      <p className="text-sm text-[#A1A1AA] mb-3">{t('settingsLinkedDevicesHint')}</p>
      <p className="text-xs font-mono text-[#71717A] mb-4">
        {t('settingsLinkedDevicesThisDevice', { id: String(localDeviceId) })}
      </p>

      <ul className="space-y-2 mb-4">
        {devices.map((d) => (
          <li
            key={d.device_id}
            className="flex items-center justify-between gap-2 rounded-lg border border-[#27272A] px-3 py-2 text-sm"
          >
            <span>
              {d.device_name || `Device ${d.device_id}`}
              {d.device_id === localDeviceId ? ` (${t('settingsLinkedDevicesThis')})` : ''}
            </span>
            {d.device_id !== localDeviceId && devices.length > 1 ? (
              <button
                type="button"
                className="text-xs text-red-400 hover:underline"
                disabled={busy}
                onClick={() => unlink(d.device_id)}
              >
                {t('settingsLinkedDevicesUnlink')}
              </button>
            ) : null}
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="ssc-btn-secondary w-full mb-3 flex items-center justify-center gap-2"
        disabled={busy}
        onClick={startLink}
      >
        <LinkSimple size={16} />
        {t('settingsLinkedDevicesShowQr')}
      </button>

      {qrDataUrl ? (
        <div className="flex flex-col items-center gap-2 mb-4 p-3 rounded-lg bg-[#18181B]">
          <img src={qrDataUrl} alt="" className="rounded bg-white p-2" />
          <p className="text-xs text-[#71717A] text-center">{t('settingsLinkedDevicesScanHint')}</p>
        </div>
      ) : null}

      <label className="block text-xs text-[#A1A1AA] mb-1">{t('settingsLinkedDevicesClaimLabel')}</label>
      <input
        className="ssc-input w-full mb-2 font-mono text-sm"
        value={claimToken}
        onChange={(e) => setClaimToken(e.target.value)}
        placeholder={t('settingsLinkedDevicesClaimPlaceholder')}
      />
      <button type="button" className="ssc-btn-primary w-full" disabled={busy} onClick={claimLink}>
        {t('settingsLinkedDevicesClaimButton')}
      </button>
    </Section>
  );
}