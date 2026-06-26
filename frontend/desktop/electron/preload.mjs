import { contextBridge, ipcRenderer } from 'electron';

const libsignalMethods = [
  'getPinnedVersion',
  'generatePreKeyBundle',
  'hasSession',
  'establishSession',
  'encryptSignalMessage',
  'decryptSignalMessage',
  'createGroupSenderKeyDistribution',
  'processGroupSenderKeyDistribution',
  'hasGroupSenderKey',
  'encryptGroupMessage',
  'decryptGroupMessage',
];

const libsignal = Object.fromEntries(
  libsignalMethods.map((method) => [
    method,
    (args) => ipcRenderer.invoke('libsignal', { method, args: args || {} }),
  ]),
);

const secureStorage = {
  isAvailable: () => ipcRenderer.invoke('secure-storage-available'),
  get: (key) => ipcRenderer.invoke('secure-storage-get', key),
  set: (key, value) => ipcRenderer.invoke('secure-storage-set', key, value),
  remove: (key) => ipcRenderer.invoke('secure-storage-remove', key),
};

contextBridge.exposeInMainWorld('sscDesktop', {
  isDesktop: true,
  platform: process.platform,
  libsignal,
  secureStorage,
});