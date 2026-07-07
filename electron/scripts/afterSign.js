/**
 * Sign native addons (.node) after electron-builder signs the main EXE.
 * Smart App Control blocks unsigned libsignal-client.node even when the app EXE loads.
 */
const fs = require('fs');
const path = require('path');

const SAFE_ENTRY_RE = /^[A-Za-z0-9._-]+$/;

function safeChildPath(rootDir, entryName) {
  const name = String(entryName || '');
  if (!SAFE_ENTRY_RE.test(name)) {
    return null;
  }
  const rootResolved = path.resolve(rootDir);
  const resolved = path.resolve(rootResolved, name);
  const prefix = rootResolved.endsWith(path.sep) ? rootResolved : `${rootResolved}${path.sep}`;
  if (resolved !== rootResolved && !resolved.startsWith(prefix)) {
    return null;
  }
  return resolved;
}

function collectFiles(rootDir, extensions, out = []) {
  if (!fs.existsSync(rootDir)) return out;
  for (const entry of fs.readdirSync(rootDir, { withFileTypes: true })) {
    const full = safeChildPath(rootDir, entry.name);
    if (!full) continue;
    if (entry.isDirectory()) {
      collectFiles(full, extensions, out);
      continue;
    }
    if (extensions.some((ext) => full.toLowerCase().endsWith(ext))) {
      out.push(full);
    }
  }
  return out;
}

module.exports = async function afterSign(context) {
  if (process.platform !== 'win32') return;
  if (!process.env.CSC_LINK && !process.env.WIN_CSC_LINK) return;

  const packager = context.packager;
  if (!packager?.signFile) return;

  const appOutDir = context.appOutDir;
  const targets = collectFiles(appOutDir, ['.node', '.dll']);
  for (const filePath of targets) {
    await packager.signFile(filePath);
  }
};