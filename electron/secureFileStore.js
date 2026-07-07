/**
 * Encrypted on-disk JSON stores — Electron safeStorage (Phase 2).
 */

const fs = require('fs');
const path = require('path');
const { safeStorage } = require('electron');

const ENC_PREFIX = 'SSCENC1:';
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

function readSecureText(file) {
  if (!fs.existsSync(file)) return '';
  const raw = fs.readFileSync(file, 'utf8');
  if (raw.startsWith(ENC_PREFIX)) {
    if (!safeStorage.isEncryptionAvailable()) {
      throw new Error('ssc_safe_storage_unavailable');
    }
    const payload = Buffer.from(raw.slice(ENC_PREFIX.length), 'base64');
    return safeStorage.decryptString(payload);
  }
  if (raw.startsWith(PLAIN_PREFIX)) {
    return raw.slice(PLAIN_PREFIX.length);
  }
  return raw;
}

function writeSecureText(file, plaintext) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (safeStorage.isEncryptionAvailable()) {
    const encrypted = safeStorage.encryptString(plaintext);
    fs.writeFileSync(file, ENC_PREFIX + encrypted.toString('base64'), { mode: 0o600 });
    return;
  }
  if (process.env.SSC_ALLOW_PLAINTEXT_STORE !== '1') {
    throw new Error('ssc_safe_storage_unavailable');
  }
  fs.writeFileSync(file, PLAIN_PREFIX + plaintext, { mode: 0o600 });
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

module.exports = { FileJsonStore, readSecureText, writeSecureText, resolveUnderRoot };