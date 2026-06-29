import React, { useEffect } from 'react';
import { X, Bell, BellSlash, Prohibit, ShieldCheck } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';
import Avatar from './Avatar';
import { formatPeerPresence } from '../lib/presence';
import { userHandle, userPrimaryLabel } from '../lib/displayName';
import { userBio } from '../lib/profileBio';

/**
 * Tap peer avatar/name in chat header — quick profile + mute/block (TASK M.1 / H.7).
 */
export default function ProfileContactSheet({
  open,
  peer,
  contact,
  onClose,
  onMute,
  onBlock,
  onVerify,
}) {
  const { t } = useLocale();

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !peer) return null;

  const muted = !!contact?.muted;
  const blocked = !!contact?.blocked;
  const peerBio = userBio(peer);

  const run = (fn) => {
    onClose?.();
    fn?.();
  };

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm flex items-end md:items-center justify-center safe-bottom"
      onClick={onClose}
      data-testid="profile-contact-sheet"
    >
      <div
        className="w-full max-w-sm bg-[#121212] tac-border rounded-t-md md:rounded-md p-5 fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-end mb-1">
          <button type="button" onClick={onClose} className="text-[#A1A1AA] hover:text-white" aria-label={t('close')}>
            <X size={16} />
          </button>
        </div>

        <div className="flex flex-col items-center text-center">
          <Avatar user={peer} size="xl" showOnline />
          <h3 className="mt-4 text-lg font-medium tracking-tight truncate max-w-full" data-testid="profile-sheet-username">
            {userPrimaryLabel(peer)}
          </h3>
          {peer.display_name && (
            <p className="mt-1 text-[10px] font-mono text-[#A1A1AA] tracking-wider" data-testid="profile-sheet-handle">
              {userHandle(peer)}
            </p>
          )}
          <p className="mt-1 text-[10px] font-mono text-[#A1A1AA] tracking-wider uppercase">
            {formatPeerPresence(peer)}
            {peer.language ? ` · ${peer.language.toUpperCase()}` : ''}
          </p>
          {peerBio && (
            <p
              className="mt-4 w-full text-left text-sm text-[#D4D4D8] whitespace-pre-wrap leading-relaxed px-1"
              data-testid="profile-sheet-bio"
            >
              {peerBio}
            </p>
          )}
        </div>

        {contact && (
          <div className="mt-6 flex flex-col gap-1">
            <button
              type="button"
              data-testid="profile-sheet-mute"
              onClick={() => run(() => onMute?.(peer.user_id))}
              className="w-full text-left px-3 py-2.5 rounded-md hover:bg-[#1A1A1A] flex items-center gap-3 text-sm"
            >
              {muted ? <Bell size={18} className="text-[#00E5FF]" /> : <BellSlash size={18} className="text-[#00E5FF]" />}
              {muted ? t('unmute') : t('mute')}
            </button>
            <button
              type="button"
              data-testid="profile-sheet-block"
              onClick={() => run(() => onBlock?.(peer.user_id))}
              className="w-full text-left px-3 py-2.5 rounded-md hover:bg-[#1A1A1A] flex items-center gap-3 text-sm"
            >
              <Prohibit size={18} className={blocked ? 'text-[#34C759]' : 'text-[#FF9500]'} />
              {blocked ? t('unblock') : t('block')}
            </button>
            {onVerify ? (
              <button
                type="button"
                data-testid="profile-sheet-verify"
                onClick={() => run(() => onVerify?.())}
                className="w-full text-left px-3 py-2.5 rounded-md hover:bg-[#1A1A1A] flex items-center gap-3 text-sm"
              >
                <ShieldCheck size={18} className="text-[#00E5FF]" />
                {t('verifyIdentity')}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}