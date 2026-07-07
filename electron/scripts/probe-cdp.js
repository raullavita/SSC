const http = require('http');
const WebSocket = require('ws');

http.get('http://127.0.0.1:9222/json/list', (res) => { // nosemgrep: problem-based-packs.insecure-transport.js-node.http-request.http-request
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  res.on('end', () => {
    const targets = JSON.parse(data);
    const page = targets.find((t) => t.type === 'page');
    if (!page) {
      console.log('NO_PAGE_TARGET');
      process.exit(1);
    }

    const ws = new WebSocket(page.webSocketDebuggerUrl);
    let id = 0;
    const pending = new Map();

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    });

    ws.on('open', async () => {
      const send = (method, params = {}) =>
        new Promise((resolve) => {
          const myId = ++id;
          pending.set(myId, resolve);
          ws.send(JSON.stringify({ id: myId, method, params }));
        });

      await send('Runtime.enable');
      const evalRes = await send('Runtime.evaluate', {
        expression:
          'JSON.stringify({text: document.body.innerText, url: location.href, title: document.title})',
        returnByValue: true,
      });
      const payload = evalRes.result?.result?.value || evalRes.result?.value;
      console.log(payload || JSON.stringify(evalRes, null, 2));
      ws.close();
      process.exit(0);
    });
  });
}).on('error', (err) => {
  console.error('ERR', err.message);
  process.exit(1);
});