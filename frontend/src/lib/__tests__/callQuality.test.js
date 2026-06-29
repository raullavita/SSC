import {
  createQualitySampler,
  pickWorstQuality,
  qualityBarCount,
  qualityLevelFromMetrics,
} from '../callQuality';

describe('callQuality', () => {
  it('maps metrics to quality levels', () => {
    expect(qualityLevelFromMetrics({ packetLossPercent: 0.2, rttMs: 80, jitterMs: 10 })).toBe('excellent');
    expect(qualityLevelFromMetrics({ packetLossPercent: 2, rttMs: 180, jitterMs: 20 })).toBe('good');
    expect(qualityLevelFromMetrics({ packetLossPercent: 5, rttMs: 280, jitterMs: 40 })).toBe('fair');
    expect(qualityLevelFromMetrics({ packetLossPercent: 12, rttMs: 500, jitterMs: 80 })).toBe('poor');
  });

  it('returns bar counts per level', () => {
    expect(qualityBarCount('excellent')).toBe(4);
    expect(qualityBarCount('poor')).toBe(1);
    expect(qualityBarCount('unknown')).toBe(0);
  });

  it('picks worst quality from a list', () => {
    expect(pickWorstQuality(['excellent', 'fair', 'good'])).toBe('fair');
    expect(pickWorstQuality(['excellent', 'poor'])).toBe('poor');
  });

  it('sampler returns unknown without peer connection', async () => {
    const sampler = createQualitySampler();
    const out = await sampler.sample(null);
    expect(out.level).toBe('unknown');
  });
});