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
  setBadgeCount: (count) => ipcRenderer.invoke('desktop-set-badge-count', count),
  getBadgeCount: () => ipcRenderer.invoke('desktop-get-badge-count'),
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
  getDownloadStatus: () => ipcRenderer.invoke('desktop-translate-download-status'),
  onDownloadProgress: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('desktop-translate-download', handler);
    return () => ipcRenderer.removeListener('desktop-translate-download', handler);
  },
};

const appLock = {
  isAvailable: () => ipcRenderer.invoke('desktop-app-lock-available'),
  authenticate: (args) => ipcRenderer.invoke('desktop-app-lock-authenticate', args || {}),
};

const updates = {
  check: (opts) => ipcRenderer.invoke('desktop-update-check', opts || {}),
  download: () => ipcRenderer.invoke('desktop-update-download'),
  install: () => ipcRenderer.invoke('desktop-update-install'),
  getStatus: () => ipcRenderer.invoke('desktop-update-status'),
  onStatus: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on('desktop-update-status', handler);
    return () => ipcRenderer.removeListener('desktop-update-status', handler);
  },
};

const crashReporting = {
  setOptIn: (enabled) => ipcRenderer.invoke('desktop-crash-reporting-set-opt-in', { enabled }),
  record: (payload) => ipcRenderer.invoke('desktop-crash-reporting-record', payload || {}),
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
  appLock,
  updates,
  crashReporting,
});