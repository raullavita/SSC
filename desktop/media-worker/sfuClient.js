/**
 * mediasoup SFU client — Android SfuSession + SfuMediaEngine parity for Windows.
 * Wire: join → send/recv transports → DTLS connect → produce audio → consume remotes.
 */
const WebSocket = require('ws');
const {
  extractDtlsParameters,
  extractRtpParametersFromSdp,
  audioRtpFallback,
  buildClientRtpCapabilities,
  buildRemoteIceSdp,
  buildMultiRecvOfferSdp,
  iceCandidateToRtc,
} = require('./sfuSdp');

class SfuClient {
  constructor({ wsUrl, roomId, joinToken, peerId, wrtc, publishAudio = true, publishVideo = false }) {
    this.wsUrl = wsUrl;
    this.roomId = roomId;
    this.joinToken = joinToken;
    this.peerId = peerId || `win-${Date.now().toString(36)}`;
    this.wrtc = wrtc;
    this.publishAudio = publishAudio;
    this.publishVideo = publishVideo;
    this.ws = null;
    this.rtpCapabilities = null;
    this.existingProducers = [];
    this.waiters = [];
    this.joined = false;
    this.sendTransport = null;
    this.recvTransport = null;
    this.sendPc = null;
    this.recvPc = null;
    this.audioSource = null;
    this.audioPump = null;
    this.produced = [];
    this.consumed = new Map(); // producerId -> consumed
    this.remoteTrackCount = 0;
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
    // Async events (not request/response waiters)
    if (action === 'newProducer' && msg.producerId) {
      this.consumeProducer(msg.producerId, msg.kind || 'audio').catch(() => {});
    }
    if (action === 'producerClosed' && msg.producerId) {
      this.consumed.delete(msg.producerId);
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

  async connectTransport(transportId, dtlsParameters) {
    this._send({
      action: 'connectWebRtcTransport',
      transportId,
      dtlsParameters,
    });
    await this._awaitAction(
      'webRtcTransportConnected',
      12000,
      (m) => m.transportId === transportId,
    );
  }

  async produce(transportId, kind, rtpParameters) {
    this._send({
      action: 'produce',
      transportId,
      kind,
      rtpParameters,
    });
    const msg = await this._awaitAction('produced', 12000);
    return msg.id;
  }

  async consume(transportId, producerId, rtpCapabilities) {
    this._send({
      action: 'consume',
      transportId,
      producerId,
      rtpCapabilities,
    });
    const msg = await this._awaitAction(
      'consumed',
      12000,
      (m) => m.producerId === producerId,
    );
    return {
      id: msg.id,
      producerId,
      kind: msg.kind || 'audio',
      rtpParameters: msg.rtpParameters,
    };
  }

  async resumeConsumer(consumerId) {
    this._send({ action: 'resumeConsumer', consumerId });
    await this._awaitAction(
      'consumerResumed',
      8000,
      (m) => m.consumerId === consumerId,
    );
  }

  async getProducers() {
    this._send({ action: 'getProducers' });
    const msg = await this._awaitAction('producers', 8000);
    const list = Array.isArray(msg.producers) ? msg.producers : [];
    this.existingProducers = list;
    return list;
  }

  _makePc() {
    const { RTCPeerConnection } = this.wrtc;
    return new RTCPeerConnection({
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
      sdpSemantics: 'unified-plan',
    });
  }

  async _setRemote(pc, type, sdp) {
    await pc.setRemoteDescription({ type, sdp });
  }

  async _setLocal(pc, desc) {
    await pc.setLocalDescription(desc);
  }

  async _addIceCandidates(pc, transport) {
    for (const c of transport.iceCandidates || []) {
      try {
        await pc.addIceCandidate(iceCandidateToRtc(c));
      } catch (_) {
        /* ignore bad candidates */
      }
    }
  }

  async _applyRemoteIce(pc, transport) {
    const ice = transport.iceParameters || {};
    const ufrag = ice.usernameFragment || ice.usernamefragment || '';
    const pwd = ice.password || '';
    const sdp = buildRemoteIceSdp(ufrag, pwd, transport.iceCandidates || [], transport.dtlsParameters || {}, [
      '0',
    ]);
    try {
      await this._setRemote(pc, 'answer', sdp);
    } catch (e) {
      // Some stacks reject synthetic answer; continue with candidates only
      process.stderr.write(`sfu applyRemoteIce: ${e.message}\n`);
    }
    await this._addIceCandidates(pc, transport);
  }

  _startAudioPump() {
    if (!this.audioSource || this.audioPump) return;
    const sampleRate = 48000;
    const channelCount = 1;
    const samplesPerFrame = 480; // 10ms
    const samples = new Int16Array(samplesPerFrame);
    this.audioPump = setInterval(() => {
      try {
        this.audioSource.onData({
          samples,
          sampleRate,
          bitsPerSample: 16,
          channelCount,
          numberOfFrames: samplesPerFrame,
        });
      } catch (_) {
        /* ignore */
      }
    }, 10);
    if (this.audioPump.unref) this.audioPump.unref();
  }

  async startMedia() {
    if (!this.wrtc) {
      return { media: false, reason: 'wrtc_unavailable' };
    }
    const result = {
      media: true,
      produced: [],
      consumed: 0,
      sendTransportId: null,
      recvTransportId: null,
      errors: [],
    };

    // --- SEND path ---
    await this.createTransport('send');
    result.sendTransportId = this.sendTransport.id;
    this.sendPc = this._makePc();
    await this._applyRemoteIce(this.sendPc, this.sendTransport);

    if (this.publishAudio) {
      try {
        const nonstandard = this.wrtc.nonstandard;
        if (nonstandard && nonstandard.RTCAudioSource) {
          this.audioSource = new nonstandard.RTCAudioSource();
          const track = this.audioSource.createTrack();
          this.sendPc.addTrack(track);
          this._startAudioPump();
        } else {
          this.sendPc.addTransceiver('audio', { direction: 'sendonly' });
        }
      } catch (e) {
        result.errors.push(`audio_track:${e.message}`);
        this.sendPc.addTransceiver('audio', { direction: 'sendonly' });
      }
    }

    if (this.publishVideo) {
      try {
        const nonstandard = this.wrtc.nonstandard;
        if (nonstandard && nonstandard.RTCVideoSource) {
          const vsrc = new nonstandard.RTCVideoSource();
          this.sendPc.addTrack(vsrc.createTrack());
        } else {
          this.sendPc.addTransceiver('video', { direction: 'sendonly' });
        }
      } catch (e) {
        result.errors.push(`video_track:${e.message}`);
      }
    }

    const offer = await this.sendPc.createOffer({
      offerToReceiveAudio: false,
      offerToReceiveVideo: false,
    });
    await this._setLocal(this.sendPc, offer);
    // brief gather
    await new Promise((r) => setTimeout(r, 300));
    const localSdp = this.sendPc.localDescription && this.sendPc.localDescription.sdp;
    const dtls = extractDtlsParameters(localSdp);
    if (!dtls) {
      result.errors.push('send_dtls_missing');
      throw new Error('send_dtls_missing');
    }
    if (!dtls.role) dtls.role = 'client';
    await this.connectTransport(this.sendTransport.id, dtls);

    if (this.publishAudio) {
      try {
        const rtp =
          extractRtpParametersFromSdp(localSdp, 'audio') || audioRtpFallback();
        const producerId = await this.produce(this.sendTransport.id, 'audio', rtp);
        this.produced.push({ id: producerId, kind: 'audio' });
        result.produced.push({ id: producerId, kind: 'audio' });
      } catch (e) {
        result.errors.push(`produce_audio:${e.message}`);
      }
    }

    // --- RECV path ---
    await this.createTransport('recv');
    result.recvTransportId = this.recvTransport.id;
    this.recvPc = this._makePc();
    this.recvPc.ontrack = () => {
      this.remoteTrackCount += 1;
    };
    await this._applyRemoteIce(this.recvPc, this.recvTransport);
    // Create local DTLS for recv transport
    try {
      this.recvPc.addTransceiver('audio', { direction: 'recvonly' });
      const recvOffer = await this.recvPc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: true,
      });
      await this._setLocal(this.recvPc, recvOffer);
      await new Promise((r) => setTimeout(r, 200));
      const recvSdp = this.recvPc.localDescription && this.recvPc.localDescription.sdp;
      const recvDtls = extractDtlsParameters(recvSdp);
      if (recvDtls) {
        if (!recvDtls.role) recvDtls.role = 'client';
        await this.connectTransport(this.recvTransport.id, recvDtls);
      } else {
        result.errors.push('recv_dtls_missing');
      }
    } catch (e) {
      result.errors.push(`recv_connect:${e.message}`);
    }

    // Consume existing + refresh
    for (const ep of this.existingProducers) {
      try {
        await this.consumeProducer(ep.producerId, ep.kind || 'audio');
      } catch (e) {
        result.errors.push(`consume_${ep.producerId}:${e.message}`);
      }
    }
    try {
      await new Promise((r) => setTimeout(r, 600));
      const fresh = await this.getProducers();
      for (const ep of fresh) {
        if (!this.consumed.has(ep.producerId)) {
          try {
            await this.consumeProducer(ep.producerId, ep.kind || 'audio');
          } catch (e) {
            result.errors.push(`consume2_${ep.producerId}:${e.message}`);
          }
        }
      }
    } catch (e) {
      result.errors.push(`getProducers:${e.message}`);
    }

    result.consumed = this.consumed.size;
    result.remoteTrackCount = this.remoteTrackCount;
    result.peerId = this.peerId;
    return result;
  }

  async consumeProducer(producerId, kind) {
    if (!producerId || this.consumed.has(producerId) || !this.recvTransport) return null;
    const caps = buildClientRtpCapabilities(this.rtpCapabilities);
    const consumed = await this.consume(this.recvTransport.id, producerId, caps);
    this.consumed.set(producerId, consumed);
    await this._applyAllConsumed();
    try {
      await this.resumeConsumer(consumed.id);
    } catch (_) {
      /* some servers auto-resume */
    }
    return consumed;
  }

  async _applyAllConsumed() {
    const pc = this.recvPc;
    const transport = this.recvTransport;
    if (!pc || !transport) return;
    const all = Array.from(this.consumed.values());
    if (!all.length) return;
    const sdp = buildMultiRecvOfferSdp(all, transport);
    if (!sdp) return;
    try {
      await this._setRemote(pc, 'offer', sdp);
      const answer = await pc.createAnswer();
      await this._setLocal(pc, answer);
      await this._addIceCandidates(pc, transport);
    } catch (e) {
      process.stderr.write(`sfu applyAllConsumed: ${e.message}\n`);
    }
  }

  /** Legacy name used by worker */
  async prepareMedia() {
    return this.startMedia();
  }

  async leave() {
    if (this.audioPump) {
      clearInterval(this.audioPump);
      this.audioPump = null;
    }
    try {
      if (this.sendPc) this.sendPc.close();
    } catch {
      /* ignore */
    }
    try {
      if (this.recvPc) this.recvPc.close();
    } catch {
      /* ignore */
    }
    this.sendPc = null;
    this.recvPc = null;
    this.audioSource = null;
    this.produced = [];
    this.consumed.clear();
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
