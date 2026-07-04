import { getInstalledClientHeader, getInstalledClientHeaders } from '../installedClient';

describe('installedClient', () => {
  test('builds header with platform version build', () => {
    expect(getInstalledClientHeader()).toMatch(/^(android|ios|windows|mac|electron)\/\d+\.\d+\.\d+\/\d+$/);
  });

  test('getInstalledClientHeaders includes X-SSC-Client', () => {
    const headers = getInstalledClientHeaders({ 'X-Test': '1' });
    expect(headers['X-SSC-Client']).toBeTruthy();
    expect(headers['X-Test']).toBe('1');
  });
});