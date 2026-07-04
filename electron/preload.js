/**
 * Electron preload — IPC bridge to main-process libsignal (Engine 11).
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sscCrypto', {
  get available() {
    return ipcRenderer.invoke('ssc-crypto:available');
  },

  async configure(opts) {
    return ipcRenderer.invoke('ssc-crypto:configure', opts);
  },

  async generatePreKeyBundle() {
    return ipcRenderer.invoke('ssc-crypto:generatePreKeyBundle');
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