/**
 * mediasoup WebSocket signaling — Engine 11 (live-hardened)
 *
 * Live fixes vs first cut:
 * - join returns existingProducers (late joiners hear/see current speakers)
 * - peer disconnect closes producers and notifies room (producerClosed)
 * - getProducers action for explicit refresh
 */

const WebSocket = require('ws');

function attachWebSocket(server, roomManager) {
  const wss = new WebSocket.Server({ server, path: process.env.SFU_WS_PATH || '/' });

  wss.on('connection', (ws) => {
    let ctx = { roomId: null, peerId: null, room: null, peer: null };

    ws.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        safeSend(ws, { action: 'error', error: 'invalid_json' });
        return;
      }

      try {
        await handleMessage(ws, msg, ctx, roomManager);
      } catch (err) {
        safeSend(ws, { action: 'error', error: err.message || 'handler_failed' });
      }
    });

    ws.on('close', () => {
      cleanupPeer(ctx, roomManager);
    });
  });

  return wss;
}

function cleanupPeer(ctx, roomManager) {
  if (!ctx.roomId || !ctx.peerId) return;
  const closed = roomManager.removePeer(ctx.roomId, ctx.peerId);
  const room = roomManager.getRoom(ctx.roomId);
  if (room && closed.length) {
    for (const producerId of closed) {
      broadcast(room, ctx.peerId, {
        action: 'producerClosed',
        peerId: ctx.peerId,
        producerId,
      });
    }
    broadcast(room, ctx.peerId, {
      action: 'peerLeft',
      peerId: ctx.peerId,
    });
  }
  ctx.room = null;
  ctx.peer = null;
  ctx.roomId = null;
  ctx.peerId = null;
}

async function handleMessage(ws, msg, ctx, roomManager) {
  const action = msg.action;

  if (action === 'join') {
    const { roomId, joinToken, peerId } = msg;
    const check = roomManager.validateJoin(roomId, joinToken);
    if (!check.ok) {
      safeSend(ws, { action: 'error', error: check.reason });
      return;
    }
    // Replace stale same peerId (reconnect)
    if (peerId && check.room.peers.has(peerId)) {
      roomManager.removePeer(roomId, peerId);
    }
    ctx.roomId = roomId;
    ctx.peerId = peerId || `peer-${Date.now()}`;
    ctx.room = check.room;
    ctx.peer = roomManager.addPeer(roomId, ctx.peerId);
    ctx.peer.ws = ws;

    const existingProducers = roomManager.listExistingProducers(roomId, ctx.peerId);
    safeSend(ws, {
      action: 'joined',
      peerId: ctx.peerId,
      rtpCapabilities: ctx.room.router.rtpCapabilities,
      existingProducers,
    });
    broadcast(ctx.room, ctx.peerId, {
      action: 'peerJoined',
      peerId: ctx.peerId,
    });
    return;
  }

  if (!ctx.room || !ctx.peer) {
    safeSend(ws, { action: 'error', error: 'not_joined' });
    return;
  }

  switch (action) {
    case 'getRouterRtpCapabilities': {
      safeSend(ws, {
        action: 'routerRtpCapabilities',
        rtpCapabilities: ctx.room.router.rtpCapabilities,
      });
      break;
    }

    case 'getProducers': {
      safeSend(ws, {
        action: 'producers',
        producers: roomManager.listExistingProducers(ctx.roomId, ctx.peerId),
      });
      break;
    }

    case 'createWebRtcTransport': {
      const { direction } = msg;
      const announcedIp = process.env.SFU_ANNOUNCED_IP || undefined;
      const transport = await ctx.room.router.createWebRtcTransport({
        listenIps: [{ ip: '0.0.0.0', announcedIp }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate: 1_000_000,
      });
      ctx.peer.transports.set(transport.id, transport);
      transport.on('dtlsstatechange', (state) => {
        if (state === 'closed' || state === 'failed') {
          try {
            transport.close();
          } catch {
            /* ignore */
          }
        }
      });
      transport.on('icestatechange', (state) => {
        if (state === 'disconnected' || state === 'closed') {
          // keep open briefly; client may reconnect
        }
      });
      safeSend(ws, {
        action: 'webRtcTransportCreated',
        direction,
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });
      break;
    }

    case 'connectWebRtcTransport': {
      const transport = ctx.peer.transports.get(msg.transportId);
      if (!transport) throw new Error('transport_not_found');
      await transport.connect({ dtlsParameters: msg.dtlsParameters });
      safeSend(ws, {
        action: 'webRtcTransportConnected',
        transportId: msg.transportId,
      });
      break;
    }

    case 'produce': {
      const transport = ctx.peer.transports.get(msg.transportId);
      if (!transport) throw new Error('transport_not_found');
      if (!msg.kind || !msg.rtpParameters) throw new Error('produce_missing_params');
      const producer = await transport.produce({
        kind: msg.kind,
        rtpParameters: msg.rtpParameters,
        appData: { peerId: ctx.peerId },
      });
      ctx.peer.producers.set(producer.id, producer);
      producer.on('transportclose', () => {
        ctx.peer.producers.delete(producer.id);
      });
      safeSend(ws, { action: 'produced', id: producer.id, kind: producer.kind });
      broadcast(ctx.room, ctx.peerId, {
        action: 'newProducer',
        peerId: ctx.peerId,
        producerId: producer.id,
        kind: producer.kind,
      });
      break;
    }

    case 'consume': {
      const transport = ctx.peer.transports.get(msg.transportId);
      if (!transport) throw new Error('transport_not_found');
      if (!msg.producerId || !msg.rtpCapabilities) throw new Error('consume_missing_params');
      if (
        !ctx.room.router.canConsume({
          producerId: msg.producerId,
          rtpCapabilities: msg.rtpCapabilities,
        })
      ) {
        throw new Error('cannot_consume');
      }
      const consumer = await transport.consume({
        producerId: msg.producerId,
        rtpCapabilities: msg.rtpCapabilities,
        paused: true,
      });
      ctx.peer.consumers.set(consumer.id, consumer);
      consumer.on('transportclose', () => {
        ctx.peer.consumers.delete(consumer.id);
      });
      consumer.on('producerclose', () => {
        ctx.peer.consumers.delete(consumer.id);
        safeSend(ws, {
          action: 'producerClosed',
          producerId: msg.producerId,
          consumerId: consumer.id,
        });
      });
      safeSend(ws, {
        action: 'consumed',
        id: consumer.id,
        producerId: msg.producerId,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        producerPaused: consumer.producerPaused,
      });
      break;
    }

    case 'resumeConsumer': {
      const consumer = ctx.peer.consumers.get(msg.consumerId);
      if (!consumer) throw new Error('consumer_not_found');
      await consumer.resume();
      safeSend(ws, { action: 'consumerResumed', consumerId: msg.consumerId });
      break;
    }

    case 'closeProducer': {
      const producer = ctx.peer.producers.get(msg.producerId);
      if (!producer) throw new Error('producer_not_found');
      producer.close();
      ctx.peer.producers.delete(msg.producerId);
      broadcast(ctx.room, ctx.peerId, {
        action: 'producerClosed',
        peerId: ctx.peerId,
        producerId: msg.producerId,
      });
      safeSend(ws, { action: 'producerClosed', producerId: msg.producerId });
      break;
    }

    default:
      safeSend(ws, { action: 'error', error: `unknown_action:${action}` });
  }
}

function broadcast(room, fromPeerId, payload) {
  for (const [peerId, peer] of room.peers) {
    if (peerId === fromPeerId) continue;
    if (peer.ws && peer.ws.readyState === WebSocket.OPEN) {
      safeSend(peer.ws, payload);
    }
  }
}

function safeSend(ws, payload) {
  if (!ws || ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    /* ignore */
  }
}

module.exports = { attachWebSocket };
