import {
  clearNativeBackHandler,
  runNativeBackHandler,
  setNativeBackHandler,
} from '../nativeBack';

describe('nativeBack', () => {
  afterEach(() => {
    clearNativeBackHandler();
  });

  it('runs registered handler', () => {
    const fn = jest.fn();
    setNativeBackHandler(fn);
    expect(runNativeBackHandler()).toBe(true);
    expect(fn).toHaveBeenCalled();
  });

  it('returns false when no handler', () => {
    expect(runNativeBackHandler()).toBe(false);
  });
});