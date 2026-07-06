const crypto = require('crypto');

const INTERNAL_SECRET = process.env.SFU_INTERNAL_SECRET || 'ssc-sfu-dev-secret';
const REQUIRE_HMAC = (process.env.SSC_SFU_REQUIRE_HMAC || 'true').toLowerCase() !== 'false';
const MAX_SKEW_SEC = Number(process.env.SSC_SFU_HMAC_SKEW_SEC || 120);

function header(req, name) {
  return req.headers[name.toLowerCase()] || req.headers[name];
}

function verifyInternalAuth(req, method, path, bodyBuf) {
  const secretHeader = header(req, 'x-ssc-sfu-secret');
  if (secretHeader !== INTERNAL_SECRET) {
    return false;
  }
  if (!REQUIRE_HMAC) {
    return true;
  }
  const ts = header(req, 'x-ssc-sfu-timestamp');
  const nonce = header(req, 'x-ssc-sfu-nonce');
  const sig = header(req, 'x-ssc-sfu-signature');
  if (!ts || !nonce || !sig) {
    return false;
  }
  const tsNum = Number(ts);
  if (!Number.isFinite(tsNum) || Math.abs(Math.floor(Date.now() / 1000) - tsNum) > MAX_SKEW_SEC) {
    return false;
  }
  const canonical = Buffer.concat([
    Buffer.from(`${ts}\n${nonce}\n${method.toUpperCase()}\n${path}\n`),
    bodyBuf || Buffer.alloc(0),
  ]);
  const expected = crypto.createHmac('sha256', INTERNAL_SECRET).update(canonical).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig));
  } catch {
    return false;
  }
}

module.exports = { verifyInternalAuth, INTERNAL_SECRET };