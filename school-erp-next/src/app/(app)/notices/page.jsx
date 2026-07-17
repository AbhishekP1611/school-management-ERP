'use client';

import { useState, useEffect } from 'react';
import API from '@/lib/api';
import { Megaphone, Send, AlertTriangle, Trash2, Users, Mail } from 'lucide-react';
import { showSuccess, showError, confirmAction, confirmSave } from '@/lib/alert';
import { runValidation, required } from '@/lib/validate';
import RouteGuard from '@/components/RouteGuard';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/lib/PermissionContext';

const TARGETS = [
  { value: 'All', label: 'Everyone (all users)' },
  { value: 'Teacher', label: 'All Teachers' },
  { value: 'Student', label: 'All Students' },
];
const PRIORITIES = ['Normal', 'Important', 'Emergency'];

const EMPTY = { title: '', message: '', priority: 'Normal', targetRole: 'All' };

function NoticesInner() {
  const { user } = useAuth();
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState([]);
  const { can } = usePermissions();
  const canCreate = can('Notices', 'canCreate');
  const canDelete = can('Notices', 'canDelete');

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined })); };

  const targets = TARGETS;

  const load = () => API.get('/notices').then((r) => setSent(r.data)).catch(console.error);
  useEffect(() => { load(); }, []);

  const send = async (e) => {
    e.preventDefault();
    const errs = runValidation(form, { title: [required('Title is required')], message: [required('Message is required')] });
    if (Object.keys(errs).length) { setErrors(errs); return; }
    const label = TARGETS.find((t) => t.value === form.targetRole)?.label || form.targetRole;
    if (!(await confirmSave('Send Notice?', `Send "${form.title}" to ${label}? An email will also be sent (if configured).`))) return;
    setSending(true);
    try {
      const res = await API.post('/notices', form);
      showSuccess('Notice sent');
      // show the email status
      const d = res.data;
      if (d.emailConfigured) showSuccess(`Notice sent · Emailed ${d.emailsSent} recipient(s)`);
      setForm(EMPTY);
      load();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to send');
    } finally { setSending(false); }
  };

  const del = async (id) => {
    if (!(await confirmAction('Delete Notice?', 'Remove this notice?'))) return;
    try { await API.delete(`/notices/${id}`); showSuccess('Deleted'); load(); }
    catch { showError('Failed'); }
  };

  const prColor = (p) => (p === 'Emergency' ? 'badge-danger' : p === 'Important' ? 'badge-warning' : 'badge-info');

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Send Notice</div>
          <div className="page-subtitle">Broadcast a notice — shows in the bell &amp; goes to recipients' email</div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1.2fr)', gap: 24, alignItems: 'start' }}>
        {/* Compose */}
        <div className="card" style={{ padding: 22 }}>
          <div className="form-section-title" style={{ marginBottom: 16 }}><Megaphone size={14} style={{ marginRight: 6, verticalAlign: -2 }} />Compose Notice</div>
          <form onSubmit={send} noValidate>
            <div className="form-group">
              <label className="form-label">Send To *</label>
              <select className="form-control" value={form.targetRole} onChange={(e) => set('targetRole', e.target.value)}>
                {targets.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {PRIORITIES.map((p) => (
                  <button type="button" key={p}
                    onClick={() => set('priority', p)}
                    className={`btn btn-sm ${form.priority === p ? (p === 'Emergency' ? 'btn-danger' : p === 'Important' ? 'btn-warning' : 'btn-primary') : 'btn-outline'}`}>
                    {p === 'Emergency' && <AlertTriangle size={13} />} {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Title *</label>
              <input className={`form-control ${errors.title ? 'input-error' : ''}`} value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="e.g. School Closed Tomorrow" />
              {errors.title && <span className="field-error">{errors.title}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Message *</label>
              <textarea className={`form-control ${errors.message ? 'input-error' : ''}`} value={form.message} onChange={(e) => set('message', e.target.value)} rows="5" placeholder="Write the notice message..." />
              {errors.message && <span className="field-error">{errors.message}</span>}
            </div>
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={sending}>
              {sending ? <span className="loading-spinner" /> : <><Send size={16} /> Send Notice</>}
            </button>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 12, fontSize: 11.5, color: 'var(--text-muted)' }}>
              <Mail size={13} /> Recipients also get an email (if SMTP is configured) &nbsp;•&nbsp; <Users size={13} /> shows in their bell instantly
            </div>
          </form>
        </div>

        {/* Sent notices */}
        <div className="card">
          <div className="card-header">Sent Notices</div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Notice</th><th>To</th><th>Priority</th><th>By</th><th>When</th>{canDelete && <th></th>}</tr></thead>
              <tbody>
                {sent.map((n) => (
                  <tr key={n.noticeId}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{n.title}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</div>
                    </td>
                    <td><span className="badge badge-purple">{n.targetRole}</span></td>
                    <td><span className={`badge ${prColor(n.priority)}`}>{n.priority}</span></td>
                    <td style={{ fontSize: 12 }}>{n.createdBy}</td>
                    <td style={{ fontSize: 12 }}>{n.at}</td>
                    {canDelete && <td><button className="btn btn-danger btn-sm" onClick={() => del(n.noticeId)}><Trash2 size={13} /></button></td>}
                  </tr>
                ))}
                {sent.length === 0 && <tr><td colSpan={canDelete ? 6 : 5} className="empty-state">No notices sent yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

export default function NoticesPage() {
  return (
    <RouteGuard module="Notices">
      <NoticesInner />
    </RouteGuard>
  );
}
