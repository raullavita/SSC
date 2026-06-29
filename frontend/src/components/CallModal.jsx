import React, { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Phone, VideoCamera, MicrophoneSlash, Microphone, VideoCameraSlash, ArrowsLeftRight, CameraRotate, ArrowsClockwise } from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';
import { useMobileLayout } from '../lib/use-mobile';
import { getBackendUrl } from '../lib/platform';
import { toastSignalingFailure } from '../chat/signalingErrors';
import { sendSignaling, unpackIncomingSignaling } from '../lib/signal/webrtcSignaling';
import {
  acquireLocalMediaStream,
  bindLocalPreview,
  bindRemoteStream,
  applyVideoToPeerConnection,
  DEFAULT_CAMERA_FACING,
  getRemoteStreamFromPeerConnection,
  oppositeCameraFacing,
  removeVideoFromPeerConnection,
  replaceVideoTrackFacing,
} from '../lib/callMedia';
import Avatar from './Avatar';
import CallQualityIndicator from './CallQualityIndicator';
import { useCallQualityMonitor } from '../chat/useCallQualityMonitor';
import { icePathLabel, summarizeIceConnection } from '../lib/callIceDiagnostics';
import {
  DISCONNECTED_GRACE_MS,
  MAX_RECONNECT_ATTEMPTS,
  reconnectDelayMs,
  shouldAttemptReconnect,
} from '../lib/callReconnect';

/**
 * CallModal handles WebRTC voice/video calls.
 * Props:
 *  - mode: 'video' | 'audio'
 *  - direction: 'outgoing' | 'incoming'
 *  - peer: { user_id, username }
 *  - socket: ChatSocket instance
 *  - signal: incoming signaling payload (offer or null)
 *  - onClose: () => void
 */
const DEFAULT_ICE = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun2.l.google.com:19302' },
];

async function getRTCConfig() {
  try {
    const base = getBackendUrl();
    const res = await fetch(`${base}/api/config`);
    const cfg = await res.json();
    if (Array.isArray(cfg.ice_servers) && cfg.ice_servers.length) {
      return { iceServers: cfg.ice_servers, iceCandidatePoolSize: 10 };
    }
  } catch {}
  return { iceServers: DEFAULT_ICE, iceCandidatePoolSize: 10 };
}

export default function CallModal({ mode, direction, peer, user, socket, signal, onClose }) {
  const { t } = useLocale();
  const isMobile = useMobileLayout();
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const remoteAudioRef = useRef(null);
  const activeModeRef = useRef(mode);
  const cameraFacingRef = useRef(DEFAULT_CAMERA_FACING);
  const renegotiatingRef = useRef(false);
  const [status, setStatus] = useState(direction === 'outgoing' ? 'calling' : 'ringing');
  const [endReason, setEndReason] = useState('');
  const [activeMode, setActiveMode] = useState(mode);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [duration, setDuration] = useState(0);
  const [icePath, setIcePath] = useState('');
  const [modeBusy, setModeBusy] = useState(false);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const startedAtRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const disconnectedTimerRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const signalingCtxRef = useRef(null);
  const giveUpReconnectRef = useRef(() => {});
  const scheduleReconnectRef = useRef(() => {});
  const quality = useCallQualityMonitor(pcRef, status === 'connected');

  useEffect(() => {
    activeModeRef.current = activeMode;
  }, [activeMode]);

  const refreshRemoteBindings = useCallback(() => {
    const pc = pcRef.current;
    if (!pc) return;
    const remoteStream = getRemoteStreamFromPeerConnection(pc);
    if (!remoteStream) return;
    bindRemoteStream({
      videoEl: activeModeRef.current === 'video' ? remoteVideoRef.current : null,
      audioEl: remoteAudioRef.current,
      stream: remoteStream,
    });
    if (activeModeRef.current === 'video') {
      bindLocalPreview(localVideoRef.current, localStreamRef.current);
    }
  }, []);

  useEffect(() => {
    setupCall();
    return () => cleanup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => {
    if (disconnectedTimerRef.current) clearTimeout(disconnectedTimerRef.current);
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
  }, []);

  useEffect(() => {
    if (status !== 'connected') return;
    startedAtRef.current = Date.now();
    const timer = setInterval(
      () => setDuration(Math.floor((Date.now() - startedAtRef.current) / 1000)),
      500,
    );
    return () => clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (activeMode === 'video') {
      requestAnimationFrame(() => refreshRemoteBindings());
    }
  }, [activeMode, refreshRemoteBindings]);

  const clearReconnectTimers = () => {
    if (disconnectedTimerRef.current) {
      clearTimeout(disconnectedTimerRef.current);
      disconnectedTimerRef.current = null;
    }
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  };

  const giveUpReconnect = useCallback((reason) => {
    clearReconnectTimers();
    setEndReason(reason);
    setStatus('ended');
    if (reason === 'failed') toast.error(t('callReconnectFailed'));
    else toast.message(t('callPeerDisconnected'));
    setTimeout(() => onClose?.(), 1800);
  }, [onClose, t]);

  const attemptIceRestart = useCallback(async () => {
    const pc = pcRef.current;
    const signalingCtx = signalingCtxRef.current;
    if (!pc || !signalingCtx || renegotiatingRef.current) return false;
    const attempt = reconnectAttemptRef.current;
    if (!shouldAttemptReconnect(pc.connectionState, attempt)) {
      giveUpReconnect('failed');
      return false;
    }
    reconnectAttemptRef.current = attempt + 1;
    setReconnectAttempt(reconnectAttemptRef.current);
    setStatus('reconnecting');
    renegotiatingRef.current = true;
    try {
      const offer = await pc.createOffer({ iceRestart: true });
      await pc.setLocalDescription(offer);
      await sendSignaling(socket, {
        type: 'call-offer',
        to: peer.user_id,
        mode: activeModeRef.current,
        sdp: offer,
        renegotiate: true,
        ice_restart: true,
      }, signalingCtx);
      return true;
    } catch (err) {
      if (!toastSignalingFailure(err, t)) {
        toast.error(t('callReconnectFailed'));
      }
      if (!shouldAttemptReconnect(pc.connectionState, reconnectAttemptRef.current)) {
        giveUpReconnect('failed');
      }
      return false;
    } finally {
      renegotiatingRef.current = false;
    }
  }, [giveUpReconnect, peer.user_id, socket, t]);

  useEffect(() => {
    giveUpReconnectRef.current = giveUpReconnect;
  }, [giveUpReconnect]);

  const scheduleReconnect = useCallback((delayMs) => {
    clearReconnectTimers();
    reconnectTimerRef.current = setTimeout(() => {
      attemptIceRestart();
    }, delayMs);
  }, [attemptIceRestart]);

  useEffect(() => {
    scheduleReconnectRef.current = scheduleReconnect;
  }, [scheduleReconnect]);

  const setupCall = async () => {
    const rtcConfig = await getRTCConfig();
    const pc = new RTCPeerConnection(rtcConfig);
    pcRef.current = pc;

    const signalingCtx = { peerUserId: peer.user_id, ourUserId: user?.user_id, peer, user, isGroup: false };
    signalingCtxRef.current = signalingCtx;

    // Show at most one encryption-failure toast per call setup to avoid flooding
    // the user with one notification per ICE candidate (typically 8–15 candidates).
    let iceEncryptErrShown = false;
    pc.onicecandidate = (e) => {
      if (e.candidate) {
        sendSignaling(socket, { type: 'ice-candidate', to: peer.user_id, candidate: e.candidate }, signalingCtx)
          .catch((err) => {
            if (!iceEncryptErrShown) {
              iceEncryptErrShown = true;
              toastSignalingFailure(err, t);
            }
          });
      }
    };
    pc.ontrack = (e) => {
      bindRemoteStream({
        videoEl: activeModeRef.current === 'video' ? remoteVideoRef.current : null,
        audioEl: remoteAudioRef.current,
        stream: e.streams[0],
      });
    };
    const refreshIcePath = async () => {
      try {
        const summary = await summarizeIceConnection(pc);
        setIcePath(icePathLabel(summary));
      } catch {
        setIcePath('');
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      if (state === 'connected') {
        clearReconnectTimers();
        reconnectAttemptRef.current = 0;
        setReconnectAttempt(0);
        setStatus('connected');
        refreshIcePath();
        setTimeout(refreshIcePath, 2000);
        return;
      }
      if (state === 'disconnected') {
        setStatus('reconnecting');
        clearReconnectTimers();
        disconnectedTimerRef.current = setTimeout(() => {
          if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') {
            scheduleReconnectRef.current(reconnectDelayMs(reconnectAttemptRef.current));
          }
        }, DISCONNECTED_GRACE_MS);
        return;
      }
      if (state === 'failed') {
        if (shouldAttemptReconnect(state, reconnectAttemptRef.current)) {
          setStatus('reconnecting');
          scheduleReconnectRef.current(reconnectDelayMs(reconnectAttemptRef.current));
        } else {
          giveUpReconnectRef.current('failed');
        }
        return;
      }
      if (state === 'closed') {
        onClose?.();
      }
    };

    try {
      const stream = await acquireLocalMediaStream(mode);
      localStreamRef.current = stream;
      bindLocalPreview(localVideoRef.current, stream);
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    } catch (e) {
      toast.error(t('callMediaError'));
      onClose && onClose();
      return;
    }

    try {
      if (direction === 'outgoing') {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        await sendSignaling(socket, { type: 'call-offer', to: peer.user_id, mode, sdp: offer }, signalingCtx);
      } else if (signal?.sdp) {
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        await sendSignaling(socket, { type: 'call-answer', to: peer.user_id, sdp: answer }, signalingCtx);
        setStatus('connected');
      }
    } catch (err) {
      if (toastSignalingFailure(err, t)) {
        cleanup();
        onClose?.();
        return;
      }
      toast.error(t('callMediaError'));
      cleanup();
      onClose?.();
    }
  };

  const applyRemoteMode = useCallback((nextMode) => {
    setActiveMode(nextMode);
    activeModeRef.current = nextMode;
    if (nextMode === 'video') {
      setVideoOff(false);
      requestAnimationFrame(() => refreshRemoteBindings());
    }
  }, [refreshRemoteBindings]);

  const handleIceRestartOffer = async (data, signalingCtx) => {
    const pc = pcRef.current;
    if (!pc || renegotiatingRef.current) return;
    renegotiatingRef.current = true;
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignaling(socket, { type: 'call-answer', to: peer.user_id, sdp: answer }, signalingCtx);
    } catch (err) {
      if (!toastSignalingFailure(err, t)) {
        toast.error(t('callReconnectFailed'));
      }
    } finally {
      renegotiatingRef.current = false;
    }
  };

  const handleRenegotiationOffer = async (data, signalingCtx) => {
    const pc = pcRef.current;
    if (!pc || renegotiatingRef.current) return;
    renegotiatingRef.current = true;
    try {
      const nextMode = data.mode === 'video' ? 'video' : 'audio';
      if (nextMode === 'video') {
        await applyVideoToPeerConnection(pc, localStreamRef.current);
      } else {
        await removeVideoFromPeerConnection(pc, localStreamRef.current);
      }
      await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await sendSignaling(socket, { type: 'call-answer', to: peer.user_id, sdp: answer }, signalingCtx);
      applyRemoteMode(nextMode);
    } catch (err) {
      if (!toastSignalingFailure(err, t)) {
        toast.error(t('callMediaError'));
      }
    } finally {
      renegotiatingRef.current = false;
    }
  };

  // listen for signaling pushed by parent (via window event hack)
  useEffect(() => {
    const handler = async (e) => {
      let data = e.detail;
      const pc = pcRef.current;
      if (!pc) return;
      const signalingCtx = { peerUserId: peer.user_id, ourUserId: user?.user_id, peer, user, isGroup: false };
      try {
        data = await unpackIncomingSignaling(data, {
          myUserId: user?.user_id,
          peerUserId: peer.user_id,
        });
      } catch (err) {
        console.warn('[SSC] call modal signaling unpack failed:', err?.message || err);
        toast.error(t('callSignalingDecryptFailed'));
        return;
      }
      if (data.type === 'call-answer' && data.from === peer.user_id) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data.sdp));
          if (status !== 'connected') setStatus('connected');
        } catch (err) {
          console.warn('[SSC] call answer SDP failed:', err?.message || err);
          toast.error(t('callSdpFailed'));
        }
      } else if (data.type === 'call-offer' && data.from === peer.user_id) {
        if (data.ice_restart) {
          await handleIceRestartOffer(data, signalingCtx);
        } else if (status === 'connected' || status === 'reconnecting' || pc.remoteDescription) {
          await handleRenegotiationOffer(data, signalingCtx);
        }
      } else if (data.type === 'ice-candidate' && data.from === peer.user_id) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
        } catch (err) {
          console.warn('[SSC] ICE candidate failed:', err?.message || err);
          toast.error(t('callIceFailed'));
        }
      } else if (data.type === 'call-end' && data.from === peer.user_id) {
        setEndReason('ended');
        setStatus('ended');
        setTimeout(() => onClose?.(), 800);
      } else if (data.type === 'call-reject' && data.from === peer.user_id) {
        setEndReason('declined');
        setStatus('ended');
        toast.message(t('callStatusDeclined'));
        setTimeout(() => onClose?.(), 1500);
      }
    };
    window.addEventListener('ssc-signal', handler);
    return () => window.removeEventListener('ssc-signal', handler);
  }, [peer.user_id, user?.user_id, onClose, status, handleRenegotiationOffer, applyRemoteMode, t]);

  const cleanup = () => {
    clearReconnectTimers();
    try { pcRef.current?.close(); } catch {}
    try { localStreamRef.current?.getTracks().forEach((track) => track.stop()); } catch {}
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  };

  const endCall = () => {
    socket.send({ type: 'call-end', to: peer.user_id });
    onClose && onClose();
  };

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks?.()[0];
    if (track) { track.enabled = !track.enabled; setMuted(!track.enabled); }
  };

  const toggleVideo = () => {
    const track = localStreamRef.current?.getVideoTracks?.()[0];
    if (track) { track.enabled = !track.enabled; setVideoOff(!track.enabled); }
  };

  const flipCamera = async () => {
    const pc = pcRef.current;
    const stream = localStreamRef.current;
    if (!pc || !stream || activeMode !== 'video' || videoOff || modeBusy) return;
    setModeBusy(true);
    try {
      const nextFacing = oppositeCameraFacing(cameraFacingRef.current);
      await replaceVideoTrackFacing(pc, stream, nextFacing);
      cameraFacingRef.current = nextFacing;
      bindLocalPreview(localVideoRef.current, stream);
    } catch {
      toast.error(t('callCameraSwitchFailed'));
    } finally {
      setModeBusy(false);
    }
  };

  const switchCallMode = async () => {
    const pc = pcRef.current;
    if (!pc || status !== 'connected' || modeBusy || renegotiatingRef.current) return;
    const nextMode = activeMode === 'video' ? 'audio' : 'video';
    const signalingCtx = { peerUserId: peer.user_id, ourUserId: user?.user_id, peer, user, isGroup: false };
    setModeBusy(true);
    renegotiatingRef.current = true;
    try {
      if (nextMode === 'video') {
        await applyVideoToPeerConnection(pc, localStreamRef.current);
        setVideoOff(false);
        bindLocalPreview(localVideoRef.current, localStreamRef.current);
      } else {
        await removeVideoFromPeerConnection(pc, localStreamRef.current);
        setVideoOff(false);
      }
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignaling(
        socket,
        { type: 'call-offer', to: peer.user_id, mode: nextMode, sdp: offer, renegotiate: true },
        signalingCtx,
      );
      setActiveMode(nextMode);
      activeModeRef.current = nextMode;
      if (nextMode === 'video') refreshRemoteBindings();
    } catch (err) {
      if (!toastSignalingFailure(err, t)) {
        toast.error(t('callMediaError'));
      }
    } finally {
      renegotiatingRef.current = false;
      setModeBusy(false);
    }
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  const icePathLabelText = () => {
    if (!icePath) return '';
    const key = `callIcePath${icePath.charAt(0).toUpperCase()}${icePath.slice(1)}`;
    return t(key) || icePath;
  };

  const statusLabel = () => {
    if (status === 'connected') {
      const path = icePathLabelText();
      return path ? `E2E · ${path} · ${fmt(duration)}` : `E2E · ${fmt(duration)}`;
    }
    if (status === 'reconnecting') {
      return t('callStatusReconnecting', { attempt: String(reconnectAttempt || 1) });
    }
    if (status === 'calling') return t('callStatusCalling');
    if (status === 'ringing') return t('callStatusRinging');
    if (endReason === 'declined') return t('callStatusDeclined');
    if (endReason === 'failed') return t('callStatusFailed');
    if (endReason === 'disconnected') return t('callPeerDisconnected');
    if (endReason === 'ended') return t('callStatusEnded');
    return status.toUpperCase();
  };

  const stageClass = isMobile
    ? 'relative flex-1 w-full min-h-0 bg-[#0A0A0A]'
    : 'relative w-full max-w-3xl aspect-video bg-[#121212] rounded-md tac-border';

  const pipClass = isMobile
    ? 'absolute bottom-4 left-3 w-28 h-36 object-cover rounded-md tac-border shadow-lg z-10'
    : 'absolute top-3 right-3 w-32 h-24 object-cover rounded-md tac-border z-10';

  return (
    <div
      className={`fixed inset-0 z-[9998] bg-black flex flex-col safe-top safe-bottom ${
        isMobile ? '' : 'bg-black/90 backdrop-blur-xl items-center justify-center'
      }`}
      data-testid="call-modal"
    >
      <audio ref={remoteAudioRef} autoPlay playsInline className="sr-only" data-testid="call-remote-audio" />

      <div
        className={`${stageClass} overflow-hidden`}
        data-testid="call-modal-stage"
        data-ice-path={status === 'connected' ? icePath || undefined : undefined}
      >
        {activeMode === 'video' ? (
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            data-testid="call-remote-video"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-[#121212]">
            <div className="mb-4">
              <Avatar user={peer} size="lg" className="!w-32 !h-32 !text-3xl !rounded-md" />
            </div>
            <div className="font-mono text-lg">@{peer.username}</div>
          </div>
        )}
        {activeMode === 'video' && (
          <video
            ref={localVideoRef}
            autoPlay
            muted
            playsInline
            className={pipClass}
            data-testid="call-local-video"
          />
        )}
        <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 rounded font-mono text-[10px] tracking-widest text-[#A1A1AA] z-10 flex items-center gap-2" data-testid="call-status-label">
          <span>{statusLabel()}</span>
          {status === 'connected' && <CallQualityIndicator level={quality.level} />}
        </div>
        {status === 'reconnecting' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 z-[6]">
            <p className="font-mono text-xs tracking-widest text-[#FFD600] mb-3">{t('callStatusReconnecting', { attempt: String(reconnectAttempt || 1) })}</p>
            <button
              type="button"
              onClick={() => attemptIceRestart()}
              data-testid="call-reconnect-retry"
              className="px-4 py-2 rounded-md tac-border bg-[#1A1A1A] hover:bg-[#232323] text-xs font-mono flex items-center gap-2"
            >
              <ArrowsClockwise size={14} />
              {t('callReconnectRetry')}
            </button>
          </div>
        )}
        {activeMode === 'video' && videoOff && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#121212]/80 z-[5] pointer-events-none">
            <VideoCameraSlash size={48} className="text-[#71717A]" />
          </div>
        )}
      </div>

      <div className={`flex items-center gap-3 shrink-0 ${isMobile ? 'py-5 px-4' : 'mt-6'}`}>
        <button
          onClick={toggleMute}
          data-testid="call-mute-button"
          className={`w-12 h-12 rounded-full flex items-center justify-center ${muted ? 'bg-[#FF3B30]' : 'bg-[#1A1A1A] tac-border'} hover:brightness-110`}
        >
          {muted ? <MicrophoneSlash size={20} /> : <Microphone size={20} />}
        </button>

        {activeMode === 'video' && (
          <>
            <button
              onClick={toggleVideo}
              data-testid="call-video-button"
              className={`w-12 h-12 rounded-full flex items-center justify-center ${videoOff ? 'bg-[#FF3B30]' : 'bg-[#1A1A1A] tac-border'} hover:brightness-110`}
            >
              {videoOff ? <VideoCameraSlash size={20} /> : <VideoCamera size={20} />}
            </button>
            {!videoOff && (
              <button
                onClick={flipCamera}
                disabled={modeBusy}
                data-testid="call-flip-camera-button"
                title={t('switchCamera')}
                className="w-12 h-12 rounded-full flex items-center justify-center bg-[#1A1A1A] tac-border hover:brightness-110 disabled:opacity-40"
              >
                <CameraRotate size={20} />
              </button>
            )}
          </>
        )}

        {(status === 'connected' || status === 'reconnecting') && (
          <button
            onClick={switchCallMode}
            disabled={status === 'reconnecting'}
            disabled={modeBusy}
            data-testid="call-mode-switch-button"
            title={activeMode === 'video' ? t('switchToAudioCall') : t('switchToVideoCall')}
            className="w-12 h-12 rounded-full flex items-center justify-center bg-[#1A1A1A] tac-border hover:brightness-110 disabled:opacity-40"
          >
            {activeMode === 'video' ? <Phone size={20} /> : <ArrowsLeftRight size={20} />}
          </button>
        )}

        <button
          onClick={endCall}
          data-testid="call-end-button"
          className="w-14 h-14 rounded-full bg-[#FF3B30] flex items-center justify-center hover:brightness-110"
        >
          <Phone size={22} weight="fill" className="rotate-[135deg] text-white" />
        </button>
      </div>
    </div>
  );
}