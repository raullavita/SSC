import { useEffect } from 'react';
import { toast } from 'sonner';
import { ChatSocket } from '../lib/socket';
import { getSessionToken } from '../lib/sessionStore';
import { stopIncomingRingtone } from '../lib/callRingtone';
import {
  isContactRealtimeEvent,
} from '../lib/contactRealtime';
import { maybeNotifyDesktopMessage, notifyDesktopFriendRequest } from '../lib/desktopNotifications';
import { formatGroupConversationLabel } from '../lib/groupDisplayLabel';
import { isPeerMuted } from '../lib/contactFilters';
import {
  processIncomingSkdmMessage,
} from '../lib/signal/groupMessages';
import { SKDM_MESSAGE_TYPE } from '../lib/signal/constants';
import { STATUS_SKDM_MESSAGE_TYPE, processIncomingStatusSkdmMessage } from '../lib/signal/statuses';
import { deleteSignalSession } from '../lib/signal/nativeLibsignal';
import { resolveIncomingSignaling, SignalingInboundError } from './signalingInbound';
import { handleIncomingCallOffer, reportIncomingCallOfferError } from './incomingCallHandler';
import { readReceiptsEnabled, typingIndicatorsEnabled } from '../lib/privacySettings';
import { applyMessageDeleted } from '../lib/messageDelete';
import { applyMessageEdited } from '../lib/messageEdit';
import { applyMessageReactionUpdate } from '../lib/messageReactions';

export function useChatSocket({
  user,
  activeId,
  peer,
  t,
  leaveChat,
  loadConversations,
  setMessages,
  setTypingFrom,
  setCallState,
  setGroupCallState,
  setReads,
  socketRef,
  conversationsRef,
  myContactsRef,
  refreshContactsRosterRef,
}) {
  useEffect(() => {
    if (!user) return undefined;
    const s = new ChatSocket(getSessionToken(), {
      onMessage: (data) => {
        if (data.type === 'message') {
          const incoming = data.data;
          if (incoming?.message_type === SKDM_MESSAGE_TYPE) {
            processIncomingSkdmMessage(incoming, {
              myUserId: user.user_id,
              peerUserId: peer?.user_id,
            }).catch((err) => {
              console.warn('[SSC] incoming group SKDM failed:', err?.message || err);
            });
          } else if (incoming?.message_type === STATUS_SKDM_MESSAGE_TYPE) {
            processIncomingStatusSkdmMessage(incoming, {
              myUserId: user.user_id,
              peerUserId: incoming.sender_id !== user.user_id ? incoming.sender_id : peer?.user_id,
            }).catch((err) => {
              console.warn('[SSC] incoming status SKDM failed:', err?.message || err);
            });
          } else if (incoming.conversation_id === activeId) {
            setMessages((m) => [...m, incoming]);
          }
          loadConversations();
          maybeNotifyDesktopMessage(incoming, {
            myUserId: user.user_id,
            activeId,
            conversations: conversationsRef.current,
            myContacts: myContactsRef.current,
            formatGroupLabel: formatGroupConversationLabel,
            isPeerMutedFn: isPeerMuted,
          }).catch(() => {});
        } else if (data.type === 'typing') {
          if (
            typingIndicatorsEnabled(user)
            && data.conversation_id === activeId
            && data.user_id !== user?.user_id
          ) {
            setTypingFrom(data.username);
            setTimeout(() => setTypingFrom(null), 2500);
          }
        } else if (data.type === 'call-offer') {
          handleIncomingCallOffer(data, {
            user,
            t,
            toast,
            setCallState,
            setGroupCallState,
          }).catch((err) => {
            reportIncomingCallOfferError(err, { t, toast });
          });
        } else if (data.type === 'message-deleted') {
          if (data.conversation_id === activeId) {
            setMessages((cur) => applyMessageDeleted(cur, data));
          }
          loadConversations();
        } else if (data.type === 'message-edited') {
          const edited = data.data;
          if (edited?.conversation_id === activeId) {
            setMessages((cur) => applyMessageEdited(cur, edited));
          }
          loadConversations();
        } else if (data.type === 'message-reaction') {
          if (data.conversation_id === activeId) {
            setMessages((cur) => applyMessageReactionUpdate(cur, data));
          }
        } else if (data.type === 'read') {
          if (readReceiptsEnabled(user) && data.conversation_id === activeId) {
            setReads((cur) => {
              const others = cur.filter((r) => r.user_id !== data.user_id);
              return [...others, { user_id: data.user_id, last_read_message_id: data.last_read_message_id }];
            });
          }
        } else if (data.type === 'conversation-created' || data.type === 'conversation-updated') {
          loadConversations();
        } else if (data.type === 'conversation-deleted') {
          loadConversations();
          if (data.data?.conversation_id === activeId) leaveChat();
        } else if (data.type === 'status-new') {
          window.dispatchEvent(new Event('ssc-status-new'));
        } else if (data.type === 'identity-changed' && data.user_id) {
          deleteSignalSession(data.user_id).catch((err) => {
            console.warn('[SSC] deleteSignalSession after identity-changed failed:', err?.message || err);
          });
          if (data.user_id === peer?.user_id) {
            toast.message(t('signalIdentityRotated'));
          }
        } else if (data.type === 'signaling-error') {
          console.warn('[SSC] signaling rejected by server:', data.detail || data.original_type);
          toast.error(t('callSignalingRejected'));
        } else if (isContactRealtimeEvent(data)) {
          const full = data.type === 'friend-accepted' || data.type === 'contacts-changed';
          refreshContactsRosterRef.current?.({ full });
          if (data.type === 'friend-request' && data.from_username) {
            toast.message(t('friendRequestIncoming', { user: data.from_username }));
            notifyDesktopFriendRequest(data.from_username).catch(() => {});
          } else if (data.type === 'friend-accepted' && data.contact_username) {
            toast.success(t('friendRequestAcceptedBy', { user: data.contact_username }));
          }
        } else if (['call-answer', 'ice-candidate', 'call-end', 'call-reject'].includes(data.type)) {
          (async () => {
            let signal = data;
            if (user?.user_id && data.type !== 'call-end' && data.type !== 'call-reject') {
              const resolved = await resolveIncomingSignaling(data, {
                myUserId: user.user_id,
                peerUserId: data.from,
              });
              if (!resolved.ok) {
                if (resolved.encrypted || resolved.error === SignalingInboundError.CLEARTEXT_REJECTED) {
                  console.warn('[SSC] call signaling unpack failed:', resolved.error);
                  toast.error(t('callSignalingDecryptFailed'));
                }
                return;
              }
              signal = resolved.signal;
            }
            window.dispatchEvent(new CustomEvent('ssc-signal', { detail: signal }));
            if (signal.type === 'call-end' || signal.type === 'call-reject') {
              stopIncomingRingtone();
              setCallState(null);
              setGroupCallState(null);
            }
          })();
        }
      },
    });
    s.connect();
    socketRef.current = s;
    return () => s.close();
  }, [
    activeId,
    user?.user_id,
    peer?.user_id,
    t,
    leaveChat,
    loadConversations,
    setMessages,
    setTypingFrom,
    setCallState,
    setGroupCallState,
    setReads,
    socketRef,
    conversationsRef,
    myContactsRef,
    refreshContactsRosterRef,
  ]);
}