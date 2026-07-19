# SSC mediasoup SFU — requires UDP 40000-49999 (use GCE, not Cloud Run)
FROM node:20-bookworm-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    build-essential \
    pkg-config \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
# All runtime JS modules (internalAuth + devHttp required by server.js)
COPY server.js roomManager.js wsHandler.js internalAuth.js devHttp.js ./

ENV SFU_PORT=4443
# Behind Caddy TLS terminator on the host; allow plain HTTP on :4443
ENV SFU_ALLOW_HTTP=1
EXPOSE 4443
EXPOSE 40000-49999/udp

CMD ["node", "server.js"]
