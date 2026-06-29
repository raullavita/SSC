import React, { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { X, BellSlash, Prohibit, Trash, ChatCircle, MagnifyingGlass } from '@phosphor-icons/react';
import { formatPeerPresence } from '../lib/presence';
import Avatar from './Avatar';
import { formatUserLabel, userPrimaryLabel } from '../lib/displayName';
import { bioPreviewLine, userBio } from '../lib/profileBio';
import { api } from '../lib/api';
import { useLocale } from '../context/LocaleContext';

const TAB_IDS = ['add', 'all', 'pending', 'blocked'];
const TAB_LABEL_KEYS = {
  add: 'tabAdd',
  all: 'tabAll',
  pending: 'tabPending',
  blocked: 'tabBlocked',
};

export default function ContactsModal({
  open,
  onClose,
  contacts = [],
  pendingRequests = [],
  outgoingRequests = [],
  onAccept,
  onReject,
  onMessage,
  onAddUser,
  onToggleBlock,
  onToggleMute,
  onRemove,
}) {
  const { t } = useLocale();
  const [tab, setTab] = useState('add');
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const debRef = useRef(null);

  useEffect(() => {
    if (!open) {
      setSearchQ('');
      setSearchResults([]);

      return;
    }
    setTab('add');
  }, [open]);

  useEffect(() => {
    if (!open || tab !== 'add' || searchQ.length < 2) {
      setSearchResults([]);
      return;
    }
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/users/search', { params: { q: searchQ } });
        setSearchResults(data);
      } catch {}
    }, 300);
    return () => debRef.current && clearTimeout(debRef.current);
  }, [searchQ, open, tab]);

  const activeContacts = useMemo(
    () => contacts.filter((c) => !c.blocked).sort((a, b) => userPrimaryLabel(a).localeCompare(userPrimaryLabel(b))),
    [contacts],
  );
  const blockedContacts = useMemo(
    () => contacts.filter((c) => c.blocked).sort((a, b) => userPrimaryLabel(a).localeCompare(userPrimaryLabel(b))),
    [contacts],
  );

  const contactById = useMemo(() => {
    const map = new Map();
    contacts.forEach((c) => map.set(c.user_id, c));
    return map;
  }, [contacts]);

  const incomingByUserId = useMemo(() => {
    const map = new Map();
    pendingRequests.forEach((r) => map.set(r.from_user_id, r));
    return map;
  }, [pendingRequests]);

  const outgoingByUserId = useMemo(() => {
    const map = new Map();
    outgoingRequests.forEach((r) => map.set(r.to_user_id, r));
    return map;
  }, [outgoingRequests]);

  const getUserStatus = (userId) => {
    const contact = contactById.get(userId);
    if (contact?.blocked) return 'blocked';
    if (contact && !contact.blocked) return 'contact';
    if (incomingByUserId.has(userId)) return 'incoming';
    if (outgoingByUserId.has(userId)) return 'outgoing';
    return 'none';
  };

  const handleAdd = async (u) => {
    try {
      await onAddUser(u);
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('couldNotSendRequest'));
    }
  };

  if (!open) return null;

  const renderContact = (c, { showBlockedActions = false } = {}) => (
    <div key={c.user_id} className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-[#1A1A1A] group" data-testid={`contact-row-${c.username}`}>
      <Avatar user={c} size="sm" showOnline />
      <div className="flex-1 min-w-0">
        <div className="text-sm truncate">{userPrimaryLabel(c)}</div>
        {c.display_name && (
          <div className="text-[10px] font-mono text-[#71717A] truncate">@{c.username}</div>
        )}
        {userBio(c) && (
          <div className="text-[10px] text-[#71717A] truncate">{bioPreviewLine(userBio(c))}</div>
        )}
        <div className="text-[10px] font-mono text-[#A1A1AA] truncate">
          {formatPeerPresence(c)}
          {c.muted && !showBlockedActions ? ` · ${t('muted')}` : ''}
        </div>
      </div>
      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
        {!showBlockedActions && (
          <>
            <button onClick={() => onMessage(c)} title={t('messageBtn')} className="w-8 h-8 rounded tac-border flex items-center justify-center hover:bg-[#232323]" data-testid={`contact-msg-${c.username}`}>
              <ChatCircle size={14} />
            </button>
            <button onClick={() => onToggleMute(c.user_id)} title={c.muted ? t('unmute') : t('mute')} className="w-8 h-8 rounded tac-border flex items-center justify-center hover:bg-[#232323]" data-testid={`contact-mute-${c.username}`}>
              <BellSlash size={14} className={c.muted ? 'text-[#FFD600]' : ''} />
            </button>
          </>
        )}
        <button onClick={() => onToggleBlock(c.user_id)} title={c.blocked ? t('unblock') : t('block')} className="w-8 h-8 rounded tac-border flex items-center justify-center hover:bg-[#232323]" data-testid={`contact-block-${c.username}`}>
          <Prohibit size={14} className={c.blocked ? 'text-[#FF3B30]' : ''} />
        </button>
        {!showBlockedActions && (
          <button onClick={() => onRemove(c.user_id)} title={t('deleteContact')} className="w-8 h-8 rounded tac-border flex items-center justify-center hover:bg-[#232323] text-[#FF3B30]" data-testid={`contact-remove-${c.username}`}>
            <Trash size={14} />
          </button>
        )}
      </div>
    </div>
  );

  const renderSearchResult = (u) => {
    const status = getUserStatus(u.user_id);
    const incoming = incomingByUserId.get(u.user_id);

    return (
      <div key={u.user_id} className="flex items-center gap-3 px-3 py-2.5 rounded-md hover:bg-[#1A1A1A]" data-testid={`add-search-result-${u.username}`}>
        <Avatar user={u} size="sm" />
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate">{formatUserLabel(u)}</div>
          <div className="text-[10px] font-mono text-[#A1A1AA] truncate">
            {status === 'contact' && t('alreadyContact')}
            {status === 'incoming' && t('wantsToConnect')}
            {status === 'outgoing' && t('requestWaiting')}
            {status === 'blocked' && t('blockedUser')}
            {status === 'none' && (u.language?.toUpperCase() || t('sscUser'))}
          </div>
        </div>
        <div className="shrink-0">
          {status === 'contact' && (
            <button onClick={() => onMessage(u)} className="text-[10px] font-mono px-2.5 py-1.5 tac-border rounded hover:bg-[#232323]" data-testid={`add-msg-${u.username}`}>
              {t('messageBtn')}
            </button>
          )}
          {status === 'incoming' && incoming && (
            <button onClick={() => onAccept(incoming.request_id)} className="text-[10px] font-mono px-2.5 py-1.5 tac-border rounded text-[#34C759] hover:bg-[#232323]" data-testid={`add-accept-${u.username}`}>
              {t('acceptBtn')}
            </button>
          )}
          {status === 'outgoing' && (
            <span className="text-[10px] font-mono text-[#A1A1AA] px-2">{t('sentBtn')}</span>
          )}
          {status === 'none' && (
            <button onClick={() => handleAdd(u)} className="text-[10px] font-mono px-2.5 py-1.5 bg-[#00E5FF] text-black rounded hover:brightness-110" data-testid={`add-friend-${u.username}`}>
              {t('addBtn')}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xl flex items-end md:items-start justify-center md:pt-16 px-0 md:px-4 safe-top" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#121212] md:tac-border md:rounded-md p-4 fade-up max-h-[92dvh] md:max-h-[80vh] flex flex-col safe-bottom rounded-t-xl md:rounded-md" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-xs tracking-[0.25em]">{t('contactsTitle')}</h3>
          <button onClick={onClose} className="text-[#A1A1AA] hover:text-white" data-testid="close-contacts"><X size={16} /></button>
        </div>

        <div className="flex gap-1 mb-3">
          {TAB_IDS.map((id) => (
            <button key={id} onClick={() => setTab(id)} data-testid={`contacts-tab-${id}`}
              className={`flex-1 text-[10px] font-mono py-1.5 rounded tac-border ${tab === id ? 'bg-[#00E5FF] text-black' : 'hover:bg-[#1A1A1A]'}`}>
              {t(TAB_LABEL_KEYS[id])}
              {id === 'pending' && pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ''}
              {id === 'blocked' && blockedContacts.length > 0 ? ` (${blockedContacts.length})` : ''}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto min-h-0">
          {tab === 'add' && (
            <>
              <p className="text-[11px] text-[#A1A1AA] mb-3 normal-case tracking-normal">
                {t('addSearchHint')}
              </p>
              <div className="flex items-center gap-2 bg-[#1A1A1A] rounded-md px-3 py-2 tac-border mb-3">
                <MagnifyingGlass size={14} className="text-[#A1A1AA] shrink-0" />
                <input
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder={t('searchUsername')}
                  className="bg-transparent flex-1 outline-none border-0 text-sm"
                  autoFocus
                  data-testid="contacts-search-input"
                />
              </div>

              {searchQ.length < 2 && (
                <div className="text-center text-[11px] font-mono text-[#A1A1AA] py-6 tracking-wider">
                  {t('type2chars')}
                </div>
              )}
              {searchQ.length >= 2 && searchResults.length === 0 && (
                <div className="text-center text-[11px] font-mono text-[#A1A1AA] py-6 tracking-wider">{t('noUsersFound')}</div>
              )}
              {searchResults.map(renderSearchResult)}


            </>
          )}

          {tab === 'all' && (
            <>
              {activeContacts.length === 0 && (
                <div className="text-center text-[11px] font-mono text-[#A1A1AA] py-8 tracking-wider">
                  {t('noContactsYet')}
                  <p className="mt-2 normal-case font-sans tracking-normal text-[10px]">{t('useAddTab')}</p>
                </div>
              )}
              {activeContacts.map((c) => renderContact(c))}
            </>
          )}

          {tab === 'pending' && (
            <>
              {pendingRequests.length === 0 && (
                <div className="text-center text-[11px] font-mono text-[#A1A1AA] py-8 tracking-wider">{t('noPendingRequests')}</div>
              )}
              {pendingRequests.map((r) => (
                <div key={r.request_id} className="flex justify-between items-center text-xs px-3 py-2.5 rounded-md hover:bg-[#1A1A1A]" data-testid={`pending-${r.request_id}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-md bg-[#232323] flex items-center justify-center font-mono text-xs">
                      {r.from_username?.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm">@{r.from_username}</span>
                      <div className="text-[10px] font-mono text-[#A1A1AA]">{t('wantsToConnectShort')}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => onAccept(r.request_id)} className="text-[#34C759] hover:underline text-[10px] font-mono px-2 py-1 tac-border rounded" data-testid={`accept-${r.request_id}`}>{t('acceptBtn')}</button>
                    <button onClick={() => onReject(r.request_id)} className="text-[#FF3B30] hover:underline text-[10px] font-mono px-2 py-1 tac-border rounded" data-testid={`reject-${r.request_id}`}>{t('rejectBtn')}</button>
                  </div>
                </div>
              ))}
            </>
          )}

          {tab === 'blocked' && (
            <>
              {blockedContacts.length === 0 && (
                <div className="text-center text-[11px] font-mono text-[#A1A1AA] py-8 tracking-wider">{t('noBlockedUsers')}</div>
              )}
              {blockedContacts.map((c) => renderContact(c, { showBlockedActions: true }))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}