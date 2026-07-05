import {
  deviceLinkDeepLink,
  deviceLinkWebUrl,
  formatExpiryCountdown,
  parseDeviceLinkToken,
  platformLabel,
} from '../deviceLink';

describe('deviceLink helpers', () => {
  it('builds web and deep links', () => {
    expect(deviceLinkWebUrl('tok123', 'https://chat.test')).toBe(
      'https://chat.test/link-device?token=tok123'
    );
    expect(deviceLinkDeepLink('tok123')).toBe('ssc://link-device?token=tok123');
  });

  it('parses tokens from urls', () => {
    expect(parseDeviceLinkToken('ssc://link-device?token=abc')).toBe('abc');
    expect(parseDeviceLinkToken('https://chat.test/link-device?token=xyz')).toBe('xyz');
    expect(parseDeviceLinkToken('token=raw')).toBe('raw');
  });

  it('formats countdown', () => {
    const future = Date.now() + 125000;
    expect(formatExpiryCountdown(future)).toMatch(/2:0\d/);
    expect(formatExpiryCountdown(Date.now() - 1000)).toBe('Expired');
  });

  it('labels platforms', () => {
    expect(platformLabel('android')).toBe('Android');
    expect(platformLabel('electron')).toBe('Desktop');
  });
});