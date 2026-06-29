import { api } from '../lib/api';
import { ensureSignalSession } from '../lib/signal/x3dh';
import { notifyDesktopIncomingCall } from '../lib/desktopNotifications';
import { resolveIncomingSignaling, SignalingInboundError } from './signalingInbound';

/**
 * Handle WS call-offer — never silent-fail on encrypted signaling.
 */
export async function handleIncomingCallOffer(data, {
  user,
  t,
  toast,
  setCallState,
  setGroupCallState,
}) {
  if (!data?.from) return;

  if (user?.user_id && data.from) {
    await ensureSignalSession(data.from, user.user_id).catch((err) => {
      console.warn('[SSC] pre-call session establish failed:', err?.message || err);
    });
  }

  const resolved = await resolveIncomingSignaling(data, {
    myUserId: user?.user_id,
    peerUserId: data.from,
  });

  if (!resolved.ok) {
    if (resolved.encrypted || resolved.error === SignalingInboundError.CLEARTEXT_REJECTED) {
      toast.error(t('callSignalingDecryptFailed'));
    }
    console.warn('[SSC] incoming call-offer dropped:', resolved.error);
    return;
  }

  const offer = resolved.signal;
  if (!offer?.sdp && offer?.type === 'call-offer') {
    toast.error(t('callSignalingDecryptFailed'));
    return;
  }

  const { data: peerData } = await api.get(`/users/${offer.from}/public`);

  if (offer.group) {
    const members = (offer.members || []).filter((m) => m.user_id !== user?.user_id);
    if (members.length === 0) members.push({ user_id: offer.from, username: peerData.username });
    setGroupCallState({
      mode: offer.mode,
      direction: 'incoming',
      members,
      signal: { from: offer.from, from_username: peerData.username, sdp: offer.sdp, members: offer.members },
    });
  } else {
    setCallState({
      mode: offer.mode,
      direction: 'incoming',
      peer: peerData,
      signal: { sdp: offer.sdp },
    });
  }

  notifyDesktopIncomingCall({
    fromUsername: peerData.username,
    mode: offer.mode,
    group: !!offer.group,
    conversationId: offer.conversation_id || null,
  }).catch((err) => {
    console.warn('[SSC] desktop incoming-call notification failed:', err?.message || err);
  });
}

/** Handle WS call-sfu-invite — SFU group calls (no SDP). */
export async function handleIncomingSfuInvite(data, {
  user,
  t,
  toast,
  setGroupCallState,
}) {
  if (!data?.from || !data?.conversation_id) return;

  const { data: peerData } = await api.get(`/users/${data.from}/public`);
  const members = (data.members || []).filter((m) => m.user_id !== user?.user_id);
  if (members.length === 0) {
    members.push({ user_id: data.from, username: peerData.username });
  }

  setGroupCallState({
    mode: data.mode || 'audio',
    mediaMode: 'sfu',
    direction: 'incoming',
    members,
    conversationId: data.conversation_id,
    signal: {
      from: data.from,
      from_username: peerData.username,
      members: data.members,
    },
  });

  notifyDesktopIncomingCall({
    fromUsername: peerData.username,
    mode: data.mode || 'audio',
    group: true,
    conversationId: data.conversation_id,
  }).catch((err) => {
    console.warn('[SSC] desktop incoming SFU call notification failed:', err?.message || err);
  });
}

/** Surface unexpected call-offer handler failures to the user. */
export function reportIncomingCallOfferError(err, { t, toast }) {
  console.error('[SSC] incoming call-offer handler failed:', err?.message || err);
  toast.error(t('callIncomingFailed'));
}