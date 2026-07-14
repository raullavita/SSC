import { __resetSyncSocketForTests } from '../useSyncSocket';

describe('useSyncSocket', () => {
  afterEach(() => {
    __resetSyncSocketForTests();
  });

  it('resets shared socket state for tests', () => {
    expect(() => __resetSyncSocketForTests()).not.toThrow();
  });
});