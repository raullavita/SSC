/**
 * mediasoup WebSocket signaling — Engine 11
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
        ws.send(JSON.stringify({ action: 'error', error: 'invalid_json' }));
        return;
      }

      try {
        await handleMessage(ws, msg, ctx, roomManager);
      } catch (err) {
        ws.send(JSON.stringify({ action: 'error', error: err.message || 'handler_failed' }));
      }
    });
  });

  return wss;
}

async function handleMessage(ws, msg, ctx, roomManager) {
  const action = msg.action;

  if (action === 'join') {
    const { roomId, joinToken, peerId } = msg;
    const check = roomManager.validateJoin(roomId, joinToken);
    if (!check.ok) {
      ws.send(JSON.stringify({ action: 'error', error: check.reason }));
      return;
    }
    ctx.roomId = roomId;
    ctx.peerId = peerId || `peer-${Date.now()}`;
    ctx.room = check.room;
    ctx.peer = roomManager.addPeer(roomId, ctx.peerId);
    ctx.peer.ws = ws;
    ws.on('close', () => {
      if (ctx.room?.peers) ctx.room.peers.delete(ctx.peerId);
    });
    ws.send(
      JSON.stringify({
        action: 'joined',
        peerId: ctx.peerId,
        rtpCapabilities: ctx.room.router.rtpCapabilities,
      })
    );
    return;
  }

  if (!ctx.room || !ctx.peer) {
    ws.send(JSON.stringify({ action: 'error', error: 'not_joined' }));
    return;
  }

  switch (action) {
    case 'getRouterRtpCapabilities': {
      ws.send(
        JSON.stringify({
          action: 'routerRtpCapabilities',
          rtpCapabilities: ctx.room.router.rtpCapabilities,
        })
      );
      break;
    }

    case 'createWebRtcTransport': {
      const { direction } = msg;
      const transport = await ctx.room.router.createWebRtcTransport({
        listenIps: [{ ip: '0.0.0.0', announcedIp: process.env.SFU_ANNOUNCED_IP || undefined }],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
      });
      ctx.peer.transports.set(transport.id, transport);
      transport.on('dtlsstatechange', (state) => {
        if (state === 'closed') transport.close();
      });
      ws.send(
        JSON.stringify({
          action: 'webRtcTransportCreated',
          direction,
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        })
      );
      break;
    }

    case 'connectWebRtcTransport': {
      const transport = ctx.peer.transports.get(msg.transportId);
      if (!transport) throw new Error('transport_not_found');
      await transport.connect({ dtlsParameters: msg.dtlsParameters });
      ws.send(JSON.stringify({ action: 'webRtcTransportConnected', transportId: msg.transportId }));
      break;
    }

    case 'produce': {
      const transport = ctx.peer.transports.get(msg.transportId);
      if (!transport) throw new Error('transport_not_found');
      const producer = await transport.produce({
        kind: msg.kind,
        rtpParameters: msg.rtpParameters,
      });
      ctx.peer.producers.set(producer.id, producer);
      ws.send(JSON.stringify({ action: 'produced', id: producer.id }));
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
      if (!ctx.room.router.canConsume({ producerId: msg.producerId, rtpCapabilities: msg.rtpCapabilities })) {
        throw new Error('cannot_consume');
      }
      const consumer = await transport.consume({
        producerId: msg.producerId,
        rtpCapabilities: msg.rtpCapabilities,
        paused: true,
      });
      ctx.peer.consumers.set(consumer.id, consumer);
      ws.send(
        JSON.stringify({
          action: 'consumed',
          id: consumer.id,
          producerId: msg.producerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
        })
      );
      break;
    }

    case 'resumeConsumer': {
      const consumer = ctx.peer.consumers.get(msg.consumerId);
      if (!consumer) throw new Error('consumer_not_found');
      await consumer.resume();
      ws.send(JSON.stringify({ action: 'consumerResumed', consumerId: msg.consumerId }));
      break;
    }

    default:
      ws.send(JSON.stringify({ action: 'error', error: `unknown_action:${action}` }));
  }
}

function broadcast(room, fromPeerId, payload) {
  for (const [peerId, peer] of room.peers) {
    if (peerId === fromPeerId) continue;
    if (peer.ws && peer.ws.readyState === 1) {
      peer.ws.send(JSON.stringify(payload));
    }
  }
}

module.exports = { attachWebSocket };