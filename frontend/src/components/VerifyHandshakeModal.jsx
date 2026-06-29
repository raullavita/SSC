import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { X, ShieldCheck, Check, ClipboardText } from '@phosphor-icons/react';
import { IDENTITY_KEY_TYPES } from '../lib/identityKey';
import {
  parseVerifyQrPayload,
  safetyNumbersMatch,
} from '../lib/safetyNumber';
import { acknowledgePeerIdentity } from '../lib/keyChangeWarnings';
import {
  clearPeerVerification,
  computeSafetyNumberForUsers,
  isPeerVerified,
  markPeerVerified,
} from '../lib/verification';

/**
 * Verified Handshake — safety number v3, text compare only (Q.53 — no QR).
 */
export default function VerifyHandshakeModal({ open, onClose, me, peer }) {
  const [code, setCode] = useState('');
  const [canonical, setCanonical] = useState('');
  const [keyType, setKeyType] = useState('');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pasteValue, setPasteValue] = useState('');
  const [pasteMatch, setPasteMatch] = useState(null);

  useEffect(() => {
    const meReady = me?.public_key || me?.signal_identity_key_public || me?.signal_prekeys_ready;
    const peerReady = peer?.public_key || peer?.signal_identity_key_public || peer?.signal_prekeys_ready;
    if (!open || !meReady || !peerReady) return;
    let mounted = true;
    (async () => {
      try {
        const result = await computeSafetyNumberForUsers(me, me.user_id, peer, peer.user_id);
        if (!mounted) return;
        setCode(result.display);
        setCanonical(result.canonical);
        setKeyType(result.keyType);
        setVerified(await isPeerVerified(peer.user_id, me, peer, me.user_id, peer));
      } catch {
        if (mounted) {
          setCode('');
          setCanonical('');
          setVerified(false);
        }
      }
    })();
    return () => { mounted = false; };
  }, [open, me, peer]);

  useEffect(() => {
    if (!canonical) {
      setPasteMatch(null);
      return;
    }
    if (!pasteValue.trim()) {
      setPasteMatch(null);
      return;
    }
    const parsed = parseVerifyQrPayload(pasteValue) || { canonical: pasteValue };
    setPasteMatch(safetyNumbersMatch(canonical, parsed.canonical));
  }, [pasteValue, canonical]);

  const markVerified = async () => {
    if (busy || !peer?.user_id) return;
    setBusy(true);
    try {
      await markPeerVerified(peer.user_id, me, peer, me.user_id, peer);
      acknowledgePeerIdentity(peer);
      setVerified(true);
      toast.success('Identity verified');
    } catch {
      toast.error('Could not save verification');
    } finally {
      setBusy(false);
    }
  };

  const unverify = () => {
    clearPeerVerification(peer.user_id);
    setVerified(false);
    toast.message('Verification cleared');
  };

  const keyLabel = keyType === IDENTITY_KEY_TYPES.SIGNAL_V1 ? 'SIGNAL IDENTITY' : 'RSA (vault legacy)';

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-[#121212] tac-border rounded-md p-5 fade-up max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} weight="duotone" className={verified ? 'text-[#34C759]' : 'text-[#00E5FF]'} />
            <h3 className="font-mono text-xs tracking-[0.25em]">VERIFY_IDENTITY</h3>
          </div>
          <button onClick={onClose} className="text-[#A1A1AA] hover:text-white" data-testid="verify-close"><X size={16} /></button>
        </div>

        <p className="text-[10px] font-mono text-[#00E5FF] tracking-widest mb-2">{keyLabel}</p>

        <p className="text-xs text-[#A1A1AA] mb-4">
          Compare this 60-digit safety number with <span className="text-white">@{peer?.username}</span> in person or on a trusted call.
          Nothing is sent to third parties.
        </p>

        <div className="bg-[#1A1A1A] tac-border rounded-md p-3 mb-3">
          <div className="text-[10px] font-mono text-[#A1A1AA] tracking-widest mb-1">SAFETY_NUMBER</div>
          <div className="font-mono text-sm leading-relaxed select-all break-words" data-testid="verify-safety-number">{code || '…'}</div>
        </div>

        <div className="bg-[#1A1A1A] tac-border rounded-md p-3 mb-4">
          <div className="text-[10px] font-mono text-[#A1A1AA] tracking-widest mb-2 flex items-center gap-1">
            <ClipboardText size={12} /> PASTE_PEER_NUMBER
          </div>
          <input
            type="text"
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            placeholder="Paste 60 digits from your contact"
            className="w-full bg-[#121212] border border-[#2A2A2A] rounded-md px-2 py-2 text-xs font-mono text-white"
            data-testid="verify-paste-input"
          />
          {pasteMatch === true && (
            <div className="text-[#34C759] text-xs font-mono mt-2" data-testid="verify-paste-match">NUMBERS_MATCH</div>
          )}
          {pasteMatch === false && (
            <div className="text-[#FF3B30] text-xs font-mono mt-2" data-testid="verify-paste-mismatch">NUMBERS_DO_NOT_MATCH</div>
          )}
        </div>

        {verified ? (
          <div>
            <div className="flex items-center justify-center gap-2 text-[#34C759] font-mono text-xs tracking-widest mb-3" data-testid="verified-status">
              <Check size={14} weight="bold" /> IDENTITY_VERIFIED
            </div>
            <button onClick={unverify} data-testid="verify-unverify-button" className="w-full py-2 text-xs font-mono text-[#A1A1AA] hover:text-[#FF3B30]">CLEAR_VERIFICATION</button>
          </div>
        ) : (
          <button
            onClick={markVerified}
            disabled={busy || !code}
            data-testid="verify-mark-button"
            className="w-full py-2.5 bg-[#34C759] text-black font-medium text-sm rounded-md hover:brightness-110 transition disabled:opacity-50"
          >
            MARK AS VERIFIED
          </button>
        )}
      </div>
    </div>
  );
}