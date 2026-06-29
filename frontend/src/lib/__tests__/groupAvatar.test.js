import { groupAvatarProps, groupDescriptionLine } from '../groupAvatar';

describe('groupAvatar', () => {
  it('uses group photo when set', () => {
    const props = groupAvatarProps({
      is_group: true,
      group_photo: 'data:image/jpeg;base64,abc',
    });
    expect(props.isGroup).toBe(false);
    expect(props.user.avatar).toContain('data:image/jpeg');
  });

  it('falls back to group icon without photo', () => {
    const props = groupAvatarProps({ is_group: true });
    expect(props.isGroup).toBe(true);
    expect(props.user).toBeNull();
  });

  it('returns description line when present', () => {
    expect(groupDescriptionLine({ group_description: '  Team chat  ' })).toBe('Team chat');
    expect(groupDescriptionLine({})).toBe('');
  });
});