import {
  buildGroupMemberRows,
  formatMemberJoinedDate,
  memberJoinedAt,
  roleBadgeTone,
} from '../groupMembers';
import { ROLE_ADMIN, ROLE_OWNER } from '../groupRoles';

describe('groupMembers', () => {
  const conv = {
    is_group: true,
    created_at: '2026-06-20T08:00:00.000Z',
    participants: ['u_owner', 'u_admin', 'u_mem'],
    owner_id: 'u_owner',
    member_roles: {
      u_owner: ROLE_OWNER,
      u_admin: ROLE_ADMIN,
      u_mem: 'member',
    },
    member_joined_at: {
      u_owner: '2026-06-20T08:00:00.000Z',
      u_admin: '2026-06-21T08:00:00.000Z',
      u_mem: '2026-06-22T08:00:00.000Z',
    },
    members: [
      { user_id: 'u_admin', username: 'admin', joined_at: '2026-06-21T08:00:00.000Z' },
      { user_id: 'u_mem', username: 'member', joined_at: '2026-06-22T08:00:00.000Z' },
    ],
  };

  it('resolves joined_at from member row or map', () => {
    expect(memberJoinedAt(conv, 'u_admin')).toBe('2026-06-21T08:00:00.000Z');
    expect(memberJoinedAt(conv, 'u_owner')).toBe('2026-06-20T08:00:00.000Z');
  });

  it('sorts owner before admin before member', () => {
    const rows = buildGroupMemberRows(conv, {
      user_id: 'u_owner',
      username: 'owner',
    });
    expect(rows.map((r) => r.user_id)).toEqual(['u_owner', 'u_admin', 'u_mem']);
  });

  it('formats joined date', () => {
    const text = formatMemberJoinedDate('2026-06-20T08:00:00.000Z', 'en');
    expect(text).toMatch(/Jun/);
    expect(text).toMatch(/20/);
  });

  it('maps role badge tones', () => {
    expect(roleBadgeTone(ROLE_OWNER)).toBe('owner');
    expect(roleBadgeTone(ROLE_ADMIN)).toBe('admin');
    expect(roleBadgeTone('member')).toBeNull();
  });

  it('sorts 50-member roster with owner first', () => {
    const participants = Array.from({ length: 50 }, (_, i) => `u_${String(i).padStart(2, '0')}`);
    const conv = {
      is_group: true,
      participants,
      owner_id: 'u_00',
      member_roles: Object.fromEntries(
        participants.map((id, i) => [id, i === 0 ? ROLE_OWNER : 'member']),
      ),
      members: participants.slice(1).map((id) => ({ user_id: id, username: id })),
    };
    const rows = buildGroupMemberRows(conv, { user_id: 'u_00', username: 'owner' });
    expect(rows).toHaveLength(50);
    expect(rows[0].user_id).toBe('u_00');
  });
});