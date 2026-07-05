import { clientFootprintClean, runClientFootprintAudit } from '../clientFootprintOrchestrator';

describe('clientFootprintOrchestrator', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('reports clean footprint by default', () => {
    const audit = runClientFootprintAudit();
    expect(audit.localStorage.ok).toBe(true);
    expect(clientFootprintClean()).toBe(true);
  });

  test('detects forbidden token keys', () => {
    localStorage.setItem('ssc_access_token', 'abc.def.ghi');
    const audit = runClientFootprintAudit();
    expect(audit.localStorage.ok).toBe(false);
    expect(audit.localStorage.violations).toContain('ssc_access_token');
    expect(clientFootprintClean()).toBe(false);
  });
});