import { indexMessage } from '../../search/messageIndex';
import { createEncryptedBackup } from '../backupExport';
import { restoreEncryptedBackup } from '../backupRestore';
import { markPeerVerified } from '../trustStore';

function readBlobText(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(blob);
  });
}

describe('backup export/restore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('exports and restores local trust + search index', async () => {
    markPeerVerified('peer-a', '1111 2222');
    localStorage.setItem('ssc_auto_translate', 'false');
    indexMessage('conv-1', {
      id: 'm1',
      text: 'hello backup',
      sender_id: 'u1',
      created_at: '2026-01-01T00:00:00Z',
    });

    const exported = await createEncryptedBackup({
      passphrase: 'backup-pass',
      userId: 'user-1',
    });
    expect(exported.keyCount).toBeGreaterThan(0);
    expect(exported.indexCount).toBe(1);

    localStorage.clear();

    const file = new File([await readBlobText(exported.blob)], 'test.ssc-backup', {
      type: 'application/json',
    });
    const result = await restoreEncryptedBackup(file, 'backup-pass');
    expect(result.keysRestored).toBeGreaterThan(0);
    expect(result.conversationsIndexed).toBe(1);
    expect(localStorage.getItem('ssc_auto_translate')).toBe('false');
    expect(localStorage.getItem('ssc_trust_v1')).toContain('peer-a');
  });

  it('does not export auth tokens', async () => {
    localStorage.setItem('ssc_access_token', 'jwt.token.here');
    localStorage.setItem('ssc_theme', 'dark');
    const exported = await createEncryptedBackup({ passphrase: 'backup-pass' });
    const text = await readBlobText(exported.blob);
    expect(text).not.toContain('jwt.token.here');
    expect(exported.keyCount).toBe(1);
  });
});