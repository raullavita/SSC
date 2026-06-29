import React, { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Phone, VideoCamera, MicrophoneSlash, Microphone, VideoCameraSlash,
  CameraRotate, HandWaving, SpeakerSlash,
} from '@phosphor-icons/react';
import { useLocale } from '../context/LocaleContext';
import { connectGroupCallSfu } from '../lib/groupCallSfu';
import {
  acquireLocalMediaStream,
  bindLocalPreview,
  bindRemoteStream,
  DEFAULT_CAMERA_FACING,
  oppositeCameraFacing,
  replaceVideoTrackFacingOnMesh,
} from '../lib/callMedia';
import {
  applyMuteAllToStream,
  canMuteAllInGroupCall,
  groupCallBroadcastTargets,
  mergeRaisedHandState,
} from '../lib/groupCallModeration';

export default function GroupCallSfuModal({
  mode, direction, members, me, conversation, conversationId, socket, signal, onClose,
}) {
  const { t } = useLocale();
  const [peers, setPeers] = useState({});
  const remoteAudioRefs = useRef({});
  const localStreamRef = useRef(null);
  const localVideoRef = useRef(null);
  const sfuSessionRef = useRef(null);
  const [muted, setMuted] = useState(false);
  const [videoOff, setVideoOff] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const cameraFacingRef = useRef(DEFAULT_CAMERA_FACING);
  const [duration, setDuration] = useState(0);
  const startRef = useRef(null);
  const [status, setStatus] = useState(direction === 'outgoing' ? 'calling' : 'incoming');
  const [raisedHands, setRaisedHands] = useState({});
  const [myHandRaised, setMyHandRaised] = useState(false);
  const canMuteAll = canMuteAllInGroupCall(conversation, me?.user_id);

  const broadcastGroupControl = async (payload) => {
    const targets = groupCallBroadcastTargets(members, Object.keys(peers), me?.user_id);
    for (const uid of targets) {
      socket?.send({ ...payload, to: uid, group: true, conversation_id: conversationId });
    }
  };

  const inviteMembers = async () => {
    const roster = members.map((m) => ({ user_id: m.user_id, username: m.username }));
    for (const m of members) {
      socket?.send({
        type: 'call-sfu-invite',
        to: m.user_id,
        group: true,
        mode,
        conversation_id: conversationId,
        members: roster,
      });
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const stream = await acquireLocalMediaStream(mode);
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        localStreamRef.current = stream;
        bindLocalPreview(localVideoRef.current, stream);

        const session = await connectGroupCallSfu({
          conversationId,
          userId: me.user_id,
          username: me.username,
          localStream: stream,
          videoEnabled: mode === 'video' && !videoOff,
          onRemoteTrack: ({ peerId, stream: remoteStream }) => {
            const member = members.find((m) => m.user_id === peerId);
            setPeers((cur) => ({
              ...cur,
              [peerId]: {
                stream: remoteStream,
                username: member?.username || peerId,
              },
            }));
            bindRemoteStream({
              videoEl: null,
              audioEl: remoteAudioRefs.current[peerId],
              stream: remoteStream,
            });
          },
          onPeerLeft: (peerId) => {
            setPeers((cur) => {
              const next = { ...cur };
              delete next[peerId];
              return next;
            });
            setRaisedHands((cur) => mergeRaisedHandState(cur, peerId, false));
          },
        });
        if (cancelled) {
          session.close();
          return;
        }
        sfuSessionRef.current = session;
        if (direction === 'outgoing') await inviteMembers();
        setStatus('connected');
      } catch (err) {
        console.error('[SSC] SFU group call failed:', err?.message || err);
        toast.error(t('groupCallSfuFailed'));
        onClose?.();
      }
    })();
    return () => {
      cancelled = true;
      try { sfuSessionRef.current?.close(); } catch { /* noop */ }
      sfuSessionRef.current = null;
      try { localStreamRef.current?.getTracks().forEach((tr) => tr.stop()); } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    startRef.current = Date.now();
    const id = setInterval(() => setDuration(Math.floor((Date.now() - startRef.current) / 1000)), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    Object.entries(peers).forEach(([uid, p]) => {
      if (p.stream) {
        bindRemoteStream({
          videoEl: null,
          audioEl: remoteAudioRefs.current[uid],
          stream: p.stream,
        });
      }
    });
  }, [peers]);

  useEffect(() => {
    const handler = (e) => {
      const data = e.detail;
      if (!data?.group) return;
      const fromId = data.from;
      if (data.type === 'call-end') {
        setPeers((cur) => {
          const next = { ...cur };
          delete next[fromId];
          return next;
        });
        setRaisedHands((cur) => mergeRaisedHandState(cur, fromId, false));
      } else if (data.type === 'call-raise-hand' && fromId !== me.user_id) {
        setRaisedHands((cur) => mergeRaisedHandState(cur, fromId, !!data.raised));
      } else if (data.type === 'call-mute-all' && fromId !== me.user_id) {
        if (applyMuteAllToStream(localStreamRef.current)) {
          setMuted(true);
          toast.message(t('groupCallMutedByHost', { user: data.from_username || fromId }));
        }
      }
    };
    window.addEventListener('ssc-signal', handler);
    return () => window.removeEventListener('ssc-signal', handler);
  }, [me?.user_id, t]);

  const cleanup = () => {
    try { sfuSessionRef.current?.close(); } catch { /* noop */ }
    sfuSessionRef.current = null;
    try { localStreamRef.current?.getTracks().forEach((tr) => tr.stop()); } catch { /* noop */ }
  };

  const end = () => {
    const targets = groupCallBroadcastTargets(members, Object.keys(peers), me?.user_id);
    for (const uid of targets) {
      socket?.send({ type: 'call-end', to: uid, group: true });
    }
    cleanup();
    onClose?.();
  };

  const toggleMute = () => {
    const track = localStreamRef.current?.getAudioTracks?.()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
    }
  };

  const toggleRaiseHand = async () => {
    const next = !myHandRaised;
    setMyHandRaised(next);
    setRaisedHands((cur) => mergeRaisedHandState(cur, me.user_id, next));
    try {
      await broadcastGroupControl({ type: 'call-raise-hand', raised: next });
    } catch {
      setMyHandRaised(!next);
      setRaisedHands((cur) => mergeRaisedHandState(cur, me.user_id, !next));
      toast.error(t('groupCallRaiseHandFailed'));
    }
  };

  const muteAllParticipants = async () => {
    if (!canMuteAll) return;
    if (applyMuteAllToStream(localStreamRef.current)) setMuted(true);
    try {
      await broadcastGroupControl({ type: 'call-mute-all' });
      toast.success(t('groupCallMuteAllSent'));
    } catch {
      toast.error(t('groupCallMuteAllFailed'));
    }
  };

  const toggleVideo = () => {
    const track = localStreamRef.current?.getVideoTracks?.()[0];
    if (track) {
      track.enabled = !track.enabled;
      setVideoOff(!track.enabled);
    }
  };

  const flipCamera = async () => {
    const stream = localStreamRef.current;
    if (!stream || mode !== 'video' || videoOff || cameraBusy) return;
    setCameraBusy(true);
    try {
      const nextFacing = oppositeCameraFacing(cameraFacingRef.current);
      await replaceVideoTrackFacingOnMesh([], stream, nextFacing);
      await sfuSessionRef.current?.replaceLocalStream?.(stream);
      cameraFacingRef.current = nextFacing;
      bindLocalPreview(localVideoRef.current, stream);
    } catch {
      toast.error(t('callCameraSwitchFailed'));
    } finally {
      setCameraBusy(false);
    }
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  const tiles = [
    { user_id: me.user_id, username: me.username, isLocal: true, handRaised: myHandRaised },
    ...Object.entries(peers).map(([uid, p]) => ({
      user_id: uid,
      username: p.username,
      stream: p.stream,
      handRaised: !!raisedHands[uid],
    })),
  ];
  const cols = tiles.length <= 2 ? 1 : tiles.length <= 4 ? 2 : 3;

  return (
    <div className="fixed inset-0 z-[9998] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-4 safe-top safe-bottom">
      <div className="absolute top-3 left-3 px-2 py-1 bg-black/60 rounded font-mono text-[10px] tracking-widest text-[#A1A1AA]">
        GROUP_CALL · SFU · {fmt(duration)} · {tiles.length} ON CALL
        {status !== 'connected' && ` · ${t('groupCallConnecting')}`}
      </div>
      <div className="w-full max-w-5xl grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {tiles.map((tile) => (
          <div key={tile.user_id} className="aspect-video bg-[#121212] rounded-md tac-border relative overflow-hidden" data-testid={`group-call-tile-${tile.username}`}>
            {!tile.isLocal && (
              <audio
                autoPlay
                playsInline
                className="sr-only"
                ref={(el) => { remoteAudioRefs.current[tile.user_id] = el; }}
              />
            )}
            {mode === 'video' ? (
              tile.isLocal ? (
                <video ref={localVideoRef} autoPlay muted playsInline className="w-full h-full object-cover" />
              ) : (
                <video
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  ref={(el) => {
                    if (el && tile.stream) {
                      bindRemoteStream({
                        videoEl: el,
                        audioEl: remoteAudioRefs.current[tile.user_id],
                        stream: tile.stream,
                      });
                    }
                  }}
                />
              )
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-16 h-16 rounded-md bg-[#232323] flex items-center justify-center font-mono text-lg">
                  {tile.username?.slice(0, 2).toUpperCase()}
                </div>
              </div>
            )}
            <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-[10px] font-mono tracking-widest">
              @{tile.username}{tile.isLocal ? ' (YOU)' : ''}
            </div>
            {tile.handRaised && (
              <div className="absolute top-2 right-2 px-1.5 py-1 bg-[#FFD600]/90 text-black rounded flex items-center gap-1">
                <HandWaving size={12} weight="fill" />
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center gap-3">
        <button onClick={toggleMute} data-testid="group-call-mute" className={`w-12 h-12 rounded-full flex items-center justify-center ${muted ? 'bg-[#FF3B30]' : 'bg-[#1A1A1A] tac-border'} hover:brightness-110`}>
          {muted ? <MicrophoneSlash size={20} /> : <Microphone size={20} />}
        </button>
        <button onClick={toggleRaiseHand} data-testid="group-call-raise-hand" className={`w-12 h-12 rounded-full flex items-center justify-center ${myHandRaised ? 'bg-[#FFD600] text-black' : 'bg-[#1A1A1A] tac-border'} hover:brightness-110`}>
          <HandWaving size={20} weight={myHandRaised ? 'fill' : 'regular'} />
        </button>
        {canMuteAll && (
          <button onClick={muteAllParticipants} data-testid="group-call-mute-all" className="w-12 h-12 rounded-full flex items-center justify-center bg-[#1A1A1A] tac-border hover:brightness-110">
            <SpeakerSlash size={20} />
          </button>
        )}
        {mode === 'video' && (
          <>
            <button onClick={toggleVideo} data-testid="group-call-video" className={`w-12 h-12 rounded-full flex items-center justify-center ${videoOff ? 'bg-[#FF3B30]' : 'bg-[#1A1A1A] tac-border'} hover:brightness-110`}>
              {videoOff ? <VideoCameraSlash size={20} /> : <VideoCamera size={20} />}
            </button>
            {!videoOff && (
              <button onClick={flipCamera} disabled={cameraBusy} data-testid="group-call-flip-camera" className="w-12 h-12 rounded-full flex items-center justify-center bg-[#1A1A1A] tac-border hover:brightness-110 disabled:opacity-40">
                <CameraRotate size={20} />
              </button>
            )}
          </>
        )}
        <button onClick={end} data-testid="group-call-end" className="w-14 h-14 rounded-full bg-[#FF3B30] flex items-center justify-center hover:brightness-110">
          <Phone size={22} weight="fill" className="rotate-[135deg] text-white" />
        </button>
      </div>
    </div>
  );
}