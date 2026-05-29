import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api, setAuthToken, setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);
const STORAGE_KEY = 'samuh_auth';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [ready, setReady] = useState(false);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    setAuthToken(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }, []);

  // Restore session on load + validate token via /me.
  useEffect(() => {
    setUnauthorizedHandler(() => logout());
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    } catch {
      saved = null;
    }
    if (saved?.token) {
      setAuthToken(saved.token);
      setToken(saved.token);
      api
        .get('/api/auth/me')
        .then((res) => setUser(res.data.user))
        .catch(() => logout())
        .finally(() => setReady(true));
    } else {
      setReady(true);
    }
  }, [logout]);

  const login = useCallback(async (loginId, password) => {
    const res = await api.post('/api/auth/login', { login: loginId, password });
    const { token: tk, user: u } = res.data;
    setAuthToken(tk);
    setToken(tk);
    setUser(u);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: tk }));
    } catch {
      /* ignore */
    }
    return u;
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, ready, login, logout, isAdmin: user?.role === 'admin' }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
