'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, Trash2, X, Mail, CalendarDays, AlertTriangle } from 'lucide-react';
import API from '@/lib/api';
import { usePermissions } from '@/lib/PermissionContext';
import { showSuccess, showError, confirmAction } from '@/lib/alert';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

const EMPTY_FORM = {
  title: '', date: '', endDate: '', description: '',
  holidayType: 'Holiday', isEmergency: false,
  targetType: 'All', targetClassId: '', sendEmail: false,
};

export default function CalendarModal({ onClose }) {
  const { can } = usePermissions();
  const canCreate = can('Calendar', 'canCreate');
  const canDelete = can('Calendar', 'canDelete');

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [holidays, setHolidays] = useState([]);
  const [classes, setClasses] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const load = useCallback((y) => {
    API.get(`/calendar?year=${y}`).then((r) => setHolidays(r.data || [])).catch(() => setHolidays([]));
  }, []);

  useEffect(() => { load(year); }, [year, load]);
  // classes for the class-wise email target (only needed if user can create)
  useEffect(() => {
    if (canCreate) API.get('/classes').then((r) => setClasses(r.data || [])).catch(() => setClasses([]));
  }, [canCreate]);

  // holidays keyed by yyyy-mm-dd (expands multi-day ranges)
  const holidayByDate = useMemo(() => {
    const map = {};
    for (const h of holidays) {
      const start = new Date(h.date + 'T00:00:00');
      const end = h.endDate ? new Date(h.endDate + 'T00:00:00') : start;
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const key = iso(d.getFullYear(), d.getMonth(), d.getDate());
        (map[key] ||= []).push(h);
      }
    }
    return map;
  }, [holidays]);

  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1);
  };

  const openAdd = (dateStr) => {
    setForm({ ...EMPTY_FORM, date: dateStr || '' });
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.title.trim()) { showError('Title is required'); return; }
    if (!form.date) { showError('Please pick a date'); return; }
    if (form.targetType === 'Class' && !form.targetClassId) { showError('Please select a class'); return; }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        date: form.date,
        endDate: form.endDate || null,
        description: form.description || null,
        holidayType: form.isEmergency ? 'Emergency' : form.holidayType,
        isEmergency: form.isEmergency,
        targetType: form.targetType,
        targetClassId: form.targetType === 'Class' ? Number(form.targetClassId) : null,
        sendEmail: form.sendEmail,
      };
      const r = await API.post('/calendar', payload);
      showSuccess(r.data?.message || 'Holiday saved');
      setShowForm(false);
      setForm(EMPTY_FORM);
      load(year);
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to save holiday');
    } finally {
      setSaving(false);
    }
  };

  const del = async (h) => {
    if (!(await confirmAction('Delete Holiday?', `Remove "${h.title}" from the calendar?`))) return;
    try {
      await API.delete(`/calendar/${h.holidayId}`);
      showSuccess('Holiday removed');
      load(year);
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to delete');
    }
  };

  const todayIso = iso(today.getFullYear(), today.getMonth(), today.getDate());

  // list of this month's holidays for the side panel
  const monthHolidays = holidays.filter((h) => {
    const d = new Date(h.date + 'T00:00:00');
    return d.getFullYear() === year && d.getMonth() === month;
  });

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-lg cal-modal">
        <div className="modal-header">
          <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <CalendarDays size={18} /> School Calendar
          </div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="modal-body cal-body">
          {/* Month nav */}
          <div className="cal-nav">
            <button className="topbar-btn" onClick={prevMonth}><ChevronLeft size={18} /></button>
            <div className="cal-nav-title">{MONTHS[month]} {year}</div>
            <button className="topbar-btn" onClick={nextMonth}><ChevronRight size={18} /></button>
            {canCreate && (
              <button className="btn btn-primary btn-sm cal-add-btn" onClick={() => openAdd('')}>
                <Plus size={15} /> Add Holiday
              </button>
            )}
          </div>

          <div className="cal-layout">
            {/* Month grid */}
            <div className="cal-grid-wrap">
              <div className="cal-grid cal-dow">
                {DOW.map((d, i) => <div key={d} className={`cal-dow-cell ${i === 0 ? 'sun' : ''}`}>{d}</div>)}
              </div>
              <div className="cal-grid">
                {cells.map((d, i) => {
                  if (d === null) return <div key={`e${i}`} className="cal-cell empty" />;
                  const dateStr = iso(year, month, d);
                  const dow = new Date(year, month, d).getDay();
                  const isSunday = dow === 0;
                  const hs = holidayByDate[dateStr] || [];
                  const isHoliday = hs.length > 0;
                  const isEmergency = hs.some((h) => h.isEmergency);
                  const isToday = dateStr === todayIso;
                  return (
                    <div
                      key={dateStr}
                      className={`cal-cell ${isSunday ? 'sunday' : ''} ${isHoliday ? 'holiday' : ''} ${isEmergency ? 'emergency' : ''} ${isToday ? 'today' : ''} ${canCreate ? 'clickable' : ''}`}
                      onClick={canCreate ? () => openAdd(dateStr) : undefined}
                      title={isHoliday ? hs.map((h) => h.title).join(', ') : (isSunday ? 'Weekly off' : (canCreate ? 'Click to add holiday' : ''))}
                    >
                      <span className="cal-cell-num">{d}</span>
                      {isHoliday && <span className="cal-dot" />}
                      {isHoliday && <span className="cal-cell-label">{hs[0].title}</span>}
                      {!isHoliday && isSunday && <span className="cal-cell-off">Off</span>}
                    </div>
                  );
                })}
              </div>
              <div className="cal-legend">
                <span><i className="lg sun" /> Sunday (off)</span>
                <span><i className="lg hol" /> Holiday</span>
                <span><i className="lg emg" /> Emergency</span>
                <span><i className="lg tdy" /> Today</span>
              </div>
            </div>

            {/* Side list */}
            <div className="cal-side">
              <div className="cal-side-title">Holidays in {MONTHS[month]}</div>
              {monthHolidays.length === 0 && <div className="cal-side-empty">No declared holidays this month.</div>}
              {monthHolidays.map((h) => (
                <div key={h.holidayId} className={`cal-side-item ${h.isEmergency ? 'emg' : ''}`}>
                  <div className="cal-side-item-main">
                    <div className="cal-side-item-title">
                      {h.isEmergency && <AlertTriangle size={13} style={{ color: '#dc2626' }} />}
                      {h.title}
                    </div>
                    <div className="cal-side-item-meta">
                      {new Date(h.date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      {h.endDate && h.endDate !== h.date && ' – ' + new Date(h.endDate + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                      {' · '}
                      {h.targetType === 'Class' ? (h.targetClassName || 'Class') : h.targetType}
                      {h.emailSent && <span className="cal-emailed"><Mail size={11} /> {h.emailCount}</span>}
                    </div>
                  </div>
                  {canDelete && (
                    <button className="cal-side-del" onClick={() => del(h)} title="Delete"><Trash2 size={14} /></button>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Add-holiday form */}
      {showForm && (
        <div className="modal-overlay" style={{ zIndex: 1100 }} onMouseDown={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <div className="modal-title">Declare Holiday</div>
              <button className="modal-close" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <form onSubmit={save}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input className="form-control" value={form.title} placeholder="e.g. Diwali Holiday"
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} autoFocus />
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Date *</label>
                    <input type="date" className="form-control" value={form.date}
                      onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">End Date (optional)</label>
                    <input type="date" className="form-control" value={form.endDate} min={form.date}
                      onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Description (optional)</label>
                  <textarea className="form-control" rows={2} value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
                </div>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                  <input type="checkbox" checked={form.isEmergency} style={{ accentColor: '#dc2626', width: 16, height: 16 }}
                    onChange={(e) => setForm((f) => ({ ...f, isEmergency: e.target.checked, sendEmail: e.target.checked ? true : f.sendEmail }))} />
                  <span style={{ color: form.isEmergency ? '#dc2626' : 'var(--text-muted)' }}>🚨 Emergency holiday</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 12 }}>
                  <input type="checkbox" checked={form.sendEmail} style={{ accentColor: 'var(--primary)', width: 16, height: 16 }}
                    onChange={(e) => setForm((f) => ({ ...f, sendEmail: e.target.checked }))} />
                  <span><Mail size={14} style={{ verticalAlign: -2 }} /> Send email notification</span>
                </label>

                {form.sendEmail && (
                  <div className="cal-email-box">
                    <div className="form-group" style={{ marginBottom: form.targetType === 'Class' ? 10 : 0 }}>
                      <label className="form-label">Notify</label>
                      <select className="form-control" value={form.targetType}
                        onChange={(e) => setForm((f) => ({ ...f, targetType: e.target.value }))}>
                        <option value="All">Everyone (Teachers + Students)</option>
                        <option value="Teachers">Teachers only</option>
                        <option value="Students">Students only</option>
                        <option value="Class">Specific Class (students)</option>
                      </select>
                    </div>
                    {form.targetType === 'Class' && (
                      <div className="form-group" style={{ marginBottom: 0 }}>
                        <label className="form-label">Class</label>
                        <select className="form-control" value={form.targetClassId}
                          onChange={(e) => setForm((f) => ({ ...f, targetClassId: e.target.value }))}>
                          <option value="">Select class</option>
                          {classes.map((c) => (
                            <option key={c.classId} value={c.classId}>{c.className}{c.stream ? ` ${c.stream}` : ''} ({c.section})</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div className="cal-email-hint">Student emails use the student's email, or the parent's email if not set.</div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="loading-spinner" /> : <><Plus size={16} /> Save Holiday</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
