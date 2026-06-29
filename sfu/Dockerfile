FROM node:20-bookworm-slim

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY config.js jwt.js Room.js server.js ./

ENV SFU_PORT=4443
EXPOSE 4443
EXPOSE 40000-49999/udp
EXPOSE 40000-49999/tcp

CMD ["node", "server.js"]