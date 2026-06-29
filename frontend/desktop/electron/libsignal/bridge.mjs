/**
 * libsignal bridge — API parity with Android SscLibsignalPlugin.
 */
import {
  CiphertextMessageType,
  groupDecrypt,
  groupEncrypt,
  PreKeyBundle,
  PreKeySignalMessage,
  processPreKeyBundle,
  processSenderKeyDistributionMessage,
  ProtocolAddress,
  PublicKey,
  SenderKeyDistributionMessage,
  signalDecrypt,
  signalDecryptPreKey,
  signalEncrypt,
  SignalMessage,
  KEMPublicKey,
} from '@signalapp/libsignal-client';
import { SscDesktopSignalStore, LIBSIGNAL_PINNED_VERSION } from './store.mjs';

const b64 = (buf) => Buffer.from(buf).toString('base64');
const dec = (str) => new Uint8Array(Buffer.from(str, 'base64'));

let store = null;

export function initLibsignalBridge(userDataPath) {
  store = SscDesktopSignalStore.forUserData(userDataPath);
  return { version: LIBSIGNAL_PINNED_VERSION };
}

function requireStore() {
  if (!store) throw new Error('libsignal bridge not initialized');
  return store;
}

function buildPreKeyBundle(bundle) {
  const identityKey = PublicKey.deserialize(dec(bundle.identity_key_public));
  const signedPreKey = PublicKey.deserialize(dec(bundle.signed_prekey_public));
  const signedSig = dec(bundle.signed_prekey_signature);
  const kyberKey = KEMPublicKey.deserialize(dec(bundle.kyber_prekey_public));
  const kyberSig = dec(bundle.kyber_prekey_signature);

  let preKeyId = null;
  let preKey = null;
  const oneTime = bundle.one_time_prekeys || [];
  if (oneTime.length > 0) {
    preKeyId = oneTime[0].prekey_id;
    preKey = PublicKey.deserialize(dec(oneTime[0].public));
  }

  return PreKeyBundle.new(
    bundle.registration_id,
    bundle.device_id || 1,
    preKeyId,
    preKey,
    bundle.signed_prekey_id,
    signedPreKey,
    signedSig,
    identityKey,
    bundle.kyber_prekey_id,
    kyberKey,
    kyberSig,
  );
}

export const libsignalHandlers = {
  async getPinnedVersion() {
    return { version: LIBSIGNAL_PINNED_VERSION, source: '@signalapp/libsignal-client' };
  },

  async getLocalDeviceId() {
    const s = requireStore();
    return { device_id: s.getLocalDeviceId() };
  },

  async setLocalDeviceId({ device_id: deviceId }) {
    const s = requireStore();
    return { device_id: s.setLocalDeviceId(deviceId) };
  },

  async generatePreKeyBundle() {
    const s = requireStore();
    return s.buildPreKeyBundleJson();
  },

  async hasSession({ peer_user_id: peerUserId, peer_device_id: peerDeviceId = 1 }) {
    const s = requireStore();
    await s.ensureLocalKeys();
    const addr = ProtocolAddress.new(peerUserId, peerDeviceId || 1);
    const session = await s.getSession(addr);
    return { has_session: !!session };
  },

  async establishSession({ peer_user_id: peerUserId, our_user_id: ourUserId, bundle }) {
    const s = requireStore();
    await s.ensureLocalKeys();
    const peerDev = bundle?.device_id || 1;
    const remote = ProtocolAddress.new(peerUserId, peerDev);
    const local = ProtocolAddress.new(ourUserId, s.getLocalDeviceId());
    const hadSession = !!(await s.getSession(remote));
    if (!hadSession) {
      const preKeyBundle = buildPreKeyBundle(bundle);
      await processPreKeyBundle(preKeyBundle, remote, local, s, s, new Date());
    }
    return {
      peer_user_id: peerUserId,
      established: !hadSession,
      already_had_session: hadSession,
      has_session: !!(await s.getSession(remote)),
    };
  },

  async encryptSignalMessage({
    peer_user_id: peerUserId,
    our_user_id: ourUserId,
    peer_device_id: peerDeviceId = 1,
    plaintext,
  }) {
    const s = requireStore();
    await s.ensureLocalKeys();
    const remote = ProtocolAddress.new(peerUserId, peerDeviceId || 1);
    const local = ProtocolAddress.new(ourUserId, s.getLocalDeviceId());
    const encrypted = await signalEncrypt(
      new TextEncoder().encode(plaintext),
      remote,
      local,
      s,
      s,
      new Date(),
    );
    return {
      protocol: 'signal_v1',
      ciphertext: b64(encrypted.serialize()),
      signal_message_type: encrypted.type(),
    };
  },

  async decryptSignalMessage({
    peer_user_id: peerUserId,
    our_user_id: ourUserId,
    peer_device_id: peerDeviceId = 1,
    ciphertext,
    signal_message_type: messageType,
  }) {
    const s = requireStore();
    await s.ensureLocalKeys();
    const remote = ProtocolAddress.new(peerUserId, peerDeviceId || 1);
    const local = ProtocolAddress.new(ourUserId, s.getLocalDeviceId());
    const serialized = dec(ciphertext);
    let plain;
    if (messageType === CiphertextMessageType.PreKey) {
      const msg = PreKeySignalMessage.deserialize(serialized);
      plain = await signalDecryptPreKey(msg, remote, local, s, s, s, s, s);
    } else if (messageType === CiphertextMessageType.Whisper) {
      const msg = SignalMessage.deserialize(serialized);
      plain = await signalDecrypt(msg, remote, local, s, s);
    } else {
      throw new Error(`unsupported signal_message_type: ${messageType}`);
    }
    return { plaintext: new TextDecoder().decode(plain) };
  },

  async createGroupSenderKeyDistribution({ our_user_id: ourUserId, distribution_id: distributionId }) {
    const s = requireStore();
    await s.ensureLocalKeys();
    const local = ProtocolAddress.new(ourUserId, 1);
    const skdm = await SenderKeyDistributionMessage.create(local, distributionId, s);
    return { skdm: b64(skdm.serialize()), distribution_id: distributionId };
  },

  async processGroupSenderKeyDistribution({ sender_user_id: senderUserId, skdm: skdmB64 }) {
    const s = requireStore();
    await s.ensureLocalKeys();
    const sender = ProtocolAddress.new(senderUserId, 1);
    const skdm = SenderKeyDistributionMessage.deserialize(dec(skdmB64));
    await processSenderKeyDistributionMessage(sender, skdm, s);
    return { processed: true };
  },

  async hasGroupSenderKey({ sender_user_id: senderUserId, distribution_id: distributionId }) {
    const s = requireStore();
    await s.ensureLocalKeys();
    const has = await s.hasSenderKey(senderUserId, distributionId);
    return { has_sender_key: has };
  },

  async encryptGroupMessage({ our_user_id: ourUserId, distribution_id: distributionId, plaintext }) {
    const s = requireStore();
    await s.ensureLocalKeys();
    const local = ProtocolAddress.new(ourUserId, 1);
    const encrypted = await groupEncrypt(
      local,
      distributionId,
      s,
      new TextEncoder().encode(plaintext),
    );
    return {
      protocol: 'signal_group_v1',
      ciphertext: b64(encrypted.serialize()),
      signal_message_type: encrypted.type(),
      distribution_id: distributionId,
    };
  },

  async decryptGroupMessage({ sender_user_id: senderUserId, ciphertext }) {
    const s = requireStore();
    await s.ensureLocalKeys();
    const sender = ProtocolAddress.new(senderUserId, 1);
    const plain = await groupDecrypt(sender, s, dec(ciphertext));
    return { plaintext: new TextDecoder().decode(plain) };
  },

  async deleteSession({ peer_user_id: peerUserId }) {
    if (!peerUserId) throw new Error('peer_user_id required');
    const s = requireStore();
    s.deleteSession(peerUserId);
    return { deleted: true };
  },

  async clearAllSessions() {
    const s = requireStore();
    s.clearAllSessions();
    return { cleared: true };
  },

  async resetLocalStore() {
    const s = requireStore();
    s.wipeAll();
    return { wiped: true };
  },
};

export async function invokeLibsignal(method, args = {}) {
  const handler = libsignalHandlers[method];
  if (!handler) throw new Error(`unknown libsignal method: ${method}`);
  return handler(args);
}