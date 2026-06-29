import {
  applyMuteAllToStream,
  canMuteAllInGroupCall,
  groupCallBroadcastTargets,
  mergeRaisedHandState,
  raisedHandUserIds,
} from '../groupCallModeration';

describe('groupCallModeration', () => {
  const groupConv = {
    is_group: true,
    participants: ['u_owner', 'u_member'],
    owner_id: 'u_owner',
    member_roles: { u_owner: 'owner', u_member: 'member' },
  };

  it('allows mute-all for owner/admin only', () => {
    expect(canMuteAllInGroupCall(groupConv, 'u_owner')).toBe(true);
    expect(canMuteAllInGroupCall(groupConv, 'u_member')).toBe(false);
    expect(canMuteAllInGroupCall(null, 'u_owner')).toBe(false);
  });

  it('collects broadcast targets excluding self', () => {
    expect(groupCallBroadcastTargets(
      [{ user_id: 'u_a' }, { user_id: 'u_b' }],
      ['u_c'],
      'u_me',
    )).toEqual(['u_a', 'u_b', 'u_c']);
  });

  it('tracks raised hands', () => {
    let hands = {};
    hands = mergeRaisedHandState(hands, 'u_a', true);
    hands = mergeRaisedHandState(hands, 'u_b', true);
    expect(raisedHandUserIds(hands)).toEqual(['u_a', 'u_b']);
    hands = mergeRaisedHandState(hands, 'u_a', false);
    expect(raisedHandUserIds(hands)).toEqual(['u_b']);
  });

  it('mutes local audio track', () => {
    const track = { enabled: true };
    const stream = { getAudioTracks: () => [track] };
    expect(applyMuteAllToStream(stream)).toBe(true);
    expect(track.enabled).toBe(false);
  });
});