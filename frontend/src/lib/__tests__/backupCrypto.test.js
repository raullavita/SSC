import {
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
    expect(envelope.format).toBe('ssc-backup');
    expect(envelope.version).toBe(1);
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