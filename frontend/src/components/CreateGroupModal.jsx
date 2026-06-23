import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { X, MagnifyingGlass, UsersThree, Check } from '@phosphor-icons/react';
import { api } from '../lib/api';
import { useLocale } from '../context/LocaleContext';

export default function CreateGroupModal({ open, onClose, onCreated, myUserId }) {
  const { t } = useLocale();
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const debRef = useRef(null);

  useEffect(() => {
    if (!open) { setQ(''); setResults([]); setPicked([]); }
  }, [open]);

  useEffect(() => {
    if (!open || q.length < 2) { setResults([]); return; }
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      try {
        const { data } = await api.get('/users/search', { params: { q } });
        setResults(data);
      } catch {}
    }, 300);
    return () => debRef.current && clearTimeout(debRef.current);
  }, [q, open]);

  const togglePick = (u) => {
    setPicked((cur) => cur.find((p) => p.user_id === u.user_id)
      ? cur.filter((p) => p.user_id !== u.user_id)
      : [...cur, u]);
  };

  const create = async () => {
    if (picked.length < 2) { toast.error(t('groupPickMin')); return; }
    setBusy(true);
    try {
      const { data } = await api.post('/conversations', {
        is_group: true,
        peer_usernames: picked.map((p) => p.username),
      });
      toast.success(t('groupCreated'));
      onCreated && onCreated(data);
      onClose && onClose();
    } catch (e) {
      toast.error(e?.response?.data?.detail || t('groupCreateFailed'));
    } finally { setBusy(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-start justify-center pt-20 px-4" onClick={onClose}>
      <div className="w-full max-w-md bg-[#121212] tac-border rounded-md p-4 fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2"><UsersThree size={18} className="text-[#00E5FF]" weight="duotone" />
            <h3 className="font-mono text-xs tracking-[0.25em]">{t('newGroup')}</h3>
          </div>
          <button onClick={onClose} className="text-[#A1A1AA] hover:text-white" data-testid="group-close"><X size={16} /></button>
        </div>

        <p className="text-[10px] font-mono text-[#A1A1AA] mb-3 tracking-wide">
          {t('groupPrivacyHint')}
        </p>

        <div className="flex items-center gap-2 bg-[#1A1A1A] rounded-md px-3 py-2 tac-border mb-2">
          <MagnifyingGlass size={14} className="text-[#A1A1AA]" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('groupSearchPlaceholder')}
            className="bg-transparent flex-1 outline-none border-0 text-sm" autoFocus data-testid="group-search-input" />
        </div>

        {picked.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {picked.map((p) => (
              <span key={p.user_id} className="inline-flex items-center gap-1 px-2 py-1 bg-[#1E2A38] rounded text-xs font-mono">
                @{p.username}
                <button onClick={() => togglePick(p)} className="hover:text-[#FF3B30]"><X size={10} /></button>
              </span>
            ))}
          </div>
        )}

        <div className="max-h-64 overflow-y-auto mb-3">
          {results.map((u) => {
            const isPicked = picked.find((p) => p.user_id === u.user_id);
            return (
              <button key={u.user_id} onClick={() => togglePick(u)} data-testid={`group-pick-${u.username}`}
                className="w-full text-left px-3 py-2 rounded-md hover:bg-[#1A1A1A] flex items-center gap-3">
                <div className="w-9 h-9 rounded-md bg-[#232323] flex items-center justify-center font-mono text-xs">
                  {u.username.slice(0, 2).toUpperCase()}
                </div>
                <div className="flex-1">
                  <div className="text-sm">@{u.username}</div>
                  <div className="text-[10px] font-mono text-[#A1A1AA]">{u.language?.toUpperCase()}</div>
                </div>
                {isPicked && <Check size={16} className="text-[#34C759]" />}
              </button>
            );
          })}
        </div>

        <button onClick={create} disabled={picked.length < 2 || busy} data-testid="group-create-button"
          className="w-full py-2.5 bg-[#00E5FF] text-black font-medium text-sm rounded-md hover:brightness-110 transition disabled:opacity-40">
          {busy ? t('groupCreating') : t('groupCreateMembers', { count: String(picked.length + 1) })}
        </button>
      </div>
    </div>
  );
}