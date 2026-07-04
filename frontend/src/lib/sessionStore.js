/**
 * Token storage — Engine 3 only. Engine 5 moves auth to httpOnly cookies.
 */

const TOKEN_KEY = 'ssc_access_token';

export function getAccessToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function setAccessToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export function clearAccessToken() {
  setAccessToken('');
}