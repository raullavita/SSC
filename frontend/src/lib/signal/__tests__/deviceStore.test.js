import { clearLocalDeviceId, getLocalDeviceId, setLocalDeviceId } from '../deviceStore';

describe('deviceStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to device 1', () => {
    expect(getLocalDeviceId()).toBe(1);
  });

  it('persists valid device id', () => {
    setLocalDeviceId(3);
    expect(getLocalDeviceId()).toBe(3);
    clearLocalDeviceId();
    expect(getLocalDeviceId()).toBe(1);
  });
});