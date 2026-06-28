import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  safeStorage,
  Tray,
  Menu,
  nativeImage,
  Notification,
} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initLibsignalBridge, invokeLibsignal } from './libsignal/bridge.mjs';
import {
  getTranslateCapabilities,
  initTranslateBridge,
  invokeTranslate,
} from './translate/bridge.mjs';
import {
  checkForUpdates,
  downloadUpdate,
  getUpdateStatus,
  initAutoUpdater,
  installUpdate,
} from './update/bridge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DESKTOP_AUTH_SCHEME = 'chat.ssc.secure.desktop';

let mainWindow = null;
let pendingAuthUrl = null;
let tray = null;
let isQuitting = false;
let notificationsAllowed = true;
let libsignalInitError = null;
let translateInitError = null;

function rendererIndex() {
  if (!app.isPackaged) {
    return path.join(__dirname, '../../build/index.html');
  }
  return path.join(process.resourcesPath, 'renderer', 'index.html');
}

function trayIconPath() {
  if (!app.isPackaged) {
    return path.join(__dirname, '../../public/icons/icon-192.png');
  }
  return path.join(process.resourcesPath, 'renderer', 'icons', 'icon-192.png');
}

function getTrayIcon() {
  const iconPath = trayIconPath();
  if (!fs.existsSync(iconPath)) return nativeImage.createEmpty();
  const img = nativeImage.createFromPath(iconPath);
  if (process.platform === 'win32' && !img.isEmpty()) {
    return img.resize({ width: 16, height: 16 });
  }
  return img;
}

function focusMainWindow() {
  if (!mainWindow) return false;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
  return true;
}

function createTray() {
  if (tray) return;
  const icon = getTrayIcon();
  if (icon.isEmpty()) return;
  tray = new Tray(icon);
  tray.setToolTip('SSC — Super Secure Chat');
  const menu = Menu.buildFromTemplate([
    {
      label: 'Open SSC',
      click: () => focusMainWindow(),
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
  tray.on('double-click', () => focusMainWindow());
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
      focusMainWindow();
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

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

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
    focusMainWindow();
  });
}

app.whenReady().then(() => {
  if (process.platform === 'win32') {
    app.setAppUserModelId('chat.ssc.secure.desktop');
    const winUrl = process.argv.find((arg) => arg.startsWith(`${DESKTOP_AUTH_SCHEME}://`));
    if (winUrl) routeAuthDeepLink(winUrl);
  }
  try {
    initLibsignalBridge(app.getPath('userData'));
  } catch (err) {
    libsignalInitError = err?.message || String(err);
    console.error('libsignal init failed:', err);
    dialog.showErrorBox(
      'SSC — Secure messaging unavailable',
      `The encryption engine could not start. Restart SSC. If this continues, reinstall the app.\n\n${libsignalInitError}`,
    );
  }
  try {
    initTranslateBridge(app.getPath('userData'));
  } catch (err) {
    translateInitError = err?.message || String(err);
    console.error('translate bridge init failed:', err);
  }
  createWindow();
  if (mainWindow && app.isPackaged) {
    initAutoUpdater(mainWindow);
  }
  createTray();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else focusMainWindow();
  });
});

app.on('open-url', (event, url) => {
  event.preventDefault();
  routeAuthDeepLink(url);
});

app.on('before-quit', () => {
  isQuitting = true;
});

app.on('window-all-closed', () => {
  // Stay in tray so WebSocket + notifications keep working while backgrounded.
});

ipcMain.handle('libsignal', async (_event, { method, args }) => {
  if (libsignalInitError) {
    throw new Error(`libsignal bridge not initialized: ${libsignalInitError}`);
  }
  return invokeLibsignal(method, args);
});

ipcMain.handle('desktop-libsignal-status', () => ({
  ok: libsignalInitError == null,
  error: libsignalInitError,
}));

ipcMain.handle('desktop-translate-capabilities', async () => {
  if (translateInitError) {
    return { on_device: false, provider: 'error', error: translateInitError };
  }
  return getTranslateCapabilities();
});

ipcMain.handle('desktop-translate', async (_event, args) => {
  if (translateInitError) throw new Error(translateInitError);
  return invokeTranslate(args || {});
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

ipcMain.handle('desktop-set-notifications-enabled', (_event, enabled) => {
  notificationsAllowed = !!enabled;
  return true;
});

ipcMain.handle('desktop-focus-window', () => focusMainWindow());

ipcMain.handle('desktop-update-check', async (_event, opts = {}) => checkForUpdates(opts));
ipcMain.handle('desktop-update-download', async () => downloadUpdate());
ipcMain.handle('desktop-update-install', () => installUpdate());
ipcMain.handle('desktop-update-status', () => getUpdateStatus());

ipcMain.handle('desktop-show-notification', (_event, opts = {}) => {
  if (!notificationsAllowed) return false;
  if (!Notification.isSupported()) return false;
  const icon = getTrayIcon();
  const notification = new Notification({
    title: opts.title || 'SSC',
    body: opts.body || '',
    silent: opts.silent === true,
    urgency: opts.urgency || 'normal',
    icon: icon.isEmpty() ? undefined : icon,
  });
  notification.on('click', () => {
    focusMainWindow();
    if (opts.conversationId && mainWindow) {
      mainWindow.webContents.send('desktop-navigate', { conversationId: opts.conversationId });
    } else if (opts.kind === 'call' && mainWindow) {
      mainWindow.webContents.send('desktop-navigate', { route: '/chat' });
    } else if (opts.kind === 'friend_request' && mainWindow) {
      mainWindow.webContents.send('desktop-navigate', { route: '/chat' });
    }
  });
  notification.show();
  return true;
});