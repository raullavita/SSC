/**
 * Electron preload — exposes official libsignal bridge to renderer.
 * Install in Electron shell: npm i @signalapp/libsignal-client
 */

const { contextBridge } = require('electron');

let libsignal = null;
try {
  libsignal = require('@signalapp/libsignal-client');
} catch {
  libsignal = null;
}

contextBridge.exposeInMainWorld('sscCrypto', {
  available: Boolean(libsignal),
  async encryptMessage(plaintext, peerId, deviceId) {
    if (!libsignal?.encryptForPeer) {
      throw new Error('libsignal_not_available');
    }
    return libsignal.encryptForPeer(plaintext, peerId, deviceId);
  },
  async decryptMessage(ciphertext, peerId) {
    if (!libsignal?.decryptFromPeer) {
      throw new Error('libsignal_not_available');
    }
    return libsignal.decryptFromPeer(ciphertext, peerId);
  },
  async generatePreKeyBundle() {
    if (!libsignal?.generatePreKeyBundle) {
      throw new Error('libsignal_not_available');
    }
    return libsignal.generatePreKeyBundle();
  },
});