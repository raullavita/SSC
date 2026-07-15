const fs = require('fs');
const path = require('path');
const { readSecureText, writeSecureText, resolveUnderRoot } = require('./secureFileStore');

function signalRoot(userDataPath) {
  return resolveUnderRoot(userDataPath, 'ssc-signal');
}

function exportSignalStoreFiles(userDataPath) {
  const root = signalRoot(userDataPath);
  if (!fs.existsSync(root)) {
    return { files: {}, fileCount: 0 };
  }
  const files = {};

  function walk(dir, prefix = '') {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const rel = prefix ? `${prefix}/${name}` : name;
      const stat = fs.statSync(full);
      if (stat.isDirectory()) {
        walk(full, rel);
        continue;
      }
      files[rel.replace(/\\/g, '/')] = readSecureText(full);
    }
  }

  walk(root);
  return { files, fileCount: Object.keys(files).length };
}

function importSignalStoreFiles(userDataPath, files = {}) {
  const root = signalRoot(userDataPath);
  if (!files || typeof files !== 'object') {
    return { imported: 0 };
  }
  let imported = 0;
  for (const [rel, content] of Object.entries(files)) {
    if (!rel || rel.includes('..')) continue;
    if (content === null || content === undefined) continue;
    const target = resolveUnderRoot(root, ...rel.split('/'));
    writeSecureText(target, String(content));
    imported += 1;
  }
  return { imported };
}

module.exports = { exportSignalStoreFiles, importSignalStoreFiles };