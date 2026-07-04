/**
 * SSC mediasoup SFU — Engine 11 full signaling
 * @see https://github.com/versatica/mediasoup
 */

const http = require('http');
const mediasoup = require('mediasoup');
const { RoomManager } = require('./roomManager');
const { attachWebSocket } = require('./wsHandler');

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

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function internalAuth(req) {
  const header = req.headers['x-ssc-sfu-secret'];
  return header === INTERNAL_SECRET;
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
    if (!internalAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    try {
      const body = await readJson(req);
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
    if (!internalAuth(req)) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'unauthorized' }));
      return;
    }
    const roomId = decodeURIComponent(req.url.split('/').pop());
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