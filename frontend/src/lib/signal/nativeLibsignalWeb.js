import { WebPlugin } from '@capacitor/core';

/** Browser dev shell only — not a product surface (use installed SSC app). */
export class SscLibsignalWeb extends WebPlugin {
  async getPinnedVersion() {
    return { version: '0.96.4', source: 'installed-only-unavailable' };
  }

  async generatePreKeyBundle() {
    throw new Error('Signal prekeys require an installed SSC app (Android, iOS, or desktop)');
  }

  async hasSession() {
    return { has_session: false, skipped: true, reason: 'web' };
  }

  async establishSession() {
    throw new Error('Signal sessions require the SSC Android app');
  }

  async encryptSignalMessage() {
    throw new Error('Signal encrypt requires the SSC Android app');
  }

  async decryptSignalMessage() {
    throw new Error('Signal decrypt requires the SSC Android app');
  }

  async deleteSession() {
    return { deleted: false, reason: 'web' };
  }

  async clearAllSessions() {
    return { cleared: false, reason: 'web' };
  }
}