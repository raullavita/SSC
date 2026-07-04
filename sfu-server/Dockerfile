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
COPY server.js roomManager.js wsHandler.js ./

ENV SFU_PORT=4443
EXPOSE 4443
EXPOSE 40000-49999/udp

CMD ["node", "server.js"]