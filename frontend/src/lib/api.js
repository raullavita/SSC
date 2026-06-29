import axios from 'axios';
import { getBackendUrl, isInstalledClient, isNativeApp } from './platform';
import { getSessionToken } from './sessionStore';

const BACKEND_URL = getBackendUrl();
export const API = `${BACKEND_URL}/api`;
export const WS_URL = BACKEND_URL.replace(/^https?/, (m) => (m === 'https' ? 'wss' : 'ws')) + '/api/ws';

export const api = axios.create({
  baseURL: API,
  withCredentials: false,
});

api.interceptors.request.use((config) => {
  if (isInstalledClient()) {
    config.headers['X-SSC-Client'] = 'installed';
  }
  if (config.skipAuth) {
    delete config.headers.Authorization;
    return config;
  }
  const token = getSessionToken();
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