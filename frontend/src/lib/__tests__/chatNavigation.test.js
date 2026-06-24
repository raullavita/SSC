import { chatListPath, chatNavigateOptions, chatThreadPath } from '../chatNavigation';

describe('chatNavigation', () => {
  it('builds list and thread paths', () => {
    expect(chatListPath()).toBe('/chat');
    expect(chatThreadPath('abc')).toBe('/chat/abc');
  });

  it('uses replace when leaving thread', () => {
    expect(chatNavigateOptions(null)).toEqual({ replace: true });
    expect(chatNavigateOptions('xyz')).toEqual({ replace: false });
  });
});