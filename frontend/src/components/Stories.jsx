import React, { useEffect, useRef, useState } from 'react';
import { Plus, Eye, X, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { encryptMessageForRecipients, decryptMessage } from '../lib/crypto';
import { subscribeMemoryWipe } from '../lib/memoryWipe';

/**
 * Stories bar: horizontal scroll at top of sidebar with avatars.
 * Click "+" to create a status; click an avatar to view their 24h stories.
 */
export function StoriesBar({ me, privateKey, onView }) {
  const [statuses, setStatuses] = useState([]);
  const [creatorOpen, setCreatorOpen] = useState(false);

  const reload = async () => {
    try {
      const { data } = await api.get('/statuses');
      setStatuses(data);
    } catch {}
  };
  useEffect(() => { reload(); }, []);

  // listen for new statuses via global event from socket
  useEffect(() => {
    const h = () => reload();
    window.addEventListener('ssc-status-new', h);
    return () => window.removeEventListener('ssc-status-new', h);
  }, []);

  // group by author
  const groups = {};
  for (const s of statuses) {
    if (!groups[s.author_id]) groups[s.author_id] = { author_id: s.author_id, author_username: s.author_username, items: [] };
    groups[s.author_id].items.push(s);
  }
  const ordered = Object.values(groups);
  // ensure "me" is first if I have a status
  ordered.sort((a, b) => (a.author_id === me?.user_id ? -1 : b.author_id === me?.user_id ? 1 : 0));

  return (
    <>
      <div className="px-3 py-3 border-b border-[#27272A] overflow-x-auto">
        <div className="flex gap-3 items-center min-w-max">
          <button onClick={() => setCreatorOpen(true)} data-testid="story-add-button"
            className="flex flex-col items-center gap-1 group">
            <div className="w-12 h-12 rounded-full bg-[#1A1A1A] tac-border flex items-center justify-center group-hover:bg-[#232323] transition">
              <Plus size={18} className="text-[#00E5FF]" />
            </div>
            <span className="text-[9px] font-mono text-[#A1A1AA] tracking-wider">ADD</span>
          </button>
          {ordered.map((g) => (
            <button key={g.author_id} onClick={() => onView && onView(g)} data-testid={`story-${g.author_username}`}
              className="flex flex-col items-center gap-1 group">
              <div className="w-12 h-12 rounded-full p-[2px] bg-gradient-to-tr from-[#00E5FF] via-[#FFD600] to-[#34C759]">
                <div className="w-full h-full rounded-full bg-[#0A0A0A] flex items-center justify-center font-mono text-[10px]">
                  {g.author_username.slice(0, 2).toUpperCase()}
                </div>
              </div>
              <span className="text-[9px] font-mono text-[#A1A1AA] tracking-wider truncate max-w-[64px]">
                {g.author_id === me?.user_id ? 'YOU' : g.author_username.toUpperCase()}
              </span>
            </button>
          ))}
        </div>
      </div>
      <StoryCreator open={creatorOpen} onClose={() => setCreatorOpen(false)} me={me} onCreated={reload} />
    </>
  );
}

// ─── Creator ─────────────────────────────────────────────────────────────────
function StoryCreator({ open, onClose, me, onCreated }) {
  const [text, setText] = useState('');
  const [bg, setBg] = useState('#1E2A38');
  const [busy, setBusy] = useState(false);
  const [contacts, setContacts] = useState([]);

  useEffect(() => {
    if (!open) { setText(''); return; }
    (async () => {
      try {
        const { data } = await api.get('/contacts');
        setContacts(data);
      } catch {}
    })();
  }, [open]);

  const palette = ['#1E2A38', '#00E5FF', '#FFD600', '#FF3B30', '#34C759', '#7B5CFF'];

  const submit = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const myPub = me.public_key ? (typeof me.public_key === 'string' ? JSON.parse(me.public_key) : me.public_key) : null;
      const recipients = { [me.user_id]: myPub };
      for (const c of contacts) {
        if (c.blocked) continue; // respect block
        if (c.public_key) recipients[c.user_id] = typeof c.public_key === 'string' ? JSON.parse(c.public_key) : c.public_key;
      }
      const enc = await encryptMessageForRecipients(text.trim(), recipients);
      await api.post('/statuses', {
        ciphertext: enc.ciphertext, iv: enc.iv, encrypted_keys: enc.encrypted_keys,
        status_type: 'text', background: bg,
      });
      toast.success('Status posted · auto-deletes in 24h');
      onCreated && onCreated();
      onClose && onClose();
    } catch (e) {
      console.error(e);
      toast.error('Failed to post status');
    } finally { setBusy(false); }
  };

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-[#121212] tac-border rounded-md p-5 fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-mono text-xs tracking-[0.25em]">NEW_STATUS</h3>
          <button onClick={onClose} className="text-[#A1A1AA] hover:text-white" data-testid="story-creator-close"><X size={16} /></button>
        </div>
        <div className="rounded-md aspect-[4/5] flex items-center justify-center p-6 mb-3" style={{ backgroundColor: bg }} data-testid="story-preview">
          <textarea value={text} onChange={(e) => setText(e.target.value.slice(0, 280))}
            placeholder="What's on your mind?"
            className="w-full h-full bg-transparent border-0 outline-none resize-none text-center font-mono text-xl leading-relaxed text-white placeholder:text-white/40" data-testid="story-text-input" />
        </div>
        <div className="flex items-center gap-2 mb-4">
          {palette.map((c) => (
            <button key={c} onClick={() => setBg(c)} className={`w-7 h-7 rounded-full tac-border ${bg === c ? 'ring-2 ring-white' : ''}`} style={{ backgroundColor: c }} data-testid={`story-bg-${c}`} />
          ))}
        </div>
        <p className="text-[10px] font-mono text-[#A1A1AA] tracking-widest mb-3 text-center">
          E2E ENCRYPTED · VISIBLE TO {contacts.filter(c => !c.blocked).length} CONTACTS · AUTO-DELETES IN 24H
        </p>
        <button onClick={submit} disabled={!text.trim() || busy || contacts.filter(c => !c.blocked).length === 0} data-testid="story-post-button"
          className="w-full py-2.5 bg-[#00E5FF] text-black font-medium text-sm rounded-md hover:brightness-110 transition disabled:opacity-40">
          {busy ? 'ENCRYPTING…' : contacts.filter(c => !c.blocked).length === 0 ? 'NO CONTACTS YET' : 'POST STATUS'}
        </button>
      </div>
    </div>
  );
}

// ─── Viewer ──────────────────────────────────────────────────────────────────
export function StoryViewer({ group, onClose, me, privateKey }) {
  const [idx, setIdx] = useState(0);
  const [decoded, setDecoded] = useState('');
  const [progress, setProgress] = useState(0);
  const timerRef = useRef(null);

  const cur = group?.items?.[idx];

  useEffect(() => subscribeMemoryWipe(() => {
    setDecoded('');
    setIdx(0);
    setProgress(0);
    if (timerRef.current) clearInterval(timerRef.current);
  }), []);

  useEffect(() => {
    if (!cur || !privateKey) return;
    setDecoded('decrypting…');
    (async () => {
      try {
        const key = cur.encrypted_keys?.[me.user_id];
        if (!key) { setDecoded('[no key for this device]'); return; }
        const pt = await decryptMessage(privateKey, cur.ciphertext, cur.iv, key);
        setDecoded(pt);
        // mark viewed
        try { await api.post('/statuses/viewed', { status_id: cur.status_id }); } catch {}
      } catch (e) {
        setDecoded('[unable to decrypt]');
      }
    })();
    // auto-advance after 6s
    setProgress(0);
    const start = Date.now();
    timerRef.current = setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / 6000);
      setProgress(p);
      if (p >= 1) {
        clearInterval(timerRef.current);
        next();
      }
    }, 50);
    return () => timerRef.current && clearInterval(timerRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cur, privateKey]);

  const next = () => {
    if (!group) return;
    if (idx + 1 < group.items.length) setIdx(idx + 1);
    else onClose && onClose();
  };
  const prev = () => setIdx(Math.max(0, idx - 1));

  const del = async () => {
    if (!cur || cur.author_id !== me?.user_id) return;
    if (!window.confirm('Delete this status?')) return;
    try {
      await api.delete(`/statuses/${cur.status_id}`);
      toast.success('Deleted');
      onClose && onClose();
    } catch {}
  };

  if (!group || !cur) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4" data-testid="story-viewer">
      <div className="w-full max-w-md aspect-[4/5] relative rounded-md overflow-hidden tac-border" style={{ backgroundColor: cur.background || '#1E2A38' }}>
        {/* progress bars */}
        <div className="absolute top-2 left-2 right-2 flex gap-1 z-10">
          {group.items.map((_, i) => (
            <div key={i} className="flex-1 h-1 bg-white/20 rounded overflow-hidden">
              <div className="h-full bg-white" style={{ width: i < idx ? '100%' : i === idx ? `${progress * 100}%` : '0%' }} />
            </div>
          ))}
        </div>
        <div className="absolute top-5 left-3 right-3 flex items-center justify-between z-10 mt-3">
          <span className="font-mono text-xs text-white/90 tracking-widest">@{group.author_username}</span>
          <div className="flex items-center gap-2">
            {cur.author_id === me?.user_id && (
              <button onClick={del} className="text-white/80 hover:text-[#FF3B30]" data-testid="story-delete-button"><Trash size={16} /></button>
            )}
            <button onClick={onClose} className="text-white/80 hover:text-white" data-testid="story-close"><X size={16} /></button>
          </div>
        </div>
        {/* tap zones */}
        <div className="absolute inset-y-0 left-0 w-1/3 z-0" onClick={prev} />
        <div className="absolute inset-y-0 right-0 w-1/3 z-0" onClick={next} />

        <div className="absolute inset-0 flex items-center justify-center p-8 z-[1] pointer-events-none">
          <div className="font-mono text-2xl leading-relaxed text-white text-center break-words" data-testid="story-content">{decoded}</div>
        </div>

        {cur.author_id === me?.user_id && (
          <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1 text-[10px] font-mono text-white/70 tracking-widest" data-testid="story-viewers-count">
            <Eye size={12} /> {cur.viewers?.length || 0} VIEWED
          </div>
        )}
      </div>
    </div>
  );
}
