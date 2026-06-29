/**
 * Q.59 — Desktop crash report buffer (opt-in). Sentry runs in renderer when DSN is set.
 */
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

let optIn = false;

function reportsDir() {
  return path.join(app.getPath('userData'), 'crash-reports');
}

export function setDesktopCrashReportingOptIn(enabled) {
  optIn = !!enabled;
  return { opt_in: optIn };
}

export function recordDesktopCrashReport(payload = {}) {
  if (!optIn) return { recorded: false, reason: 'opt_out' };
  const dir = reportsDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `crash-${Date.now()}.json`);
  const body = {
    message: String(payload.message || 'unknown').slice(0, 2000),
    stack: String(payload.stack || '').slice(0, 8000),
    at: new Date().toISOString(),
    provider: 'desktop_buffer',
  };
  fs.writeFileSync(file, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
  return { recorded: true, path: file };
}