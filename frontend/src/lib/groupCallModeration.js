/** Group call raise-hand + mute-all — Q.33 */

import { getMemberRole, isPrivilegedRole } from './groupRoles';

export function canMuteAllInGroupCall(conversation, userId) {
  if (!conversation?.is_group || !userId) return false;
  return isPrivilegedRole(getMemberRole(conversation, userId));
}

export function groupCallBroadcastTargets(members = [], peerIds = [], meId) {
  const targets = new Set();
  for (const m of members) {
    if (m?.user_id && m.user_id !== meId) targets.add(m.user_id);
  }
  for (const id of peerIds) {
    if (id && id !== meId) targets.add(id);
  }
  return [...targets];
}

export function applyMuteAllToStream(stream) {
  const track = stream?.getAudioTracks?.()?.[0];
  if (!track) return false;
  track.enabled = false;
  return true;
}

export function mergeRaisedHandState(current, userId, raised) {
  if (!userId) return current;
  const next = { ...current };
  if (raised) next[userId] = true;
  else delete next[userId];
  return next;
}

export function raisedHandUserIds(raisedHands = {}) {
  return Object.keys(raisedHands).filter((id) => raisedHands[id]);
}