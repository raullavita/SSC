import { renderHook, waitFor } from '@testing-library/react';
import { useActiveConversation } from '../useActiveConversation';
import { useConversationDetail } from '../useConversationDetail';

jest.mock('../useConversationDetail', () => ({
  useConversationDetail: jest.fn(),
}));

describe('useActiveConversation', () => {
  beforeEach(() => {
    useConversationDetail.mockReset();
  });

  it('merges list row with fetched detail and syncs list updates', async () => {
    const onListUpdated = jest.fn();
    useConversationDetail.mockReturnValue({
      conversation: {
        id: 'c1',
        pinned: true,
        muted: false,
        unread_count: 0,
      },
      refresh: jest.fn(),
      loading: false,
      error: null,
    });

    const { result } = renderHook(() =>
      useActiveConversation(
        [{ id: 'c1', peer_id: 'u2', unread_count: 3, muted: true }],
        'c1',
        onListUpdated
      )
    );

    await waitFor(() => {
      expect(onListUpdated).toHaveBeenCalledWith({
        id: 'c1',
        pinned: true,
        muted: false,
        unread_count: 0,
      });
    });

    expect(result.current.active).toEqual({
      id: 'c1',
      peer_id: 'u2',
      pinned: true,
      muted: false,
      unread_count: 0,
    });
  });

  it('returns null active conversation when nothing is selected', () => {
    useConversationDetail.mockReturnValue({
      conversation: null,
      refresh: jest.fn(),
      loading: false,
      error: null,
    });

    const { result } = renderHook(() => useActiveConversation([], null, jest.fn()));
    expect(result.current.active).toBeNull();
  });
});