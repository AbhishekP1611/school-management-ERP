'use client';

import { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { isTokenExpired, API_BASE } from './api';
import { showError } from './alert';

const AuthContext = createContext(null);

// Seconds (unix) at which the token hard-expires — the login+8h cap.
function tokenExpiryMs(token) {
  try {
    const p = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return p?.exp ? p.exp * 1000 : 0;
  } catch { return 0; }
}

export function AuthProvider({ children }) {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const expiryTimer = useRef(null);

  // Load user from localStorage on mount (client-only)
  useEffect(() => {
    try {
      const token = localStorage.getItem('token');
      const stored = localStorage.getItem('user');
      if (token && stored && !isTokenExpired(token)) {
        setUser(JSON.parse(stored));
      } else {
        localStorage.clear();
      }
    } catch {
      localStorage.clear();
    }
    setReady(true);
  }, []);

  const login = useCallback((userData) => {
    localStorage.setItem('token', userData.token);
    localStorage.setItem('user', JSON.stringify(userData));
    // Multi-unit: ALWAYS clear the previous session's unit keys first so a
    // different user on the same browser can never inherit a stale active unit.
    localStorage.removeItem('active_unit');
    localStorage.removeItem('user_units');
    // The active unit drives the whole app's scoping. Set it whenever the login
    // response carries it (including single-unit users, so the X-Unit-Id header
    // always goes out).
    if (userData.activeUnitId != null) localStorage.setItem('active_unit', String(userData.activeUnitId));
    if (Array.isArray(userData.units)) localStorage.setItem('user_units', JSON.stringify(userData.units));
    setUser(userData);
  }, []);

  const logout = useCallback((opts = {}) => {
    if (expiryTimer.current) { clearTimeout(expiryTimer.current); expiryTimer.current = null; }
    // Tell the server to close the session (best-effort, don't block logout).
    try {
      const token = localStorage.getItem('token');
      if (token) {
        fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          keepalive: true,
        }).catch(() => {});
      }
    } catch {}
    localStorage.clear();
    setUser(null);
    if (opts.expired) {
      showError('Your 8-hour session has ended. Please sign in again.');
    }
    router.push('/login');
  }, [router]);

  // Auto-logout exactly at the token's expiry (login + 8h), even if the user
  // is idle and makes no requests. Re-armed whenever the user/token changes.
  useEffect(() => {
    if (expiryTimer.current) { clearTimeout(expiryTimer.current); expiryTimer.current = null; }
    if (!user) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    const msLeft = tokenExpiryMs(token) - Date.now();
    if (msLeft <= 0) { logout({ expired: true }); return; }
    // setTimeout caps at ~24.8 days; our window is 8h so it's safe.
    expiryTimer.current = setTimeout(() => logout({ expired: true }), msLeft);
    return () => { if (expiryTimer.current) clearTimeout(expiryTimer.current); };
  }, [user, logout]);

  return (
    <AuthContext.Provider value={{ user, login, logout, ready }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
