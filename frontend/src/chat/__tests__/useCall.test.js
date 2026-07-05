import { renderHook, act } from '@testing-library/react';
import { useCall } from '../useCall';

jest.mock('../../lib/api', () => ({
  api: {
    post: jest.fn(),
    get: jest.fn(),
  },
}));

jest.mock('../../calls/iceServers', () => ({
  fetchIceServers: jest.fn().mockResolvedValue([{ urls: 'stun:stun.test' }]),
}));

jest.mock('../../signal/signalBridge', () => ({
  encryptMessage: jest.fn().mockResolvedValue({ ciphertext: 'cipher', protocol: 'signal_v1' }),
  decryptMessage: jest.fn().mockResolvedValue('{"sdp":{}}'),
}));

const mockStream = {
  getTracks: () => [{ stop: jest.fn() }],
  getAudioTracks: () => [{ enabled: true }],
};

jest.mock('../callMedia', () => ({
  acquireCallMedia: jest.fn(() => Promise.resolve(mockStream)),
  callErrorMessage: jest.fn((code) => code),
}));

jest.mock('../../hooks/useUserSocket', () => ({
  useUserSocket: jest.fn(),
}));

const { api } = require('../../lib/api');
const { acquireCallMedia } = require('../callMedia');

class MockPeerConnection {
  constructor() {
    this.localDescription = null;
    this.remoteDescription = null;
    this.connectionState = 'new';
    this.onicecandidate = null;
    this.ontrack = null;
    this.onconnectionstatechange = null;
  }

  addTrack() {}

  async createOffer() {
    return { type: 'offer', sdp: 'v=0', toJSON: () => ({ type: 'offer', sdp: 'v=0' }) };
  }

  async setLocalDescription(sdp) {
    this.localDescription = sdp;
  }

  async setRemoteDescription(sdp) {
    this.remoteDescription = sdp;
  }

  async createAnswer() {
    return { type: 'answer', sdp: 'v=0', toJSON: () => ({ type: 'answer', sdp: 'v=0' }) };
  }

  async addIceCandidate() {}

  close() {}
}

beforeAll(() => {
  global.RTCPeerConnection = MockPeerConnection;
  window.RTCPeerConnection = MockPeerConnection;
});

beforeEach(() => {
  jest.clearAllMocks();
  api.post.mockImplementation((path) => {
    if (path === '/api/calls') {
      return Promise.resolve({ call: { id: 'call_1', video: false } });
    }
    if (path.endsWith('/end')) {
      return Promise.resolve({ ok: true });
    }
    return Promise.resolve({ ok: true });
  });
});

describe('useCall', () => {
  test('startCall creates call session and acquires media', async () => {
    const { result } = renderHook(() =>
      useCall({
        conversationId: 'c_1',
        peerId: 'u_peer',
        userId: 'u_me',
        enabled: true,
        wsToken: 'tok',
      })
    );

    await act(async () => {
      await result.current.startCall(false);
    });

    expect(api.post).toHaveBeenCalledWith(
      '/api/calls',
      expect.objectContaining({ conversation_id: 'c_1', callee_id: 'u_peer' })
    );
    expect(acquireCallMedia).toHaveBeenCalledWith(false);
    expect(result.current.callOpen).toBe(true);
    expect(result.current.status).not.toBe('idle');
    if (result.current.status === 'failed') {
      expect(result.current.errorCode).toBeTruthy();
    } else {
      expect(['ringing', 'connecting', 'connected']).toContain(result.current.status);
    }
  });

  test('startCall handles permission errors', async () => {
    acquireCallMedia.mockRejectedValueOnce(Object.assign(new Error('permission_denied'), { message: 'permission_denied' }));

    const { result } = renderHook(() =>
      useCall({
        conversationId: 'c_1',
        peerId: 'u_peer',
        userId: 'u_me',
        enabled: true,
        wsToken: 'tok',
      })
    );

    await act(async () => {
      await result.current.startCall(true);
    });

    expect(result.current.status).toBe('failed');
    expect(result.current.errorCode).toBe('permission_denied');
  });
});