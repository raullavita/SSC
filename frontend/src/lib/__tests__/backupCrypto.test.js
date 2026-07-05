import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  decryptBackupPayload,
  encryptBackupPayload,
  isForbiddenBackupKey,
  validateBackupEnvelope,
} from '../backupCrypto';

describe('backupCrypto', () => {
  it('rejects forbidden keys', () => {
    expect(isForbiddenBackupKey('ssc_access_token')).toBe(true);
    expect(isForbiddenBackupKey('ssc_trust_v1')).toBe(false);
  });

  it('encrypts and decrypts round-trip', async () => {
    const plaintext = JSON.stringify({ hello: 'world' });
    const envelope = await encryptBackupPayload(plaintext, 'test-passphrase');
    validateBackupEnvelope(envelope);
    expect(envelope.format).toBe(BACKUP_FORMAT);
    expect(envelope.version).toBe(BACKUP_VERSION);
    const decrypted = await decryptBackupPayload(envelope, 'test-passphrase');
    expect(decrypted).toBe(plaintext);
  });

  it('fails on wrong passphrase', async () => {
    const envelope = await encryptBackupPayload('secret', 'correct-pass');
    await expect(decryptBackupPayload(envelope, 'wrong-pass')).rejects.toThrow();
  });

  it('requires minimum passphrase length', async () => {
    await expect(encryptBackupPayload('x', 'short')).rejects.toThrow(/at least/);
  });
});