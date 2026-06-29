import { captureCurrentLocation, isGeolocationAvailable } from '../locationShare';

describe('locationShare', () => {
  const original = navigator.geolocation;

  afterEach(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: original,
    });
  });

  it('detects geolocation availability', () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: jest.fn() },
    });
    expect(isGeolocationAvailable()).toBe(true);
  });

  it('captures current location', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (success) => success({
          coords: { latitude: 44.4, longitude: 26.1, accuracy: 8 },
        }),
      },
    });
    const out = await captureCurrentLocation();
    expect(out.ok).toBe(true);
    expect(out.coords.lat).toBe(44.4);
  });

  it('maps permission denied', async () => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: (_ok, fail) => fail({ code: 1 }),
      },
    });
    const out = await captureCurrentLocation();
    expect(out).toEqual({ ok: false, errorKey: 'locationPermissionDenied' });
  });
});