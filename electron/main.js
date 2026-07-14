const crypto = require('crypto');
const { app, BrowserWindow, ipcMain, session, shell } = require('electron');
const { autoUpdater } = require('electron-updater');
const fs = require('fs');
const path = require('path');

const compatMode = fs.existsSync(path.join(__dirname, 'SSC_COMPAT_MODE'));

let getSession;
let wipeLocalData;
let getGroupSenderKeySession;

let mainWindow = null;
let libsignalAvailable = false;
let libsignalLoadError = '';

if (compatMode) {
  libsignalLoadError = 'sac_compat_mode_native_crypto_disabled';
  console.warn('[ssc] SAC compat build — native libsignal is not loaded (Smart App Control workaround).');
} else {
  ({ getSession, wipeLocalData } = require('./libsignalSession'));
  ({ getGroupSenderKeySession } = require('./groupSenderKeySession'));
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
}

function requireLibsignal() {
  if (!libsignalAvailable) {
    throw new Error(libsignalLoadError || 'libsignal_unavailable');
  }
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
          compatMode,
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

function registerPushIpc() {
  try {
    const { getOrCreatePushToken } = require('./pushTokenStore');
    ipcMain.handle('ssc-push:get-token', () => getOrCreatePushToken(app.getPath('userData')));
  } catch (err) {
    console.warn('[ssc] push IPC disabled', err?.message || err);
  }
}

function registerCryptoIpc() {
  ipcMain.handle('ssc-crypto:available', () => libsignalAvailable);

  ipcMain.handle('ssc-crypto:diagnostics', () => ({
    libsignalAvailable,
    libsignalLoadError: libsignalLoadError || null,
    compatMode,
    version: app.getVersion(),
    packaged: app.isPackaged,
  }));

  ipcMain.handle('ssc-crypto:configure', (_evt, opts) => {
    requireLibsignal();
    const s = getSession(app.getPath('userData'));
    s.configure(opts || {});
    return { ok: true };
  });

  ipcMain.handle('ssc-crypto:generatePreKeyBundle', async () => {
    requireLibsignal();
    const s = getSession(app.getPath('userData'));
    return s.generatePreKeyBundle();
  });

  ipcMain.handle('ssc-crypto:generatePreKeyBatch', async (_evt, { count } = {}) => {
    requireLibsignal();
    const s = getSession(app.getPath('userData'));
    return s.generatePreKeyBatch(count || 50);
  });

  ipcMain.handle('ssc-crypto:generatePreKeyBatchOnly', async (_evt, { count } = {}) => {
    requireLibsignal();
    const s = getSession(app.getPath('userData'));
    return s.generatePreKeyBatchOnly(count || 50);
  });

  ipcMain.handle('ssc-crypto:rotateSignedPreKey', async () => {
    requireLibsignal();
    const s = getSession(app.getPath('userData'));
    return s.rotateSignedPreKey();
  });

  ipcMain.handle('ssc-crypto:establishSession', async (_evt, { peerId, deviceId, bundle }) => {
    requireLibsignal();
    const s = getSession(app.getPath('userData'));
    return s.establishSession(peerId, deviceId, bundle);
  });

  ipcMain.handle('ssc-crypto:encryptMessage', async (_evt, { plaintext, peerId, deviceId }) => {
    requireLibsignal();
    const s = getSession(app.getPath('userData'));
    return s.encryptMessage(plaintext, peerId, deviceId);
  });

  ipcMain.handle('ssc-crypto:decryptMessage', async (_evt, { ciphertext, peerId, deviceId }) => {
    requireLibsignal();
    const s = getSession(app.getPath('userData'));
    return s.decryptMessage(ciphertext, peerId, deviceId);
  });

  ipcMain.handle('ssc-crypto:encryptBytes', async (_evt, { buffer }) => {
    requireLibsignal();
    const s = getSession(app.getPath('userData'));
    return s.encryptBytes(buffer);
  });

  ipcMain.handle('ssc-crypto:decryptBytes', async (_evt, { ciphertext }) => {
    requireLibsignal();
    const s = getSession(app.getPath('userData'));
    return s.decryptBytes(ciphertext);
  });

  ipcMain.handle('ssc-crypto:computeSafetyNumber', async (_evt, { peerId, peerIdentityKey }) => {
    requireLibsignal();
    const s = getSession(app.getPath('userData'));
    return s.computeSafetyNumber(peerId, peerIdentityKey);
  });

  ipcMain.handle('ssc-crypto:wipeLocalData', async () => {
    if (!libsignalAvailable) return { ok: true, skipped: true };
    return wipeLocalData(app.getPath('userData'));
  });

  ipcMain.handle('ssc-group-keys:configure', (_evt, opts) => {
    requireLibsignal();
    const s = getGroupSenderKeySession(app.getPath('userData'));
    s.configure(opts || {});
    return { ok: true };
  });

  ipcMain.handle('ssc-group-keys:getDistributionState', (_evt, { groupId }) => {
    requireLibsignal();
    const s = getGroupSenderKeySession(app.getPath('userData'));
    return s.getDistributionState(groupId);
  });

  ipcMain.handle('ssc-group-keys:createDistribution', async (_evt, { groupId }) => {
    requireLibsignal();
    const s = getGroupSenderKeySession(app.getPath('userData'));
    return s.createDistributionMessage(groupId);
  });

  ipcMain.handle('ssc-group-keys:markDistributionSent', (_evt, { groupId }) => {
    requireLibsignal();
    const s = getGroupSenderKeySession(app.getPath('userData'));
    return s.markDistributionSent(groupId);
  });

  ipcMain.handle('ssc-group-keys:processDistribution', async (_evt, { senderId, deviceId, ciphertext }) => {
    requireLibsignal();
    const s = getGroupSenderKeySession(app.getPath('userData'));
    return s.processDistribution(senderId, deviceId, ciphertext);
  });

  ipcMain.handle('ssc-group-keys:encrypt', async (_evt, { groupId, plaintext }) => {
    requireLibsignal();
    const s = getGroupSenderKeySession(app.getPath('userData'));
    return { ciphertext: await s.encryptGroupPlaintext(groupId, plaintext) };
  });

  ipcMain.handle('ssc-group-keys:decrypt', async (_evt, { senderId, deviceId, ciphertext }) => {
    requireLibsignal();
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
    const withoutScheme = rawUrl.slice('ssc://'.length);
    const slashIdx = withoutScheme.indexOf('/');
    const host = (slashIdx >= 0 ? withoutScheme.slice(0, slashIdx) : withoutScheme).toLowerCase();
    const rest = slashIdx >= 0 ? withoutScheme.slice(slashIdx) : '';
    const qIdx = rest.indexOf('?');
    const pathPart = qIdx >= 0 ? rest.slice(0, qIdx) : rest;
    const query = qIdx >= 0 ? rest.slice(qIdx) : '';

    if (host === 'auth') {
      return `/auth/google${query}`;
    }
    if (host === 'link-device') {
      return `/link-device${query}`;
    }
    if (host === 'add') {
      const username = pathPart.replace(/^\//, '').trim();
      return username ? `/add/${username}${query}` : '/';
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
  // Legacy pins (pre Jul 2026 cert rotation)
  'sha256/aW6xgPeCioys0l73e6c6E4GRjmUx7Yqf8tw2DCUgqQs=',
  'sha256/C5+lpZ7tcVwmwQIMcRtPjsQt3MRxqt72RCZ3PqFyjx0=',
  // Current production pins (Google-managed certs, Jul 2026)
  'sha256/BPXdoCCsA5W+UqtMi/95FqG81W6cuYOAMg+KUnMw4BI=', // api.supersecurechat.com
  'sha256/F6jTih9VkkYZS8yuYqeU/4DUGehJ+niBGkkQ1yg8H3U=', // www.supersecurechat.com
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
      callback(-3);
      return;
    }
    let pin = null;
    try {
      pin = certificateSpkiPin(request.certificate);
    } catch (err) {
      console.error('[ssc] spki pin computation failed', err?.message || err);
    }
    if (pin && PINNED_SPKI_HASHES.has(pin)) {
      callback(0);
      return;
    }
    console.error('[ssc] cert pin rejected', hostname, pin || 'unknown');
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

function isExternalOAuthUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    if (host === API_HOST && parsed.pathname.startsWith('/api/auth/google')) {
      return true;
    }
    return (
      host === 'accounts.google.com' ||
      host === 'oauth2.googleapis.com' ||
      host.endsWith('.googleusercontent.com')
    );
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
  if (isOAuthFinishUrl(url)) {
    const route = routeFromOAuthFinishUrl(url);
    if (!route) return;
    event.preventDefault();
    navigateInstalledRoute(route);
    return;
  }
  if (isExternalOAuthUrl(url)) {
    event.preventDefault();
    shell.openExternal(url).catch((err) => {
      console.error('[ssc] openExternal oauth failed', err?.message || err);
    });
  }
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
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  attachOAuthNavigationHandlers(win);
  win.webContents.on('preload-error', (_event, preloadPath, error) => {
    console.error('[ssc] preload-error', preloadPath, error?.message || error);
  });
  win.webContents.on('did-fail-load', (_event, code, description, url) => {
    console.error('[ssc] did-fail-load', code, description, url);
  });
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
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

const FETCH_MAX_CONCURRENT = 4;
let fetchInFlight = 0;
const fetchWaitQueue = [];

function drainFetchQueue() {
  while (fetchInFlight < FETCH_MAX_CONCURRENT && fetchWaitQueue.length > 0) {
    const job = fetchWaitQueue.shift();
    fetchInFlight += 1;
    Promise.resolve()
      .then(job.run)
      .then(job.resolve, job.reject)
      .finally(() => {
        fetchInFlight -= 1;
        drainFetchQueue();
      });
  }
}

function enqueueFetch(run) {
  return new Promise((resolve, reject) => {
    fetchWaitQueue.push({ run, resolve, reject });
    drainFetchQueue();
  });
}

async function performShellFetch(url, method, headers, body) {
  const response = await session.defaultSession.fetch(url, {
    method,
    headers,
    body: body != null && body !== '' ? body : undefined,
  });
  const text = await response.text();
  return {
    status: response.status,
    ok: response.ok,
    body: text,
  };
}

ipcMain.handle('ssc-shell:open-oauth', async (_evt, url) => {
  if (typeof url !== 'string' || !url.startsWith('http')) {
    throw new Error('invalid_oauth_url');
  }
  await shell.openExternal(url);
  return { ok: true };
});

ipcMain.handle('ssc-shell:fetch-api', async (_evt, payload) => {
  const url = payload?.url;
  const method = (payload?.method || 'GET').toUpperCase();
  const headersJson = payload?.headersJson;
  const body = payload?.body;
  if (typeof url !== 'string' || !url.startsWith('https://')) {
    throw new Error('invalid_fetch_url');
  }
  let hostname = '';
  try {
    hostname = new URL(url).hostname.toLowerCase();
  } catch {
    throw new Error('invalid_fetch_url');
  }
  if (!PINNED_HOSTS.has(hostname)) {
    throw new Error('fetch_host_not_allowed');
  }
  let headers = {};
  if (typeof headersJson === 'string' && headersJson.trim()) {
    try {
      headers = JSON.parse(headersJson);
    } catch {
      throw new Error('invalid_fetch_headers');
    }
  }

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await enqueueFetch(() => performShellFetch(url, method, headers, body));
    } catch (err) {
      const message = String(err?.message || err);
      const retryable = /ERR_INSUFFICIENT_RESOURCES|ERR_FAILED|fetch failed/i.test(message);
      if (!retryable || attempt === maxAttempts) {
        console.error('[ssc] fetch-api failed', hostname, message);
        throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 150 * attempt));
    }
  }
  throw new Error('fetch_failed');
});

ipcMain.handle('ssc-desktop:attest-token', () => {
  const secret = (process.env.SSC_DESKTOP_ATTEST_SECRET || '').trim();
  if (!secret) {
    if (app.isPackaged) {
      throw new Error('ssc_desktop_attest_secret_missing');
    }
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
  registerPushIpc();
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