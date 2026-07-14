const fs = require('fs');
const path = require('path');
const { randomBytes } = require('crypto');

function getOrCreatePushToken(userDataPath) {
  const file = path.join(userDataPath, 'ssc-push-token.txt');
  try {
    if (fs.existsSync(file)) {
      const existing = fs.readFileSync(file, 'utf8').trim();
      if (existing.length >= 16) return existing;
    }
    const token = `ssc-electron-${randomBytes(24).toString('hex')}`;
    fs.writeFileSync(file, token, 'utf8');
    return token;
  } catch {
    return `ssc-electron-${randomBytes(24).toString('hex')}`;
  }
}

module.exports = { getOrCreatePushToken };