import axios from 'axios';
import { getBackendUrl, isNativeApp } from './platform';

const BACKEND_URL = getBackendUrl();
export const API = `${BACKEND_URL}/api`;
export const WS_URL = BACKEND_URL.replace(/^https?/, (m) => (m === 'https' ? 'wss' : 'ws')) + '/api/ws';

export const api = axios.create({
  baseURL: API,
  // Capacitor WebView uses http://localhost — skip cookies; JWT is in Authorization header
  withCredentials: !isNativeApp(),
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('ssc_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      // do not auto-redirect; let pages decide
    }
    return Promise.reject(err);
  },
);