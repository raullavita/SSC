/**
 * SSC libsignal group sender keys — main process (Step 2 / Engine 9).
 * File-backed SenderKeyStore using @signalapp/libsignal-client v0.96.4.
 */

const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const { FileJsonStore, resolveUnderRoot } = require('./secureFileStore');
const {
  ProtocolAddress,
  SenderKeyRecord,
  SenderKeyDistributionMessage,
  SenderKeyStore,
  processSenderKeyDistributionMessage,
  groupEncrypt,
  groupDecrypt,
} = require('@signalapp/libsignal-client');

function b64encode(buf) {
  return Buffer.from(buf).toString('base64');
}

function b64decode(str) {
  return new Uint8Array(Buffer.from(str, 'base64'));
}

class SscSenderKeyStore extends SenderKeyStore {
  constructor(store) {
    super();
    this.store = store;
  }

  async saveSenderKey(sender, distributionId, record) {
    const key = `${sender.toString()}:${distributionId}`;
    this.store.data[key] = b64encode(record.serialize());
    this.store.save();
  }

  async getSenderKey(sender, distributionId) {
    const key = `${sender.toString()}:${distributionId}`;
    const raw = this.store.data[key];
    if (!raw) return null;
    return SenderKeyRecord.deserialize(b64decode(raw));
  }
}

class GroupSenderKeySession {
  constructor(userDataPath) {
    this.root = resolveUnderRoot(userDataPath, 'ssc-signal');
    this.meta = { localUserId: null, deviceId: '1' };
    this.metaStore = new FileJsonStore(this.root, 'sender_key_meta.json');
    this.senderKeyStore = new SscSenderKeyStore(new FileJsonStore(this.root, 'sender_keys.json'));
  }

  configure({ deviceId, localUserId } = {}) {
    if (deviceId) this.meta.deviceId = String(deviceId);
    if (localUserId) this.meta.localUserId = localUserId;
  }

  localAddress() {
    const userId = this.meta.localUserId;
    if (!userId) {
      throw new Error('GroupSenderKeySession: localUserId not configured');
    }
    return ProtocolAddress.new(userId, Number(this.meta.deviceId) || 1);
  }

  peerAddress(peerId, deviceId = '1') {
    return ProtocolAddress.new(peerId, Number(deviceId) || 1);
  }

  _groupMeta(groupId) {
    if (!this.metaStore.data.groups) this.metaStore.data.groups = {};
    if (!this.metaStore.data.groups[groupId]) {
      this.metaStore.data.groups[groupId] = {
        distributionId: randomUUID(),
        distributed: false,
      };
      this.metaStore.save();
    }
    return this.metaStore.data.groups[groupId];
  }

  getDistributionState(groupId) {
    const group = this._groupMeta(groupId);
    return {
      distributionId: group.distributionId,
      distributed: Boolean(group.distributed),
    };
  }

  markDistributionSent(groupId) {
    const group = this._groupMeta(groupId);
    group.distributed = true;
    this.metaStore.save();
    return { ok: true };
  }

  async createDistributionMessage(groupId) {
    const group = this._groupMeta(groupId);
    const sender = this.localAddress();
    const dist = await SenderKeyDistributionMessage.create(
      sender,
      group.distributionId,
      this.senderKeyStore
    );
    return {
      distributionId: group.distributionId,
      ciphertext: b64encode(dist.serialize()),
    };
  }

  async processDistribution(senderId, deviceId, ciphertextB64) {
    const sender = this.peerAddress(senderId, deviceId);
    const message = SenderKeyDistributionMessage.deserialize(b64decode(ciphertextB64));
    await processSenderKeyDistributionMessage(sender, message, this.senderKeyStore);
    return { ok: true };
  }

  async encryptGroupPlaintext(groupId, plaintext) {
    const group = this._groupMeta(groupId);
    const sender = this.localAddress();
    const bytes = Buffer.from(String(plaintext), 'utf8');
    const ciphertext = await groupEncrypt(
      sender,
      group.distributionId,
      this.senderKeyStore,
      bytes
    );
    return b64encode(ciphertext.serialize());
  }

  async decryptGroupCiphertext(senderId, deviceId, ciphertextB64) {
    const sender = this.peerAddress(senderId, deviceId);
    const bytes = b64decode(ciphertextB64);
    const plain = await groupDecrypt(sender, this.senderKeyStore, bytes);
    return Buffer.from(plain).toString('utf8');
  }
}

let session = null;

function getGroupSenderKeySession(userDataPath) {
  if (!session) {
    session = new GroupSenderKeySession(userDataPath);
  }
  return session;
}

function wipeGroupSenderKeyData(userDataPath) {
  const root = resolveUnderRoot(userDataPath, 'ssc-signal');
  const errors = [];
  for (const name of ['sender_keys.json', 'sender_key_meta.json']) {
    const file = resolveUnderRoot(root, name);
    if (!fs.existsSync(file)) continue;
    try {
      fs.rmSync(file, { force: true });
    } catch (err) {
      errors.push({ file: name, error: err?.message || String(err) });
      console.error('[ssc] group key wipe failed', name, err?.message || err);
    }
  }
  session = null;
  return errors.length ? { ok: false, errors } : { ok: true };
}

module.exports = {
  GroupSenderKeySession,
  getGroupSenderKeySession,
  wipeGroupSenderKeyData,
};