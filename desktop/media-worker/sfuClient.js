/**
 * mediasoup SFU WebSocket client — wire protocol matches sfu-server/wsHandler.js
 * and Android SfuSession (join, transports, leave). Media produce/consume is
 * best-effort via @roamhq/wrtc; signaling join always runs for group-call path.
 */
const WebSocket = require('ws');

class SfuClient {
  constructor({ wsUrl, roomId, joinToken, peerId, wrtc }) {
    this.wsUrl = wsUrl;
    this.roomId = roomId;
    this.joinToken = joinToken;
    this.peerId = peerId || `win-${Date.now().toString(36)}`;
    this.wrtc = wrtc;
    this.ws = null;
    this.rtpCapabilities = null;
    this.existingProducers = [];
    this.waiters = [];
    this.joined = false;
    this.sendTransport = null;
    this.recvTransport = null;
    this.pc = null;
  }

  _send(obj) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('sfu_ws_not_open');
    }
    this.ws.send(JSON.stringify(obj));
  }

  _awaitAction(action, timeoutMs = 15000, predicate) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w !== waiter);
        reject(new Error(`sfu_timeout:${action}`));
      }, timeoutMs);
      const waiter = {
        action,
        predicate: predicate || (() => true),
        resolve: (msg) => {
          clearTimeout(t);
          resolve(msg);
        },
        reject: (err) => {
          clearTimeout(t);
          reject(err);
        },
      };
      this.waiters.push(waiter);
    });
  }

  _onMessage(raw) {
    let msg;
    try {
      msg = JSON.parse(String(raw));
    } catch {
      return;
    }
    const action = msg.action;
    if (action === 'error') {
      const err = msg.error || 'sfu_error';
      for (const w of this.waiters.splice(0)) w.reject(new Error(err));
      return;
    }
    const remaining = [];
    for (const w of this.waiters) {
      if (w.action === action && w.predicate(msg)) {
        w.resolve(msg);
      } else {
        remaining.push(w);
      }
    }
    this.waiters = remaining;
  }

  async connectAndJoin(timeoutMs = 15000) {
    if (!this.wsUrl || !this.roomId || !this.joinToken) {
      throw new Error('sfu_missing_params');
    }
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('sfu_ws_connect_timeout')), timeoutMs);
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on('open', () => {
        clearTimeout(timer);
        resolve();
      });
      this.ws.on('error', (e) => {
        clearTimeout(timer);
        reject(e);
      });
      this.ws.on('message', (data) => this._onMessage(data));
      this.ws.on('close', () => {
        this.joined = false;
        for (const w of this.waiters.splice(0)) w.reject(new Error('sfu_ws_closed'));
      });
    });

    this._send({
      action: 'join',
      roomId: this.roomId,
      joinToken: this.joinToken,
      peerId: this.peerId,
    });
    const joined = await this._awaitAction('joined', timeoutMs);
    this.peerId = joined.peerId || this.peerId;
    this.rtpCapabilities = joined.rtpCapabilities || null;
    this.existingProducers = Array.isArray(joined.existingProducers) ? joined.existingProducers : [];
    this.joined = true;
    return {
      peerId: this.peerId,
      existingProducers: this.existingProducers.length,
      hasRtpCapabilities: Boolean(this.rtpCapabilities),
    };
  }

  async createTransport(direction) {
    this._send({ action: 'createWebRtcTransport', direction });
    const msg = await this._awaitAction(
      'webRtcTransportCreated',
      12000,
      (m) => m.direction === direction,
    );
    const info = {
      id: msg.id,
      direction,
      iceParameters: msg.iceParameters,
      iceCandidates: msg.iceCandidates || [],
      dtlsParameters: msg.dtlsParameters,
    };
    if (direction === 'send') this.sendTransport = info;
    else this.recvTransport = info;
    return info;
  }

  /**
   * Best-effort: open a PeerConnection using SFU ICE candidates so DTLS can start.
   * Full produce/consume needs mediasoup-client rtpParameters; join+transports is the parity path.
   */
  async prepareMedia() {
    if (!this.wrtc || !this.sendTransport) {
      return { media: false, reason: 'no_wrtc_or_send_transport' };
    }
    try {
      const { RTCPeerConnection } = this.wrtc;
      const iceServers = [];
      const urls = (this.sendTransport.iceCandidates || [])
        .map((c) => {
          if (!c || !c.ip) return null;
          const proto = (c.protocol || 'udp').toLowerCase();
          return `${proto === 'tcp' ? 'turn' : 'stun'}:${c.ip}:${c.port || 3478}`;
        })
        .filter(Boolean);
      if (urls.length) iceServers.push({ urls });
      this.pc = new RTCPeerConnection({ iceServers: iceServers.length ? iceServers : undefined });
      try {
        const nonstandard = this.wrtc.nonstandard;
        if (nonstandard && nonstandard.RTCAudioSource) {
          const source = new nonstandard.RTCAudioSource();
          this.pc.addTrack(source.createTrack());
        } else {
          this.pc.addTransceiver('audio', { direction: 'sendrecv' });
        }
      } catch {
        this.pc.addTransceiver('audio', { direction: 'sendrecv' });
      }
      return {
        media: true,
        sendTransportId: this.sendTransport.id,
        recvTransportId: this.recvTransport ? this.recvTransport.id : null,
        iceCandidateCount: (this.sendTransport.iceCandidates || []).length,
      };
    } catch (e) {
      return { media: false, reason: e.message || String(e) };
    }
  }

  async leave() {
    try {
      if (this.pc) {
        this.pc.close();
        this.pc = null;
      }
    } catch {
      /* ignore */
    }
    try {
      if (this.ws) this.ws.close();
    } catch {
      /* ignore */
    }
    this.ws = null;
    this.joined = false;
    this.sendTransport = null;
    this.recvTransport = null;
    return { left: true };
  }
}

module.exports = { SfuClient };
