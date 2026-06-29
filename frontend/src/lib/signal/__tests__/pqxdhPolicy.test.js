import { ProtocolVersion } from '../constants';
import {
  PQXDH_HYBRID_ENABLED,
  bundleHasKyberPrekeys,
  signalUsesPqxdh,
} from '../pqxdhPolicy';

describe('pqxdhPolicy', () => {
  it('enables PQXDH hybrid', () => {
    expect(PQXDH_HYBRID_ENABLED).toBe(true);
  });

  it('requires kyber fields in bundle', () => {
    expect(bundleHasKyberPrekeys({
      kyber_prekey_id: 1,
      kyber_prekey_public: 'a',
      kyber_prekey_signature: 'b',
    })).toBe(true);
    expect(bundleHasKyberPrekeys({ kyber_prekey_id: 1 })).toBe(false);
  });

  it('covers signal protocol variants', () => {
    expect(signalUsesPqxdh(ProtocolVersion.SIGNAL_V1)).toBe(true);
    expect(signalUsesPqxdh(ProtocolVersion.SIGNAL_GROUP_V1)).toBe(true);
    expect(signalUsesPqxdh(ProtocolVersion.SIGNAL_STATUS_V1)).toBe(true);
    expect(signalUsesPqxdh(ProtocolVersion.LEGACY_RSA)).toBe(false);
  });
});