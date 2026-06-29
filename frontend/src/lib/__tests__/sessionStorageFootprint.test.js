import { clearSessionStorageFootprint, SESSION_PENDING_KEYS } from '../sessionStorageFootprint';

describe('sessionStorageFootprint', () => {
  it('tracks pending call key only (invite links retired)', () => {
    expect(SESSION_PENDING_KEYS).toEqual(['ssc_pending_call', 'ssc_pending_reply']);
  });

  it('clears pending keys on logout', () => {
    sessionStorage.setItem('ssc_pending_call', '1');
    sessionStorage.setItem('other', 'keep');
    clearSessionStorageFootprint('logout');
    expect(sessionStorage.getItem('ssc_pending_call')).toBeNull();
    expect(sessionStorage.getItem('other')).toBe('keep');
  });

  it('clears all session storage on panic', () => {
    sessionStorage.setItem('ssc_pending_call', '1');
    sessionStorage.setItem('other', 'gone');
    clearSessionStorageFootprint('panic');
    expect(sessionStorage.length).toBe(0);
  });
});