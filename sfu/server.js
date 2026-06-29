'use strict';

const http = require('http');
const mediasoup = require('mediasoup');
const { WebSocketServer } = require('ws');
const { listenPort, workerSettings } = require('./config');
const { Room } = require('./Room');
const { verifySfuToken } = require('./jwt');

const rooms = new Map();
let worker = null;

async function getWorker() {
  if (!worker) {
    worker = await mediasoup.createWorker(workerSettings());
    worker.on('died', () => {
      console.error('[ssc-sfu] mediasoup worker died — exiting');
      process.exit(1);
    });
  }
  return worker;
}

async function getOrCreateRoom(roomId) {
  let room = rooms.get(roomId);
  if (!room) {
    room = new Room({ roomId, worker: await getWorker() });
    rooms.set(roomId, room);
  }
  await room.ready();
  return room;
}

function send(socket, payload) {
  if (socket.readyState === 1) socket.send(JSON.stringify(payload));
}

function sendError(socket, id, message) {
  send(socket, { id, ok: false, error: message });
}

async function handleRequest(socket, peerCtx, msg) {
  const { id, method, data = {} } = msg;
  try {
    let result;
    switch (method) {
      case 'getRouterRtpCapabilities': {
        if (!data.roomId) throw new Error('ROOM_ID_REQUIRED');
        const room = await getOrCreateRoom(data.roomId);
        result = { rtpCapabilities: room.getRtpCapabilities() };
        break;
      }
      case 'join': {
        verifySfuToken(data.token, { roomId: data.roomId, userId: data.userId });
        peerCtx.roomId = data.roomId;
        peerCtx.userId = data.userId;
        peerCtx.username = data.username || data.userId;
        const room = await getOrCreateRoom(data.roomId);
        await room.addPeer({
          peerId: data.userId,
          username: peerCtx.username,
          socket,
        });
        result = {
          peers: room.listPeers(data.userId),
          producers: room.listProducers(data.userId),
        };
        break;
      }
      case 'createWebRtcTransport':
        result = await (await getOrCreateRoom(peerCtx.roomId))
          .createWebRtcTransport(peerCtx.userId, { producing: !!data.producing });
        break;
      case 'connectWebRtcTransport':
        await (await getOrCreateRoom(peerCtx.roomId)).connectTransport(peerCtx.userId, data);
        result = {};
        break;
      case 'produce':
        result = await (await getOrCreateRoom(peerCtx.roomId)).produce(peerCtx.userId, data);
        break;
      case 'consume':
        result = await (await getOrCreateRoom(peerCtx.roomId)).consume(peerCtx.userId, data);
        break;
      case 'resumeConsumer':
        await (await getOrCreateRoom(peerCtx.roomId)).resumeConsumer(peerCtx.userId, data);
        result = {};
        break;
      default:
        throw new Error(`UNKNOWN_METHOD:${method}`);
    }
    send(socket, { id, ok: true, data: result });
  } catch (err) {
    sendError(socket, id, err?.message || String(err));
  }
}

function onPeerDisconnect(socket, peerCtx) {
  if (!peerCtx.roomId || !peerCtx.userId) return;
  const room = rooms.get(peerCtx.roomId);
  if (!room) return;
  room.removePeer(peerCtx.userId);
  if (room.peers.size === 0) {
    room.close();
    rooms.delete(peerCtx.roomId);
  }
}

async function main() {
  await getWorker();
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, service: 'ssc-sfu', stack: 'mediasoup' }));
      return;
    }
    res.writeHead(404);
    res.end();
  });

  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (socket) => {
    const peerCtx = { roomId: null, userId: null, username: null };
    socket.on('message', async (raw) => {
      let msg;
      try {
        msg = JSON.parse(String(raw));
      } catch {
        return;
      }
      if (msg.request) {
        await handleRequest(socket, peerCtx, msg);
      }
    });
    socket.on('close', () => onPeerDisconnect(socket, peerCtx));
  });

  server.listen(listenPort, () => {
    console.log(`[ssc-sfu] listening on :${listenPort} (ws path /ws)`);
  });
}

main().catch((err) => {
  console.error('[ssc-sfu] fatal:', err);
  process.exit(1);
});