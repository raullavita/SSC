import { electronApiFetch, electronApiFetchEnabled } from '../electronApiFetch';

describe('electronApiFetch', () => {
  afterEach(() => {
    delete window.__SSC_ELECTRON_CLIENT;
    delete window.sscShell;
  });

  test('enabled when electron shell exposes fetchApi', () => {
    window.__SSC_ELECTRON_CLIENT = 'electron/0.3.1/10';
    window.sscShell = { fetchApi: jest.fn() };
    expect(electronApiFetchEnabled()).toBe(true);
  });

  test('routes API calls through sscShell.fetchApi', async () => {
    window.__SSC_ELECTRON_CLIENT = 'electron/0.3.1/10';
    window.sscShell = {
      fetchApi: jest.fn().mockResolvedValue({
        status: 200,
        body: '{"ok":true}',
      }),
    };
    const response = await electronApiFetch('https://api.supersecurechat.com/api/auth/me', {
      method: 'GET',
      headers: { 'X-SSC-Client': 'electron/0.3.1/10' },
    });
    expect(window.sscShell.fetchApi).toHaveBeenCalled();
    expect(response.ok).toBe(true);
    await expect(response.json()).resolves.toEqual({ ok: true });
  });
});