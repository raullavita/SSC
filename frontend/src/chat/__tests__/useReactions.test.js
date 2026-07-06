import { act, renderHook, waitFor } from '@testing-library/react';
import * as signalBridge from '../../signal/signalBridge';
import * as reactionsApi from '../reactions';
import { useReactions } from '../useReactions';

describe('useReactions', () => {
  beforeEach(() => {
    jest.spyOn(signalBridge, 'decryptMessage').mockResolvedValue(
      JSON.stringify({ emoji: '👍', target: 'msg_1' })
    );
    jest.spyOn(reactionsApi, 'fetchConversationReactions').mockResolvedValue({
      reactions: [
        {
          id: 'rx_1',
          sender_id: 'peer',
          ciphertext: 'enc',
          protocol: 'signal_v1_reaction',
        },
      ],
    });
    jest.spyOn(reactionsApi, 'sendReaction').mockResolvedValue({
      reaction: {
        id: 'rx_new',
        sender_id: 'u1',
        ciphertext: 'enc2',
        protocol: 'signal_v1_reaction',
        mine: true,
      },
    });
    jest.spyOn(reactionsApi, 'removeReaction').mockResolvedValue({ ok: true });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('loads and aggregates reactions by target', async () => {
    const { result } = renderHook(() =>
      useReactions({
        conversationId: 'conv_1',
        enabled: true,
        peerId: 'peer',
        isGroup: false,
        userId: 'u1',
      })
    );

    await waitFor(() => {
      expect(result.current.reactionsLoading).toBe(false);
    });
    expect(result.current.reactionsByTarget.msg_1).toHaveLength(1);
    expect(result.current.reactionsByTarget.msg_1[0].emoji).toBe('👍');
  });

  test('optimistically adds reaction', async () => {
    jest.spyOn(reactionsApi, 'fetchConversationReactions').mockResolvedValue({ reactions: [] });
    jest.spyOn(signalBridge, 'decryptMessage').mockResolvedValue(
      JSON.stringify({ emoji: '❤️', target: 'msg_2' })
    );
    const onError = jest.fn();
    const { result } = renderHook(() =>
      useReactions({
        conversationId: 'conv_1',
        enabled: true,
        peerId: 'peer',
        isGroup: false,
        userId: 'u1',
        onError,
      })
    );

    await waitFor(() => expect(result.current.reactionsLoading).toBe(false));

    await act(async () => {
      await result.current.sendReaction('❤️', 'msg_2');
    });

    expect(reactionsApi.sendReaction).toHaveBeenCalled();
    expect(result.current.reactionsByTarget.msg_2[0].emoji).toBe('❤️');
    expect(onError).not.toHaveBeenCalled();
  });

  test('rolls back on remove failure', async () => {
    jest.spyOn(signalBridge, 'decryptMessage').mockResolvedValue(
      JSON.stringify({ emoji: '👍', target: 'msg_1' })
    );
    jest.spyOn(reactionsApi, 'fetchConversationReactions').mockResolvedValue({
      reactions: [
        {
          id: 'rx_mine',
          sender_id: 'u1',
          ciphertext: 'enc',
          protocol: 'signal_v1_reaction',
          mine: true,
        },
      ],
    });
    reactionsApi.removeReaction.mockRejectedValueOnce(new Error('network'));
    const onError = jest.fn();

    const { result } = renderHook(() =>
      useReactions({
        conversationId: 'conv_1',
        enabled: true,
        peerId: 'peer',
        isGroup: false,
        userId: 'u1',
        onError,
      })
    );

    await waitFor(() => expect(result.current.reactionsByTarget.msg_1).toBeDefined());

    await act(async () => {
      await result.current.sendReaction('👍', 'msg_1');
    });

    expect(onError).toHaveBeenCalledWith('network');
    expect(result.current.reactionsByTarget.msg_1[0].emoji).toBe('👍');
  });
});