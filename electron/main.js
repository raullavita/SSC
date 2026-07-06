const crypto = require('crypto');
const { app, BrowserWindow, ipcMain, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');
const { getSession, wipeLocalData } = require('./libsignalSession');
const { getGroupSenderKeySession } = require('./groupSenderKeySession');

let mainWindow = null;
let libsignalAvailable = false;
let libsignalLoadError = '';
try {
  require('@signalapp/libsignal-client');
  libsignalAvailable = true;
} catch (err) {
  libsignalAvailable = false;
  libsignalLoadError = err?.message || String(err);
  console.error(
    '[ssc] libsignal-client failed to load — Windows Smart App Control often blocks unsigned .node files.',
    libsignalLoadError,
  );
}

function writeStartupDiagnostics() {
  try {
    const logPath = path.join(app.getPath('userData'), 'ssc-startup.log');
    fs.writeFileSync(
      logPath,
      JSON.stringify(
        {
          at: new Date().toISOString(),
          libsignalAvailable,
          libsignalLoadError: libsignalLoadError || null,
          packaged: app.isPackaged,
          version: app.getVersion(),
        },
        null,
        2,
      ),
      'utf8',
    );
  } catch {
    // ignore diagnostic write failures
  }
}

function registerCryptoIpc() {
  ipcMain.handle('ssc-crypto:available', () => libsignalAvailable);

  ipcMain.handle('ssc-crypto:diagnostics', () => ({
    libsignalAvailable,
    libsignalLoadError: libsignalLoadError || null,
    version: app.getVersion(),
    packaged: app.isPackaged,
  }));

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

function routeFromDeepLink(rawUrl) {
  if (!rawUrl || !rawUrl.startsWith('ssc://')) return '/';
  try {
    const parsed = new URL(rawUrl.replace('ssc://', 'https://ssc.local/'));
    const host = (parsed.hostname || '').toLowerCase();
    if (host === 'auth') {
      const query = parsed.search || '';
      return `/auth/google${query}`;
    }
    if (host === 'link-device') {
      return `/link-device${parsed.search || ''}`;
    }
    if (host === 'add') {
      const username = parsed.pathname.replace(/^\//, '').trim();
      return username ? `/add/${username}` : '/';
    }
  } catch {
    return '/';
  }
  return '/';
}

function navigateInstalledRoute(route) {
  if (!mainWindow) return;
  const indexPath = resolvePackagedIndex();
  if (!indexPath) return;
  const normalized = route.startsWith('/') ? route : `/${route}`;
  mainWindow.loadURL(fileUrlWithHash(indexPath, normalized));
}

const API_HOST = (process.env.SSC_API_HOST || 'api.supersecurechat.com').toLowerCase();

const PINNED_HOSTS = new Set([
  API_HOST,
  'www.supersecurechat.com',
  'supersecurechat.com',
  'sfu.supersecurechat.com',
]);

const PINNED_SPKI_HASHES = new Set([
  'sha256/aW6xgPeCioys0l73e6c6E4GRjmUx7Yqf8tw2DCUgqQs=',
  'sha256/C5+lpZ7tcVwmwQIMcRtPjsQt3MRxqt72RCZ3PqFyjx0=',
]);

function certificateSpkiPin(cert) {
  if (!cert?.data) return null;
  const der = Buffer.isBuffer(cert.data) ? cert.data : Buffer.from(cert.data);
  const x509 = new crypto.X509Certificate(der);
  const spki = x509.publicKey.export({ type: 'spki', format: 'der' });
  return `sha256/${crypto.createHash('sha256').update(spki).digest('base64')}`;
}

function attachCertificatePinning() {
  if (process.env.SSC_DISABLE_CERT_PINNING === '1') return;
  session.defaultSession.setCertificateVerifyProc((request, callback) => {
    const hostname = (request.hostname || '').toLowerCase();
    if (!PINNED_HOSTS.has(hostname)) {
      callback(0);
      return;
    }
    const pin = certificateSpkiPin(request.certificate);
    if (pin && PINNED_SPKI_HASHES.has(pin)) {
      callback(0);
      return;
    }
    callback(-2);
  });
}

function isOAuthFinishUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.hostname.toLowerCase() === API_HOST && parsed.pathname === '/auth/google';
  } catch {
    return false;
  }
}

function routeFromOAuthFinishUrl(url) {
  try {
    const parsed = new URL(url);
    const oauthCode = parsed.searchParams.get('oauth_code');
    const error = parsed.searchParams.get('error');
    if (oauthCode) return `/auth/google?oauth_code=${encodeURIComponent(oauthCode)}`;
    if (error) return `/auth/google?error=${encodeURIComponent(error)}`;
  } catch {
    return null;
  }
  return null;
}

function interceptOAuthNavigation(event, url) {
  if (typeof url !== 'string') return;
  if (url.startsWith('ssc://')) {
    event.preventDefault();
    handleDeepLink(url);
    return;
  }
  if (!isOAuthFinishUrl(url)) return;
  const route = routeFromOAuthFinishUrl(url);
  if (!route) return;
  event.preventDefault();
  navigateInstalledRoute(route);
}

function completeOAuthFinishNavigation(url) {
  if (!isOAuthFinishUrl(url)) return false;
  const route = routeFromOAuthFinishUrl(url);
  if (!route) return false;
  navigateInstalledRoute(route);
  return true;
}

function attachOAuthNavigationHandlers(win) {
  win.webContents.on('will-navigate', interceptOAuthNavigation);
  win.webContents.on('will-redirect', interceptOAuthNavigation);
  win.webContents.on('did-navigate', (_event, url) => {
    completeOAuthFinishNavigation(url);
  });
  win.webContents.on('did-redirect-navigation', (_event, url) => {
    completeOAuthFinishNavigation(url);
  });
}

function handleDeepLink(rawUrl) {
  navigateInstalledRoute(routeFromDeepLink(rawUrl));
}

function fileUrlWithHash(filePath, hashRoute = '/') {
  const normalized = filePath.replace(/\\/g, '/');
  const route = hashRoute.startsWith('/') ? hashRoute : `/${hashRoute}`;
  return `file:///${normalized.replace(/^\//, '')}#${route}`;
}

function loadWindow(win) {
  const devUrl = process.env.SSC_DEV_URL || 'http://localhost:3000';
  const prodFile = process.env.SSC_PROD_FILE;

  if (prodFile && fs.existsSync(prodFile)) {
    win.loadURL(fileUrlWithHash(prodFile, '/'));
    return;
  }

  if (app.isPackaged) {
    const indexPath = resolvePackagedIndex();
    if (indexPath) {
      win.loadURL(fileUrlWithHash(indexPath, '/'));
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

  attachOAuthNavigationHandlers(win);
  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error('[ssc] did-fail-load', code, description, url);
  });
  loadWindow(win);
  mainWindow = win;
  return win;
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const deepLink = argv.find((arg) => typeof arg === 'string' && arg.startsWith('ssc://'));
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
      if (deepLink) handleDeepLink(deepLink);
    }
  });
}

if (!app.isDefaultProtocolClient('ssc')) {
  app.setAsDefaultProtocolClient('ssc');
}

function registerAutoUpdater(win) {
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('update-available', () => {
    win?.webContents?.send('ssc-update', { status: 'available' });
  });
  autoUpdater.on('update-downloaded', () => {
    win?.webContents?.send('ssc-update', { status: 'downloaded' });
  });
  autoUpdater.on('error', (err) => {
    win?.webContents?.send('ssc-update', { status: 'error', detail: err?.message || 'update_failed' });
  });

  if (app.isPackaged) {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify().catch(() => {});
    }, 8000);
  }
}

ipcMain.handle('ssc-update:install', () => {
  autoUpdater.quitAndInstall();
  return { ok: true };
});

ipcMain.handle('ssc-desktop:attest-token', () => {
  const secret = (process.env.SSC_DESKTOP_ATTEST_SECRET || '').trim();
  if (!secret) {
    return 'ssc-attest-test-v1';
  }
  const ts = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', secret).update(`electron:${ts}`).digest('hex');
  return `${ts}.${sig}`;
});

app.whenReady().then(() => {
  writeStartupDiagnostics();
  attachCertificatePinning();
  registerCryptoIpc();
  const win = createWindow();
  registerAutoUpdater(win);
  const deepLink = process.argv.find((arg) => typeof arg === 'string' && arg.startsWith('ssc://'));
  if (deepLink) handleDeepLink(deepLink);
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  handleDeepLink(url);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});