import { icePathLabel } from '../callIceDiagnostics';

describe('callIceDiagnostics', () => {
  it('labels relay path when either side uses TURN', () => {
    expect(icePathLabel({
      localType: 'relay',
      remoteType: 'srflx',
      usesRelay: true,
    })).toBe('relay');
  });

  it('labels direct LAN path', () => {
    expect(icePathLabel({
      localType: 'host',
      remoteType: 'host',
      usesRelay: false,
    })).toBe('direct');
  });

  it('labels STUN reflexive path', () => {
    expect(icePathLabel({
      localType: 'srflx',
      remoteType: 'host',
      usesRelay: false,
    })).toBe('stun');
  });
});