import { useCallback } from 'react';
import { toast } from 'sonner';
import { ensureMediaPermissions } from '../lib/mediaPermissions';
import { stopIncomingRingtone } from '../lib/callRingtone';
import { isPeerBlocked } from '../lib/contactFilters';
import { usesSignalOnlyMessaging } from '../lib/signal/installedMessaging';
import { evaluateMessagingGate } from './messagingGate';
import { toastMessagingGateFailure } from './messagingErrors';

export function useChatCalls({
  isGroup,
  peer,
  activeConv,
  activeId,
  user,
  myContacts,
  callState,
  setCallState,
  groupCallState,
  setGroupCallState,
  socketRef,
  refreshUser,
  t,
}) {
  const runCallEncryptionGate = useCallback(async () => {
    if (!usesSignalOnlyMessaging()) return { ok: true, useSignal: false };
    const gate = await evaluateMessagingGate({
      isGroup,
      peer,
      user,
      members: activeConv?.members || [],
      refreshUser,
    });
    if (!gate.ok) {
      toastMessagingGateFailure(gate, t);
      return null;
    }
    return gate;
  }, [isGroup, peer, user, activeConv, refreshUser, t]);

  const startCall = useCallback(async (mode) => {
    if (!isGroup && peer && isPeerBlocked(peer.user_id, myContacts)) {
      toast.error(t('cannotMessageBlocked'));
      return;
    }

    const gate = await runCallEncryptionGate();
    if (!gate) return;

    const ok = await ensureMediaPermissions(
      { audio: true, video: mode === 'video' },
      { t },
    );
    if (!ok) return;

    if (isGroup && activeConv) {
      const members = (activeConv.members || []).filter((m) => m.user_id !== user?.user_id);
      if (members.length === 0) {
        toast.error(t('groupCallNoMembers'));
        return;
      }
      const { validateGroupCallSize, resolveGroupCallModeForStart } = await import('../lib/groupCalls');
      const capErr = await validateGroupCallSize(members.length);
      if (capErr) {
        toast.error(capErr);
        return;
      }
      const mediaMode = await resolveGroupCallModeForStart(members.length);
      setGroupCallState({
        mode,
        mediaMode,
        direction: 'outgoing',
        members,
        signal: null,
        conversationId: activeId,
      });
      return;
    }
    if (!peer) return;
    setCallState({ mode, direction: 'outgoing', peer, signal: null });
  }, [
    isGroup,
    peer,
    activeConv,
    activeId,
    user?.user_id,
    myContacts,
    runCallEncryptionGate,
    setCallState,
    setGroupCallState,
    t,
  ]);

  const acceptCall = useCallback(async () => {
    if (!callState) return;
    const ok = await ensureMediaPermissions(
      { audio: true, video: callState.mode === 'video' },
      { t },
    );
    if (!ok) return;
    stopIncomingRingtone();
    setCallState((s) => (s ? { ...s, direction: 'incoming-accepted' } : s));
  }, [callState, setCallState, t]);

  const rejectCall = useCallback(() => {
    if (!callState) return;
    stopIncomingRingtone();
    socketRef.current?.send({ type: 'call-reject', to: callState.peer.user_id });
    setCallState(null);
  }, [callState, setCallState, socketRef]);

  const rejectGroupCall = useCallback(() => {
    if (!groupCallState) return;
    stopIncomingRingtone();
    const from = groupCallState.signal?.from;
    if (from) {
      socketRef.current?.send({ type: 'call-reject', to: from, group: true });
    }
    setGroupCallState(null);
  }, [groupCallState, setGroupCallState, socketRef]);

  const acceptGroupCall = useCallback(async () => {
    if (!groupCallState) return;
    const ok = await ensureMediaPermissions(
      { audio: true, video: groupCallState.mode === 'video' },
      { t },
    );
    if (!ok) return;
    stopIncomingRingtone();
    setGroupCallState((s) => (s ? { ...s, direction: 'incoming-accepted' } : s));
  }, [groupCallState, setGroupCallState, t]);

  return {
    startCall,
    acceptCall,
    rejectCall,
    rejectGroupCall,
    acceptGroupCall,
  };
}