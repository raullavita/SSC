import React, { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { GearSix, Megaphone, PaperPlaneTilt, X } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';
import { broadcastRecipientLabel, listBroadcastLists } from '../lib/broadcastLists';
import { sendBroadcastText } from '../chat/broadcastSend';
import { toastMessagingGateFailure } from '../chat/messagingErrors';

export default function BroadcastSendModal({
  open,
  onClose,
  initialList = null,
  contacts = [],
  conversations = [],
  user,
  privateKey,
  refreshUser,
  loadConversations,
  onManageLists,
}) {
  const { t } = useLocale();
  const [lists, setLists] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    listBroadcastLists()
      .then((rows) => {
        setLists(rows);
        const preferred = initialList?.list_id
          || rows[0]?.list_id
          || '';
        setSelectedId(preferred);
      })
      .catch((e) => {
        toast.error(e?.response?.data?.detail || t('broadcastListsLoadFailed'));
      })
      .finally(() => setLoading(false));
  }, [open, initialList, t]);

  useEffect(() => {
    if (!open) {
      setMessage('');
      setSelectedId('');
    }
  }, [open]);

  const selectedList = useMemo(
    () => lists.find((row) => row.list_id === selectedId) || initialList || null,
    [lists, selectedId, initialList],
  );

  const recipientPreview = useMemo(() => {
    const ids = selectedList?.recipient_ids || [];
    return ids.map((id) => broadcastRecipientLabel(contacts, id)).join(', ');
  }, [selectedList, contacts]);

  const send = async () => {
    if (!selectedList?.recipient_ids?.length) {
      toast.error(t('broadcastNoListSelected'));
      return;
    }
    const trimmed = message.trim();
    if (!trimmed) {
      toast.error(t('broadcastMessageRequired'));
      return;
    }
    setBusy(true);
    try {
      const result = await sendBroadcastText({
        text: trimmed,
        recipientIds: selectedList.recipient_ids,
        user,
        privateKey,
        refreshUser,
        contacts,
        conversations,
        loadConversations,
      });
      if (result.sent > 0) {
        toast.success(t('broadcastSendSuccess', { count: String(result.sent) }));
        if (result.errors.length > 0) {
          toast.error(t('broadcastSendPartial', {
            sent: String(result.sent),
            failed: String(result.errors.length),
          }));
        }
        onClose?.();
      } else {
        const gateErr = result.errors.find((row) => row.error?.gate)?.error;
        if (gateErr?.gate) toastMessagingGateFailure(gateErr.gate, t);
        else toast.error(t('broadcastSendFailed'));
      }
    } catch (e) {
      toast.error(e?.response?.data?.detail || e?.message || t('broadcastSendFailed'));
    } finally {
      setBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[63] bg-black/80 backdrop-blur-xl flex items-end sm:items-center justify-center p-4 safe-bottom"
      onClick={onClose}
      data-testid="broadcast-send-modal"
    >
      <div
        className="w-full max-w-md bg-[#121212] tac-border rounded-md p-4 fade-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Megaphone size={18} className="text-[#00E5FF]" weight="duotone" />
            <h3 className="font-mono text-xs tracking-[0.25em]">{t('broadcastSendTitle')}</h3>
          </div>
          <button type="button" onClick={onClose} className="text-[#A1A1AA] hover:text-white">
            <X size={16} />
          </button>
        </div>

        <p className="text-[10px] font-mono text-[#71717A] mb-3">{t('broadcastSendHint')}</p>

        <div className="flex gap-2 mb-2">
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={loading || lists.length === 0}
            data-testid="broadcast-send-list-select"
            className="flex-1 h-10 px-3 text-sm rounded-md bg-[#1A1A1A] tac-border"
          >
            {lists.length === 0 && <option value="">{t('broadcastListsEmpty')}</option>}
            {lists.map((row) => (
              <option key={row.list_id} value={row.list_id}>{row.name}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={onManageLists}
            title={t('broadcastListsTitle')}
            data-testid="broadcast-manage-lists"
            className="w-10 h-10 rounded-md tac-border bg-[#1A1A1A] hover:bg-[#232323] flex items-center justify-center"
          >
            <GearSix size={16} />
          </button>
        </div>

        {selectedList && (
          <div className="mb-3 px-3 py-2 rounded-md bg-[#1A1A1A] border border-[#27272A] text-[10px] font-mono text-[#A1A1AA] max-h-16 overflow-y-auto">
            {recipientPreview}
          </div>
        )}

        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder={t('broadcastMessagePlaceholder')}
          rows={4}
          data-testid="broadcast-send-message"
          className="w-full px-3 py-2 mb-3 text-sm rounded-md bg-[#1A1A1A] tac-border resize-none"
        />

        <button
          type="button"
          onClick={send}
          disabled={busy || !selectedList || lists.length === 0}
          data-testid="broadcast-send-submit"
          className="w-full py-2.5 bg-[#00E5FF] text-black font-medium text-sm rounded-md hover:brightness-110 transition disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <PaperPlaneTilt size={16} />
          {busy ? t('broadcastSending') : t('broadcastSendSubmit')}
        </button>
      </div>
    </div>
  );
}