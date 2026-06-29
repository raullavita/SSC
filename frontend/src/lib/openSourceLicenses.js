/**
 * Open-source notices — must stay aligned with THIRD_PARTY_NOTICES.md and agpl_policy.py.
 */
import { LIBSIGNAL_PINNED_VERSION } from './signal/constants';

export const SSC_SOURCE_REPO_URL = 'https://github.com/raullavita/SSC';
export const SSC_LICENSE_ID = 'AGPL-3.0';
export const SSC_LICENSE_LABEL = 'GNU Affero General Public License v3.0';

/** Copyleft deps shipped or planned — shown in Settings → Open source. */
export const COPYLEFT_NOTICES = [
  {
    id: 'libsignal',
    name: 'libsignal (Signal Foundation)',
    version: LIBSIGNAL_PINNED_VERSION,
    license: 'AGPL-3.0',
    url: 'https://github.com/signalapp/libsignal',
    shippedInAndroid: true,
  },
  {
    id: 'mediasoup',
    name: 'mediasoup SFU (group calls 9+)',
    version: 'Phase B — not deployed',
    license: 'AGPL-3.0',
    url: 'https://github.com/versatica/mediasoup',
    shippedInAndroid: false,
  },
];