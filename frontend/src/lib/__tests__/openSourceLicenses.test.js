import {
  COPYLEFT_NOTICES,
  SSC_LICENSE_ID,
  SSC_SOURCE_REPO_URL,
} from '../openSourceLicenses';
import { LIBSIGNAL_PINNED_VERSION } from '../signal/constants';

describe('openSourceLicenses', () => {
  it('points to the public SSC source repository', () => {
    expect(SSC_SOURCE_REPO_URL).toBe('https://github.com/raullavita/SSC');
  });

  it('declares AGPL-3.0 for the conveyed application', () => {
    expect(SSC_LICENSE_ID).toBe('AGPL-3.0');
  });

  it('lists libsignal as shipped copyleft dependency', () => {
    const lib = COPYLEFT_NOTICES.find((n) => n.id === 'libsignal');
    expect(lib).toBeDefined();
    expect(lib.version).toBe(LIBSIGNAL_PINNED_VERSION);
    expect(lib.shippedInAndroid).toBe(true);
    expect(lib.license).toBe('AGPL-3.0');
  });
});