'use client';

import { useState, useEffect } from 'react';
import API from '@/lib/api';
import Link from 'next/link';
import { Plus, Edit2, Trash2, ShieldCheck, Mail, MailX, Boxes } from 'lucide-react';
import { showSuccess, showError, confirmAction, confirmSave } from '@/lib/alert';
import { runValidation, required, email as emailRule } from '@/lib/validate';
import DataGrid from '@/components/DataGrid';
import RouteGuard from '@/components/RouteGuard';

const EMPTY = { username: '', password: '', role: 'Teacher', email: '', isActive: true, emailNotifications: true, unitId: '', unitIds: [] };

function UsersInner() {
  const [users, setUsers] = useState([]);
  const [units, setUnits] = useState([]);            // all units, for the multi-select
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [showInactive, setShowInactive] = useState(false);

  // permission grid modal
  const [permUser, setPermUser] = useState(null);
  const [permRows, setPermRows] = useState([]);

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined })); };

  const load = () => API.get(`/users?includeInactive=${showInactive}`).then((r) => setUsers(r.data)).catch(console.error);
  useEffect(() => { load(); }, [showInactive]);

  // Load all units once (for the "units this user can access" multi-select).
  // Only ACTIVE units can be assigned to a user (inactive units are hidden).
  useEffect(() => { API.get('/units').then((r) => setUnits((r.data || []).filter((u) => u.isActive))).catch(() => setUnits([])); }, []);

  const openForm = (u = null) => {
    setErrors({});
    if (u) {
      // u.unitIds comes from the API (the units this user may access).
      const ids = Array.isArray(u.unitIds) && u.unitIds.length ? u.unitIds : (u.unitId ? [u.unitId] : []);
      setEditId(u.userId);
      setForm({ ...EMPTY, ...u, password: '', unitId: u.unitId || '', unitIds: ids });
    } else {
      setEditId(null);
      setForm(EMPTY);
    }
    setShowModal(true);
  };

  // Toggle a unit in the multi-select. The first-picked unit becomes the "home" unit.
  const toggleUnit = (id) => {
    setForm((f) => {
      const has = f.unitIds.includes(id);
      const nextIds = has ? f.unitIds.filter((x) => x !== id) : [...f.unitIds, id];
      // keep a valid home unit: current one if still selected, else the first selected
      let home = f.unitId && nextIds.includes(f.unitId) ? f.unitId : (nextIds[0] || '');
      return { ...f, unitIds: nextIds, unitId: home };
    });
    if (errors.unitIds) setErrors((e) => ({ ...e, unitIds: undefined }));
  };

  const save = async (e) => {
    e.preventDefault();
    const rules = { username: [required('Username is required')], email: [emailRule()] };
    if (!editId) rules.password = [required('Password is required')];
    const errs = runValidation(form, rules);
    if (!form.unitIds || form.unitIds.length === 0) errs.unitIds = 'Select at least one unit';
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (!(await confirmSave('Save User?', 'Save this user account?'))) return;
    try {
      if (editId) { await API.put(`/users/${editId}`, form); showSuccess('User updated'); }
      else { await API.post('/users', form); showSuccess('User added'); }
      setShowModal(false); load();
    } catch (err) { showError(err.response?.data?.message || 'Failed'); }
  };

  const del = async (id) => {
    if (!(await confirmAction('Delete User?', 'This permanently deletes the account. To just disable it temporarily, edit the user and tick "Inactive" instead.'))) return;
    try { await API.delete(`/users/${id}`); showSuccess('User deleted'); load(); }
    catch (err) { showError(err.response?.data?.message || 'Failed'); }
  };

  // ── Permissions grid ──
  const openPerms = async (u) => {
    setPermUser(u);
    try {
      const r = await API.get(`/authority/user/${u.userId}`);
      setPermRows(r.data);
    } catch { showError('Failed to load permissions'); }
  };

  const togglePerm = (moduleId, key) => {
    setPermRows((rs) => rs.map((r) => {
      if (r.moduleId !== moduleId) return r;
      const next = { ...r, [key]: !r[key] };
      // if any action is enabled, ensure canView too
      if (key !== 'canView' && next[key]) next.canView = true;
      // if view is turned off, turn all off
      if (key === 'canView' && !next.canView) { next.canCreate = false; next.canEdit = false; next.canDelete = false; }
      return next;
    }));
  };

  const savePerms = async () => {
    try {
      await API.post('/authority/save', { userId: permUser.userId, permissions: permRows });
      showSuccess('Permissions saved');
      setPermUser(null);
    } catch { showError('Failed to save permissions'); }
  };

  const columns = [
    { key: 'username', label: 'Username', render: (u) => <span style={{ fontWeight: 600 }}>{u.username}</span> },
    { key: 'unitName', label: 'Unit', value: (u) => u.unitName || '', render: (u) => u.unitName ? <span className="badge badge-grey">{u.unitName}</span> : '-' },
    { key: 'email', label: 'Email', value: (u) => u.email || '', render: (u) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {u.email || '-'}
        {u.email && (u.emailNotifications
          ? <Mail size={13} style={{ color: 'var(--secondary)' }} title="Email notifications on" />
          : <MailX size={13} style={{ color: 'var(--text-muted)' }} title="Email notifications off" />)}
      </span>
    ) },
    { key: 'isActive', label: 'Status', value: (u) => (u.isActive ? 'Active' : 'Inactive'), render: (u) => <span className={`badge ${u.isActive ? 'badge-success' : 'badge-danger'}`}>{u.isActive ? 'Active' : 'Inactive'}</span> },
  ];

  return (
    <>
      <DataGrid
        title="Users & Access"
        subtitle="Manage user accounts and per-module permissions"
        columns={columns}
        rows={users}
        rowKey={(u) => u.userId}
        exportName="Users"
        emptyText="No users found."
        toolbar={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--text-muted)' }}>
              <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} style={{ accentColor: 'var(--primary)', width: 15, height: 15 }} />
              Show inactive
            </label>
            <Link href="/modules" className="btn btn-outline"><Boxes size={16} /> Modules &amp; Nav</Link>
            <button className="btn btn-primary" onClick={() => openForm()}><Plus size={16} /> Add User</button>
          </div>
        }
        actions={(u) => (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" title="Permissions" onClick={() => openPerms(u)} style={{ borderColor: 'var(--primary)' }}><ShieldCheck size={14} /></button>
            <button className="btn btn-outline btn-sm" onClick={() => openForm(u)}><Edit2 size={14} /></button>
            <button className="btn btn-danger btn-sm" onClick={() => del(u.userId)}><Trash2 size={14} /></button>
          </div>
        )}
      />

      {/* Add/Edit user */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal modal-sm">
            <div className="modal-header"><div className="modal-title">{editId ? 'Edit User' : 'Add User'}</div><button className="modal-close" onClick={() => setShowModal(false)}>&times;</button></div>
            <form onSubmit={save} noValidate>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Username *</label>
                  <input className={`form-control ${errors.username ? 'input-error' : ''}`} value={form.username} onChange={(e) => set('username', e.target.value)} />
                  {errors.username && <span className="field-error">{errors.username}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Password {editId ? '(leave blank to keep)' : '*'}</label>
                  <input type="password" className={`form-control ${errors.password ? 'input-error' : ''}`} value={form.password} onChange={(e) => set('password', e.target.value)} />
                  {errors.password && <span className="field-error">{errors.password}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Email</label>
                  <input type="email" className={`form-control ${errors.email ? 'input-error' : ''}`} value={form.email || ''} onChange={(e) => set('email', e.target.value)} />
                  {errors.email && <span className="field-error">{errors.email}</span>}
                </div>

                {/* Units this user can access — pick one or more. */}
                <div className="form-group">
                  <label className="form-label">Units this user can access *</label>
                  <div className={`unit-multiselect ${errors.unitIds ? 'input-error' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto', border: '1px solid var(--border-col)', borderRadius: 10, padding: 10 }}>
                    {units.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No units available.</span>}
                    {units.map((u) => {
                      const checked = form.unitIds.includes(u.unitId);
                      const isHome = form.unitId === u.unitId;
                      return (
                        <label key={u.unitId} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleUnit(u.unitId)} style={{ accentColor: 'var(--primary)', width: 15, height: 15 }} />
                          <span style={{ fontWeight: checked ? 600 : 400 }}>{u.unitName}</span>
                          {isHome && <span className="badge badge-grey" style={{ fontSize: 10 }}>home</span>}
                        </label>
                      );
                    })}
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>User will see & manage the data of every ticked unit. First pick = home unit (new records they create are stamped with it).</span>
                  {errors.unitIds && <span className="field-error">{errors.unitIds}</span>}
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                    <input type="checkbox" checked={form.emailNotifications} onChange={(e) => set('emailNotifications', e.target.checked)} style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: form.emailNotifications ? 'var(--primary-dark)' : 'var(--text-muted)', fontWeight: 700 }}>
                      {form.emailNotifications ? <Mail size={14} /> : <MailX size={14} />} Send email notifications
                    </span>
                  </label>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 24 }}>Login alerts, notices &amp; holiday emails go to this user only if checked.</span>
                </div>
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                    <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
                    <span style={{ color: form.isActive ? 'var(--secondary)' : 'var(--text-muted)', fontWeight: 700 }}>{form.isActive ? 'Active' : 'Inactive'}</span>
                  </label>
                </div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Permission grid */}
      {permUser && (
        <div className="modal-overlay">
          <div className="modal modal-lg perm-modal">
            <div className="modal-header">
              <div className="modal-title">Permissions — {permUser.username}{permUser.unitName && <span className="badge badge-grey" style={{ marginLeft: 8 }}>{permUser.unitName}</span>}</div>
              <button className="modal-close" onClick={() => setPermUser(null)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-info" style={{ marginBottom: 14 }}>
                Access is fully permission-based. Tick exactly what this user may View / Create / Edit / Delete per module.
              </div>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>Module</th><th style={{ textAlign: 'center' }}>View</th><th style={{ textAlign: 'center' }}>Create</th><th style={{ textAlign: 'center' }}>Edit</th><th style={{ textAlign: 'center' }}>Delete</th></tr></thead>
                  <tbody>
                    {permRows.map((r) => (
                      <tr key={r.moduleId}>
                        <td style={{ fontWeight: 600 }}>{r.moduleName}</td>
                        {['canView', 'canCreate', 'canEdit', 'canDelete'].map((k) => (
                          <td key={k} style={{ textAlign: 'center' }}>
                            <input type="checkbox" checked={r[k]} onChange={() => togglePerm(r.moduleId, k)} style={{ accentColor: 'var(--primary)', width: 17, height: 17, cursor: 'pointer' }} />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setPermUser(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={savePerms}><ShieldCheck size={16} /> Save Permissions</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function UsersPage() {
  return (
    <RouteGuard module="Users">
      <UsersInner />
    </RouteGuard>
  );
}
