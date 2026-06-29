/**
 * Q.55 — Post-quantum hybrid (PQXDH) via libsignal Kyber prekeys.
 * No custom PQ crypto; upstream SessionBuilder only.
 */
import { ProtocolVersion } from './constants';

export const PQXDH_HYBRID_ENABLED = true;

export const PQXDH_KYBER_FIELDS = [
  'kyber_prekey_id',
  'kyber_prekey_public',
  'kyber_prekey_signature',
];

export function bundleHasKyberPrekeys(bundle) {
  if (!bundle) return false;
  return PQXDH_KYBER_FIELDS.every((field) => bundle[field] != null && bundle[field] !== '');
}

export function signalUsesPqxdh(protocol) {
  return protocol === ProtocolVersion.SIGNAL_V1
    || protocol === ProtocolVersion.SIGNAL_GROUP_V1
    || protocol === ProtocolVersion.SIGNAL_STATUS_V1;
}