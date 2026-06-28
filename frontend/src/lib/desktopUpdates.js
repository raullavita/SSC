/**
 * Electron auto-update IPC wrapper — Windows / Mac desktop shell only.
 */
import { isElectronApp } from './platform';

function updatesApi() {
  return window.sscDesktop?.updates;
}

export async function checkDesktopUpdates(opts = {}) {
  if (!isElectronApp() || !updatesApi()?.check) {
    return { state: 'unsupported' };
  }
  return updatesApi().check(opts);
}

export async function downloadDesktopUpdate() {
  if (!isElectronApp() || !updatesApi()?.download) {
    return { state: 'unsupported' };
  }
  return updatesApi().download();
}

export async function installDesktopUpdate() {
  if (!isElectronApp() || !updatesApi()?.install) {
    return { state: 'unsupported' };
  }
  return updatesApi().install();
}

export async function getDesktopUpdateStatus() {
  if (!isElectronApp() || !updatesApi()?.getStatus) {
    return { state: 'unsupported' };
  }
  return updatesApi().getStatus();
}

export function subscribeDesktopUpdateStatus(handler) {
  if (!isElectronApp() || !updatesApi()?.onStatus) return () => {};
  return updatesApi().onStatus(handler);
}