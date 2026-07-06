/**
 * Encrypted on-disk JSON stores — Electron safeStorage (Phase 2).
 */

const fs = require('fs');
const path = require('path');
const { safeStorage } = require('electron');

const ENC_PREFIX = 'SSCENC1:';
const PLAIN_PREFIX = 'SSCPLAIN:';

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
    fs.writeFileSync(file, ENC_PREFIX + encrypted.toString('base64'));
    return;
  }
  fs.writeFileSync(file, PLAIN_PREFIX + plaintext);
}

class FileJsonStore {
  constructor(dir, filename) {
    this.file = path.join(dir, filename);
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

module.exports = { FileJsonStore, readSecureText, writeSecureText };