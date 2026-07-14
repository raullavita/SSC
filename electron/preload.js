/**
 * Electron preload — IPC bridge to main-process libsignal (Engine 11).
 */

const { contextBridge, ipcRenderer } = require('electron');

// Must not require() local files here — Electron 20+ sandboxes preload by default and
// only allows built-in modules, so require('./package.json') crashes before sscCrypto loads.
const SSC_VERSION = '0.3.1';
const SSC_BUILD = '12';
const CLIENT_VALUE = `electron/${SSC_VERSION}/${SSC_BUILD}`;

contextBridge.exposeInMainWorld('sscUpdater', {
  onStatus: (cb) => {
    ipcRenderer.on('ssc-update', (_evt, payload) => cb(payload));
  },
  installUpdate: () => ipcRenderer.invoke('ssc-update:install'),
});

contextBridge.exposeInMainWorld('__SSC_ELECTRON_CLIENT', CLIENT_VALUE);
contextBridge.exposeInMainWorld('__SSC_NATIVE_BRIDGE', 'v1');
contextBridge.exposeInMainWorld('__SSC_DEVICE_ATTEST', () => 'ssc-attest-test-v1');
// Chromium Translator API is used in-renderer when available (see onDevice.js).
contextBridge.exposeInMainWorld('__SSC_ELECTRON_TRANSLATE', 'browser_translator');

contextBridge.exposeInMainWorld('sscShell', {
  openOAuth(url) {
    return ipcRenderer.invoke('ssc-shell:open-oauth', url);
  },
  fetchApi(url, method, headersJson, body) {
    return ipcRenderer.invoke('ssc-shell:fetch-api', { url, method, headersJson, body });
  },
});

contextBridge.exposeInMainWorld('sscPush', {
  getToken() {
    return ipcRenderer.invoke('ssc-push:get-token');
  },
  platform: 'electron',
});

contextBridge.exposeInMainWorld('sscCrypto', {
  get available() {
    return ipcRenderer.invoke('ssc-crypto:available');
  },

  diagnostics() {
    return ipcRenderer.invoke('ssc-crypto:diagnostics');
  },

  async configure(opts) {
    return ipcRenderer.invoke('ssc-crypto:configure', opts);
  },

  async generatePreKeyBundle() {
    return ipcRenderer.invoke('ssc-crypto:generatePreKeyBundle');
  },

  async generatePreKeyBatch(count = 50) {
    return ipcRenderer.invoke('ssc-crypto:generatePreKeyBatch', { count });
  },

  async generatePreKeyBatchOnly(count = 50) {
    return ipcRenderer.invoke('ssc-crypto:generatePreKeyBatchOnly', { count });
  },

  async rotateSignedPreKey() {
    return ipcRenderer.invoke('ssc-crypto:rotateSignedPreKey');
  },

  async establishSession(peerId, deviceId, bundle) {
    return ipcRenderer.invoke('ssc-crypto:establishSession', { peerId, deviceId, bundle });
  },

  async encryptMessage(plaintext, peerId, deviceId = '1') {
    return ipcRenderer.invoke('ssc-crypto:encryptMessage', { plaintext, peerId, deviceId });
  },

  async decryptMessage(ciphertext, peerId, deviceId = '1') {
    return ipcRenderer.invoke('ssc-crypto:decryptMessage', { ciphertext, peerId, deviceId });
  },

  async encryptBytes(arrayBuffer) {
    return ipcRenderer.invoke('ssc-crypto:encryptBytes', { buffer: arrayBuffer });
  },

  async decryptBytes(ciphertext) {
    return ipcRenderer.invoke('ssc-crypto:decryptBytes', { ciphertext });
  },

  async computeSafetyNumber(peerId, peerIdentityKey) {
    return ipcRenderer.invoke('ssc-crypto:computeSafetyNumber', { peerId, peerIdentityKey });
  },

  async wipeLocalData() {
    return ipcRenderer.invoke('ssc-crypto:wipeLocalData');
  },

  async configureGroupKeys(opts) {
    return ipcRenderer.invoke('ssc-group-keys:configure', opts);
  },

  async getGroupDistributionState(groupId) {
    return ipcRenderer.invoke('ssc-group-keys:getDistributionState', { groupId });
  },

  async createGroupDistribution(groupId) {
    return ipcRenderer.invoke('ssc-group-keys:createDistribution', { groupId });
  },

  async markGroupDistributionSent(groupId) {
    return ipcRenderer.invoke('ssc-group-keys:markDistributionSent', { groupId });
  },

  async processGroupDistribution({ senderId, deviceId, ciphertext }) {
    return ipcRenderer.invoke('ssc-group-keys:processDistribution', {
      senderId,
      deviceId,
      ciphertext,
    });
  },

  async encryptGroupMessage(groupId, plaintext) {
    return ipcRenderer.invoke('ssc-group-keys:encrypt', { groupId, plaintext });
  },

  async decryptGroupMessage(senderId, deviceId, ciphertext) {
    return ipcRenderer.invoke('ssc-group-keys:decrypt', { senderId, deviceId, ciphertext });
  },
});