import { encryptGroupMessage, decryptGroupMessage, groupE2EStatus } from '../groupSenderKeys';
import {
  ensureOwnSenderKey,
  getSenderKey,
  packSenderKeyDistribution,
  rememberSenderKey,
  unpackSenderKeyDistribution,
} from '../senderKeyStore';

describe('groupSenderKeys', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('reports sender key mode', () => {
    expect(groupE2EStatus().senderKeys).toBe(true);
  });

  it('encrypts and decrypts with local sender key', async () => {
    const groupId = 'g_test';
    const userId = 'u_a';
    const { ciphertext } = await encryptGroupMessage('hello group', { groupId, userId });
    const plain = await decryptGroupMessage(ciphertext, { groupId, senderId: userId });
    expect(plain).toBe('hello group');
  });

  it('packs sender key distribution payloads', () => {
    const packed = packSenderKeyDistribution({
      groupId: 'g1',
      senderId: 'u1',
      keyMaterial: 'abc',
    });
    const dist = unpackSenderKeyDistribution(packed);
    expect(dist.groupId).toBe('g1');
    rememberSenderKey(dist.groupId, dist.senderId, dist.keyMaterial);
    expect(getSenderKey('g1', 'u1')).toBe('abc');
    expect(ensureOwnSenderKey('g1', 'u1')).toBe('abc');
  });
});