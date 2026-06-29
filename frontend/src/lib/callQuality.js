/** WebRTC call quality sampling — Q.32 */

export const QUALITY_LEVELS = ['excellent', 'good', 'fair', 'poor', 'unknown'];

export function qualityLevelFromMetrics({ packetLossPercent, rttMs, jitterMs }) {
  const loss = Number(packetLossPercent);
  const rtt = Number(rttMs);
  const jitter = Number(jitterMs);
  if (!Number.isFinite(loss) && !Number.isFinite(rtt) && !Number.isFinite(jitter)) {
    return 'unknown';
  }
  if ((Number.isFinite(loss) && loss > 8) || (Number.isFinite(rtt) && rtt > 400)) {
    return 'poor';
  }
  if (
    (Number.isFinite(loss) && loss > 3)
    || (Number.isFinite(rtt) && rtt > 250)
    || (Number.isFinite(jitter) && jitter > 50)
  ) {
    return 'fair';
  }
  if (
    (Number.isFinite(loss) && loss > 1)
    || (Number.isFinite(rtt) && rtt > 150)
    || (Number.isFinite(jitter) && jitter > 30)
  ) {
    return 'good';
  }
  return 'excellent';
}

export function qualityBarCount(level) {
  switch (level) {
    case 'excellent': return 4;
    case 'good': return 3;
    case 'fair': return 2;
    case 'poor': return 1;
    default: return 0;
  }
}

export function qualityBarColor(level) {
  switch (level) {
    case 'excellent': return '#34C759';
    case 'good': return '#34C759';
    case 'fair': return '#FFD600';
    case 'poor': return '#FF3B30';
    default: return '#71717A';
  }
}

function readInboundRtp(stats) {
  let audio = null;
  let video = null;
  for (const report of stats.values()) {
    if (report.type !== 'inbound-rtp') continue;
    if (report.kind === 'audio' && !audio) audio = report;
    if (report.kind === 'video' && !video) video = report;
  }
  return { audio, video };
}

function readActiveRtt(stats) {
  let bestRtt = null;
  for (const report of stats.values()) {
    if (report.type !== 'candidate-pair' || report.state !== 'succeeded') continue;
    const rtt = Number(report.currentRoundTripTime);
    if (!Number.isFinite(rtt) || rtt <= 0) continue;
    const ms = rtt * 1000;
    if (bestRtt == null || ms < bestRtt) bestRtt = ms;
  }
  return bestRtt;
}

export function createQualitySampler() {
  let prevAudio = null;

  return {
    async sample(pc) {
      if (!pc || typeof pc.getStats !== 'function') {
        return { level: 'unknown', packetLossPercent: null, rttMs: null, jitterMs: null };
      }
      const stats = await pc.getStats();
      const { audio } = readInboundRtp(stats);
      const rttMs = readActiveRtt(stats);

      let packetLossPercent = null;
      let jitterMs = null;

      if (audio) {
        const lost = Number(audio.packetsLost || 0);
        const recv = Number(audio.packetsReceived || 0);
        if (prevAudio) {
          const dLost = Math.max(0, lost - prevAudio.packetsLost);
          const dRecv = Math.max(0, recv - prevAudio.packetsReceived);
          const total = dLost + dRecv;
          packetLossPercent = total > 0 ? (dLost / total) * 100 : 0;
        }
        prevAudio = { packetsLost: lost, packetsReceived: recv };
        const jitter = Number(audio.jitter);
        if (Number.isFinite(jitter) && jitter > 0) {
          jitterMs = jitter * 1000;
        }
      }

      const level = qualityLevelFromMetrics({ packetLossPercent, rttMs, jitterMs });
      return { level, packetLossPercent, rttMs, jitterMs };
    },
    reset() {
      prevAudio = null;
    },
  };
}

export function pickWorstQuality(levels) {
  const order = { poor: 0, fair: 1, good: 2, excellent: 3, unknown: 4 };
  let worst = 'unknown';
  for (const level of levels) {
    if ((order[level] ?? 4) < (order[worst] ?? 4)) worst = level;
  }
  return worst;
}