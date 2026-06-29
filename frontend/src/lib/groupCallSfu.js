/**
 * mediasoup SFU client — group calls 9+ (Q.35).
 * One upstream per participant; server forwards RTP (no mesh SDP fan-out).
 */
import { api } from './api';

export function wsUrlFromConfig(sfuUrl) {
  const raw = (sfuUrl || '').trim();
  if (!raw) throw new Error('SFU_URL_MISSING');
  if (raw.startsWith('ws://') || raw.startsWith('wss://')) {
    const base = raw.replace(/\/$/, '');
    return base.endsWith('/ws') ? base : `${base}/ws`;
  }
  throw new Error('SFU_URL_INVALID');
}

export class SfuSignalingSocket {
  constructor(url) {
    this.url = url;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
    this.onNotification = null;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.url);
      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error('SFU_WS_CONNECT_FAILED'));
      this.ws.onclose = () => {
        for (const { reject: rej } of this.pending.values()) {
          rej(new Error('SFU_WS_CLOSED'));
        }
        this.pending.clear();
      };
      this.ws.onmessage = (ev) => {
        let msg;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (msg.notification) {
          this.onNotification?.(msg.event, msg.data);
          return;
        }
        const waiter = this.pending.get(msg.id);
        if (!waiter) return;
        this.pending.delete(msg.id);
        if (msg.ok) waiter.resolve(msg.data);
        else waiter.reject(new Error(msg.error || 'SFU_REQUEST_FAILED'));
      };
    });
  }

  request(method, data = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ request: true, id, method, data }));
    });
  }

  close() {
    try { this.ws?.close(); } catch { /* noop */ }
    this.ws = null;
  }
}

export async function fetchSfuJoinCredentials(conversationId) {
  const { data } = await api.post('/calls/sfu-join', { conversation_id: conversationId });
  return data;
}

/**
 * Join an SFU room and publish local tracks; consume remote producers.
 * @returns {Promise<{ close: Function, replaceLocalStream: Function }>}
 */
export async function connectGroupCallSfu({
  conversationId,
  userId,
  username,
  localStream,
  videoEnabled,
  onRemoteTrack,
  onPeerLeft,
}) {
  const creds = await fetchSfuJoinCredentials(conversationId);
  const { Device } = await import('mediasoup-client');
  const socket = new SfuSignalingSocket(wsUrlFromConfig(creds.sfu_url));
  await socket.connect();

  const { rtpCapabilities } = await socket.request('getRouterRtpCapabilities', {
    roomId: creds.room_id,
  });
  const device = new Device();
  await device.load({ routerRtpCapabilities: rtpCapabilities });

  const join = await socket.request('join', {
    roomId: creds.room_id,
    userId,
    username,
    token: creds.token,
  });

  const sendTransportInfo = await socket.request('createWebRtcTransport', { producing: true });
  const sendTransport = device.createSendTransport({
    id: sendTransportInfo.id,
    iceParameters: sendTransportInfo.iceParameters,
    iceCandidates: sendTransportInfo.iceCandidates,
    dtlsParameters: sendTransportInfo.dtlsParameters,
  });
  sendTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
    socket.request('connectWebRtcTransport', {
      transportId: sendTransport.id,
      dtlsParameters,
    }).then(callback).catch(errback);
  });
  sendTransport.on('produce', ({ kind, rtpParameters }, callback, errback) => {
    socket.request('produce', {
      transportId: sendTransport.id,
      kind,
      rtpParameters,
    }).then(({ producerId }) => callback({ id: producerId })).catch(errback);
  });

  const recvTransportInfo = await socket.request('createWebRtcTransport', { producing: false });
  const recvTransport = device.createRecvTransport({
    id: recvTransportInfo.id,
    iceParameters: recvTransportInfo.iceParameters,
    iceCandidates: recvTransportInfo.iceCandidates,
    dtlsParameters: recvTransportInfo.dtlsParameters,
  });
  recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
    socket.request('connectWebRtcTransport', {
      transportId: recvTransport.id,
      dtlsParameters,
    }).then(callback).catch(errback);
  });

  const consumers = new Map();

  async function consumeProducer({ producerId, peerId, kind }) {
    if (consumers.has(producerId)) return;
    const data = await socket.request('consume', {
      transportId: recvTransport.id,
      producerId,
      rtpCapabilities: device.rtpCapabilities,
    });
    const consumer = await recvTransport.consume({
      id: data.consumerId,
      producerId: data.producerId,
      kind: data.kind,
      rtpParameters: data.rtpParameters,
    });
    consumers.set(producerId, consumer);
    await socket.request('resumeConsumer', { consumerId: consumer.id });
    const stream = new MediaStream();
    stream.addTrack(consumer.track);
    onRemoteTrack?.({ peerId, kind, stream, consumer });
  }

  socket.onNotification = (event, data) => {
    if (event === 'newProducer') {
      consumeProducer(data).catch((err) => {
        console.warn('[SSC] SFU consume failed:', err?.message || err);
      });
    } else if (event === 'peerClosed') {
      onPeerLeft?.(data.peerId);
    }
  };

  for (const producer of join.producers || []) {
    await consumeProducer(producer);
  }

  const producers = [];
  for (const track of localStream.getTracks()) {
    if (track.kind === 'video' && !videoEnabled) continue;
    // eslint-disable-next-line no-await-in-loop
    const producer = await sendTransport.produce({ track });
    producers.push(producer);
  }

  async function replaceLocalStream(nextStream) {
    for (const producer of producers) {
      const track = nextStream.getTracks().find((t) => t.kind === producer.track?.kind);
      if (track) await producer.replaceTrack({ track });
    }
  }

  function close() {
    for (const consumer of consumers.values()) {
      try { consumer.close(); } catch { /* noop */ }
    }
    for (const producer of producers) {
      try { producer.close(); } catch { /* noop */ }
    }
    try { sendTransport.close(); } catch { /* noop */ }
    try { recvTransport.close(); } catch { /* noop */ }
    socket.close();
  }

  return { close, replaceLocalStream };
}