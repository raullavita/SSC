import React, { useEffect, useRef } from 'react';
import { X, Bell, BellSlash, Prohibit, Trash, SignOut, UsersThree, PushPin, Archive } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';
import { userPrimaryLabel } from '../lib/displayName';

/**
 * Long-press / context menu for a chat list row.
 */
export default function ConversationActionsSheet({
  open,
  conversation,
  contact,
  onClose,
  onOpenMute,
  onBlock,
  onPin,
  onArchive,
  onDelete,
  onManageGroup,
}) {
  const { t } = useLocale();
  const sheetRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !conversation) return null;

  const isGroup = conversation.is_group;
  const title = isGroup
    ? (conversation.display_label || t('group'))
    : userPrimaryLabel(conversation.peer);

  const run = (fn) => {
    onClose?.();
    fn?.();
  };

  const isMuted = !!conversation.muted || (!isGroup && !!contact?.muted);

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/70 backdrop-blur-sm flex items-end justify-center safe-bottom"
      onClick={onClose}
      data-testid="conversation-actions-sheet"
    >
      <div
        ref={sheetRef}
        className="w-full max-w-md bg-[#121212] tac-border rounded-t-md p-4 fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-xs tracking-[0.2em] truncate pr-2">{title}</h3>
          <button type="button" onClick={onClose} className="text-[#A1A1AA] hover:text-white">
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <button
            type="button"
            data-testid="conv-action-mute"
            onClick={() => run(() => onOpenMute?.(conversation))}
            className="w-full text-left px-3 py-2.5 rounded-md hover:bg-[#1A1A1A] flex items-center gap-3 text-sm"
          >
            {isMuted ? <Bell size={18} className="text-[#00E5FF]" /> : <BellSlash size={18} className="text-[#00E5FF]" />}
            {isMuted ? t('muteNotifications') : t('muteChat')}
          </button>
          {!isGroup && contact && (
            <button
              type="button"
              data-testid="conv-action-block"
              onClick={() => run(() => onBlock?.(contact.user_id))}
              className="w-full text-left px-3 py-2.5 rounded-md hover:bg-[#1A1A1A] flex items-center gap-3 text-sm"
            >
              <Prohibit size={18} className="text-[#FF9500]" />
              {contact.blocked ? t('unblock') : t('block')}
            </button>
          )}
          {isGroup && (
            <button
              type="button"
              data-testid="conv-action-manage-group"
              onClick={() => run(() => onManageGroup?.(conversation))}
              className="w-full text-left px-3 py-2.5 rounded-md hover:bg-[#1A1A1A] flex items-center gap-3 text-sm"
            >
              <UsersThree size={18} className="text-[#00E5FF]" />
              {t('groupManageTitle')}
            </button>
          )}
          {!conversation.archived && (
            <button
              type="button"
              data-testid="conv-action-pin"
              onClick={() => run(() => onPin?.(conversation))}
              className="w-full text-left px-3 py-2.5 rounded-md hover:bg-[#1A1A1A] flex items-center gap-3 text-sm"
            >
              <PushPin size={18} className="text-[#00E5FF]" weight={conversation.pinned ? 'fill' : 'regular'} />
              {conversation.pinned ? t('unpinChat') : t('pinChat')}
            </button>
          )}
          <button
            type="button"
            data-testid="conv-action-archive"
            onClick={() => run(() => onArchive?.(conversation))}
            className="w-full text-left px-3 py-2.5 rounded-md hover:bg-[#1A1A1A] flex items-center gap-3 text-sm"
          >
            <Archive size={18} className="text-[#00E5FF]" weight={conversation.archived ? 'fill' : 'regular'} />
            {conversation.archived ? t('unarchiveChat') : t('archiveChat')}
          </button>
          <button
            type="button"
            data-testid="conv-action-delete"
            onClick={() => run(() => onDelete?.(conversation))}
            className="w-full text-left px-3 py-2.5 rounded-md hover:bg-[#1A1A1A] flex items-center gap-3 text-sm text-[#FF3B30]"
          >
            {isGroup ? <SignOut size={18} /> : <Trash size={18} />}
            {isGroup ? t('leaveGroup') : t('deleteChat')}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConversationListRow({
  conversation,
  activeId,
  isMuted,
  label,
  subtitle,
  onSelect,
  onOpenActions,
  children,
}) {
  const longPressRef = useRef(false);
  const press = useConversationLongPress(() => {
    longPressRef.current = true;
    onOpenActions?.(conversation);
  });

  return (
    <button
      key={conversation.conversation_id}
      type="button"
      data-testid={`conversation-${conversation.conversation_id}`}
      {...press}
      onClick={() => {
        if (longPressRef.current) {
          longPressRef.current = false;
          return;
        }
        onSelect?.(conversation.conversation_id);
      }}
      className={`w-full text-left px-4 py-3 border-b border-[#27272A] flex items-center gap-3 hover:bg-[#1A1A1A] transition ${activeId === conversation.conversation_id ? 'bg-[#1A1A1A]' : ''}`}
    >
      {children || (
        <>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">{label}</div>
            <div className="text-[11px] text-[#A1A1AA] truncate font-mono">{subtitle}</div>
          </div>
        </>
      )}
    </button>
  );
}

/** Attach long-press (touch) and right-click handlers. */
export function useConversationLongPress(onLongPress, { delayMs = 500 } = {}) {
  const timerRef = useRef(null);

  const clear = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const onTouchStart = (e) => {
    clear();
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onLongPress?.(e);
    }, delayMs);
  };

  const onTouchEnd = () => clear();
  const onTouchMove = () => clear();
  const onContextMenu = (e) => {
    e.preventDefault();
    onLongPress?.(e);
  };

  return { onTouchStart, onTouchEnd, onTouchMove, onContextMenu };
}