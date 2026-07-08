import { sendBroadcastMessage } from '../broadcastSend';
import { api } from '../api';
import { encryptMessage } from '../../signal/signalBridge';
import { encryptSealedMessage } from '../../signal/sealedSender';
import { getSealedSenderEnabled } from '../chatPrefs';

jest.mock('../api', () => ({
  api: {
    post: jest.fn(),
  },
}));

jest.mock('../../signal/signalBridge', () => ({
  encryptMessage: jest.fn(),
}));

jest.mock('../../signal/sealedSender', () => ({
  encryptSealedMessage: jest.fn(),
}));

jest.mock('../chatPrefs', () => ({
  getSealedSenderEnabled: jest.fn(),
}));

describe('sendBroadcastMessage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSealedSenderEnabled.mockReturnValue(false);
    encryptMessage.mockResolvedValue({ ciphertext: 'ct', protocol: 'signal_v1' });
    api.post
      .mockResolvedValueOnce({ conversation: { id: 'c1' } })
      .mockResolvedValueOnce({ message: { id: 'm1' } })
      .mockResolvedValueOnce({ conversation: { id: 'c2' } })
      .mockResolvedValueOnce({ message: { id: 'm2' } });
  });

  it('sends encrypted messages to each recipient', async () => {
    const result = await sendBroadcastMessage({
      text: 'hello team',
      recipientIds: ['peer_a', 'peer_b'],
    });

    expect(result.sent).toBe(2);
    expect(result.failed).toBe(0);
    expect(api.post).toHaveBeenCalledWith('/api/conversations', { participant_id: 'peer_a' });
    expect(api.post).toHaveBeenCalledWith('/api/conversations', { participant_id: 'peer_b' });
    expect(encryptMessage).toHaveBeenCalledWith('hello team', { peerId: 'peer_a' });
    expect(encryptMessage).toHaveBeenCalledWith('hello team', { peerId: 'peer_b' });
  });

  it('uses sealed sender when enabled', async () => {
    getSealedSenderEnabled.mockReturnValue(true);
    encryptSealedMessage.mockResolvedValue({
      ciphertext: 'sealed',
      protocol: 'signal_v1',
      sealed: true,
    });
    api.post.mockReset();
    api.post
      .mockResolvedValueOnce({ conversation: { id: 'c1' } })
      .mockResolvedValueOnce({ message: { id: 'm1' } });

    await sendBroadcastMessage({
      text: 'secret',
      recipientIds: ['peer_a'],
    });

    expect(encryptSealedMessage).toHaveBeenCalledWith('secret', { peerId: 'peer_a' });
    expect(api.post).toHaveBeenCalledWith('/api/conversations/c1/messages', {
      ciphertext: 'sealed',
      protocol: 'signal_v1',
      sealed: true,
    });
  });

  it('throws when every recipient fails', async () => {
    api.post.mockReset();
    api.post.mockRejectedValue(new Error('network'));

    await expect(
      sendBroadcastMessage({
        text: 'hello',
        recipientIds: ['peer_a'],
      })
    ).rejects.toThrow('peer_a: network');
  });
});