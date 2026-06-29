/** ICE candidate diagnostics for off-LAN TURN proof — Q.31 */

export function icePathLabel(summary) {
  if (!summary) return '';
  if (summary.usesRelay) return 'relay';
  if (summary.localType === 'host' && summary.remoteType === 'host') return 'direct';
  if (summary.localType === 'srflx' || summary.remoteType === 'srflx') return 'stun';
  return 'p2p';
}

export async function summarizeIceConnection(pc) {
  if (!pc || typeof pc.getStats !== 'function') return null;
  const stats = await pc.getStats();
  let best = null;
  for (const report of stats.values()) {
    if (report.type !== 'candidate-pair' || report.state !== 'succeeded') continue;
    const local = stats.get(report.localCandidateId);
    const remote = stats.get(report.remoteCandidateId);
    const usesRelay = local?.candidateType === 'relay' || remote?.candidateType === 'relay';
    const nominated = report.nominated === true;
    const priority = Number(report.priority || 0);
    const row = {
      localType: local?.candidateType || 'unknown',
      remoteType: remote?.candidateType || 'unknown',
      usesRelay,
      nominated,
      priority,
    };
    if (!best || (nominated && !best.nominated) || priority > best.priority) {
      best = row;
    }
  }
  return best;
}