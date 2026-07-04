/**
 * mediasoup room lifecycle — Engine 11
 */

const mediaCodecs = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: { 'x-google-start-bitrate': 1000 },
  },
];

class RoomManager {
  constructor(worker) {
    this.worker = worker;
    this.rooms = new Map();
  }

  async createRoom(roomId, joinToken) {
    if (this.rooms.has(roomId)) {
      return this.rooms.get(roomId);
    }
    const router = await this.worker.createRouter({ mediaCodecs });
    const room = {
      roomId,
      joinToken,
      router,
      peers: new Map(),
      createdAt: Date.now(),
    };
    this.rooms.set(roomId, room);
    return room;
  }

  getRoom(roomId) {
    return this.rooms.get(roomId) || null;
  }

  validateJoin(roomId, joinToken) {
    const room = this.getRoom(roomId);
    if (!room) return { ok: false, reason: 'room_not_found' };
    if (room.joinToken !== joinToken) return { ok: false, reason: 'invalid_token' };
    return { ok: true, room };
  }

  addPeer(roomId, peerId) {
    const room = this.getRoom(roomId);
    if (!room) return null;
    if (!room.peers.has(peerId)) {
      room.peers.set(peerId, { transports: new Map(), producers: new Map(), consumers: new Map() });
    }
    return room.peers.get(peerId);
  }

  deleteRoom(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return false;
    room.router.close();
    this.rooms.delete(roomId);
    return true;
  }

  listRooms() {
    return [...this.rooms.keys()];
  }
}

module.exports = { RoomManager, mediaCodecs };