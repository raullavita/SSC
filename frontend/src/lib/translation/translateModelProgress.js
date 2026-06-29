/**
 * Desktop Transformers.js model-download progress — renderer IPC wrapper (Q.46).
 */
import { isElectronApp } from '../platform';

function translateApi() {
  return window.sscDesktop?.translate;
}

export async function getTranslateModelDownloadStatus() {
  if (!isElectronApp() || !translateApi()?.getDownloadStatus) {
    return { state: 'unsupported' };
  }
  return translateApi().getDownloadStatus();
}

export function subscribeTranslateModelDownloadProgress(handler) {
  if (!isElectronApp() || !translateApi()?.onDownloadProgress) return () => {};
  return translateApi().onDownloadProgress(handler);
}

export function isTranslateModelDownloading(status) {
  return status?.state === 'downloading' || status?.state === 'ready';
}