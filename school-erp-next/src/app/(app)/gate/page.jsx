'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import API from '@/lib/api';
import {
  DoorOpen, DoorClosed, Plus, LogOut, X, Search, Users, UserSquare2,
  User, Clock, Phone, RefreshCw, ArrowRightLeft,
} from 'lucide-react';
import { showSuccess, showError, confirmAction, confirmSave } from '@/lib/alert';
import { usePermissions } from '@/lib/PermissionContext';
import RouteGuard from '@/components/RouteGuard';

const TYPES = [
  { key: 'Visitor', label: 'Visitor', icon: User },
  { key: 'Student', label: 'Student', icon: Users },
  { key: 'Staff',   label: 'Staff',   icon: UserSquare2 },
];
const PURPOSES = ['Meeting', 'Delivery', 'Enquiry', 'Admission', 'Event', 'Maintenance', 'Other'];
const REASONS = ['Late arrival', 'Early leave', 'Half day', 'Official work', 'Medical', 'Other'];

const EMPTY = {
  personType: 'Visitor', name: '', phone: '', studentId: null, teacherId: null,
  referenceNo: '', whomToMeet: '', purpose: 'Meeting', reason: 'Late arrival',
  approvedBy: '', remarks: '',
};

const timeOnly = (s) => (s ? s.slice(11, 16) : '');
const fmtDur = (m) => (m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`);

function GateInner() {
  const { can } = usePermissions();
  const canCreate = can('Gate', 'canCreate');
  const canEdit = can('Gate', 'canEdit');

  const [tab, setTab] = useState('inside');            // inside | log
  const [stats, setStats] = useState({});
  const [inside, setInside] = useState([]);
  const [log, setLog] = useState([]);
  const [logDate, setLogDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [logType, setLogType] = useState('All');
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const loadStats = useCallback(() => API.get('/gate/stats').then((r) => setStats(r.data || {})).catch(() => {}), []);
  const loadInside = useCallback(() => API.get('/gate/inside').then((r) => setInside(r.data || [])).catch(() => setInside([])), []);
  const loadLog = useCallback(() => {
    API.get(`/gate/log?date=${logDate}&type=${logType}`).then((r) => setLog(r.data || [])).catch(() => setLog([]));
  }, [logDate, logType]);

  const refresh = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadStats(), loadInside(), loadLog()]);
    setLoading(false);
  }, [loadStats, loadInside, loadLog]);

  useEffect(() => { refresh(); }, [refresh]);
  // auto-refresh the live board every 30s
  useEffect(() => {
    const t = setInterval(() => { loadStats(); loadInside(); }, 30000);
    return () => clearInterval(t);
  }, [loadStats, loadInside]);

  const openForm = () => { setForm(EMPTY); setShowForm(true); };

  const save = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) { showError('Name is required'); return; }
    if (!(await confirmSave('Log this entry?', `Record ${form.personType.toLowerCase()} "${form.name.trim()}" at the gate?`))) return;
    setSaving(true);
    try {
      const r = await API.post('/gate/entry', form);
      showSuccess(`${form.personType} entry logged · ${r.data?.passNo || ''}`);
      setShowForm(false);
      refresh();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to log entry');
    } finally {
      setSaving(false);
    }
  };

  const markExit = async (g) => {
    if (!(await confirmAction('Mark as out?', `Record ${g.name}'s exit now? This cannot be undone.`, '🚪 Yes, Mark Out', '#16a34a'))) return;
    try {
      await API.post(`/gate/exit/${g.gatePassId}`);
      showSuccess(`${g.name} marked out`);
      refresh();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed');
    }
  };

  const typeBadge = (t) => (
    <span className={`gate-type gate-type-${t.toLowerCase()}`}>
      {t === 'Visitor' ? <User size={12} /> : t === 'Student' ? <Users size={12} /> : <UserSquare2 size={12} />}
      {t}
    </span>
  );

  const rows = tab === 'inside' ? inside : log;

  return (
    <div className="page-wrap gate-page">
      {/* Stat cards */}
      <div className="gate-stats">
        <StatCard icon={<DoorOpen size={22} />} label="Currently Inside" value={stats.insideTotal ?? 0} tone="primary" big />
        <StatCard icon={<User size={20} />} label="Visitors" value={stats.insideVisitors ?? 0} tone="violet" />
        <StatCard icon={<Users size={20} />} label="Students" value={stats.insideStudents ?? 0} tone="amber" />
        <StatCard icon={<UserSquare2 size={20} />} label="Staff" value={stats.insideStaff ?? 0} tone="teal" />
        <StatCard icon={<ArrowRightLeft size={20} />} label="Today In / Out" value={`${stats.todayEntries ?? 0} / ${stats.todayExits ?? 0}`} tone="green" />
      </div>

      {/* Toolbar */}
      <div className="gate-toolbar">
        <div className="gate-tabs">
          <button className={`gate-tab ${tab === 'inside' ? 'active' : ''}`} onClick={() => setTab('inside')}>
            <DoorOpen size={16} /> Currently Inside
            {inside.length > 0 && <span className="gate-tab-count">{inside.length}</span>}
          </button>
          <button className={`gate-tab ${tab === 'log' ? 'active' : ''}`} onClick={() => setTab('log')}>
            <Clock size={16} /> Gate Log
          </button>
        </div>

        <div className="gate-toolbar-right">
          {tab === 'log' && (
            <>
              <input type="date" className="form-control gate-date" value={logDate} onChange={(e) => setLogDate(e.target.value)} />
              <select className="form-control gate-typefilter" value={logType} onChange={(e) => setLogType(e.target.value)}>
                <option value="All">All types</option>
                {TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
              </select>
            </>
          )}
          <button className="topbar-btn" title="Refresh" onClick={refresh}><RefreshCw size={16} className={loading ? 'spin' : ''} /></button>
          {canCreate && (
            <button className="btn btn-primary" onClick={openForm}><Plus size={16} /> New Entry</button>
          )}
        </div>
      </div>

      {/* Records */}
      {loading ? (
        <div className="empty-state"><span className="loading-spinner" /> Loading…</div>
      ) : rows.length === 0 ? (
        <div className="empty-state gate-empty">
          <DoorClosed size={40} />
          <p>{tab === 'inside' ? 'No one is currently inside.' : 'No gate records for this day.'}</p>
        </div>
      ) : (
        <div className="gate-grid">
          {rows.map((g) => (
            <div key={g.gatePassId} className={`gate-card ${g.isInside ? 'in' : 'out'}`}>
              <div className="gate-card-top">
                <div className="gate-avatar">
                  {g.photoUrl ? <img src={g.photoUrl} alt="" /> : g.name.charAt(0).toUpperCase()}
                </div>
                <div className="gate-card-main">
                  <div className="gate-card-name">{g.name}</div>
                  <div className="gate-card-sub">
                    {typeBadge(g.personType)}
                    {g.referenceNo && <span className="gate-ref">{g.referenceNo}</span>}
                  </div>
                </div>
                <span className={`gate-status ${g.isInside ? 'inside' : 'left'}`}>
                  {g.isInside ? 'Inside' : 'Left'}
                </span>
              </div>

              <div className="gate-card-meta">
                {g.phone && <span><Phone size={12} /> {g.phone}</span>}
                {g.whomToMeet && <span>👤 {g.whomToMeet}</span>}
                {g.purpose && g.personType === 'Visitor' && <span>🎯 {g.purpose}</span>}
                {g.reason && g.personType !== 'Visitor' && <span>📝 {g.reason}</span>}
                {g.approvedBy && <span>✔ {g.approvedBy}</span>}
              </div>

              <div className="gate-card-foot">
                <div className="gate-times">
                  <span className="gate-in">In {timeOnly(g.entryAt)}</span>
                  {g.exitAt ? <span className="gate-out">Out {timeOnly(g.exitAt)}</span> : <span className="gate-dur"><Clock size={11} /> {fmtDur(g.durationMinutes)}</span>}
                </div>
                <div className="gate-card-actions">
                  {g.isInside && canEdit && (
                    <button className="btn btn-sm btn-outline gate-exit-btn" onClick={() => markExit(g)}>
                      <LogOut size={14} /> Mark Out
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <EntryForm
          form={form} setForm={setForm} saving={saving}
          onClose={() => setShowForm(false)} onSubmit={save}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value, tone, big }) {
  return (
    <div className={`gate-stat gate-stat-${tone} ${big ? 'big' : ''}`}>
      <div className="gate-stat-icon">{icon}</div>
      <div className="gate-stat-body">
        <div className="gate-stat-value">{value}</div>
        <div className="gate-stat-label">{label}</div>
      </div>
    </div>
  );
}

function EntryForm({ form, setForm, saving, onClose, onSubmit }) {
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const debounce = useRef(null);

  // search student/staff for the linked entry
  useEffect(() => {
    if (form.personType === 'Visitor') { setResults([]); return; }
    if (!q.trim()) { setResults([]); return; }
    setSearching(true);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(async () => {
      try {
        const ep = form.personType === 'Student' ? 'search-student' : 'search-staff';
        const r = await API.get(`/gate/${ep}?q=${encodeURIComponent(q)}`);
        setResults(r.data || []);
      } catch { setResults([]); } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(debounce.current);
  }, [q, form.personType]);

  const pick = (r) => {
    if (form.personType === 'Student') set('studentId', r.studentId);
    else set('teacherId', r.teacherId);
    setForm((f) => ({ ...f, name: r.name, referenceNo: r.refNo, phone: r.phone || '' }));
    setResults([]);
    setQ(r.name);
  };

  const changeType = (t) => setForm({ ...EMPTY, personType: t });

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-sm gate-form-modal">
        <div className="modal-header">
          <div className="modal-title"><DoorOpen size={17} /> New Gate Entry</div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={onSubmit}>
          <div className="modal-body">
            {/* type picker */}
            <div className="gate-type-picker">
              {TYPES.map((t) => {
                const Icon = t.icon;
                return (
                  <button type="button" key={t.key}
                    className={`gate-type-opt ${form.personType === t.key ? 'active' : ''}`}
                    onClick={() => changeType(t.key)}>
                    <Icon size={18} /> {t.label}
                  </button>
                );
              })}
            </div>

            {/* student/staff lookup */}
            {form.personType !== 'Visitor' && (
              <div className="form-group gate-search">
                <label className="form-label">Find {form.personType.toLowerCase()}</label>
                <div className="input-icon-wrap">
                  <Search size={15} className="input-lead-icon" />
                  <input className="form-control has-lead" placeholder={`Search by name / ${form.personType === 'Student' ? 'admission' : 'employee'} no.`}
                    value={q} onChange={(e) => setQ(e.target.value)} />
                </div>
                {searching && <div className="gate-search-hint">Searching…</div>}
                {results.length > 0 && (
                  <div className="gate-search-results">
                    {results.map((r) => (
                      <button type="button" key={(r.studentId || r.teacherId)} className="gate-search-item" onClick={() => pick(r)}>
                        <b>{r.name}</b>
                        <span>{r.refNo}{r.className ? ' · ' + r.className : ''}{r.designation ? ' · ' + r.designation : ''}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Name *</label>
                <input className="form-control" value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus={form.personType === 'Visitor'} />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label">Phone</label>
                <input className="form-control" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              </div>
            </div>

            {form.personType === 'Visitor' ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Whom to meet</label>
                  <input className="form-control" value={form.whomToMeet} onChange={(e) => set('whomToMeet', e.target.value)} placeholder="e.g. Principal" />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Purpose</label>
                  <select className="form-control" value={form.purpose} onChange={(e) => set('purpose', e.target.value)}>
                    {PURPOSES.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 10 }}>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Reason</label>
                  <select className="form-control" value={form.reason} onChange={(e) => set('reason', e.target.value)}>
                    {REASONS.map((p) => <option key={p}>{p}</option>)}
                  </select>
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label className="form-label">Approved by</label>
                  <input className="form-control" value={form.approvedBy} onChange={(e) => set('approvedBy', e.target.value)} placeholder="e.g. Class teacher" />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Remarks (optional)</label>
              <input className="form-control" value={form.remarks} onChange={(e) => set('remarks', e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? <span className="loading-spinner" /> : <><Plus size={16} /> Log Entry</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function GatePage() {
  return (
    <RouteGuard module="Gate">
      <GateInner />
    </RouteGuard>
  );
}
