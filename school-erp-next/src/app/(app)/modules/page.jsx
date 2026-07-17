'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import API from '@/lib/api';
import { Plus, Edit2, Trash2, GripVertical, Save, Eye, EyeOff, Boxes, ArrowLeft } from 'lucide-react';
import { showSuccess, showError, confirmAction, confirmSave } from '@/lib/alert';
import RouteGuard from '@/components/RouteGuard';
import { usePermissions } from '@/lib/PermissionContext';
import { useNav } from '@/lib/NavContext';
import { getIcon, ICON_NAMES } from '@/lib/iconMap';

const EMPTY = { moduleName: '', displayName: '', route: '', icon: 'Box', isActive: true };

function ModulesInner() {
  const { can } = usePermissions();
  const { refresh: refreshNav } = useNav();
  const canEdit = can('Users', 'canEdit');
  const canDelete = can('Users', 'canDelete');

  const [modules, setModules] = useState([]);
  const [dirty, setDirty] = useState(false);       // order changed but not saved
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const dragIndex = useRef(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const load = () => API.get('/authority/modules')
    .then((r) => { setModules(r.data); setDirty(false); })
    .catch(() => showError('Failed to load modules'));
  useEffect(() => { load(); }, []);

  // ── Drag & drop reorder ──
  const onDragStart = (i) => { dragIndex.current = i; };
  const onDragOver = (e, i) => {
    e.preventDefault();
    const from = dragIndex.current;
    if (from === null || from === i) return;
    setModules((list) => {
      const next = [...list];
      const [moved] = next.splice(from, 1);
      next.splice(i, 0, moved);
      dragIndex.current = i;
      return next;
    });
    setDirty(true);
  };
  const onDragEnd = () => { dragIndex.current = null; };

  const saveOrder = async () => {
    try {
      await API.post('/authority/modules/reorder', { orderedIds: modules.map((m) => m.moduleId) });
      showSuccess('Order saved');
      setDirty(false);
      refreshNav();
    } catch { showError('Failed to save order'); }
  };

  // ── Add / edit ──
  const openForm = (m = null) => {
    if (m) { setEditId(m.moduleId); setForm({ moduleName: m.moduleName, displayName: m.displayName || '', route: m.route || '', icon: m.icon || 'Box', isActive: m.isActive }); }
    else { setEditId(null); setForm(EMPTY); }
    setShowModal(true);
  };

  const save = async () => {
    if (!form.moduleName.trim()) { showError('Module name (RBAC key) is required'); return; }
    if (!(await confirmSave(editId ? 'Update Module?' : 'Add Module?', 'Save this module configuration?'))) return;
    try {
      if (editId) await API.put(`/authority/modules/${editId}`, form);
      else await API.post('/authority/modules', form);
      showSuccess('Saved');
      setShowModal(false);
      load();
      refreshNav();
    } catch (err) { showError(err.response?.data?.message || 'Failed'); }
  };

  const toggleActive = async (m) => {
    try {
      await API.put(`/authority/modules/${m.moduleId}`, {
        moduleName: m.moduleName, displayName: m.displayName, route: m.route, icon: m.icon, isActive: !m.isActive,
      });
      load();
      refreshNav();
    } catch { showError('Failed'); }
  };

  const del = async (m) => {
    if (!(await confirmAction('Delete Module?', `Remove "${m.displayName || m.moduleName}" and all its permission grants? This cannot be undone.`))) return;
    try { await API.delete(`/authority/modules/${m.moduleId}`); showSuccess('Deleted'); load(); refreshNav(); }
    catch (err) { showError(err.response?.data?.message || 'Failed'); }
  };

  return (
    <>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link href="/users" className="btn btn-outline btn-sm" title="Back to Users & Access"><ArrowLeft size={15} /> Back</Link>
          <div>
            <div className="page-title">Modules & Navigation</div>
            <div className="page-subtitle">Add, reorder (drag) and configure the modules that drive the sidebar &amp; access control</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {dirty && canEdit && <button className="btn btn-success" onClick={saveOrder}><Save size={15} /> Save Order</button>}
          {canEdit && <button className="btn btn-primary" onClick={() => openForm()}><Plus size={15} /> Add Module</button>}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        {/* Scroll lives INSIDE the grid — header/buttons stay put, only the table body scrolls. */}
        <div className="table-wrapper" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100vh - 220px)', borderRadius: 12 }}>
          <table>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr>
                <th style={{ width: 40 }}></th>
                <th style={{ width: 60 }}>Icon</th>
                <th>Display Name</th>
                <th>Module Key (RBAC)</th>
                <th>Route</th>
                <th>In Nav</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {modules.map((m, i) => {
                const Icon = getIcon(m.icon);
                return (
                  <tr
                    key={m.moduleId}
                    draggable={canEdit}
                    onDragStart={() => onDragStart(i)}
                    onDragOver={(e) => onDragOver(e, i)}
                    onDragEnd={onDragEnd}
                    style={{ cursor: canEdit ? 'grab' : 'default', opacity: m.isActive ? 1 : 0.5 }}
                  >
                    <td style={{ color: 'var(--text-muted)' }}>{canEdit && <GripVertical size={16} />}</td>
                    <td><span style={{ display: 'inline-flex', width: 30, height: 30, borderRadius: 8, background: 'var(--bg-hover, rgba(37,99,235,.1))', alignItems: 'center', justifyContent: 'center', color: 'var(--primary)' }}><Icon size={16} /></span></td>
                    <td style={{ fontWeight: 600 }}>{m.displayName || m.moduleName}</td>
                    <td><span className="badge badge-info">{m.moduleName}</span></td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{m.route || <em>— no page —</em>}</td>
                    <td>
                      <button className="btn btn-outline btn-sm" title={m.isActive ? 'Shown in sidebar' : 'Hidden from sidebar'} onClick={() => canEdit && toggleActive(m)} disabled={!canEdit}>
                        {m.isActive ? <><Eye size={13} /> Yes</> : <><EyeOff size={13} /> No</>}
                      </button>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {canEdit && <button className="btn btn-outline btn-sm" onClick={() => openForm(m)}><Edit2 size={13} /></button>}
                        {canDelete && <button className="btn btn-danger btn-sm" onClick={() => del(m)}><Trash2 size={13} /></button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {modules.length === 0 && <tr><td colSpan={7} className="empty-state">No modules yet.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Boxes size={14} /> Drag rows to reorder — the order here is the sidebar order and the default landing priority (top-most a user can access). Give access to each module from <b>Users &amp; Access</b>.
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal modal-md">
            <div className="modal-header">
              <div className="modal-title">{editId ? 'Edit Module' : 'Add Module'}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Module Key (RBAC) *</label>
                  <input className="form-control" value={form.moduleName} onChange={(e) => set('moduleName', e.target.value)} placeholder="e.g. Inventory" disabled={!!editId} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Must match the backend permission name. {editId && 'Locked after creation.'}</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Display Name</label>
                  <input className="form-control" value={form.displayName} onChange={(e) => set('displayName', e.target.value)} placeholder="Sidebar label" />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Route (page path)</label>
                  <input className="form-control" value={form.route} onChange={(e) => set('route', e.target.value)} placeholder="/inventory" />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>The page must exist in the app, else it 404s. Leave blank for a permission-only module.</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Icon</label>
                  <select className="form-control" value={form.icon} onChange={(e) => set('icon', e.target.value)}>
                    {ICON_NAMES.map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 4 }}>
                <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} />
                <span>Show in sidebar (active)</span>
              </label>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>💾 Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function ModulesPage() {
  return (
    <RouteGuard module="Users">
      <ModulesInner />
    </RouteGuard>
  );
}
