'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon, LogOut, KeyRound, Building2, CalendarDays, GraduationCap, Palette, Bot, Menu } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useTheme } from '@/lib/ThemeContext';
import { useAuth } from '@/lib/AuthContext';
import { useUnit } from '@/lib/UnitContext';
import { usePermissions } from '@/lib/PermissionContext';
import { useAcademicYear } from '@/lib/AcademicYearContext';
import { confirmLogout, showSuccess, showError } from '@/lib/alert';
import API from '@/lib/api';
import NotificationBell from '@/components/NotificationBell';
import CalendarModal from '@/components/CalendarModal';
import ThemePanel from '@/components/ThemePanel';
import StudentLookupBot from '@/components/StudentLookupBot';

const TITLE_MAP = {
  '/dashboard': 'Dashboard Overview',
  '/students': 'Student Management',
  '/teachers': 'Faculty Directory',
  '/classes': 'Class Master',
  '/academics': 'Exams & Results',
  '/library': 'Library Management',
  '/attendance': 'Attendance System',
  '/transport': 'Transport',
  '/promotion': 'Student Promotion',
  '/finance': 'Finance & Accounts',
  '/gate': 'Gate Management',
  '/inventory': 'Inventory & Assets',
  '/events': 'Events & Notices',
  '/notices': 'Send Notice',
  '/users': 'Users & Access',
  '/monitor': 'Activity Monitor',
  '/units': 'School Units',
};

export default function Topbar({ onMenuClick }) {
  const pathname = usePathname();
  const title = TITLE_MAP[pathname] || 'School ERP';
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { unit, units, activeUnitId, switchUnit } = useUnit();
  const { can } = usePermissions();
  const { years, year, current, setYear, loaded: yearsLoaded } = useAcademicYear();
  const canSeeCalendar = can('Calendar', 'canView');
  const canSeeBot = can('StudentLookup', 'canView');

  const [showBot, setShowBot] = useState(false);
  const [showCal, setShowCal] = useState(false);
  const [showPwd, setShowPwd] = useState(false);
  const [showTheme, setShowTheme] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);   // avatar dropdown (holds logout etc.)

  // Live clock — updates every minute for the date/day display.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const dateStr = now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });

  // Changing the academic year re-scopes the whole ERP, so reload so every
  // page refetches with the new ?year= param.
  const changeYear = (y) => {
    if (y === year) return;
    setYear(y);
    if (typeof window !== 'undefined') window.location.reload();
  };
  const [pwdForm, setPwdForm] = useState({ current: '', next: '', confirm: '' });
  const [saving, setSaving] = useState(false);

  const handleLogout = async () => {
    if (await confirmLogout()) logout();
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (pwdForm.next.length < 6) { showError('New password must be at least 6 characters.'); return; }
    if (pwdForm.next !== pwdForm.confirm) { showError('New passwords do not match.'); return; }
    setSaving(true);
    try {
      await API.post('/auth/change-password', { currentPassword: pwdForm.current, newPassword: pwdForm.next });
      showSuccess('Password changed');
      setShowPwd(false);
      setPwdForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to change password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          {/* Hamburger — mobile only, opens the nav drawer */}
          <button className="topbar-hamburger" onClick={onMenuClick} title="Menu" aria-label="Open menu">
            <Menu size={20} />
          </button>
          <div className="topbar-title">{title}</div>
          {unit?.unitName && (
            units && units.length > 1 ? (
              // Multi-unit user → switchable dropdown (re-scopes the whole app).
              <div className="topbar-unit topbar-unit-switch" title="Switch unit">
                <Building2 size={13} />
                <select
                  value={activeUnitId || ''}
                  onChange={(e) => switchUnit(Number(e.target.value))}
                  aria-label="Active unit"
                >
                  {units.map((u) => (
                    <option key={u.unitId} value={u.unitId}>{u.unitName}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="topbar-unit" title="Unit">
                <Building2 size={13} />
                <span>{unit.unitName}</span>
              </div>
            )
          )}
        </div>
        <div className="topbar-right">
          {/* Live date */}
          <div className="topbar-date" title="Today">
            <CalendarDays size={14} />
            <span>{dateStr}</span>
          </div>

          {/* Academic year filter — re-scopes the whole ERP */}
          {yearsLoaded && years.length > 0 && (
            <div className="topbar-year" title="Academic year — filters all data">
              <GraduationCap size={14} />
              <select value={year || ''} onChange={(e) => changeYear(e.target.value)}>
                {years.map((y) => (
                  <option key={y} value={y}>{y}{y === current ? ' (current)' : ''}</option>
                ))}
              </select>
            </div>
          )}

          <button className="topbar-btn" onClick={toggleTheme} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>

          <div style={{ position: 'relative' }}>
            <button
              className={`topbar-btn topbar-theme-btn ${showTheme ? 'active' : ''}`}
              onClick={() => setShowTheme((s) => !s)}
              title="Theme & colors"
            >
              <Palette size={18} />
            </button>
            {showTheme && <ThemePanel onClose={() => setShowTheme(false)} />}
          </div>

          {canSeeBot && (
            <button className="topbar-btn topbar-bot-btn" title="Student assistant" onClick={() => setShowBot(true)}>
              <Bot size={18} />
            </button>
          )}

          {canSeeCalendar && (
            <button className="topbar-btn topbar-cal-btn" title="School calendar & holidays" onClick={() => setShowCal(true)}>
              <CalendarDays size={18} />
            </button>
          )}

          <button className="topbar-btn topbar-pwd-btn" title="Change password" onClick={() => setShowPwd(true)}>
            <KeyRound size={18} />
          </button>

          <NotificationBell />

          {user && (
            <div className="topbar-user" style={{ position: 'relative' }}>
              <button
                className={`topbar-user-btn ${showUserMenu ? 'active' : ''}`}
                onClick={() => setShowUserMenu((s) => !s)}
                aria-label="Account menu"
              >
                <div className="topbar-user-avatar">{user.username?.charAt(0).toUpperCase()}</div>
                <div className="topbar-user-meta">
                  <div className="topbar-user-name">{user.username}</div>
                  <div className="topbar-user-role">{unit?.unitName || 'Signed in'}</div>
                </div>
              </button>
              {/* Desktop: logout sits inline next to the avatar. */}
              <button className="topbar-btn logout topbar-logout-inline" onClick={handleLogout} title="Logout">
                <LogOut size={18} />
              </button>

              {/* Account dropdown — the reliable home for logout + secondary actions
                  (so nothing ever gets clipped on mobile). */}
              {showUserMenu && (
                <>
                  <div className="topbar-menu-backdrop" onClick={() => setShowUserMenu(false)} />
                  <div className="topbar-user-menu">
                    <div className="topbar-user-menu-head">
                      <div className="topbar-user-avatar lg">{user.username?.charAt(0).toUpperCase()}</div>
                      <div style={{ minWidth: 0 }}>
                        <div className="topbar-user-name">{user.username}</div>
                        <div className="topbar-user-role">{unit?.unitName || 'Signed in'}</div>
                      </div>
                    </div>

                    {/* Unit switch (mobile — the topbar badge is hidden on small screens) */}
                    {units && units.length > 1 && (
                      <div className="topbar-menu-field topbar-menu-mobile">
                        <span className="topbar-menu-label"><Building2 size={13} /> Unit</span>
                        <select value={activeUnitId || ''} onChange={(e) => { switchUnit(Number(e.target.value)); }}>
                          {units.map((u) => <option key={u.unitId} value={u.unitId}>{u.unitName}</option>)}
                        </select>
                      </div>
                    )}
                    {/* Academic year (mobile — hidden in the row on small screens) */}
                    {yearsLoaded && years.length > 0 && (
                      <div className="topbar-menu-field topbar-menu-mobile">
                        <span className="topbar-menu-label"><GraduationCap size={13} /> Year</span>
                        <select value={year || ''} onChange={(e) => changeYear(e.target.value)}>
                          {years.map((y) => <option key={y} value={y}>{y}{y === current ? ' (current)' : ''}</option>)}
                        </select>
                      </div>
                    )}

                    <button className="topbar-menu-item" onClick={() => { setShowUserMenu(false); setShowPwd(true); }}>
                      <KeyRound size={16} /> Change password
                    </button>
                    {canSeeCalendar && (
                      <button className="topbar-menu-item topbar-menu-mobile" onClick={() => { setShowUserMenu(false); setShowCal(true); }}>
                        <CalendarDays size={16} /> Calendar
                      </button>
                    )}
                    <button className="topbar-menu-item danger" onClick={() => { setShowUserMenu(false); handleLogout(); }}>
                      <LogOut size={16} /> Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Student assistant chatbot */}
      {showBot && <StudentLookupBot onClose={() => setShowBot(false)} />}

      {/* School calendar modal */}
      {showCal && <CalendarModal onClose={() => setShowCal(false)} />}

      {/* Change password modal */}
      {showPwd && (
        <div className="modal-overlay">
          <div className="modal modal-sm">
            <div className="modal-header">
              <div className="modal-title">Change Password</div>
              <button className="modal-close" onClick={() => setShowPwd(false)}>&times;</button>
            </div>
            <form onSubmit={changePassword}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Current Password</label>
                  <input type="password" className="form-control" value={pwdForm.current} onChange={(e) => setPwdForm((f) => ({ ...f, current: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">New Password</label>
                  <input type="password" className="form-control" value={pwdForm.next} onChange={(e) => setPwdForm((f) => ({ ...f, next: e.target.value }))} required />
                </div>
                <div className="form-group">
                  <label className="form-label">Confirm New Password</label>
                  <input type="password" className="form-control" value={pwdForm.confirm} onChange={(e) => setPwdForm((f) => ({ ...f, confirm: e.target.value }))} required />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowPwd(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="loading-spinner" /> : <><KeyRound size={16} /> Change Password</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
