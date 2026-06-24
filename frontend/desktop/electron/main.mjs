import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initLibsignalBridge, invokeLibsignal } from './libsignal/bridge.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let mainWindow = null;

function rendererIndex() {
  if (!app.isPackaged) {
    return path.join(__dirname, '../../build/index.html');
  }
  return path.join(process.resourcesPath, 'renderer', 'index.html');
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
  });
  mainWindow.loadFile(rendererIndex());
  if (!app.isPackaged) {
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  }
}

app.whenReady().then(() => {
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

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.handle('libsignal', async (_event, { method, args }) => {
  return invokeLibsignal(method, args);
});