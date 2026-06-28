import { computeChatLayoutMode } from '../use-mobile';

describe('computeChatLayoutMode', () => {
  const originalMatchMedia = window.matchMedia;

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  function mockLandscape(isLandscape) {
    window.matchMedia = jest.fn((query) => ({
      matches: query === '(orientation: landscape)' ? isLandscape : false,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    }));
  }

  it('uses split layout at desktop widths', () => {
    mockLandscape(false);
    expect(computeChatLayoutMode(1024)).toEqual({ split: true, narrow: false });
    expect(computeChatLayoutMode(768)).toEqual({ split: true, narrow: false });
  });

  it('uses split layout on tablet landscape', () => {
    mockLandscape(true);
    expect(computeChatLayoutMode(640)).toEqual({ split: true, narrow: false });
  });

  it('uses single-pane on phone portrait', () => {
    mockLandscape(false);
    expect(computeChatLayoutMode(390)).toEqual({ split: false, narrow: true });
  });

  it('uses single-pane on narrow landscape phones', () => {
    mockLandscape(true);
    expect(computeChatLayoutMode(480)).toEqual({ split: false, narrow: true });
  });
});