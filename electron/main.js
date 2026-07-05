const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const { getSession, wipeLocalData } = require('./libsignalSession');
const { getGroupSenderKeySession } = require('./groupSenderKeySession');

let libsignalAvailable = false;
try {
  require('@signalapp/libsignal-client');
  libsignalAvailable = true;
} catch {
  libsignalAvailable = false;
}

function registerCryptoIpc() {
  ipcMain.handle('ssc-crypto:available', () => libsignalAvailable);

  ipcMain.handle('ssc-crypto:configure', (_evt, opts) => {
    const s = getSession(app.getPath('userData'));
    s.configure(opts || {});
    return { ok: true };
  });

  ipcMain.handle('ssc-crypto:generatePreKeyBundle', async () => {
    const s = getSession(app.getPath('userData'));
    return s.generatePreKeyBundle();
  });

  ipcMain.handle('ssc-crypto:establishSession', async (_evt, { peerId, deviceId, bundle }) => {
    const s = getSession(app.getPath('userData'));
    return s.establishSession(peerId, deviceId, bundle);
  });

  ipcMain.handle('ssc-crypto:encryptMessage', async (_evt, { plaintext, peerId, deviceId }) => {
    const s = getSession(app.getPath('userData'));
    return s.encryptMessage(plaintext, peerId, deviceId);
  });

  ipcMain.handle('ssc-crypto:decryptMessage', async (_evt, { ciphertext, peerId, deviceId }) => {
    const s = getSession(app.getPath('userData'));
    return s.decryptMessage(ciphertext, peerId, deviceId);
  });

  ipcMain.handle('ssc-crypto:encryptBytes', async (_evt, { buffer }) => {
    const s = getSession(app.getPath('userData'));
    return s.encryptBytes(buffer);
  });

  ipcMain.handle('ssc-crypto:computeSafetyNumber', async (_evt, { peerId, peerIdentityKey }) => {
    const s = getSession(app.getPath('userData'));
    return s.computeSafetyNumber(peerId, peerIdentityKey);
  });

  ipcMain.handle('ssc-crypto:wipeLocalData', async () => {
    return wipeLocalData(app.getPath('userData'));
  });

  ipcMain.handle('ssc-group-keys:configure', (_evt, opts) => {
    const s = getGroupSenderKeySession(app.getPath('userData'));
    s.configure(opts || {});
    return { ok: true };
  });

  ipcMain.handle('ssc-group-keys:getDistributionState', (_evt, { groupId }) => {
    const s = getGroupSenderKeySession(app.getPath('userData'));
    return s.getDistributionState(groupId);
  });

  ipcMain.handle('ssc-group-keys:createDistribution', async (_evt, { groupId }) => {
    const s = getGroupSenderKeySession(app.getPath('userData'));
    return s.createDistributionMessage(groupId);
  });

  ipcMain.handle('ssc-group-keys:markDistributionSent', (_evt, { groupId }) => {
    const s = getGroupSenderKeySession(app.getPath('userData'));
    return s.markDistributionSent(groupId);
  });

  ipcMain.handle('ssc-group-keys:processDistribution', async (_evt, { senderId, deviceId, ciphertext }) => {
    const s = getGroupSenderKeySession(app.getPath('userData'));
    return s.processDistribution(senderId, deviceId, ciphertext);
  });

  ipcMain.handle('ssc-group-keys:encrypt', async (_evt, { groupId, plaintext }) => {
    const s = getGroupSenderKeySession(app.getPath('userData'));
    return { ciphertext: await s.encryptGroupPlaintext(groupId, plaintext) };
  });

  ipcMain.handle('ssc-group-keys:decrypt', async (_evt, { senderId, deviceId, ciphertext }) => {
    const s = getGroupSenderKeySession(app.getPath('userData'));
    return { plaintext: await s.decryptGroupCiphertext(senderId, deviceId, ciphertext) };
  });
}

function resolvePackagedIndex() {
  const candidates = [
    path.join(process.resourcesPath, 'app', 'index.html'),
    path.join(__dirname, 'app', 'index.html'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }
  return null;
}

function loadWindow(win) {
  const devUrl = process.env.SSC_DEV_URL || 'http://localhost:3000';
  const prodFile = process.env.SSC_PROD_FILE;

  if (prodFile && fs.existsSync(prodFile)) {
    win.loadFile(prodFile);
    return;
  }

  if (app.isPackaged) {
    const indexPath = resolvePackagedIndex();
    if (indexPath) {
      win.loadFile(indexPath);
      return;
    }
  }

  win.loadURL(devUrl);
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  loadWindow(win);
}

app.whenReady().then(() => {
  registerCryptoIpc();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});