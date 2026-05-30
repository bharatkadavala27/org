import axios from 'axios';

// Same-origin deploy (backend serves the client): default to relative ''.
// Set VITE_API_URL only when the API is on a different origin (e.g. APK, split hosting).
const baseURL = import.meta.env.VITE_API_URL || '';

export const api = axios.create({
  baseURL,
  timeout: 60000, // Render free tier cold start can be ~50s
});

let authToken = null;
let onUnauthorized = null;

export function setAuthToken(token) {
  authToken = token;
}
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

api.interceptors.request.use((config) => {
  if (authToken) config.headers.Authorization = `Bearer ${authToken}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    if (status === 401 && onUnauthorized) {
      onUnauthorized();
    }
    const message =
      err.response?.data?.message ||
      (err.code === 'ECONNABORTED'
        ? 'The server took too long to respond. It may be waking up — please retry.'
        : err.message) ||
      'Network error';
    return Promise.reject(new Error(message));
  }
);
