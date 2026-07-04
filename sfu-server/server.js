/**
 * SSC mediasoup SFU scaffold — Engine 10
 * @see https://github.com/versatica/mediasoup
 *
 * Full signaling auth wiring lands when SSC_SFU_ENABLED=true in production.
 */

const http = require('http');
const mediasoup = require('mediasoup');

const PORT = Number(process.env.SFU_PORT || 4443);
const WS_PATH = process.env.SFU_WS_PATH || '/';

let worker;

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

const server = http.createServer((req, res) => {
  if (req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', provider: 'mediasoup', engine: 10 }));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('SSC SFU scaffold — connect via mediasoup-client in installed app\n');
});

async function main() {
  await createWorker();
  server.listen(PORT, () => {
    console.log(`SSC SFU scaffold listening on :${PORT} (ws path ${WS_PATH})`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});