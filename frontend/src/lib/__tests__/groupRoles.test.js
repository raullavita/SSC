import {
  ROLE_ADMIN,
  ROLE_MEMBER,
  ROLE_OWNER,
  canAddMembers,
  canPostInGroup,
  canRemoveMember,
  getMemberRole,
} from '../groupRoles';

function group(overrides = {}) {
  return {
    is_group: true,
    participants: ['u_owner', 'u_admin', 'u_mem'],
    owner_id: 'u_owner',
    member_roles: {
      u_owner: ROLE_OWNER,
      u_admin: ROLE_ADMIN,
      u_mem: ROLE_MEMBER,
    },
    group_permissions: { posting: 'all', add_members: 'admins' },
    ...overrides,
  };
}

describe('groupRoles', () => {
  it('resolves member roles from legacy admin_id', () => {
    const conv = {
      is_group: true,
      participants: ['u_a', 'u_b'],
      admin_id: 'u_a',
    };
    expect(getMemberRole(conv, 'u_a')).toBe(ROLE_OWNER);
    expect(getMemberRole(conv, 'u_b')).toBe(ROLE_MEMBER);
  });

  it('blocks members when posting is admins_only', () => {
    const conv = group({ group_permissions: { posting: 'admins_only', add_members: 'admins' } });
    expect(canPostInGroup(conv, 'u_mem')).toBe(false);
    expect(canPostInGroup(conv, 'u_admin')).toBe(true);
  });

  it('restricts add members to owner when configured', () => {
    const conv = group({ group_permissions: { posting: 'all', add_members: 'owner_only' } });
    expect(canAddMembers(conv, 'u_admin')).toBe(false);
    expect(canAddMembers(conv, 'u_owner')).toBe(true);
  });

  it('allows admin to remove members but not owner', () => {
    const conv = group();
    expect(canRemoveMember(conv, 'u_admin', 'u_mem')).toBe(true);
    expect(canRemoveMember(conv, 'u_admin', 'u_owner')).toBe(false);
  });
});