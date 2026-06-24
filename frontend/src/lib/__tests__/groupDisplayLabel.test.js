import { formatGroupMemberLabel, formatGroupConversationLabel } from '../groupDisplayLabel';
import { setLocalGroupLabel, clearLocalGroupLabels } from '../groupLabels';

describe('groupDisplayLabel', () => {
  afterEach(() => {
    clearLocalGroupLabels();
  });

  it('formats two member names', () => {
    expect(formatGroupMemberLabel([
      { username: 'bob' },
      { username: 'alice' },
    ])).toBe('@alice, @bob');
  });

  it('formats overflow with +N', () => {
    expect(formatGroupMemberLabel([
      { username: 'carol' },
      { username: 'bob' },
      { username: 'alice' },
    ])).toBe('@alice, @bob +1');
  });

  it('prefers local label when set', () => {
    setLocalGroupLabel('g_abc', 'Weekend crew');
    expect(formatGroupConversationLabel({
      conversation_id: 'g_abc',
      is_group: true,
      members: [{ username: 'alice' }],
    })).toBe('Weekend crew');
  });
});