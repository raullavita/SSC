import fs from 'fs';

const unexportPairs = [
  ['src/calls/sfuSession.js', 'export class SfuSession', 'class SfuSession'],
  ['src/chat/attachments.js', 'export const ATTACHMENT_PROTOCOL', 'const ATTACHMENT_PROTOCOL'],
  ['src/chat/polls.js', 'export const POLL_PROTOCOL', 'const POLL_PROTOCOL'],
  ['src/chat/stories.js', 'export const STORY_PROTOCOL', 'const STORY_PROTOCOL'],
  ['src/lib/api.js', 'export async function apiJson', 'async function apiJson'],
  ['src/lib/backupCrypto.js', 'export const BACKUP_FORMAT', 'const BACKUP_FORMAT'],
  ['src/lib/backupCrypto.js', 'export const BACKUP_VERSION', 'const BACKUP_VERSION'],
  ['src/lib/backupCrypto.js', 'export const PBKDF2_ITERATIONS', 'const PBKDF2_ITERATIONS'],
  ['src/lib/backupCrypto.js', 'export function assertPassphrase', 'function assertPassphrase'],
  ['src/lib/backupExport.js', 'export function collectLocalStorageSnapshot', 'function collectLocalStorageSnapshot'],
  ['src/lib/backupExport.js', 'export function buildBackupPayload', 'function buildBackupPayload'],
  ['src/lib/backupRestore.js', 'export function readBackupFile', 'function readBackupFile'],
  ['src/lib/backupRestore.js', 'export function validateBackupPayload', 'function validateBackupPayload'],
  ['src/lib/backupRestore.js', 'export function restoreLocalStorageSnapshot', 'function restoreLocalStorageSnapshot'],
  ['src/lib/conversationMeta.js', 'export const CONVERSATION_META_FIELDS', 'const CONVERSATION_META_FIELDS'],
  ['src/lib/conversationMeta.js', 'export function pickConversationMeta', 'function pickConversationMeta'],
  ['src/lib/cryptoPolicy.js', 'export function isGroupLibsignalAvailable', 'function isGroupLibsignalAvailable'],
  ['src/lib/deviceLink.js', 'export function deviceLinkPath', 'function deviceLinkPath'],
  ['src/lib/googleAuth.js', 'export function isGoogleOAuthReturn', 'function isGoogleOAuthReturn'],
  ['src/lib/googleAuth.js', 'export function extractOAuthCode', 'function extractOAuthCode'],
  ['src/lib/googleAuth.js', 'export function shouldUseGoogleRedirect', 'function shouldUseGoogleRedirect'],
  ['src/lib/googleAuth.js', 'export function startGoogleRedirect', 'function startGoogleRedirect'],
  ['src/lib/googleAuth.js', 'export function signInWithIdToken', 'function signInWithIdToken'],
  ['src/lib/linkPreview.js', 'export function extractUrls', 'function extractUrls'],
  ['src/lib/linkPreview.js', 'export function hostnameFromUrl', 'function hostnameFromUrl'],
  ['src/lib/linkPreview.js', 'export function parsePreviewFromHtml', 'function parsePreviewFromHtml'],
  ['src/lib/linkPreview.js', 'export function fallbackPreview', 'function fallbackPreview'],
  ['src/lib/linkPreview.js', 'export async function maybeFetchLinkPreview', 'async function maybeFetchLinkPreview'],
  ['src/lib/panicWipe.js', 'export function clearLocalClientData', 'function clearLocalClientData'],
  ['src/lib/panicWipe.js', 'export async function clearNativeCryptoStore', 'async function clearNativeCryptoStore'],
  ['src/lib/presence.js', 'export async function sendHeartbeat', 'async function sendHeartbeat'],
  ['src/lib/readReceipts.js', 'export function normalizeReaders', 'function normalizeReaders'],
  ['src/lib/safetyVerify.js', 'export function normalizeSafetyNumber', 'function normalizeSafetyNumber'],
  ['src/lib/safetyVerify.js', 'export function safetyNumbersMatch', 'function safetyNumbersMatch'],
  ['src/lib/safetyVerify.js', 'export function parseSafetyQrPayload', 'function parseSafetyQrPayload'],
  ['src/lib/translation.js', 'export async function translateTextDetailed', 'async function translateTextDetailed'],
  ['src/lib/translation/providers/onDevice.js', 'export async function onDeviceAvailability', 'async function onDeviceAvailability'],
  ['src/lib/wsSubscribe.js', 'export async function wsSubscribeTokenRequired', 'async function wsSubscribeTokenRequired'],
  ['src/lib/wsSubscribe.js', 'export async function fetchWsSubscribeToken', 'async function fetchWsSubscribeToken'],
  ['src/signal/safetyNumber.js', 'export async function fetchPeerIdentityKey', 'async function fetchPeerIdentityKey'],
  ['src/signal/safetyNumber.js', 'export async function fetchLocalIdentityKey', 'async function fetchLocalIdentityKey'],
  ['src/signal/senderKeyStore.js', 'export function generateSenderKeyMaterial', 'function generateSenderKeyMaterial'],
  ['src/signal/senderKeyStore.js', 'export const SENDER_KEY_DIST_PREFIX', 'const SENDER_KEY_DIST_PREFIX'],
];

for (const [file, from, to] of unexportPairs) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(from)) {
    console.error('missing', file, from);
    process.exitCode = 1;
    continue;
  }
  fs.writeFileSync(file, text.replace(from, to));
}

function removeFunction(source, name) {
  const start = source.indexOf(`export function ${name}`);
  if (start === -1) return source;
  let depth = 0;
  let i = source.indexOf('{', start);
  for (; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === '{') depth += 1;
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(0, start) + source.slice(i + 1).replace(/^\s*\n/, '\n');
      }
    }
  }
  return source;
}

let conversationMeta = fs.readFileSync('src/lib/conversationMeta.js', 'utf8');
conversationMeta = removeFunction(conversationMeta, 'clearUnread');
fs.writeFileSync('src/lib/conversationMeta.js', conversationMeta);

let providers = fs.readFileSync('src/lib/translation/providers/index.js', 'utf8');
providers = providers.replace(/export const PROVIDER_ORDER = \[[^\]]+\];\n\n/, '');
fs.writeFileSync('src/lib/translation/providers/index.js', providers);

let messageIndex = fs.readFileSync('src/search/messageIndex.js', 'utf8');
messageIndex = removeFunction(messageIndex, 'clearIndex');
fs.writeFileSync('src/search/messageIndex.js', messageIndex);

let safetyNumber = fs.readFileSync('src/signal/safetyNumber.js', 'utf8');
safetyNumber = removeFunction(safetyNumber, 'trustStoreKey');
fs.writeFileSync('src/signal/safetyNumber.js', safetyNumber);

let signalBridge = fs.readFileSync('src/signal/signalBridge.js', 'utf8');
signalBridge = removeFunction(signalBridge, 'getSignalLibTarget');
signalBridge = removeFunction(signalBridge, 'installedClientHeader');
fs.writeFileSync('src/signal/signalBridge.js', signalBridge);

let senderKeyStore = fs.readFileSync('src/signal/senderKeyStore.js', 'utf8');
senderKeyStore = removeFunction(senderKeyStore, 'listGroupSenderKeys');
fs.writeFileSync('src/signal/senderKeyStore.js', senderKeyStore);

console.log('knip cleanup applied');