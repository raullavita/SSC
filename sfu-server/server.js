/**
 * SSC mediasoup SFU — Engine 11 full signaling
 * @see https://github.com/versatica/mediasoup
 */

const http = require('http');
const mediasoup = require('mediasoup');
const { RoomManager } = require('./roomManager');
const { attachWebSocket } = require('./wsHandler');
const { verifyInternalAuth } = require('./internalAuth');

const PORT = Number(process.env.SFU_PORT || 4443);
const INTERNAL_SECRET = process.env.SFU_INTERNAL_SECRET || 'ssc-sfu-dev-secret';

let worker;
let roomManager;

async function createWorker() {
  worker = await mediasoup.createWorker({
    logLevel: 'warn',
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
  });
  worker.on('died', () => {
    console.error('mediasoup worker died — exiting');
    process.exit(1);
  });
  return worker;
}

function readBodyBuffer(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        status: 'ok',
        provider: 'mediasoup',
        engine: 11,
        rooms: roomManager ? roomManager.listRooms().length : 0,
      })
    );
    return;
  }

  if (req.method === 'POST' && req.url === '/internal/rooms') {
    const bodyBuf = await readBodyBuffer(req);
    if (!verifyInternalAuth(req, 'POST', '/internal/rooms', bodyBuf)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    try {
      const body = bodyBuf.length ? JSON.parse(bodyBuf.toString('utf8')) : {};
      const room = await roomManager.createRoom(body.room_id, body.join_token);
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, room_id: room.roomId }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.method === 'DELETE' && req.url?.startsWith('/internal/rooms/')) {
    const path = req.url.split('?')[0];
    if (!verifyInternalAuth(req, 'DELETE', path, Buffer.alloc(0))) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    const roomId = decodeURIComponent(path.split('/').pop());
    const deleted = roomManager.deleteRoom(roomId);
    res.writeHead(deleted ? 200 : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: deleted, room_id: roomId }));
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('SSC SFU — connect via WebSocket + mediasoup-client\n');
});

async function main() {
  await createWorker();
  roomManager = new RoomManager(worker);
  attachWebSocket(server, roomManager);
  server.listen(PORT, () => {
    console.log(`SSC SFU listening on :${PORT}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});