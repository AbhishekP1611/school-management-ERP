'use client';

import { useState, useEffect, useCallback } from 'react';
import API from '@/lib/api';
import { Activity, LogOut, Ban, CheckCircle, RefreshCw, Clock, Monitor, X, LogIn, User } from 'lucide-react';
import { showSuccess, showError, confirmAction } from '@/lib/alert';
import DataGrid from '@/components/DataGrid';
import RouteGuard from '@/components/RouteGuard';
import { useAuth } from '@/lib/AuthContext';

function fmtDuration(mins) {
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function MonitorInner() {
  const [tab, setTab] = useState('Sessions');
  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Activity Monitor</div>
          <div className="page-subtitle">Who logged in, what they did, and for how long</div>
        </div>
      </div>
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'Sessions' ? 'active' : ''}`} onClick={() => setTab('Sessions')}><Monitor size={14} style={{ marginRight: 6 }} />Sessions</button>
        <button className={`tab-btn ${tab === 'Activity' ? 'active' : ''}`} onClick={() => setTab('Activity')}><Activity size={14} style={{ marginRight: 6 }} />Activity Log</button>
      </div>
      {tab === 'Sessions' && <SessionsTab />}
      {tab === 'Activity' && <ActivityTab />}
    </>
  );
}

// ── SESSIONS (one row per user, date-filtered) ────────────────
function SessionsTab() {
  const { user, logout } = useAuth();
  const myId = user?.userId;
  const today = new Date().toISOString().split('T')[0];

  const [date, setDate] = useState(today);
  const [users, setUsers] = useState([]);
  const [detailUser, setDetailUser] = useState(null);   // { userId, username } open in popup

  const load = useCallback(() => {
    API.get(`/monitoring/sessions-by-user?date=${date}`).then((r) => setUsers(r.data.users || [])).catch(console.error);
  }, [date]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);   // auto-refresh every 15s
    return () => clearInterval(t);
  }, [load]);

  const forceLogout = async (userId, username) => {
    const isSelf = userId === myId;
    const msg = isSelf ? 'This ends YOUR session — you will be logged out now. Continue?' : `End all active sessions of "${username}"?`;
    if (!(await confirmAction('Force Logout?', msg))) return;
    try { await API.post(`/monitoring/force-logout/${userId}`); if (isSelf) { logout(); return; } showSuccess('Sessions ended'); load(); }
    catch { showError('Failed'); }
  };
  const block = async (userId, username) => {
    const isSelf = userId === myId;
    const msg = isSelf ? 'Block YOUR OWN account — you will be logged out and cannot log back in until re-activated. Continue?' : `Block "${username}" — they will be logged out and cannot log in until re-activated.`;
    if (!(await confirmAction('Block User?', msg))) return;
    try { await API.post(`/monitoring/block/${userId}`); if (isSelf) { logout(); return; } showSuccess('User blocked'); load(); }
    catch (err) { showError(err.response?.data?.message || 'Failed'); }
  };
  const unblock = async (userId, username) => {
    try { await API.post(`/monitoring/unblock/${userId}`); showSuccess(`${username} re-activated`); load(); }
    catch { showError('Failed'); }
  };

  const columns = [
    { key: 'username', label: 'User', value: (u) => u.username, render: (u) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        <div className="mon-av">{u.username?.charAt(0).toUpperCase()}</div>
        <div style={{ fontWeight: 600 }}>{u.username}</div>
      </div>
    ) },
    { key: 'loginCount', label: 'Logins', value: (u) => u.loginCount, render: (u) => (
      <button className="mon-count" onClick={() => setDetailUser(u)} title="View this day's sessions">
        <LogIn size={12} /> {u.loginCount}× <span className="mon-count-hint">view</span>
      </button>
    ) },
    { key: 'lastLoginAt', label: 'Last Login', value: (u) => u.lastLoginAt, render: (u) => <span style={{ fontSize: 12.5 }}>{u.lastLoginAt?.slice(11)}</span> },
    { key: 'totalMinutes', label: 'Total Time', value: (u) => u.totalMinutes, render: (u) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={12} /> {fmtDuration(u.totalMinutes)}</span> },
    { key: 'status', label: 'Status', value: (u) => (u.isBlocked ? 'Blocked' : u.status), render: (u) =>
      u.isBlocked ? <span className="badge badge-danger">Blocked</span>
        : u.online ? <span className="badge badge-success">● Online</span>
        : <span className="badge badge-grey">Offline</span> },
  ];

  return (
    <>
      <DataGrid
        title="Login Sessions"
        subtitle={`One row per user · ${date === today ? 'today' : date} · auto-refreshes`}
        columns={columns}
        rows={users}
        rowKey={(u) => u.userId}
        exportName={`Sessions_${date}`}
        emptyText="No logins on this date."
        toolbar={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <Clock size={13} /> Date:
            </span>
            <input type="date" className="form-control" style={{ width: 155, height: 38 }} value={date} max={today} onChange={(e) => setDate(e.target.value)} />
            {date !== today && <button className="btn btn-outline btn-sm" onClick={() => setDate(today)}>Today</button>}
            <button className="btn btn-outline btn-sm" title="Refresh" onClick={load}><RefreshCw size={14} /></button>
          </div>
        }
        actions={(u) => (
          <div style={{ display: 'flex', gap: 6 }}>
            {u.online && (
              <button className="btn btn-outline btn-sm" title="Force logout" onClick={() => forceLogout(u.userId, u.username)}><LogOut size={13} /></button>
            )}
            {u.isBlocked
              ? <button className="btn btn-success btn-sm" title="Unblock / re-activate" onClick={() => unblock(u.userId, u.username)}><CheckCircle size={13} /></button>
              : <button className="btn btn-danger btn-sm" title="Block" onClick={() => block(u.userId, u.username)}><Ban size={13} /></button>}
          </div>
        )}
      />
      {detailUser && <SessionDetailModal user={detailUser} date={date} onClose={() => setDetailUser(null)} />}
    </>
  );
}

// Popup: a user's individual login/logout sessions for the selected day.
function SessionDetailModal({ user, date, onClose }) {
  const [sessions, setSessions] = useState(null);
  useEffect(() => {
    API.get(`/monitoring/user-sessions?userId=${user.userId}&date=${date}`)
      .then((r) => setSessions(r.data || [])).catch(() => setSessions([]));
  }, [user, date]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <User size={16} /> {user.username} — {date}
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          {sessions === null ? <div className="empty-state"><span className="loading-spinner" /> Loading…</div>
            : sessions.length === 0 ? <div className="empty-state">No sessions this day.</div>
            : (
              <>
                <div className="mon-detail-summary">{sessions.length} login{sessions.length > 1 ? 's' : ''} on {date}</div>
                <div className="mon-timeline">
                  {sessions.map((s, i) => (
                    <div className="mon-tl-item" key={s.sessionId}>
                      <div className={`mon-tl-dot ${s.status === 'Online' ? 'on' : ''}`} />
                      <div className="mon-tl-body">
                        <div className="mon-tl-row">
                          <span><LogIn size={12} color="#16a34a" /> {s.loginAt}</span>
                          <span>{s.logoutAt ? <><LogOut size={12} color="#94a3b8" /> {s.logoutAt}</> : <span className="badge badge-success" style={{ fontSize: 10 }}>● Active</span>}</span>
                        </div>
                        <div className="mon-tl-meta">
                          <Clock size={11} /> {fmtDuration(s.durationMinutes)}
                          {s.logoutReason && <span> · {s.logoutReason}</span>}
                          {s.ip && <span> · {s.ip}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
        </div>
      </div>
    </div>
  );
}

// ── ACTIVITY LOG ──────────────────────────────────────────────
function ActivityTab() {
  const [logs, setLogs] = useState([]);
  const [moduleFilter, setModuleFilter] = useState('');

  const load = useCallback(() => {
    const q = moduleFilter ? `?module=${moduleFilter}&take=300` : '?take=300';
    API.get(`/monitoring/activity${q}`).then((r) => setLogs(r.data)).catch(console.error);
  }, [moduleFilter]);

  useEffect(() => {
    load();
    const t = setInterval(load, 15000);
    return () => clearInterval(t);
  }, [load]);

  const actionBadge = (a) => {
    const map = { Create: 'badge-success', Update: 'badge-info', Delete: 'badge-danger', Login: 'badge-purple', Logout: 'badge-grey' };
    return <span className={`badge ${map[a] || 'badge-grey'}`}>{a}</span>;
  };

  const columns = [
    { key: 'username', label: 'User', value: (l) => l.username, render: (l) => <span style={{ fontWeight: 600 }}>{l.username}</span> },
    { key: 'module', label: 'Module', render: (l) => <span className="badge badge-purple">{l.module}</span> },
    { key: 'action', label: 'Action', render: (l) => actionBadge(l.action) },
    { key: 'detail', label: 'Detail', value: (l) => l.detail || '', render: (l) => <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{l.detail}</span> },
    { key: 'at', label: 'Time' },
  ];

  const MODULES = ['Students', 'Teachers', 'Classes', 'Academics', 'Library', 'Attendance', 'Transport', 'Events', 'Fees', 'Users', 'Auth'];

  return (
    <DataGrid
      title="Activity Log"
      subtitle="Every create / update / delete / login — auto-refreshes"
      columns={columns}
      rows={logs}
      rowKey={(l) => l.logId}
      exportName="ActivityLog"
      emptyText="No activity recorded yet."
      toolbar={
        <select className="form-control" style={{ width: 160 }} value={moduleFilter} onChange={(e) => setModuleFilter(e.target.value)}>
          <option value="">All Modules</option>
          {MODULES.map((m) => <option key={m}>{m}</option>)}
        </select>
      }
    />
  );
}

export default function MonitorPage() {
  return (
    <RouteGuard module="Monitor">
      <MonitorInner />
    </RouteGuard>
  );
}
