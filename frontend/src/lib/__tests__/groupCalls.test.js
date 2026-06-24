import { clearGroupCallPolicyCache, fetchGroupCallPolicy, validateGroupCallSize } from '../groupCalls';

describe('groupCalls', () => {
  beforeEach(() => {
    clearGroupCallPolicyCache();
    global.fetch = jest.fn();
  });

  it('defaults to mesh cap of 6 when config fetch fails', async () => {
    global.fetch.mockRejectedValue(new Error('offline'));
    const policy = await fetchGroupCallPolicy();
    expect(policy.max_mesh_participants).toBe(6);
    expect(policy.sfu_enabled).toBe(false);
  });

  it('allows group call within mesh cap', async () => {
    global.fetch.mockResolvedValue({
      json: async () => ({ group_calls: { max_mesh_participants: 6, sfu_enabled: false } }),
    });
    expect(await validateGroupCallSize(5)).toBeNull();
  });

  it('blocks group call above mesh cap without SFU', async () => {
    global.fetch.mockResolvedValue({
      json: async () => ({ group_calls: { max_mesh_participants: 6, sfu_enabled: false } }),
    });
    const err = await validateGroupCallSize(6);
    expect(err).toMatch(/SFU/);
  });

  it('allows large groups when SFU is enabled', async () => {
    global.fetch.mockResolvedValue({
      json: async () => ({
        group_calls: { max_mesh_participants: 6, sfu_enabled: true, sfu_url: 'wss://sfu.test' },
      }),
    });
    expect(await validateGroupCallSize(10)).toBeNull();
  });
});