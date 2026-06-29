/** Group size limits — Q.29 (synced with /api/config groups.max_participants). */

import { getBackendUrl } from './platform';

export const DEFAULT_MAX_GROUP_PARTICIPANTS = 50;

let cachedMax = null;

export async function fetchMaxGroupParticipants() {
  if (cachedMax != null) return cachedMax;
  try {
    const res = await fetch(`${getBackendUrl()}/api/config`);
    const cfg = await res.json();
    const max = Number(cfg?.groups?.max_participants);
    cachedMax = Number.isFinite(max) && max > 1 ? max : DEFAULT_MAX_GROUP_PARTICIPANTS;
  } catch {
    cachedMax = DEFAULT_MAX_GROUP_PARTICIPANTS;
  }
  return cachedMax;
}

export function remainingGroupSlots(participantCount, maxParticipants = DEFAULT_MAX_GROUP_PARTICIPANTS) {
  return Math.max(0, maxParticipants - (participantCount || 0));
}

export function isGroupFull(participantCount, maxParticipants = DEFAULT_MAX_GROUP_PARTICIPANTS) {
  return remainingGroupSlots(participantCount, maxParticipants) <= 0;
}

export function maxInitialGroupPicks(maxParticipants = DEFAULT_MAX_GROUP_PARTICIPANTS) {
  return Math.max(0, maxParticipants - 1);
}

export function clearGroupLimitsCache() {
  cachedMax = null;
}