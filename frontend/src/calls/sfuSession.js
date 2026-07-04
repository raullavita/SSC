/**
 * mediasoup-client SFU session — Engine 11
 * @see https://github.com/versatica/mediasoup
 */

import * as mediasoupClient from 'mediasoup-client';
import { fetchIceServers } from './iceServers';

function waitForMessage(ws, predicate, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ws.removeEventListener('message', onMessage);
      reject(new Error('sfu_ws_timeout'));
    }, timeoutMs);

    function onMessage(event) {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (predicate(msg)) {
        clearTimeout(timer);
        ws.removeEventListener('message', onMessage);
        resolve(msg);
      }
    }
    ws.addEventListener('message', onMessage);
  });
}

function send(ws, payload) {
  ws.send(JSON.stringify(payload));
}

export class SfuSession {
  constructor({ wsUrl, roomId, joinToken, peerId, onRemoteTrack } = {}) {
    this.wsUrl = wsUrl;
    this.roomId = roomId;
    this.joinToken = joinToken;
    this.peerId = peerId || `ssc-${Math.random().toString(36).slice(2, 10)}`;
    this.onRemoteTrack = onRemoteTrack;
    this.ws = null;
    this.device = null;
    this.sendTransport = null;
    this.recvTransport = null;
    this.rtpCapabilities = null;
    this.connected = false;
    this.remoteConsumers = new Map();
  }

  async connect() {
    if (!this.wsUrl || !this.roomId || !this.joinToken) {
      throw new Error('sfu_missing_params');
    }

    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = () => reject(new Error('sfu_ws_failed'));
    });

    send(this.ws, {
      action: 'join',
      roomId: this.roomId,
      joinToken: this.joinToken,
      peerId: this.peerId,
    });

    const joined = await waitForMessage(this.ws, (m) => m.action === 'joined');
    this.rtpCapabilities = joined.rtpCapabilities;
    this.device = new mediasoupClient.Device();
    await this.device.load({ routerRtpCapabilities: this.rtpCapabilities });
    this.connected = true;

    this.ws.addEventListener('message', (event) => {
      let msg;
      try {
        msg = JSON.parse(event.data);
      } catch {
        return;
      }
      if (msg.action === 'newProducer') {
        this._onNewProducer(msg);
      }
    });

    return this;
  }

  async _createTransport(direction) {
    send(this.ws, { action: 'createWebRtcTransport', direction });
    const created = await waitForMessage(
      this.ws,
      (m) => m.action === 'webRtcTransportCreated' && m.direction === direction
    );

    const iceServers = await fetchIceServers();
    const transportOptions = {
      id: created.id,
      iceParameters: created.iceParameters,
      iceCandidates: created.iceCandidates,
      dtlsParameters: created.dtlsParameters,
      iceServers,
    };

    const transport =
      direction === 'send'
        ? this.device.createSendTransport(transportOptions)
        : this.device.createRecvTransport(transportOptions);

    transport.on('connect', ({ dtlsParameters }, callback, errback) => {
      send(this.ws, {
        action: 'connectWebRtcTransport',
        transportId: transport.id,
        dtlsParameters,
      });
      waitForMessage(
        this.ws,
        (m) => m.action === 'webRtcTransportConnected' && m.transportId === transport.id
      )
        .then(() => callback())
        .catch((e) => errback(e));
    });

    if (direction === 'send') {
      transport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
        send(this.ws, {
          action: 'produce',
          transportId: transport.id,
          kind,
          rtpParameters,
        });
        waitForMessage(this.ws, (m) => m.action === 'produced')
          .then((m) => callback({ id: m.id }))
          .catch((e) => errback(e));
      });
    }

    return transport;
  }

  async publishLocalStream(stream) {
    if (!this.sendTransport) {
      this.sendTransport = await this._createTransport('send');
    }
    const tracks = stream.getTracks();
    const producers = [];
    for (const track of tracks) {
      const producer = await this.sendTransport.produce({ track });
      producers.push(producer);
    }
    return producers;
  }

  async _onNewProducer({ producerId, kind }) {
    if (!this.recvTransport) {
      this.recvTransport = await this._createTransport('recv');
    }
    send(this.ws, {
      action: 'consume',
      transportId: this.recvTransport.id,
      producerId,
      rtpCapabilities: this.device.rtpCapabilities,
    });
    const consumed = await waitForMessage(this.ws, (m) => m.action === 'consumed' && m.producerId === producerId);
    const consumer = await this.recvTransport.consume({
      id: consumed.id,
      producerId,
      kind: consumed.kind,
      rtpParameters: consumed.rtpParameters,
    });
    send(this.ws, { action: 'resumeConsumer', consumerId: consumer.id });
    await waitForMessage(
      this.ws,
      (m) => m.action === 'consumerResumed' && m.consumerId === consumer.id
    );
    this.remoteConsumers.set(consumer.id, consumer);
    if (this.onRemoteTrack && consumer.track) {
      this.onRemoteTrack({
        producerId,
        kind: consumed.kind,
        track: consumer.track,
        consumerId: consumer.id,
      });
    }
    return consumer;
  }

  close() {
    this.connected = false;
    if (this.sendTransport) this.sendTransport.close();
    if (this.recvTransport) this.recvTransport.close();
    if (this.ws) this.ws.close();
  }
}

export async function connectSfuSession(opts = {}) {
  const session = new SfuSession(opts);
  await session.connect();
  return session;
}