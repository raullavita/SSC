'use strict';

const { mediaCodecs, webRtcTransportOptions } = require('./config');

class Peer {
  constructor({ id, username, socket }) {
    this.id = id;
    this.username = username;
    this.socket = socket;
    this.transports = new Map();
    this.producers = new Map();
    this.consumers = new Map();
  }

  close() {
    for (const consumer of this.consumers.values()) {
      try { consumer.close(); } catch { /* noop */ }
    }
    for (const producer of this.producers.values()) {
      try { producer.close(); } catch { /* noop */ }
    }
    for (const transport of this.transports.values()) {
      try { transport.close(); } catch { /* noop */ }
    }
    this.consumers.clear();
    this.producers.clear();
    this.transports.clear();
  }
}

class Room {
  constructor({ roomId, worker }) {
    this.roomId = roomId;
    this.worker = worker;
    this.router = null;
    this.peers = new Map();
    this._initPromise = this._initRouter();
  }

  async ready() {
    await this._initPromise;
  }

  async _initRouter() {
    this.router = await this.worker.createRouter({ mediaCodecs });
  }

  getRtpCapabilities() {
    return this.router.rtpCapabilities;
  }

  async addPeer({ peerId, username, socket }) {
    await this.ready();
    if (this.peers.has(peerId)) {
      this.removePeer(peerId);
    }
    const peer = new Peer({ id: peerId, username, socket });
    this.peers.set(peerId, peer);
    return peer;
  }

  removePeer(peerId) {
    const peer = this.peers.get(peerId);
    if (!peer) return;
    peer.close();
    this.peers.delete(peerId);
    for (const other of this.peers.values()) {
      this._notify(other.socket, 'peerClosed', { peerId });
    }
  }

  listPeers(exceptPeerId) {
    return [...this.peers.values()]
      .filter((p) => p.id !== exceptPeerId)
      .map((p) => ({ peerId: p.id, username: p.username }));
  }

  listProducers(exceptPeerId) {
    const out = [];
    for (const peer of this.peers.values()) {
      if (peer.id === exceptPeerId) continue;
      for (const producer of peer.producers.values()) {
        out.push({
          peerId: peer.id,
          producerId: producer.id,
          kind: producer.kind,
        });
      }
    }
    return out;
  }

  async createWebRtcTransport(peerId, { producing }) {
    await this.ready();
    const peer = this.peers.get(peerId);
    if (!peer) throw new Error('PEER_NOT_FOUND');
    const transport = await this.router.createWebRtcTransport(webRtcTransportOptions());
    transport.on('dtlsstatechange', (state) => {
      if (state === 'closed') {
        try { transport.close(); } catch { /* noop */ }
      }
    });
    peer.transports.set(transport.id, transport);
    return {
      id: transport.id,
      iceParameters: transport.iceParameters,
      iceCandidates: transport.iceCandidates,
      dtlsParameters: transport.dtlsParameters,
      producing,
    };
  }

  async connectTransport(peerId, { transportId, dtlsParameters }) {
    const peer = this.peers.get(peerId);
    if (!peer) throw new Error('PEER_NOT_FOUND');
    const transport = peer.transports.get(transportId);
    if (!transport) throw new Error('TRANSPORT_NOT_FOUND');
    await transport.connect({ dtlsParameters });
  }

  async produce(peerId, { transportId, kind, rtpParameters }) {
    const peer = this.peers.get(peerId);
    if (!peer) throw new Error('PEER_NOT_FOUND');
    const transport = peer.transports.get(transportId);
    if (!transport) throw new Error('TRANSPORT_NOT_FOUND');
    const producer = await transport.produce({ kind, rtpParameters });
    peer.producers.set(producer.id, producer);
    producer.on('transportclose', () => {
      peer.producers.delete(producer.id);
    });
    for (const other of this.peers.values()) {
      if (other.id === peerId) continue;
      this._notify(other.socket, 'newProducer', {
        peerId,
        producerId: producer.id,
        kind: producer.kind,
      });
    }
    return { producerId: producer.id };
  }

  async consume(peerId, { transportId, producerId, rtpCapabilities }) {
    await this.ready();
    const peer = this.peers.get(peerId);
    if (!peer) throw new Error('PEER_NOT_FOUND');
    if (!this.router.canConsume({ producerId, rtpCapabilities })) {
      throw new Error('CANNOT_CONSUME');
    }
    let producerPeer = null;
    for (const candidate of this.peers.values()) {
      if (candidate.producers.has(producerId)) {
        producerPeer = candidate;
        break;
      }
    }
    if (!producerPeer) throw new Error('PRODUCER_NOT_FOUND');
    const recvTransport = peer.transports.get(transportId);
    if (!recvTransport) throw new Error('RECV_TRANSPORT_NOT_FOUND');
    const consumer = await recvTransport.consume({
      producerId,
      rtpCapabilities,
      paused: true,
    });
    peer.consumers.set(consumer.id, consumer);
    consumer.on('transportclose', () => {
      peer.consumers.delete(consumer.id);
    });
    return {
      consumerId: consumer.id,
      producerId,
      peerId: producerPeer.id,
      kind: consumer.kind,
      rtpParameters: consumer.rtpParameters,
    };
  }

  async resumeConsumer(peerId, { consumerId }) {
    const peer = this.peers.get(peerId);
    if (!peer) throw new Error('PEER_NOT_FOUND');
    const consumer = peer.consumers.get(consumerId);
    if (!consumer) throw new Error('CONSUMER_NOT_FOUND');
    await consumer.resume();
  }

  _notify(socket, event, data) {
    if (!socket || socket.readyState !== 1) return;
    socket.send(JSON.stringify({ notification: true, event, data }));
  }

  close() {
    for (const peerId of [...this.peers.keys()]) {
      this.removePeer(peerId);
    }
    if (this.router) {
      try { this.router.close(); } catch { /* noop */ }
      this.router = null;
    }
  }
}

module.exports = { Room };