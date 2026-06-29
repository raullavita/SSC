/**
 * Persistent libsignal store for SSC desktop — mirrors Android SscSignalStore.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  Direction,
  IdentityChange,
  IdentityKeyPair,
  KEMKeyPair,
  KyberPreKeyRecord,
  PreKeyRecord,
  PrivateKey,
  ProtocolAddress,
  PublicKey,
  SenderKeyRecord,
  SessionRecord,
  SessionStore,
  SignedPreKeyRecord,
} from '@signalapp/libsignal-client';

const PINNED_VERSION = '0.96.2';
const ONE_TIME_PREKEY_COUNT = 20;

const b64 = (buf) => Buffer.from(buf).toString('base64');
const dec = (str) => new Uint8Array(Buffer.from(str, 'base64'));

function addrKey(address) {
  return `${address.name()}:${address.deviceId()}`;
}

function senderKeyKey(sender, distributionId) {
  return `${addrKey(sender)}:${distributionId}`;
}

function generateRegistrationId() {
  return Math.floor(Math.random() * 16380) + 1;
}

export class SscDesktopSignalStore extends SessionStore {
  #root;
  #data;
  #dirty = false;

  constructor(userDataRoot) {
    super();
    this.#root = path.join(userDataRoot, 'ssc_signal_store_v1');
    fs.mkdirSync(this.#root, { recursive: true });
    this.#data = this.#load();
  }

  static forUserData(userDataPath) {
    return new SscDesktopSignalStore(userDataPath);
  }

  get pinnedVersion() {
    return PINNED_VERSION;
  }

  #filePath() {
    return path.join(this.#root, 'store.json');
  }

  #load() {
    const fp = this.#filePath();
    if (!fs.existsSync(fp)) {
      return {
        identity_key_pair: null,
        registration_id: generateRegistrationId(),
        signed_prekey_id: 1,
        kyber_prekey_id: 1,
        signed_prekey: null,
        kyber_prekey: null,
        prekeys: {},
        sessions: {},
        identities: {},
        sender_keys: {},
        prekey_ids: [],
        device_id: 1,
      };
    }
    return JSON.parse(fs.readFileSync(fp, 'utf8'));
  }

  #persist() {
    if (!this.#dirty) return;
    fs.writeFileSync(this.#filePath(), JSON.stringify(this.#data, null, 2), 'utf8');
    this.#dirty = false;
  }

  #touch() {
    this.#dirty = true;
    this.#persist();
  }

  async ensureLocalKeys() {
    if (!this.#data.identity_key_pair) {
      const identity = IdentityKeyPair.generate();
      this.#data.identity_key_pair = b64(identity.serialize());
    }
    if (!this.#data.signed_prekey) {
      const identity = IdentityKeyPair.deserialize(dec(this.#data.identity_key_pair));
      const signedPair = PrivateKey.generate();
      const signedPub = signedPair.getPublicKey();
      const sig = identity.privateKey.sign(signedPub.serialize());
      const signed = SignedPreKeyRecord.new(
        this.#data.signed_prekey_id,
        Date.now(),
        signedPub,
        signedPair,
        sig,
      );
      this.#data.signed_prekey = b64(signed.serialize());
    }
    if (!this.#data.kyber_prekey) {
      const identity = IdentityKeyPair.deserialize(dec(this.#data.identity_key_pair));
      const kyberPair = KEMKeyPair.generate();
      const sig = identity.privateKey.sign(kyberPair.getPublicKey().serialize());
      const kyber = KyberPreKeyRecord.new(this.#data.kyber_prekey_id, Date.now(), kyberPair, sig);
      this.#data.kyber_prekey = b64(kyber.serialize());
    }
    const existing = new Set(this.#data.prekey_ids || []);
    let nextId = 2;
    while (existing.size < ONE_TIME_PREKEY_COUNT) {
      while (existing.has(nextId)) nextId += 1;
      const kp = PrivateKey.generate();
      const rec = PreKeyRecord.new(nextId, kp.getPublicKey(), kp);
      this.#data.prekeys[String(nextId)] = b64(rec.serialize());
      existing.add(nextId);
      nextId += 1;
    }
    this.#data.prekey_ids = [...existing].sort((a, b) => a - b);
    this.#touch();
  }

  async getIdentityKey() {
    await this.ensureLocalKeys();
    const pair = IdentityKeyPair.deserialize(dec(this.#data.identity_key_pair));
    return pair.privateKey;
  }

  async getIdentityKeyPair() {
    await this.ensureLocalKeys();
    return IdentityKeyPair.deserialize(dec(this.#data.identity_key_pair));
  }

  async getLocalRegistrationId() {
    await this.ensureLocalKeys();
    return this.#data.registration_id;
  }

  async saveIdentity(name, key) {
    const k = addrKey(name);
    const prev = this.#data.identities[k];
    this.#data.identities[k] = b64(key.serialize());
    this.#touch();
    return prev ? IdentityChange.ReplacedExisting : IdentityChange.NewOrUnchanged;
  }

  async isTrustedIdentity(name, key, direction) {
    const existing = await this.getIdentity(name);
    if (!existing) return true;
    return existing.serialize().every((v, i) => v === key.serialize()[i]);
  }

  async getIdentity(name) {
    const raw = this.#data.identities[addrKey(name)];
    return raw ? PublicKey.deserialize(dec(raw)) : null;
  }

  async saveSession(name, record) {
    this.#data.sessions[addrKey(name)] = b64(record.serialize());
    this.#touch();
  }

  async getSession(name) {
    const raw = this.#data.sessions[addrKey(name)];
    return raw ? SessionRecord.deserialize(dec(raw)) : null;
  }

  async getExistingSessions(addresses) {
    const out = [];
    for (const addr of addresses) {
      const rec = await this.getSession(addr);
      if (!rec) throw new Error(`no session for ${addrKey(addr)}`);
      out.push(rec);
    }
    return out;
  }

  async savePreKey(id, record) {
    this.#data.prekeys[String(id)] = b64(record.serialize());
    if (!this.#data.prekey_ids.includes(id)) {
      this.#data.prekey_ids.push(id);
      this.#data.prekey_ids.sort((a, b) => a - b);
    }
    this.#touch();
  }

  async getPreKey(id) {
    const raw = this.#data.prekeys[String(id)];
    if (!raw) throw new Error(`missing prekey ${id}`);
    return PreKeyRecord.deserialize(dec(raw));
  }

  async removePreKey(id) {
    delete this.#data.prekeys[String(id)];
    this.#data.prekey_ids = (this.#data.prekey_ids || []).filter((x) => x !== id);
    this.#touch();
  }

  async saveSignedPreKey(id, record) {
    this.#data.signed_prekey_id = id;
    this.#data.signed_prekey = b64(record.serialize());
    this.#touch();
  }

  async getSignedPreKey(id) {
    await this.ensureLocalKeys();
    const rec = SignedPreKeyRecord.deserialize(dec(this.#data.signed_prekey));
    if (rec.id() !== id) throw new Error(`signed prekey id mismatch want=${id} have=${rec.id()}`);
    return rec;
  }

  async saveKyberPreKey(kyberPreKeyId, record) {
    this.#data.kyber_prekey_id = kyberPreKeyId;
    this.#data.kyber_prekey = b64(record.serialize());
    this.#touch();
  }

  async getKyberPreKey(kyberPreKeyId) {
    await this.ensureLocalKeys();
    const rec = KyberPreKeyRecord.deserialize(dec(this.#data.kyber_prekey));
    if (rec.id() !== kyberPreKeyId) throw new Error(`kyber id mismatch`);
    return rec;
  }

  async markKyberPreKeyUsed(kyberPreKeyId, signedPreKeyId, baseKey) {
    void kyberPreKeyId;
    void signedPreKeyId;
    void baseKey;
    this.#touch();
  }

  async saveSenderKey(sender, distributionId, record) {
    this.#data.sender_keys[senderKeyKey(sender, distributionId)] = b64(record.serialize());
    this.#touch();
  }

  async getSenderKey(sender, distributionId) {
    const raw = this.#data.sender_keys[senderKeyKey(sender, distributionId)];
    return raw ? SenderKeyRecord.deserialize(dec(raw)) : null;
  }

  async hasSenderKey(senderUserId, distributionId) {
    const sender = ProtocolAddress.new(senderUserId, 1);
    const rec = await this.getSenderKey(sender, distributionId);
    return !!rec;
  }

  getPreKeyIdList() {
    return [...(this.#data.prekey_ids || [])];
  }

  deleteSession(peerUserId) {
    const addr = ProtocolAddress.new(peerUserId, 1);
    const sessionKey = addrKey(addr);
    delete this.#data.sessions[sessionKey];
    const senderPrefix = `${sessionKey}:`;
    for (const key of Object.keys(this.#data.sender_keys)) {
      if (key.startsWith(senderPrefix)) {
        delete this.#data.sender_keys[key];
      }
    }
    this.#touch();
  }

  clearAllSessions() {
    this.#data.sessions = {};
    this.#data.sender_keys = {};
    this.#touch();
  }

  wipeAll() {
    try {
      const fp = this.#filePath();
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    } catch {
      /* ignore */
    }
    this.#data = {
      identity_key_pair: null,
      registration_id: generateRegistrationId(),
      signed_prekey_id: 1,
      kyber_prekey_id: 1,
      signed_prekey: null,
      kyber_prekey: null,
      prekeys: {},
      sessions: {},
      identities: {},
      sender_keys: {},
      prekey_ids: [],
    };
    this.#dirty = false;
  }

  getLocalDeviceId() {
    const id = parseInt(this.#data.device_id, 10);
    if (!Number.isFinite(id) || id < 1) return 1;
    return Math.min(5, id);
  }

  setLocalDeviceId(deviceId) {
    const safe = Math.max(1, Math.min(5, parseInt(deviceId, 10) || 1));
    this.#data.device_id = safe;
    this.#dirty = true;
    this.#persist();
    return safe;
  }

  async buildPreKeyBundleJson() {
    await this.ensureLocalKeys();
    const identity = await this.getIdentityKeyPair();
    const signed = SignedPreKeyRecord.deserialize(dec(this.#data.signed_prekey));
    const kyber = KyberPreKeyRecord.deserialize(dec(this.#data.kyber_prekey));
    const oneTime = [];
    for (const id of this.getPreKeyIdList()) {
      const pk = await this.getPreKey(id);
      oneTime.push({
        prekey_id: id,
        public: b64(pk.publicKey().serialize()),
      });
    }
    return {
      libsignal_version: PINNED_VERSION,
      registration_id: this.#data.registration_id,
      device_id: this.getLocalDeviceId(),
      identity_key_public: b64(identity.publicKey.serialize()),
      signed_prekey_id: signed.id(),
      signed_prekey_public: b64(signed.publicKey().serialize()),
      signed_prekey_signature: b64(signed.signature()),
      kyber_prekey_id: kyber.id(),
      kyber_prekey_public: b64(kyber.publicKey().serialize()),
      kyber_prekey_signature: b64(kyber.signature()),
      one_time_prekeys: oneTime,
    };
  }
}

export { ProtocolAddress, Direction, PINNED_VERSION as LIBSIGNAL_PINNED_VERSION };