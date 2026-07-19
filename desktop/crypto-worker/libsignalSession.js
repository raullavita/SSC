/**
 * SSC Electron libsignal session — main process only (Engine 11).
 * File-backed ProtocolStore + real @signalapp/libsignal-client v0.96.4.
 */

const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');
const { FileJsonStore, readSecureText, writeSecureText, resolveUnderRoot } = require('./secureFileStore');
const {
  IdentityKeyPair,
  PrivateKey,
  PublicKey,
  PreKeyRecord,
  SignedPreKeyRecord,
  KyberPreKeyRecord,
  KEMKeyPair,
  KEMPublicKey,
  PreKeyBundle,
  ProtocolAddress,
  SessionRecord,
  SessionStore,
  IdentityKeyStore,
  PreKeyStore,
  SignedPreKeyStore,
  KyberPreKeyStore,
  Direction,
  IdentityChange,
  processPreKeyBundle,
  signalEncrypt,
  signalDecrypt,
  signalDecryptPreKey,
  CiphertextMessageType,
  PreKeySignalMessage,
  SignalMessage,
  Fingerprint,
} = require('@signalapp/libsignal-client');

function b64encode(buf) {
  return Buffer.from(buf).toString('base64');
}

function b64decode(str) {
  return new Uint8Array(Buffer.from(str, 'base64'));
}

function randomRegistrationId() {
  return Math.floor(Math.random() * 16380) + 1;
}

class SscSessionStore extends SessionStore {
  constructor(store) {
    super();
    this.store = store;
  }

  async saveSession(name, record) {
    this.store.data[name.toString()] = b64encode(record.serialize());
    this.store.save();
  }

  async getSession(name) {
    const raw = this.store.data[name.toString()];
    if (!raw) return null;
    return SessionRecord.deserialize(b64decode(raw));
  }

  async getExistingSessions(addresses) {
    const out = [];
    for (const addr of addresses) {
      const rec = await this.getSession(addr);
      if (rec) out.push(rec);
    }
    return out;
  }
}

class SscIdentityStore extends IdentityKeyStore {
  constructor(dir, meta) {
    super();
    this.meta = meta;
    this.identityFile = resolveUnderRoot(dir, 'identity.json');
    this.trustedFile = resolveUnderRoot(dir, 'trusted.json');
    this._pair = null;
    this.trusted = {};
    if (fs.existsSync(this.trustedFile)) {
      try {
        this.trusted = JSON.parse(readSecureText(this.trustedFile));
      } catch {
        this.trusted = {};
      }
    }
  }

  _loadPair() {
    if (this._pair) return this._pair;
    if (fs.existsSync(this.identityFile)) {
      const doc = JSON.parse(readSecureText(this.identityFile));
      this._pair = IdentityKeyPair.deserialize(b64decode(doc.identityKeyPair));
      this.meta.registrationId = doc.registrationId;
      this.meta.deviceId = doc.deviceId;
      this.meta.localUserId = doc.localUserId;
      return this._pair;
    }
    this._pair = IdentityKeyPair.generate();
    this.meta.registrationId = randomRegistrationId();
    if (!this.meta.deviceId) this.meta.deviceId = '1';
    writeSecureText(
      this.identityFile,
      JSON.stringify({
        identityKeyPair: b64encode(this._pair.serialize()),
        registrationId: this.meta.registrationId,
        deviceId: this.meta.deviceId,
        localUserId: this.meta.localUserId || null,
      })
    );
    return this._pair;
  }

  async getIdentityKey() {
    return this._loadPair().privateKey;
  }

  async getIdentityKeyPair() {
    return this._loadPair();
  }

  async getLocalRegistrationId() {
    this._loadPair();
    return this.meta.registrationId;
  }

  async saveIdentity(name, key) {
    const k = name.toString();
    const prev = this.trusted[k];
    this.trusted[k] = b64encode(key.serialize());
    writeSecureText(this.trustedFile, JSON.stringify(this.trusted));
    return prev ? IdentityChange.ReplacedExisting : IdentityChange.NewOrUnchanged;
  }

  async isTrustedIdentity(name, key, direction) {
    const k = name.toString();
    const prev = this.trusted[k];
    if (!prev) return true;
    return b64encode(key.serialize()) === prev;
  }

  async getIdentity(name) {
    const raw = this.trusted[name.toString()];
    if (!raw) return null;
    return PublicKey.deserialize(b64decode(raw));
  }
}

class SscPreKeyStore extends PreKeyStore {
  constructor(store) {
    super();
    this.store = store;
  }

  async savePreKey(id, record) {
    this.store.data[String(id)] = b64encode(record.serialize());
    this.store.save();
  }

  async getPreKey(id) {
    const raw = this.store.data[String(id)];
    if (!raw) throw new Error(`prekey_missing:${id}`);
    return PreKeyRecord.deserialize(b64decode(raw));
  }

  async removePreKey(id) {
    delete this.store.data[String(id)];
    this.store.save();
  }
}

class SscSignedPreKeyStore extends SignedPreKeyStore {
  constructor(store) {
    super();
    this.store = store;
  }

  async saveSignedPreKey(id, record) {
    this.store.data[String(id)] = b64encode(record.serialize());
    this.store.save();
  }

  async getSignedPreKey(id) {
    const raw = this.store.data[String(id)];
    if (!raw) throw new Error(`signed_prekey_missing:${id}`);
    return SignedPreKeyRecord.deserialize(b64decode(raw));
  }
}

class SscKyberPreKeyStore extends KyberPreKeyStore {
  constructor(store) {
    super();
    this.store = store;
  }

  async saveKyberPreKey(id, record) {
    this.store.data[String(id)] = b64encode(record.serialize());
    this.store.save();
  }

  async getKyberPreKey(id) {
    const raw = this.store.data[String(id)];
    if (!raw) throw new Error(`kyber_prekey_missing:${id}`);
    return KyberPreKeyRecord.deserialize(b64decode(raw));
  }

  async markKyberPreKeyUsed(kyberPreKeyId, signedPreKeyId, baseKey) {
    // SSC marks used in memory only for installed-client MVP.
  }
}

class LibsignalSession {
  constructor(userDataPath) {
    this.root = resolveUnderRoot(userDataPath, 'ssc-signal');
    this.meta = { registrationId: null, deviceId: '1', localUserId: null };
    this.sessionStore = new SscSessionStore(new FileJsonStore(this.root, 'sessions.json'));
    this.identityStore = new SscIdentityStore(this.root, this.meta);
    this.preKeyStore = new SscPreKeyStore(new FileJsonStore(this.root, 'prekeys.json'));
    this.signedPreKeyStore = new SscSignedPreKeyStore(new FileJsonStore(this.root, 'signed_prekeys.json'));
    this.kyberPreKeyStore = new SscKyberPreKeyStore(new FileJsonStore(this.root, 'kyber_prekeys.json'));
    this._counterStore = new FileJsonStore(this.root, 'prekey_counters.json');
    this._loadPreKeyCounters();
  }

  _maxStoredId(store) {
    const ids = Object.keys(store.data || {})
      .map((k) => Number(k))
      .filter((n) => Number.isFinite(n) && n > 0);
    return ids.length ? Math.max(...ids) : 0;
  }

  _loadPreKeyCounters() {
    const saved = this._counterStore.data || {};
    this._signedPreKeyId = Math.max(saved.signedPreKeyId || 0, this._maxStoredId(this.signedPreKeyStore.store)) + 1;
    this._kyberPreKeyId = Math.max(saved.kyberPreKeyId || 0, this._maxStoredId(this.kyberPreKeyStore.store)) + 1;
    this._nextPreKeyId = Math.max(saved.nextPreKeyId || 0, this._maxStoredId(this.preKeyStore.store)) + 1;
  }

  _savePreKeyCounters() {
    this._counterStore.data = {
      signedPreKeyId: this._signedPreKeyId,
      kyberPreKeyId: this._kyberPreKeyId,
      nextPreKeyId: this._nextPreKeyId,
    };
    this._counterStore.save();
  }

  _fileDekPath() {
    return path.join(this.root, 'file_dek.json');
  }

  _getFileEncryptionKey() {
    const dekFile = this._fileDekPath();
    if (fs.existsSync(dekFile)) {
      const doc = JSON.parse(readSecureText(dekFile));
      return b64decode(doc.key);
    }
    const key = randomBytes(32);
    writeSecureText(dekFile, JSON.stringify({ key: b64encode(key) }));
    return key;
  }

  configure({ deviceId, localUserId } = {}) {
    if (deviceId) this.meta.deviceId = String(deviceId);
    if (localUserId) this.meta.localUserId = localUserId;
  }

  localAddress() {
    const userId = this.meta.localUserId || 'ssc-local';
    return ProtocolAddress.new(userId, Number(this.meta.deviceId) || 1);
  }

  peerAddress(peerId, deviceId = '1') {
    return ProtocolAddress.new(peerId, Number(deviceId) || 1);
  }

  async generatePreKeyBundle() {
    const identity = await this.identityStore.getIdentityKeyPair();
    const registrationId = await this.identityStore.getLocalRegistrationId();
    const deviceId = Number(this.meta.deviceId) || 1;

    const signedId = this._signedPreKeyId++;
    const signedPrivate = PrivateKey.generate();
    const signedPublic = signedPrivate.getPublicKey();
    const signedPreKey = SignedPreKeyRecord.new(
      signedId,
      Date.now(),
      signedPublic,
      signedPrivate,
      identity.privateKey.sign(signedPublic.serialize())
    );
    await this.signedPreKeyStore.saveSignedPreKey(signedId, signedPreKey);

    const preKeyId = this._nextPreKeyId++;
    const preKeyPrivate = PrivateKey.generate();
    const preKey = PreKeyRecord.new(preKeyId, preKeyPrivate.getPublicKey(), preKeyPrivate);
    await this.preKeyStore.savePreKey(preKeyId, preKey);

    const kyberId = this._kyberPreKeyId++;
    const kyberPair = KEMKeyPair.generate();
    const kyberSig = identity.privateKey.sign(kyberPair.getPublicKey().serialize());
    const kyberRecord = KyberPreKeyRecord.new(kyberId, Date.now(), kyberPair, kyberSig);
    await this.kyberPreKeyStore.saveKyberPreKey(kyberId, kyberRecord);
    this._savePreKeyCounters();

    return this._bundlePayload(identity, registrationId, signedPreKey, [preKey], kyberRecord);
  }

  async _createSignedPreKeyRecord(identity) {
    const signedId = this._signedPreKeyId++;
    const signedPrivate = PrivateKey.generate();
    const signedPublic = signedPrivate.getPublicKey();
    const signedPreKey = SignedPreKeyRecord.new(
      signedId,
      Date.now(),
      signedPublic,
      signedPrivate,
      identity.privateKey.sign(signedPublic.serialize())
    );
    await this.signedPreKeyStore.saveSignedPreKey(signedId, signedPreKey);
    return signedPreKey;
  }

  async _createKyberRecord(identity) {
    const kyberId = this._kyberPreKeyId++;
    const kyberPair = KEMKeyPair.generate();
    const kyberSig = identity.privateKey.sign(kyberPair.getPublicKey().serialize());
    const kyberRecord = KyberPreKeyRecord.new(kyberId, Date.now(), kyberPair, kyberSig);
    await this.kyberPreKeyStore.saveKyberPreKey(kyberId, kyberRecord);
    return kyberRecord;
  }

  async _createPreKeyRecords(count) {
    const records = [];
    for (let i = 0; i < count; i += 1) {
      const preKeyId = this._nextPreKeyId++;
      const preKeyPrivate = PrivateKey.generate();
      const preKey = PreKeyRecord.new(preKeyId, preKeyPrivate.getPublicKey(), preKeyPrivate);
      await this.preKeyStore.savePreKey(preKeyId, preKey);
      records.push(preKey);
    }
    return records;
  }

  _bundlePayload(identity, registrationId, signedPreKey, preKeyRecords, kyberRecord) {
    return {
      registrationId,
      identityKey: b64encode(identity.publicKey.serialize()),
      signedPreKey: {
        keyId: signedPreKey.id(),
        publicKey: b64encode(signedPreKey.publicKey().serialize()),
        signature: b64encode(signedPreKey.signature()),
      },
      preKeys: preKeyRecords.map((preKey) => ({
        keyId: preKey.id(),
        publicKey: b64encode(preKey.publicKey().serialize()),
      })),
      kyberPreKey: {
        keyId: kyberRecord.id(),
        publicKey: b64encode(kyberRecord.publicKey().serialize()),
        signature: b64encode(kyberRecord.signature()),
      },
    };
  }

  async generatePreKeyBatch(count = 50) {
    const identity = await this.identityStore.getIdentityKeyPair();
    const registrationId = await this.identityStore.getLocalRegistrationId();
    const signedPreKey = await this._createSignedPreKeyRecord(identity);
    const preKeyRecords = await this._createPreKeyRecords(count);
    const kyberRecord = await this._createKyberRecord(identity);
    this._savePreKeyCounters();
    return this._bundlePayload(identity, registrationId, signedPreKey, preKeyRecords, kyberRecord);
  }

  async rotateSignedPreKey() {
    const identity = await this.identityStore.getIdentityKeyPair();
    const signedPreKey = await this._createSignedPreKeyRecord(identity);
    const kyberRecord = await this._createKyberRecord(identity);
    this._savePreKeyCounters();
    return {
      signedPreKey: {
        keyId: signedPreKey.id(),
        publicKey: b64encode(signedPreKey.publicKey().serialize()),
        signature: b64encode(signedPreKey.signature()),
      },
      kyberPreKey: {
        keyId: kyberRecord.id(),
        publicKey: b64encode(kyberRecord.publicKey().serialize()),
        signature: b64encode(kyberRecord.signature()),
      },
    };
  }

  async generatePreKeyBatchOnly(count = 50) {
    const preKeyRecords = await this._createPreKeyRecords(count);
    this._savePreKeyCounters();
    return {
      preKeys: preKeyRecords.map((preKey) => ({
        keyId: preKey.id(),
        publicKey: b64encode(preKey.publicKey().serialize()),
      })),
    };
  }

  _bundleFromServer(peerBundle) {
    const deviceId = Number(peerBundle.device_id || peerBundle.deviceId || 1);
    const prekeys = peerBundle.prekeys || peerBundle.preKeys || [];
    const firstPreKey = prekeys[0] || null;
    let signed = peerBundle.signed_prekey || peerBundle.signedPreKey;
    const kyber = peerBundle.kyber_prekey || peerBundle.kyberPreKey;

    const identityKey = PublicKey.deserialize(b64decode(peerBundle.identity_key || peerBundle.identityKey));
    if (typeof signed === 'string') {
      signed = {
        key_id: peerBundle.signed_prekey_id,
        public_key: signed,
        signature: peerBundle.signed_prekey_signature,
      };
    }
    if (!signed || typeof signed !== 'object') {
      throw new Error('signed_prekey_required');
    }
    const signedPub = PublicKey.deserialize(b64decode(signed.public_key || signed.publicKey));
    const signedSig = b64decode(signed.signature || signed.signed_prekey_signature);

    let preKeyId = null;
    let preKeyPub = null;
    if (firstPreKey) {
      preKeyId = firstPreKey.key_id ?? firstPreKey.keyId;
      preKeyPub = PublicKey.deserialize(b64decode(firstPreKey.public_key || firstPreKey.publicKey));
    }

    if (!kyber?.public_key && !kyber?.publicKey) {
      throw new Error('kyber_prekey_required');
    }
    const kyberId = kyber.key_id ?? kyber.keyId ?? 0;
    const kyberPub = KEMPublicKey.deserialize(b64decode(kyber.public_key || kyber.publicKey));
    const kyberSig = b64decode(kyber.signature);

    return PreKeyBundle.new(
      peerBundle.registration_id ?? peerBundle.registrationId,
      deviceId,
      preKeyId,
      preKeyPub,
      signed.key_id ?? signed.keyId ?? signed.signed_prekey_id,
      signedPub,
      signedSig,
      identityKey,
      kyberId,
      kyberPub,
      kyberSig
    );
  }

  async establishSession(peerId, deviceId, peerBundle) {
    const remote = this.peerAddress(peerId, deviceId);
    const bundle = this._bundleFromServer(peerBundle);
    await processPreKeyBundle(
      bundle,
      remote,
      this.localAddress(),
      this.sessionStore,
      this.identityStore,
      new Date()
    );
    return { ok: true };
  }

  async encryptMessage(plaintext, peerId, deviceId = '1') {
    const remote = this.peerAddress(peerId, deviceId);
    const msg = await signalEncrypt(
      Buffer.from(String(plaintext), 'utf8'),
      remote,
      this.localAddress(),
      this.sessionStore,
      this.identityStore,
      new Date()
    );
    return { ciphertext: b64encode(msg.serialize()), messageType: msg.type() };
  }

  async decryptMessage(ciphertextB64, peerId, deviceId = '1') {
    const remote = this.peerAddress(peerId, deviceId);
    const bytes = b64decode(ciphertextB64);
    const typeByte = bytes[0];
    let plaintext;
    if (typeByte === CiphertextMessageType.PreKey) {
      const preKeyMsg = PreKeySignalMessage.deserialize(bytes);
      plaintext = await signalDecryptPreKey(
        preKeyMsg,
        remote,
        this.localAddress(),
        this.sessionStore,
        this.identityStore,
        this.preKeyStore,
        this.signedPreKeyStore,
        this.kyberPreKeyStore
      );
    } else {
      const signalMsg = SignalMessage.deserialize(bytes);
      plaintext = await signalDecrypt(
        signalMsg,
        remote,
        this.localAddress(),
        this.sessionStore,
        this.identityStore
      );
    }
    return Buffer.from(plaintext).toString('utf8');
  }

  async computeSafetyNumber(peerId, peerIdentityKeyB64) {
    const pair = await this.identityStore.getIdentityKeyPair();
    const remoteKey = PublicKey.deserialize(b64decode(peerIdentityKeyB64));
    const localUser = this.meta.localUserId || 'ssc-local';
    const localId = new TextEncoder().encode(localUser);
    const remoteId = new TextEncoder().encode(peerId);
    const fp = Fingerprint.new(2, 5200, localId, pair.publicKey, remoteId, remoteKey);
    return {
      displayable: fp.displayableFingerprint().toString(),
      localUser,
      peerId,
    };
  }

  async encryptBytes(arrayBuffer) {
    const bytes = new Uint8Array(arrayBuffer);
    const key = this._getFileEncryptionKey();
    const nonce = new Uint8Array(randomBytes(12));
    const { Aes256GcmSiv } = require('@signalapp/libsignal-client');
    const cipher = Aes256GcmSiv.new(key);
    const ciphertext = cipher.encrypt(bytes, nonce, new Uint8Array(0));
    const payload = JSON.stringify({
      v: 2,
      type: 'ssc_file',
      nonce: b64encode(nonce),
      data: b64encode(ciphertext),
    });
    return { ciphertext: b64encode(Buffer.from(payload, 'utf8')) };
  }

  async decryptBytes(ciphertextB64) {
    const outer = JSON.parse(Buffer.from(b64decode(ciphertextB64)).toString('utf8'));
    if (outer?.type !== 'ssc_file' || !outer.nonce || !outer.data) {
      throw new Error('ssc_file_invalid_envelope');
    }
    const key = this._getFileEncryptionKey();
    const { Aes256GcmSiv } = require('@signalapp/libsignal-client');
    const cipher = Aes256GcmSiv.new(key);
    const plain = cipher.decrypt(b64decode(outer.data), b64decode(outer.nonce), new Uint8Array(0));
    const plainBuf = Buffer.from(plain);
    return {
      buffer: plainBuf.buffer.slice(plainBuf.byteOffset, plainBuf.byteOffset + plainBuf.byteLength),
    };
  }
}

let session = null;

function getSession(userDataPath) {
  if (!session) {
    session = new LibsignalSession(userDataPath);
  }
  return session;
}

function wipeLocalData(userDataPath) {
  try {
    const { wipeGroupSenderKeyData } = require('./groupSenderKeySession');
    wipeGroupSenderKeyData(userDataPath);
  } catch (_) {
    /* optional */
  }
  const root = path.resolve(String(userDataPath || ''));
  const signalRoot = path.join(root, 'ssc-signal');
  if (fs.existsSync(signalRoot)) {
    fs.rmSync(signalRoot, { recursive: true, force: true });
  } else if (root && fs.existsSync(root) && path.basename(root) === 'ssc-signal') {
    fs.rmSync(root, { recursive: true, force: true });
  }
  session = null;
  return { ok: true };
}

module.exports = { LibsignalSession, getSession, wipeLocalData };