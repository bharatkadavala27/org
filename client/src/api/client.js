import axios from 'axios';

const baseURL = import.meta.env.VITE_API_URL;
if (!baseURL) {
  // Fail loudly in dev so we never accidentally use relative /api (breaks the APK).
  // eslint-disable-next-line no-console
  console.error('VITE_API_URL is not set. Set it in client/.env');
}

export const api = axios.create({
  baseURL,
  timeout: 60000, // Render free tier cold start can be ~50s
});

// In-memory token; mirrored to a module variable set by AuthContext.
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
    // Normalize a human-readable message for the UI.
    const message =
      err.response?.data?.message ||
      (err.code === 'ECONNABORTED'
        ? 'The server took too long to respond. It may be waking up — please retry.'
        : err.message) ||
      'Network error';
    return Promise.reject(new Error(message));
  }
);
