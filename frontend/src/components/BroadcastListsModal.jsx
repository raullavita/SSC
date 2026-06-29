import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Check, MagnifyingGlass, Megaphone, PencilSimple, Plus, Trash, X } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';
import {
  broadcastRecipientLabel,
  createBroadcastList,
  deleteBroadcastList,
  fetchBroadcastListLimits,
  listBroadcastLists,
  updateBroadcastList,
} from '../lib/broadcastLists';

export default function BroadcastListsModal({
  open,
  onClose,
  contacts = [],
  onSendList,
  onListsChanged,
}) {
  const { t } = useLocale();
  const [lists, setLists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('list');
  const [editingId, setEditingId] = useState(null);
  const [name, setName] = useState('');
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState([]);
  const [maxRecipients, setMaxRecipients] = useState(50);
  const [maxLists, setMaxLists] = useState(20);

  const eligibleContacts = useMemo(
    () => contacts.filter((c) => !c.blocked).sort((a, b) => a.username.localeCompare(b.username)),
    [contacts],
  );

  const filteredContacts = useMemo(() => {
    if (q.length < 2) return eligibleContacts;
    const needle = q.toLowerCase();
    return eligibleContacts.filter((c) => c.username.toLowerCase().includes(needle));
  }, [eligibleContacts, q]);

  const atPickLimit = picked.length >= maxRecipients;

  const loadLists = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await listBroadcastLists();
      setLists(rows);
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('broadcastListsLoadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (!open) return;
    fetchBroadcastListLimits().then((limits) => {
      setMaxRecipients(limits.maxRecipients);
      setMaxLists(limits.maxLists);
    }).catch(() => {});
    loadLists();
  }, [open, loadLists]);

  useEffect(() => {
    if (!open) {
      setMode('list');
      setEditingId(null);
      setName('');
      setQ('');
      setPicked([]);
    }
  }, [open]);

  const startCreate = () => {
    if (lists.length >= maxLists) {
      toast.error(t('broadcastListsCapReached', { max: String(maxLists) }));
      return;
    }
    setMode('edit');
    setEditingId(null);
    setName('');
    setPicked([]);
    setQ('');
  };

  const startEdit = (row) => {
    setMode('edit');
    setEditingId(row.list_id);
    setName(row.name || '');
    setPicked(
      (row.recipient_ids || [])
        .map((id) => eligibleContacts.find((c) => c.user_id === id))
        .filter(Boolean),
    );
    setQ('');
  };

  const togglePick = (contact) => {
    setPicked((cur) => {
      if (cur.find((p) => p.user_id === contact.user_id)) {
        return cur.filter((p) => p.user_id !== contact.user_id);
      }
      if (cur.length >= maxRecipients) {
        toast.error(t('broadcastRecipientsCapReached', { max: String(maxRecipients) }));
        return cur;
      }
      return [...cur, contact];
    });
  };

  const saveList = async () => {
    if (!name.trim()) {
      toast.error(t('broadcastListNameRequired'));
      return;
    }
    if (picked.length < 1) {
      toast.error(t('broadcastPickMin'));
      return;
    }
    setBusy(true);
    try {
      const recipientIds = picked.map((p) => p.user_id);
      if (editingId) {
        await updateBroadcastList(editingId, { name: name.trim(), recipientIds });
        toast.success(t('broadcastListUpdated'));
      } else {
        await createBroadcastList({ name: name.trim(), recipientIds });
        toast.success(t('broadcastListCreated'));
      }
      await loadLists();
      onListsChanged?.();
      setMode('list');
      setEditingId(null);
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('broadcastListSaveFailed'));
    } finally {
      setBusy(false);
    }
  };

  const removeList = async (listId) => {
    setBusy(true);
    try {
      await deleteBroadcastList(listId);
      toast.success(t('broadcastListDeleted'));
      await loadLists();
      onListsChanged?.();
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('broadcastListDeleteFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[62] bg-black/80 backdrop-blur-xl flex items-start justify-center pt-16 px-4"
      onClick={onClose}
      data-testid="broadcast-lists-modal"
    >
      <div
        className="w-full max-w-md bg-[#121212] tac-border rounded-md p-4 fade-up max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <Megaphone size={18} className="text-[#00E5FF]" weight="duotone" />
            <h3 className="font-mono text-xs tracking-[0.25em]">
              {mode === 'edit' ? t('broadcastListEditTitle') : t('broadcastListsTitle')}
            </h3>
          </div>
          <button type="button" onClick={onClose} className="text-[#A1A1AA] hover:text-white" data-testid="broadcast-lists-close">
            <X size={16} />
          </button>
        </div>

        {mode === 'list' && (
          <>
            <p className="text-[10px] font-mono text-[#71717A] mb-3">
              {t('broadcastListsHint', { max: String(maxLists), recipients: String(maxRecipients) })}
            </p>
            <button
              type="button"
              onClick={startCreate}
              disabled={lists.length >= maxLists}
              data-testid="broadcast-list-create"
              className="mb-3 w-full h-10 rounded-md tac-border bg-[#1A1A1A] hover:bg-[#232323] flex items-center justify-center gap-2 text-sm disabled:opacity-40"
            >
              <Plus size={14} /> {t('broadcastListNew')}
            </button>
            <div className="flex-1 overflow-y-auto min-h-0 space-y-2">
              {loading && (
                <div className="text-center text-[11px] font-mono text-[#A1A1AA] py-6">{t('loading')}</div>
              )}
              {!loading && lists.length === 0 && (
                <div className="text-center text-[11px] font-mono text-[#A1A1AA] py-6">{t('broadcastListsEmpty')}</div>
              )}
              {lists.map((row) => (
                <div key={row.list_id} className="rounded-md border border-[#27272A] bg-[#1A1A1A] p-3" data-testid={`broadcast-list-row-${row.list_id}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{row.name}</div>
                      <div className="text-[10px] font-mono text-[#71717A] mt-1">
                        {t('broadcastListRecipientCount', { count: String((row.recipient_ids || []).length) })}
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => onSendList?.(row)}
                        className="w-8 h-8 rounded tac-border hover:bg-[#232323] flex items-center justify-center"
                        title={t('broadcastSendTitle')}
                        data-testid={`broadcast-list-send-${row.list_id}`}
                      >
                        <Megaphone size={14} className="text-[#00E5FF]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => startEdit(row)}
                        className="w-8 h-8 rounded tac-border hover:bg-[#232323] flex items-center justify-center"
                        data-testid={`broadcast-list-edit-${row.list_id}`}
                      >
                        <PencilSimple size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeList(row.list_id)}
                        disabled={busy}
                        className="w-8 h-8 rounded tac-border hover:bg-[#232323] flex items-center justify-center text-[#FF3B30]"
                        data-testid={`broadcast-list-delete-${row.list_id}`}
                      >
                        <Trash size={14} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {(row.recipient_ids || []).slice(0, 6).map((id) => (
                      <span key={id} className="px-1.5 py-0.5 rounded bg-[#232323] text-[10px] font-mono text-[#A1A1AA]">
                        {broadcastRecipientLabel(contacts, id)}
                      </span>
                    ))}
                    {(row.recipient_ids || []).length > 6 && (
                      <span className="text-[10px] font-mono text-[#71717A]">
                        {t('broadcastListMoreRecipients', { count: String(row.recipient_ids.length - 6) })}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {mode === 'edit' && (
          <>
            <p className="text-[10px] font-mono text-[#71717A] mb-3" data-testid="broadcast-recipient-cap-hint">
              {t('broadcastRecipientsCapHint', { max: String(maxRecipients), picked: String(picked.length) })}
            </p>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('broadcastListNamePlaceholder')}
              className="w-full h-10 px-3 mb-2 text-sm rounded-md bg-[#1A1A1A] tac-border"
              data-testid="broadcast-list-name-input"
              maxLength={64}
            />
            <div className="flex items-center gap-2 bg-[#1A1A1A] rounded-md px-3 py-2 tac-border mb-2">
              <MagnifyingGlass size={14} className="text-[#A1A1AA]" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t('broadcastSearchPlaceholder')}
                className="bg-transparent flex-1 outline-none border-0 text-sm"
                data-testid="broadcast-list-search"
              />
            </div>
            {picked.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {picked.map((p) => (
                  <span key={p.user_id} className="inline-flex items-center gap-1 px-2 py-1 bg-[#1E2A38] rounded text-xs font-mono">
                    @{p.username}
                    <button type="button" onClick={() => togglePick(p)} className="hover:text-[#FF3B30]"><X size={10} /></button>
                  </span>
                ))}
              </div>
            )}
            <div className="max-h-52 overflow-y-auto mb-3">
              {filteredContacts.map((contact) => {
                const isPicked = !!picked.find((p) => p.user_id === contact.user_id);
                return (
                  <button
                    key={contact.user_id}
                    type="button"
                    onClick={() => togglePick(contact)}
                    disabled={!isPicked && atPickLimit}
                    data-testid={`broadcast-pick-${contact.username}`}
                    className="w-full text-left px-3 py-2 rounded-md hover:bg-[#1A1A1A] flex items-center gap-3 disabled:opacity-40"
                  >
                    <div className="w-9 h-9 rounded-md bg-[#232323] flex items-center justify-center font-mono text-xs">
                      {contact.username.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 text-sm">@{contact.username}</div>
                    {isPicked && <Check size={16} className="text-[#34C759]" />}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('list')}
                className="flex-1 py-2.5 tac-border rounded-md text-sm hover:bg-[#1A1A1A]"
              >
                {t('cancel')}
              </button>
              <button
                type="button"
                onClick={saveList}
                disabled={busy || picked.length < 1}
                data-testid="broadcast-list-save"
                className="flex-1 py-2.5 bg-[#00E5FF] text-black font-medium text-sm rounded-md hover:brightness-110 transition disabled:opacity-40"
              >
                {busy ? t('broadcastListSaving') : t('broadcastListSave')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}