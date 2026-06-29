/**
 * Q.61 — Read shipped signing.config.json (extraResources) for update verification.
 */
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

let cached = null;

function configPath() {
  if (!app.isPackaged) {
    return path.join(process.cwd(), 'signing.config.json');
  }
  return path.join(process.resourcesPath, 'signing.config.json');
}

export function loadSigningConfig() {
  if (cached) return cached;
  const defaults = {
    windows_authenticode: false,
    mac_notarized: false,
    verify_windows_update_signature: false,
  };
  try {
    const raw = fs.readFileSync(configPath(), 'utf8');
    cached = { ...defaults, ...JSON.parse(raw) };
  } catch {
    cached = defaults;
  }
  return cached;
}

export function shouldVerifyWindowsUpdateSignature() {
  if (process.env.SSC_WIN_VERIFY_UPDATE_SIGNATURE === 'true') return true;
  if (process.env.SSC_WIN_VERIFY_UPDATE_SIGNATURE === 'false') return false;
  return !!loadSigningConfig().verify_windows_update_signature;
}