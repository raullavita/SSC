/**
 * Transformers.js model-download progress — broadcast to renderer (Q.46).
 */

let mainWindowRef = null;
let lastStatus = { state: 'idle', percent: null, model: null, file: null, message: null };
let activeDownloads = 0;
const fileProgress = new Map();

function broadcast() {
  const win = mainWindowRef;
  if (!win || win.isDestroyed()) return;
  win.webContents.send('desktop-translate-download', lastStatus);
}

function setStatus(patch) {
  lastStatus = { ...lastStatus, ...patch, at: Date.now() };
  broadcast();
}

function aggregatePercent() {
  let loaded = 0;
  let total = 0;
  let progressSum = 0;
  let progressCount = 0;

  for (const entry of fileProgress.values()) {
    if (entry.total > 0) {
      loaded += entry.loaded;
      total += entry.total;
    } else if (entry.progress != null) {
      progressSum += entry.progress;
      progressCount += 1;
    }
  }

  if (total > 0) {
    return Math.min(99, Math.round((loaded / total) * 100));
  }
  if (progressCount > 0) {
    return Math.min(99, Math.round(progressSum / progressCount));
  }
  return null;
}

export function initTranslateProgress(mainWindow) {
  mainWindowRef = mainWindow;
  broadcast();
}

export function getTranslateDownloadStatus() {
  return { ...lastStatus };
}

export function resetTranslateDownloadStatus() {
  activeDownloads = 0;
  fileProgress.clear();
  setStatus({
    state: 'idle',
    percent: null,
    model: null,
    file: null,
    message: null,
  });
}

export function markTranslateDownloadError(message) {
  activeDownloads = 0;
  fileProgress.clear();
  setStatus({
    state: 'error',
    message: message || 'model download failed',
    percent: null,
    model: null,
    file: null,
  });
}

export function createProgressCallback() {
  return (data) => {
    const model = data?.name || null;
    const file = data?.file || null;
    const key = `${model || 'model'}/${file || 'file'}`;

    if (data?.status === 'initiate') {
      if (!fileProgress.has(key)) {
        activeDownloads += 1;
      }
      setStatus({
        state: 'downloading',
        model,
        file,
        message: file,
        percent: aggregatePercent(),
      });
      return;
    }

    if (data?.status === 'download') {
      setStatus({
        state: 'downloading',
        model,
        file,
        message: file,
        percent: aggregatePercent(),
      });
      return;
    }

    if (data?.progress != null || data?.loaded != null) {
      fileProgress.set(key, {
        loaded: data.loaded ?? 0,
        total: data.total ?? 0,
        progress: data.progress ?? null,
      });
      setStatus({
        state: 'downloading',
        model,
        file,
        message: file,
        percent: aggregatePercent(),
      });
      return;
    }

    if (data?.status === 'done') {
      fileProgress.set(key, { loaded: 1, total: 1, progress: 100 });
      activeDownloads = Math.max(0, activeDownloads - 1);
      if (activeDownloads === 0) {
        setStatus({ state: 'ready', percent: 100, model, file, message: null });
        setTimeout(() => resetTranslateDownloadStatus(), 600);
      } else {
        setStatus({
          state: 'downloading',
          model,
          file,
          message: file,
          percent: aggregatePercent(),
        });
      }
    }
  };
}