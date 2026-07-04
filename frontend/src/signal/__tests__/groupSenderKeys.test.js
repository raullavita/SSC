import {
  encryptGroupMessage,
  decryptGroupMessage,
  groupE2EStatus,
  isSenderKeyDistributionMessage,
} from '../groupSenderKeys';
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
    const status = groupE2EStatus();
    expect(status.senderKeys).toBe(true);
  });

  it('encrypts and decrypts with dev fallback when libsignal unavailable', async () => {
    const groupId = 'g_test';
    const userId = 'u_a';
    const { ciphertext, protocol } = await encryptGroupMessage('hello group', { groupId, userId });
    expect(protocol).toBe('group_sender_key_dev');
    const plain = await decryptGroupMessage(ciphertext, {
      groupId,
      senderId: userId,
      protocol,
    });
    expect(plain).toBe('hello group');
  });

  it('detects sender key distribution messages by protocol', () => {
    expect(
      isSenderKeyDistributionMessage({
        protocol: 'group_sender_key_dist_v1',
        ciphertext: 'abc',
      })
    ).toBe(true);
    expect(isSenderKeyDistributionMessage({ protocol: 'group_sender_key_v2', ciphertext: 'x' })).toBe(
      false
    );
  });

  it('packs legacy sender key distribution payloads', () => {
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