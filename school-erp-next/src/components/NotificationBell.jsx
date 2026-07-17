'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Bell, AlertTriangle, Info, Megaphone } from 'lucide-react';
import API from '@/lib/api';

const priorityStyle = (p) => {
  if (p === 'Emergency') return { icon: <AlertTriangle size={15} />, color: '#dc2626', bg: '#fee2e2' };
  if (p === 'Important') return { icon: <Megaphone size={15} />, color: '#ca8a04', bg: '#fef9c3' };
  return { icon: <Info size={15} />, color: '#2563eb', bg: '#dbeafe' };
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [count, setCount] = useState(0);
  const [notices, setNotices] = useState([]);
  const ref = useRef(null);

  const loadCount = useCallback(() => {
    API.get('/notices/unread-count').then((r) => setCount(r.data.count || 0)).catch(() => {});
  }, []);

  const loadNotices = useCallback(() => {
    API.get('/notices').then((r) => setNotices(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    loadCount();
    const t = setInterval(loadCount, 20000); // poll every 20s
    return () => clearInterval(t);
  }, [loadCount]);

  // close on outside click
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      loadNotices();
      // mark all read when opened
      try { await API.post('/notices/mark-read'); setCount(0); } catch {}
    }
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button className="topbar-btn" title="Notifications" onClick={toggle}>
        <Bell size={18} />
        {count > 0 && <span className="bell-badge">{count > 9 ? '9+' : count}</span>}
      </button>

      {open && (
        <div className="bell-dropdown">
          <div className="bell-dropdown-head">
            <span>Notifications</span>
            {notices.length > 0 && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{notices.length}</span>}
          </div>
          <div className="bell-list">
            {notices.length === 0 ? (
              <div className="empty-state" style={{ padding: 30, fontSize: 13 }}>No notifications yet.</div>
            ) : (
              notices.map((n) => {
                const st = priorityStyle(n.priority);
                return (
                  <div key={n.noticeId} className="bell-item" style={{ opacity: n.isRead ? 0.7 : 1 }}>
                    <div className="bell-item-icon" style={{ background: st.bg, color: st.color }}>{st.icon}</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="bell-item-title">
                        {n.title}
                        {n.priority === 'Emergency' && <span className="badge badge-danger" style={{ marginLeft: 6, fontSize: 9 }}>URGENT</span>}
                      </div>
                      <div className="bell-item-msg">{n.message}</div>
                      <div className="bell-item-meta">{n.createdBy} · {n.at} · to {n.targetRole}</div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
