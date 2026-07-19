/**
 * SSC desktop crypto worker — JSON lines over stdin/stdout.
 * Same libsignal 0.96.4 protocol as Android / former Electron shell.
 *
 * Request:  {"id":1,"cmd":"encryptMessage","args":{...}}\n
 * Response: {"id":1,"ok":true,"result":{...}}\n
 */
const readline = require('readline');
const path = require('path');
const { setActiveRoot } = require('./secureFileStore');
const { getSession, wipeLocalData } = require('./libsignalSession');
const {
  getGroupSenderKeySession,
  wipeGroupSenderKeyData,
} = require('./groupSenderKeySession');

let userDataPath = path.join(process.env.APPDATA || process.env.HOME || '.', 'SuperSecureChat');
let session = null;
let groupSession = null;

function ensureSession() {
  setActiveRoot(userDataPath);
  if (!session) {
    session = getSession(userDataPath);
  }
  return session;
}

function ensureGroup() {
  setActiveRoot(userDataPath);
  if (!groupSession) {
    groupSession = getGroupSenderKeySession(userDataPath);
  }
  return groupSession;
}

async function handle(cmd, args = {}) {
  switch (cmd) {
    case 'ping':
      return { pong: true, version: '0.4.0', group: true };
    case 'configure': {
      if (args.userDataPath) {
        userDataPath = String(args.userDataPath);
        session = null;
        groupSession = null;
      }
      const s = ensureSession();
      s.configure({
        deviceId: args.deviceId || '1',
        localUserId: args.localUserId || null,
      });
      const g = ensureGroup();
      if (g.configure) {
        g.configure({
          deviceId: args.deviceId || '1',
          localUserId: args.localUserId || null,
        });
      }
      return { ok: true, root: userDataPath };
    }
    case 'wipe': {
      wipeLocalData(userDataPath);
      try {
        wipeGroupSenderKeyData(userDataPath);
      } catch (_) {
        /* ignore */
      }
      session = null;
      groupSession = null;
      return { wiped: true };
    }
    case 'generatePreKeyBundle': {
      return ensureSession().generatePreKeyBundle();
    }
    case 'generatePreKeyBatch': {
      return ensureSession().generatePreKeyBatch(args.count || 50);
    }
    case 'generatePreKeyBatchOnly': {
      return ensureSession().generatePreKeyBatchOnly(args.count || 50);
    }
    case 'rotateSignedPreKey': {
      return ensureSession().rotateSignedPreKey();
    }
    case 'establishSession': {
      return ensureSession().establishSession(args.peerId, args.deviceId || '1', args.bundle);
    }
    case 'encryptMessage': {
      return ensureSession().encryptMessage(args.plaintext, args.peerId, args.deviceId || '1');
    }
    case 'decryptMessage': {
      const plain = await ensureSession().decryptMessage(
        args.ciphertext,
        args.peerId,
        args.deviceId || '1',
      );
      return { plaintext: plain };
    }
    case 'computeSafetyNumber': {
      return ensureSession().computeSafetyNumber(args.peerId, args.peerIdentityKeyB64);
    }
    case 'encryptBytes': {
      return ensureSession().encryptBytes(Buffer.from(args.base64 || '', 'base64'));
    }
    case 'decryptBytes': {
      return ensureSession().decryptBytes(args.ciphertext);
    }
    case 'groupCreateDistribution': {
      const g = ensureGroup();
      return g.createDistributionMessage(args.groupId);
    }
    case 'groupProcessDistribution': {
      const g = ensureGroup();
      return g.processDistribution(args.senderId, args.deviceId || '1', args.ciphertext);
    }
    case 'groupEncrypt': {
      const g = ensureGroup();
      const ciphertext = await g.encryptGroupPlaintext(args.groupId, args.plaintext);
      return { ciphertext, protocol: 'signal_v1_group_sender_key' };
    }
    case 'groupDecrypt': {
      const g = ensureGroup();
      const plain = await g.decryptGroupCiphertext(
        args.senderId,
        args.deviceId || '1',
        args.ciphertext,
      );
      return { plaintext: plain };
    }
    case 'groupDistributionState': {
      const g = ensureGroup();
      return g.getDistributionState(args.groupId);
    }
    case 'groupMarkDistributed': {
      const g = ensureGroup();
      return g.markDistributionSent(args.groupId);
    }
    default:
      throw new Error(`unknown_cmd:${cmd}`);
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on('line', async (line) => {
  const raw = String(line || '').trim();
  if (!raw) return;
  let req;
  try {
    req = JSON.parse(raw);
  } catch (e) {
    process.stdout.write(`${JSON.stringify({ id: null, ok: false, error: 'invalid_json' })}\n`);
    return;
  }
  const id = req.id;
  try {
    const result = await handle(req.cmd, req.args || {});
    process.stdout.write(`${JSON.stringify({ id, ok: true, result })}\n`);
  } catch (e) {
    process.stdout.write(
      `${JSON.stringify({ id, ok: false, error: e && e.message ? e.message : String(e) })}\n`,
    );
  }
});

process.stdout.write(`${JSON.stringify({ id: 0, ok: true, result: { ready: true } })}\n`);
