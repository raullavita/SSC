/**
 * SSC desktop media worker — 1:1 WebRTC + SFU join path via @roamhq/wrtc.
 * JSON lines stdin/stdout (same pattern as crypto-worker).
 *
 * cmds: ping, create, createOffer, createAnswer, setRemote, addIce, close,
 *       drainIce, sfuJoin, sfuLeave
 */
const readline = require('readline');
const { SfuClient } = require('./sfuClient');

let wrtc;
try {
  wrtc = require('@roamhq/wrtc');
} catch (e) {
  wrtc = null;
}

const { RTCPeerConnection, nonstandard } = wrtc || {};
const sessions = new Map(); // callId -> { pc, pendingIce }
const sfuSessions = new Map(); // roomId -> SfuClient

function iceServersFromArgs(args) {
  const list = args.iceServers || args.ice_servers || [];
  if (!Array.isArray(list) || list.length === 0) {
    return [{ urls: 'stun:stun.l.google.com:19302' }];
  }
  return list.map((s) => {
    const urls = s.urls || s.url;
    const out = { urls };
    if (s.username) out.username = s.username;
    if (s.credential || s.password) out.credential = s.credential || s.password;
    return out;
  });
}

function addLocalTracks(pc, video) {
  try {
    if (nonstandard && nonstandard.RTCAudioSource) {
      const source = new nonstandard.RTCAudioSource();
      pc.addTrack(source.createTrack());
    } else {
      pc.addTransceiver('audio', { direction: 'sendrecv' });
    }
  } catch (_) {
    pc.addTransceiver('audio', { direction: 'sendrecv' });
  }
  if (video) {
    try {
      if (nonstandard && nonstandard.RTCVideoSource) {
        const vsrc = new nonstandard.RTCVideoSource();
        pc.addTrack(vsrc.createTrack());
      } else {
        pc.addTransceiver('video', { direction: 'sendrecv' });
      }
    } catch (_) {
      pc.addTransceiver('video', { direction: 'sendrecv' });
    }
  }
}

async function handle(cmd, args = {}) {
  if (cmd === 'ping') {
    return { pong: true, version: '0.4.0', wrtc: Boolean(wrtc), sfu: true };
  }
  if (cmd === 'sfuJoin') {
    const roomId = String(args.roomId || '');
    if (!roomId) throw new Error('sfu_room_id_required');
    if (sfuSessions.has(roomId)) {
      try {
        await sfuSessions.get(roomId).leave();
      } catch (_) {
        /* ignore */
      }
      sfuSessions.delete(roomId);
    }
    const client = new SfuClient({
      wsUrl: args.wsUrl,
      roomId,
      joinToken: args.joinToken,
      peerId: args.peerId,
      wrtc,
    });
    const joined = await client.connectAndJoin(Number(args.timeoutMs) || 15000);
    await client.createTransport('send');
    await client.createTransport('recv');
    const media = await client.prepareMedia();
    sfuSessions.set(roomId, client);
    return {
      joined: true,
      roomId,
      peerId: joined.peerId,
      existingProducers: joined.existingProducers,
      hasRtpCapabilities: joined.hasRtpCapabilities,
      sendTransportId: client.sendTransport && client.sendTransport.id,
      recvTransportId: client.recvTransport && client.recvTransport.id,
      media,
    };
  }
  if (cmd === 'sfuLeave') {
    const roomId = String(args.roomId || '');
    const client = sfuSessions.get(roomId);
    if (client) {
      await client.leave();
      sfuSessions.delete(roomId);
    }
    return { left: true, roomId };
  }
  if (!wrtc && cmd !== 'ping') {
    throw new Error('wrtc_unavailable');
  }
  switch (cmd) {
    case 'create': {
      const callId = String(args.callId || 'default');
      if (sessions.has(callId)) {
        try {
          sessions.get(callId).pc.close();
        } catch (_) {
          /* ignore */
        }
        sessions.delete(callId);
      }
      const pc = new RTCPeerConnection({ iceServers: iceServersFromArgs(args) });
      const pendingIce = [];
      pc.onicecandidate = (ev) => {
        if (ev.candidate) {
          pendingIce.push(ev.candidate.toJSON ? ev.candidate.toJSON() : ev.candidate);
        }
      };
      addLocalTracks(pc, !!args.video);
      sessions.set(callId, { pc, pendingIce, iceComplete: false, video: !!args.video });
      pc.onicegatheringstatechange = () => {
        const s = sessions.get(callId);
        if (s && pc.iceGatheringState === 'complete') s.iceComplete = true;
      };
      return { callId, ok: true, video: !!args.video };
    }
    case 'createOffer': {
      const s = sessions.get(String(args.callId || 'default'));
      if (!s) throw new Error('no_session');
      const offer = await s.pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: !!(args.video || s.video),
      });
      await s.pc.setLocalDescription(offer);
      await new Promise((r) => setTimeout(r, 400));
      return {
        sdp: s.pc.localDescription.sdp,
        type: s.pc.localDescription.type,
        ice: s.pendingIce.splice(0),
      };
    }
    case 'createAnswer': {
      const s = sessions.get(String(args.callId || 'default'));
      if (!s) throw new Error('no_session');
      const answer = await s.pc.createAnswer();
      await s.pc.setLocalDescription(answer);
      await new Promise((r) => setTimeout(r, 400));
      return {
        sdp: s.pc.localDescription.sdp,
        type: s.pc.localDescription.type,
        ice: s.pendingIce.splice(0),
      };
    }
    case 'setRemote': {
      const s = sessions.get(String(args.callId || 'default'));
      if (!s) throw new Error('no_session');
      await s.pc.setRemoteDescription({ type: args.type, sdp: args.sdp });
      return { ok: true };
    }
    case 'addIce': {
      const s = sessions.get(String(args.callId || 'default'));
      if (!s) throw new Error('no_session');
      const c = args.candidate;
      if (c) {
        await s.pc.addIceCandidate(c);
      }
      return { ok: true };
    }
    case 'drainIce': {
      const s = sessions.get(String(args.callId || 'default'));
      if (!s) throw new Error('no_session');
      const ice = s.pendingIce.splice(0);
      return { ice, gathering: s.pc.iceGatheringState };
    }
    case 'close': {
      const id = String(args.callId || 'default');
      const s = sessions.get(id);
      if (s) {
        try {
          s.pc.close();
        } catch (_) {
          /* ignore */
        }
        sessions.delete(id);
      }
      return { closed: true };
    }
    default:
      throw new Error(`unknown_cmd:${cmd}`);
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
rl.on('line', async (line) => {
  const raw = String(line || '').trim();
  if (!raw) return;
  let req;
  try {
    req = JSON.parse(raw);
  } catch {
    process.stdout.write(`${JSON.stringify({ id: null, ok: false, error: 'invalid_json' })}\n`);
    return;
  }
  try {
    const result = await handle(req.cmd, req.args || {});
    process.stdout.write(`${JSON.stringify({ id: req.id, ok: true, result })}\n`);
  } catch (e) {
    process.stdout.write(
      `${JSON.stringify({ id: req.id, ok: false, error: e && e.message ? e.message : String(e) })}\n`,
    );
  }
});
process.stdout.write(`${JSON.stringify({ id: 0, ok: true, result: { ready: true, wrtc: Boolean(wrtc), sfu: true } })}\n`);
