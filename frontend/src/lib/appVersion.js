/** Installed client semver — baked at build via REACT_APP_SSC_VERSION. */

export function getAppVersion() {
  return process.env.REACT_APP_SSC_VERSION || '1.0.12';
}

export function parseSemver(version) {
  const m = String(version || '').trim().match(/^(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

export function compareSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  if (!pa || !pb) return 0;
  if (pa.major !== pb.major) return pa.major - pb.major;
  if (pa.minor !== pb.minor) return pa.minor - pb.minor;
  return pa.patch - pb.patch;
}

export function isVersionNewer(remote, local) {
  return compareSemver(remote, local) > 0;
}