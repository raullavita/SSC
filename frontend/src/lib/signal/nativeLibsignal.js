import { Capacitor, registerPlugin } from '@capacitor/core';
import { isElectronApp } from '../platform';
import { LIBSIGNAL_PINNED_VERSION } from './constants';

const SscLibsignal = registerPlugin('SscLibsignal', {
  web: () => import('./nativeLibsignalWeb').then((m) => new m.SscLibsignalWeb()),
});

function getLibsignalClient() {
  if (Capacitor.isNativePlatform()) return SscLibsignal;
  if (isElectronApp() && window.sscDesktop?.libsignal) return window.sscDesktop.libsignal;
  return null;
}

export function isNativeLibsignalAvailable() {
  return !!getLibsignalClient();
}

export async function getPinnedLibsignalVersion() {
  const client = getLibsignalClient();
  if (!client) {
    return { version: LIBSIGNAL_PINNED_VERSION, source: 'policy-only-browser-dev' };
  }
  return client.getPinnedVersion();
}

export async function generatePreKeyBundle() {
  const client = getLibsignalClient();
  if (!client) {
    throw new Error('Signal prekeys require an installed SSC app (Android, iOS, or desktop)');
  }
  const bundle = await client.generatePreKeyBundle();
  if (bundle?.libsignal_version && bundle.libsignal_version !== LIBSIGNAL_PINNED_VERSION) {
    throw new Error(`Unexpected libsignal version: ${bundle.libsignal_version}`);
  }
  return bundle;
}

export async function hasSignalSession(peerUserId) {
  const client = getLibsignalClient();
  if (!client) {
    return { has_session: false, skipped: true, reason: 'browser-dev' };
  }
  return client.hasSession({ peer_user_id: peerUserId });
}

export async function establishSignalSession(peerUserId, bundle, ourUserId) {
  const client = getLibsignalClient();
  if (!client) {
    throw new Error('Signal sessions require an installed SSC app (Android, iOS, or desktop)');
  }
  return client.establishSession({
    peer_user_id: peerUserId,
    our_user_id: ourUserId,
    bundle,
  });
}

export async function encryptSignalMessage(peerUserId, ourUserId, plaintext) {
  const client = getLibsignalClient();
  if (!client) {
    throw new Error('Signal encrypt requires an installed SSC app (Android, iOS, or desktop)');
  }
  return client.encryptSignalMessage({
    peer_user_id: peerUserId,
    our_user_id: ourUserId,
    plaintext,
  });
}

export async function decryptSignalMessage(peerUserId, ourUserId, ciphertext, signalMessageType) {
  const client = getLibsignalClient();
  if (!client) {
    throw new Error('Signal decrypt requires an installed SSC app (Android, iOS, or desktop)');
  }
  return client.decryptSignalMessage({
    peer_user_id: peerUserId,
    our_user_id: ourUserId,
    ciphertext,
    signal_message_type: signalMessageType,
  });
}

export async function createGroupSenderKeyDistribution(ourUserId, distributionId) {
  const client = getLibsignalClient();
  if (!client) {
    throw new Error('Group sender keys require an installed SSC app');
  }
  return client.createGroupSenderKeyDistribution({
    our_user_id: ourUserId,
    distribution_id: distributionId,
  });
}

export async function processGroupSenderKeyDistribution(senderUserId, skdm) {
  const client = getLibsignalClient();
  if (!client) {
    throw new Error('Group sender keys require an installed SSC app');
  }
  return client.processGroupSenderKeyDistribution({
    sender_user_id: senderUserId,
    skdm,
  });
}

export async function hasGroupSenderKey(senderUserId, distributionId) {
  const client = getLibsignalClient();
  if (!client) {
    return { has_sender_key: false, skipped: true, reason: 'browser-dev' };
  }
  return client.hasGroupSenderKey({
    sender_user_id: senderUserId,
    distribution_id: distributionId,
  });
}

export async function encryptGroupMessage(ourUserId, distributionId, plaintext) {
  const client = getLibsignalClient();
  if (!client) {
    throw new Error('Group encrypt requires an installed SSC app');
  }
  return client.encryptGroupMessage({
    our_user_id: ourUserId,
    distribution_id: distributionId,
    plaintext,
  });
}

export async function decryptGroupMessage(senderUserId, ciphertext) {
  const client = getLibsignalClient();
  if (!client) {
    throw new Error('Group decrypt requires an installed SSC app');
  }
  return client.decryptGroupMessage({
    sender_user_id: senderUserId,
    ciphertext,
  });
}

/** Panic wipe / reinstall — drop local Signal state so sessions can be rebuilt. */
export async function wipeLocalSignalStore() {
  const client = getLibsignalClient();
  if (!client?.resetLocalStore) return { wiped: false, reason: 'unavailable' };
  return client.resetLocalStore();
}