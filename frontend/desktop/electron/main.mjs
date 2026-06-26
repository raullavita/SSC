import { app, BrowserWindow, ipcMain, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initLibsignalBridge, invokeLibsignal } from './libsignal/bridge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP_AUTH_SCHEME = 'chat.ssc.secure.desktop';

let mainWindow = null;
let pendingAuthUrl = null;

function rendererIndex() {
  if (!app.isPackaged) {
    return path.join(__dirname, '../../build/index.html');
  }
  return path.join(process.resourcesPath, 'renderer', 'index.html');
}

function isDesktopAuthUrl(url) {
  return typeof url === 'string' && url.startsWith(`${DESKTOP_AUTH_SCHEME}://`);
}

function routeAuthDeepLink(url) {
  if (!isDesktopAuthUrl(url)) return false;
  try {
    const parsed = new URL(url);
    const authPath = parsed.pathname || '/auth/google';
    const hashRoute = `${authPath}${parsed.search}${parsed.hash}`;
    if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
      mainWindow.loadFile(rendererIndex(), { hash: hashRoute });
    } else {
      pendingAuthUrl = hashRoute;
    }
    return true;
  } catch {
    return false;
  }
}

/** OAuth leaves file:// for Google — intercept custom-scheme return inside the same window. */
function attachOAuthNavigationGuards(win) {
  const intercept = (event, url) => {
    if (!isDesktopAuthUrl(url)) return;
    event.preventDefault();
    routeAuthDeepLink(url);
  };
  win.webContents.on('will-navigate', intercept);
  win.webContents.on('will-redirect', intercept);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'SSC — Super Secure Chat',
    backgroundColor: '#0A0A0A',
    webPreferences: {
      preload: path.join(__dirname, 'preload.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    if (pendingAuthUrl) {
      mainWindow.loadFile(rendererIndex(), { hash: pendingAuthUrl });
      pendingAuthUrl = null;
    }
  });

  if (pendingAuthUrl) {
    mainWindow.loadFile(rendererIndex(), { hash: pendingAuthUrl });
    pendingAuthUrl = null;
  } else {
    mainWindow.loadFile(rendererIndex());
  }

  attachOAuthNavigationGuards(mainWindow);

  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

if (process.defaultApp) {
  if (process.argv.length >= 2) {
    app.setAsDefaultProtocolClient(DESKTOP_AUTH_SCHEME, process.execPath, [path.resolve(process.argv[1])]);
  }
} else {
  app.setAsDefaultProtocolClient(DESKTOP_AUTH_SCHEME);
}

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) {
  app.quit();
} else {
  app.on('second-instance', (_event, argv) => {
    const authUrl = argv.find((arg) => arg.startsWith(`${DESKTOP_AUTH_SCHEME}://`));
    if (authUrl) routeAuthDeepLink(authUrl);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    const winUrl = process.argv.find((arg) => arg.startsWith(`${DESKTOP_AUTH_SCHEME}://`));
    if (winUrl) routeAuthDeepLink(winUrl);
  }
  createWindow();
  try {
    initLibsignalBridge(app.getPath('userData'));
  } catch (err) {
    console.error('libsignal init deferred:', err);
  }
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  routeAuthDeepLink(url);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('libsignal', async (_event, { method, args }) => {
  return invokeLibsignal(method, args);
});

const SECURE_STORE_FILE = () => path.join(app.getPath('userData'), 'ssc-secure-store.json');

function readSecureStore() {
  try {
    const raw = fs.readFileSync(SECURE_STORE_FILE(), 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeSecureStore(data) {
  fs.writeFileSync(SECURE_STORE_FILE(), JSON.stringify(data), 'utf8');
}

ipcMain.handle('secure-storage-available', () => safeStorage.isEncryptionAvailable());

ipcMain.handle('secure-storage-get', (_event, key) => {
  if (!safeStorage.isEncryptionAvailable() || !key) return null;
  const store = readSecureStore();
  const enc = store[key];
  if (!enc) return null;
  try {
    return safeStorage.decryptString(Buffer.from(enc, 'base64'));
  } catch {
    return null;
  }
});

ipcMain.handle('secure-storage-set', (_event, key, value) => {
  if (!safeStorage.isEncryptionAvailable() || !key || value == null) return false;
  const store = readSecureStore();
  store[key] = safeStorage.encryptString(String(value)).toString('base64');
  writeSecureStore(store);
  return true;
});

ipcMain.handle('secure-storage-remove', (_event, key) => {
  const store = readSecureStore();
  delete store[key];
  writeSecureStore(store);
});