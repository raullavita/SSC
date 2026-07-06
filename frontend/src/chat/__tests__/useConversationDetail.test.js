import { renderHook, waitFor } from '@testing-library/react';
import { api } from '../../lib/api';
import { useConversationDetail } from '../useConversationDetail';

jest.mock('../../lib/api', () => ({
  api: { get: jest.fn() },
}));

describe('useConversationDetail', () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  it('loads conversation by id', async () => {
    api.get.mockResolvedValue({ conversation: { id: 'c1', title: 'Alice' } });
    const { result } = renderHook(() => useConversationDetail('c1'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(api.get).toHaveBeenCalledWith('/api/conversations/c1');
    expect(result.current.conversation).toEqual({ id: 'c1', title: 'Alice' });
  });

  it('skips fetch when id is empty', async () => {
    const { result } = renderHook(() => useConversationDetail(null));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(api.get).not.toHaveBeenCalled();
    expect(result.current.conversation).toBeNull();
  });
});