export class Device {
  async load() {
    return undefined;
  }

  get rtpCapabilities() {
    return {};
  }

  createSendTransport() {
    return {
      on: () => {},
      produce: async () => ({ close: () => {}, replaceTrack: async () => {} }),
      close: () => {},
    };
  }

  createRecvTransport() {
    return {
      on: () => {},
      consume: async () => ({ track: {}, close: () => {} }),
      close: () => {},
    };
  }
}