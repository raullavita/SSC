/**
 * On-disk stores for Qt desktop crypto worker (no Electron safeStorage).
 * Uses AES-256-GCM with a machine-local key file under the user data root.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ENC_PREFIX = 'SSCENC2:';
const PLAIN_PREFIX = 'SSCPLAIN:';

function resolveUnderRoot(rootDir, ...segments) {
  const base = path.resolve(String(rootDir || ''));
  const safeSegments = segments.map((segment) => {
    const value = String(segment || '');
    if (!value || value === '.' || value.includes('..') || path.isAbsolute(value)) {
      throw new Error('invalid_path_segment');
    }
    if (value.includes('/') || value.includes('\\')) {
      throw new Error('invalid_path_segment');
    }
    return value;
  });
  const resolved = path.resolve(base, ...safeSegments);
  if (resolved !== base && !resolved.startsWith(`${base}${path.sep}`)) {
    throw new Error('path_outside_root');
  }
  return resolved;
}

function machineKeyPath(rootDir) {
  return path.join(path.resolve(rootDir), '.ssc-store-key');
}

function getMachineKey(rootDir) {
  const kp = machineKeyPath(rootDir);
  if (fs.existsSync(kp)) {
    return Buffer.from(fs.readFileSync(kp, 'utf8').trim(), 'base64');
  }
  const key = crypto.randomBytes(32);
  fs.mkdirSync(path.dirname(kp), { recursive: true });
  fs.writeFileSync(kp, key.toString('base64'), { mode: 0o600 });
  return key;
}

function encryptToDisk(rootDir, plaintext) {
  const key = getMachineKey(rootDir);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, tag, ct]).toString('base64');
}

function decryptFromDisk(rootDir, raw) {
  if (raw.startsWith(ENC_PREFIX)) {
    const key = getMachineKey(rootDir);
    const buf = Buffer.from(raw.slice(ENC_PREFIX.length), 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const ct = buf.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
  }
  if (raw.startsWith(PLAIN_PREFIX)) {
    return raw.slice(PLAIN_PREFIX.length);
  }
  return raw;
}

/** Module-level root set by worker configure */
let activeRoot = null;

function setActiveRoot(root) {
  activeRoot = root;
}

function readSecureText(file) {
  if (!fs.existsSync(file)) return '';
  const raw = fs.readFileSync(file, 'utf8');
  const root = activeRoot || path.dirname(file);
  return decryptFromDisk(root, raw);
}

function writeSecureText(file, plaintext) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const root = activeRoot || path.dirname(file);
  fs.writeFileSync(file, encryptToDisk(root, plaintext), { mode: 0o600 });
}

class FileJsonStore {
  constructor(dir, filename) {
    if (filename.includes('..') || path.isAbsolute(filename)) {
      throw new Error('invalid_store_filename');
    }
    this.file = resolveUnderRoot(dir, filename);
    this.data = {};
    if (fs.existsSync(this.file)) {
      try {
        this.data = JSON.parse(readSecureText(this.file));
      } catch {
        this.data = {};
      }
    }
  }

  save() {
    writeSecureText(this.file, JSON.stringify(this.data));
  }
}

module.exports = {
  FileJsonStore,
  readSecureText,
  writeSecureText,
  resolveUnderRoot,
  setActiveRoot,
};
