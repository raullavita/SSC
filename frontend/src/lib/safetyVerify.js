/**
 * Safety number verification helpers — compare, QR payload, formatting.
 */

function normalizeSafetyNumber(value) {
  if (!value) return '';
  return String(value).replace(/\s+/g, '').toLowerCase();
}

function safetyNumbersMatch(a, b) {
  const left = normalizeSafetyNumber(a);
  const right = normalizeSafetyNumber(b);
  return Boolean(left && right && left === right);
}

export function splitSafetyNumberGroups(displayable) {
  if (!displayable) return [];
  return displayable.trim().split(/\s+/).filter(Boolean);
}

export function buildSafetyQrPayload(peerId, displayable) {
  if (!peerId || !displayable) return null;
  return `ssc://verify/${peerId}/${normalizeSafetyNumber(displayable)}`;
}

/**
 * Parse QR/deep-link payloads: ssc://verify/{peerId}/{digits}
 */
function parseSafetyQrPayload(payload) {
  if (!payload?.trim()) return null;
  const raw = payload.trim();
  const match = raw.match(/^ssc:\/\/verify\/([^/]+)\/([0-9a-f]+)$/i);
  if (!match) return null;
  return { peerId: match[1], digits: match[2].toLowerCase() };
}

export function comparePastedSafetyValue(displayable, pasted) {
  const trimmed = pasted?.trim();
  if (!trimmed) return { match: false, reason: '' };

  const parsed = parseSafetyQrPayload(trimmed);
  if (parsed) {
    const match = safetyNumbersMatch(displayable, parsed.digits);
    return {
      match,
      reason: match ? 'qr_match' : 'qr_mismatch',
      peerId: parsed.peerId,
    };
  }

  const match = safetyNumbersMatch(displayable, trimmed);
  return { match, reason: match ? 'text_match' : 'text_mismatch' };
}