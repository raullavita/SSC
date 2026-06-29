import {
  buildLocationPayload,
  buildMapsDeepLink,
  buildStaticMapUrl,
  formatCoordinates,
  parseLocationPayload,
  serializeLocationPayload,
} from '../locationMessage';

describe('locationMessage', () => {
  it('serializes and parses location payload', () => {
    const raw = serializeLocationPayload({ lat: 45.1234, lng: 25.5678, accuracy: 12 });
    expect(parseLocationPayload(raw)).toEqual({
      lat: 45.1234,
      lng: 25.5678,
      accuracy: 12,
    });
  });

  it('rejects invalid coordinates', () => {
    expect(buildLocationPayload({ lat: 999, lng: 0 }).ok).toBe(false);
    expect(parseLocationPayload('{"lat":91,"lng":0}')).toBeNull();
  });

  it('formats coordinates and builds map urls', () => {
    expect(formatCoordinates(45.123456, 25.5)).toBe('45.12346, 25.50000');
    expect(buildStaticMapUrl(45, 25)).toContain('staticmap.openstreetmap.de');
    expect(buildMapsDeepLink(45, 25)).toContain('openstreetmap.org');
  });
});