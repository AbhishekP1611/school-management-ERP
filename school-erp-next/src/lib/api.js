import axios from 'axios';
import { getSelectedYear } from './AcademicYearContext';

// A stable per-browser device id (persisted). Same browser = same device = same session
// (so multiple tabs don't trip the single-session gate); a different device conflicts.
export function getDeviceId() {
  if (typeof window === 'undefined') return null;
  try {
    let id = localStorage.getItem('device_id');
    if (!id) {
      id = 'dev-' + Math.random().toString(36).slice(2) + '-' + Date.now().toString(36);
      localStorage.setItem('device_id', id);
    }
    return id;
  } catch { return null; }
}

const API = axios.create({
  baseURL: 'http://localhost:5099/api',
  headers: { 'Content-Type': 'application/json' },
});

// Endpoints whose GET data is scoped by academic year. The selected year is
// auto-attached as ?year= so the whole ERP follows the topbar year picker.
// Excluded on purpose:
//  • /attendance — looked up by exact date, not academic year.
//  • /classes — MASTER DATA, not year-scoped (same classes across all years).
const YEAR_SCOPED = [
  '/students', '/fees', '/exams', '/results', '/dashboard',
];
function isYearScoped(url = '') {
  const path = url.split('?')[0];
  return YEAR_SCOPED.some((p) => path === p || path.startsWith(p + '/'));
}

// ── Decode JWT payload (no external lib) ─────────────────────────
function decodeToken(token) {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    return decoded;
  } catch {
    return null;
  }
}

// Is the token expired (or about to be, within 5s)?
export function isTokenExpired(token) {
  const data = decodeToken(token);
  if (!data || !data.exp) return true;
  const now = Math.floor(Date.now() / 1000);
  return data.exp < now + 5;
}

// Seconds left before the token expires (0 if invalid/expired).
function secondsLeft(token) {
  const data = decodeToken(token);
  if (!data || !data.exp) return 0;
  return data.exp - Math.floor(Date.now() / 1000);
}

function forceLogout() {
  if (typeof window === 'undefined') return;
  localStorage.clear();
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
}

// ── Silent token refresh ─────────────────────────────────────────
// When the token has < 15 min left, quietly fetch a new one so an active
// user is never kicked out mid-session. Guarded so it runs at most once.
let refreshing = null;
const REFRESH_THRESHOLD = 15 * 60; // 15 minutes

async function maybeRefresh(token) {
  if (secondsLeft(token) > REFRESH_THRESHOLD) return;
  if (refreshing) return refreshing;
  refreshing = axios
    .post('http://localhost:5099/api/auth/refresh', {}, { headers: { Authorization: `Bearer ${token}` } })
    .then((res) => {
      if (res.data?.token) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('user', JSON.stringify(res.data));
      }
    })
    .catch(() => { /* ignore; normal expiry handling still applies */ })
    .finally(() => { refreshing = null; });
  return refreshing;
}

// ── Attach JWT token to every request (and pre-check expiry) ─────
API.interceptors.request.use(async (config) => {
  if (typeof window !== 'undefined') {
    let token = localStorage.getItem('token');
    if (token) {
      // Proactive expiry check — logout before hitting the server with a dead token
      if (isTokenExpired(token)) {
        forceLogout();
        return Promise.reject(new axios.Cancel('Session expired. Please log in again.'));
      }
      // Silently renew when nearing expiry
      await maybeRefresh(token);
      token = localStorage.getItem('token') || token;
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Attach the selected academic year to year-scoped GET requests
    // (unless the caller already specified a year explicitly).
    const method = (config.method || 'get').toLowerCase();
    if (method === 'get' && isYearScoped(config.url)) {
      const year = getSelectedYear();
      config.params = config.params || {};
      if (year && config.params.year === undefined) {
        config.params.year = year;
      }
    }
  }
  return config;
});

// ── Handle 401 + blocked-403 globally ───────────────────────────
API.interceptors.response.use(
  (res) => res,
  (err) => {
    const status = err.response?.status;
    // 401 = expired/invalid; 403 with blocked flag = admin blocked this user
    if (status === 401 || (status === 403 && err.response?.data?.blocked)) {
      forceLogout();
    }
    return Promise.reject(err);
  }
);

export default API;
