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
  'resetLocalStore',
  'clearAllSessions',
  'deleteSession',
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

const notifications = {
  show: (opts) => ipcRenderer.invoke('desktop-show-notification', opts || {}),
  setEnabled: (enabled) => ipcRenderer.invoke('desktop-set-notifications-enabled', enabled),
  onNavigate: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('desktop-navigate', handler);
    return () => ipcRenderer.removeListener('desktop-navigate', handler);
  },
};

const windowApi = {
  focus: () => ipcRenderer.invoke('desktop-focus-window'),
};

const translate = {
  getCapabilities: () => ipcRenderer.invoke('desktop-translate-capabilities'),
  translate: (args) => ipcRenderer.invoke('desktop-translate', args || {}),
};

contextBridge.exposeInMainWorld('sscDesktop', {
  isDesktop: true,
  platform: process.platform,
  libsignal,
  libsignalInitStatus: () => ipcRenderer.invoke('desktop-libsignal-status'),
  translate,
  secureStorage,
  notifications,
  window: windowApi,
});