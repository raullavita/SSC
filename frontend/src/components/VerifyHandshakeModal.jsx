import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { X, ShieldCheck, Check, QrCode } from '@phosphor-icons/react';
import {
  clearPeerVerification,
  computeSafetyNumber,
  isPeerVerified,
  markPeerVerified,
} from '../lib/verification';

/**
 * Verified Handshake — safety number + crypto-bound local verification record (Engine 2.6).
 */
export default function VerifyHandshakeModal({ open, onClose, me, peer }) {
  const [code, setCode] = useState('');
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !me?.public_key || !peer?.public_key) return;
    let mounted = true;
    (async () => {
      try {
        const myPub = typeof me.public_key === 'string' ? JSON.parse(me.public_key) : me.public_key;
        const peerPub = typeof peer.public_key === 'string' ? JSON.parse(peer.public_key) : peer.public_key;
        const { display } = await computeSafetyNumber(myPub, peerPub);
        if (mounted) setCode(display);
        if (mounted) setVerified(await isPeerVerified(peer.user_id, myPub, peerPub));
      } catch {
        if (mounted) {
          setCode('');
          setVerified(false);
        }
      }
    })();
    return () => { mounted = false; };
  }, [open, me, peer]);

  const markVerified = async () => {
    if (busy || !peer?.user_id) return;
    setBusy(true);
    try {
      const myPub = typeof me.public_key === 'string' ? JSON.parse(me.public_key) : me.public_key;
      const peerPub = typeof peer.public_key === 'string' ? JSON.parse(peer.public_key) : peer.public_key;
      await markPeerVerified(peer.user_id, myPub, peerPub);
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

  const qrSrc = code ? `https://api.qrserver.com/v1/create-qr-code/?size=240x240&bgcolor=121212&color=00E5FF&qzone=1&data=${encodeURIComponent('SSC:' + code.replace(/ /g, ''))}` : '';

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-[#121212] tac-border rounded-md p-5 fade-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} weight="duotone" className={verified ? 'text-[#34C759]' : 'text-[#00E5FF]'} />
            <h3 className="font-mono text-xs tracking-[0.25em]">VERIFY_IDENTITY</h3>
          </div>
          <button onClick={onClose} className="text-[#A1A1AA] hover:text-white" data-testid="verify-close"><X size={16} /></button>
        </div>

        <p className="text-xs text-[#A1A1AA] mb-4">
          Compare this 60-character safety number with <span className="text-white">@{peer?.username}</span> in person, via voice/video call, or another trusted channel.
          If they match, you have proven you&apos;re talking to the real person — not a man-in-the-middle.
        </p>

        <div className="flex justify-center mb-3">
          {qrSrc ? <img src={qrSrc} alt="safety number QR" className="w-[240px] h-[240px] rounded-md tac-border" data-testid="verify-qr" /> : <div className="w-[240px] h-[240px] bg-[#1A1A1A] rounded-md flex items-center justify-center"><QrCode size={32} className="text-[#A1A1AA]" /></div>}
        </div>

        <div className="bg-[#1A1A1A] tac-border rounded-md p-3 mb-4">
          <div className="text-[10px] font-mono text-[#A1A1AA] tracking-widest mb-1">SAFETY_NUMBER</div>
          <div className="font-mono text-sm leading-relaxed select-all break-words" data-testid="verify-safety-number">{code || '…'}</div>
        </div>

        {verified ? (
          <div>
            <div className="flex items-center justify-center gap-2 text-[#34C759] font-mono text-xs tracking-widest mb-3" data-testid="verified-status">
              <Check size={14} weight="bold" /> IDENTITY_VERIFIED
            </div>
            <button onClick={unverify} data-testid="verify-unverify-button" className="w-full py-2 text-xs font-mono text-[#A1A1AA] hover:text-[#FF3B30]">CLEAR_VERIFICATION</button>
          </div>
        ) : (
          <button onClick={markVerified} disabled={busy || !code} data-testid="verify-mark-button"
            className="w-full py-2.5 bg-[#34C759] text-black font-medium text-sm rounded-md hover:brightness-110 transition disabled:opacity-50">
            MARK AS VERIFIED
          </button>
        )}
      </div>
    </div>
  );
}