import {
  getTranslateModelDownloadStatus,
  isTranslateModelDownloading,
  subscribeTranslateModelDownloadProgress,
} from '../translateModelProgress';

jest.mock('../../platform', () => ({
  isElectronApp: jest.fn(() => false),
}));

const { isElectronApp } = require('../../platform');

describe('translateModelProgress', () => {
  const original = window.sscDesktop;

  afterEach(() => {
    window.sscDesktop = original;
    jest.clearAllMocks();
  });

  it('reports unsupported on web', async () => {
    window.sscDesktop = undefined;
    await expect(getTranslateModelDownloadStatus()).resolves.toEqual({ state: 'unsupported' });
    expect(subscribeTranslateModelDownloadProgress(() => {})).toEqual(expect.any(Function));
  });

  it('routes status and subscriptions through desktop bridge', async () => {
    const status = { state: 'downloading', percent: 42 };
    const unsubscribe = jest.fn();
    const onDownloadProgress = jest.fn(() => unsubscribe);
    isElectronApp.mockReturnValue(true);
    window.sscDesktop = {
      translate: {
        getDownloadStatus: jest.fn().mockResolvedValue(status),
        onDownloadProgress,
      },
    };

    await expect(getTranslateModelDownloadStatus()).resolves.toEqual(status);
    const handler = jest.fn();
    const off = subscribeTranslateModelDownloadProgress(handler);
    expect(onDownloadProgress).toHaveBeenCalledWith(handler);
    expect(off).toBe(unsubscribe);
  });

  it('detects active download states', () => {
    expect(isTranslateModelDownloading({ state: 'downloading' })).toBe(true);
    expect(isTranslateModelDownloading({ state: 'ready' })).toBe(true);
    expect(isTranslateModelDownloading({ state: 'idle' })).toBe(false);
  });
});