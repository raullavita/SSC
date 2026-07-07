/**
 * Dev-only plain HTTP listener — production uses TLS via createAppServer().
 */
const http = require('http');

function createDevServer(handler) {
  return http.createServer(handler);
}

module.exports = { createDevServer };