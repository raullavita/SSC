const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const { getSession } = require('./libsignalSession');

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

  const devUrl = process.env.SSC_DEV_URL || 'http://localhost:3000';
  const prodFile = process.env.SSC_PROD_FILE;
  if (prodFile) {
    win.loadFile(prodFile);
  } else {
    win.loadURL(devUrl);
  }
}

app.whenReady().then(() => {
  registerCryptoIpc();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});