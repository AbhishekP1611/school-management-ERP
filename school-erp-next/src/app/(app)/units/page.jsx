'use client';

import { useState, useEffect, useRef } from 'react';
import API from '@/lib/api';
import { Plus, Edit2, Trash2, Building2, Users, Camera } from 'lucide-react';
import { showSuccess, showError, confirmAction, confirmSave } from '@/lib/alert';
import { runValidation, required, email as emailRule, phone as phoneRule } from '@/lib/validate';
import DataGrid from '@/components/DataGrid';
import RouteGuard from '@/components/RouteGuard';

const EMPTY = {
  unitName: '', gstNo: '', registrationNo: '', principalName: '',
  address: '', city: '', state: '', pincode: '', phone: '', email: '', logoUrl: '', isActive: true,
};

function UnitsInner() {
  const logoRef = useRef();
  const [units, setUnits] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [logoPreview, setLogoPreview] = useState('');

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined })); };

  const load = () => API.get('/units').then((r) => setUnits(r.data)).catch(console.error);
  useEffect(() => { load(); }, []);

  const openForm = (u = null) => {
    setErrors({});
    if (u) { setEditId(u.unitId); setForm({ ...EMPTY, ...u }); setLogoPreview(u.logoUrl || ''); }
    else { setEditId(null); setForm(EMPTY); setLogoPreview(''); }
    setShowModal(true);
  };

  const handleLogo = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => { setLogoPreview(reader.result); set('logoUrl', reader.result); };
    reader.readAsDataURL(file);
  };

  const save = async (e) => {
    e.preventDefault();
    const errs = runValidation(form, {
      unitName: [required('Unit name is required')],
      email: [emailRule()],
      phone: [phoneRule()],
    });
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (!(await confirmSave('Save Unit?', 'Save this school unit?'))) return;
    try {
      if (editId) { await API.put(`/units/${editId}`, form); showSuccess('Unit updated'); }
      else { await API.post('/units', form); showSuccess('Unit added'); }
      setShowModal(false); load();
    } catch (err) { showError(err.response?.data?.message || 'Failed'); }
  };

  const del = async (id) => {
    if (!(await confirmAction('Delete Unit?', 'Delete this unit?'))) return;
    try { await API.delete(`/units/${id}`); showSuccess('Unit deleted'); load(); }
    catch (err) { showError(err.response?.data?.message || 'Failed'); }
  };

  const columns = [
    {
      key: 'unitName', label: 'Unit',
      render: (u) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {u.logoUrl ? <img src={u.logoUrl} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover' }} /> : <div className="stat-icon" style={{ width: 34, height: 34, background: 'var(--primary-light)', color: 'var(--primary)' }}><Building2 size={17} /></div>}
          <div>
            <div style={{ fontWeight: 600 }}>{u.unitName}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{[u.city, u.state].filter(Boolean).join(', ')}</div>
          </div>
        </div>
      ),
    },
    { key: 'gstNo', label: 'GST No', value: (u) => u.gstNo || '', render: (u) => u.gstNo || '-' },
    { key: 'principalName', label: 'Principal', value: (u) => u.principalName || '', render: (u) => u.principalName || '-' },
    { key: 'phone', label: 'Phone', value: (u) => u.phone || '', render: (u) => u.phone || '-' },
    { key: 'studentCount', label: 'Students', render: (u) => <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Users size={12} /> {u.studentCount}</span> },
    { key: 'userCount', label: 'Users' },
    { key: 'isActive', label: 'Status', value: (u) => (u.isActive ? 'Active' : 'Inactive'), render: (u) => <span className={`badge ${u.isActive ? 'badge-success' : 'badge-danger'}`}>{u.isActive ? 'Active' : 'Inactive'}</span> },
  ];

  return (
    <>
      <DataGrid
        title="School Units"
        subtitle="Manage all branches / units — each has its own students, staff & data"
        columns={columns}
        rows={units}
        rowKey={(u) => u.unitId}
        exportName="Units"
        emptyText="No units yet."
        toolbar={<button className="btn btn-primary" onClick={() => openForm()}><Plus size={16} /> Add Unit</button>}
        actions={(u) => (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => openForm(u)}><Edit2 size={14} /></button>
            <button className="btn btn-danger btn-sm" onClick={() => del(u.unitId)}><Trash2 size={14} /></button>
          </div>
        )}
      />

      {showModal && (
        <div className="modal-overlay">
          <div className="modal student-modal" style={{ width: '80vw', maxWidth: 1000 }}>
            <div className="modal-header">
              <div className="modal-title">{editId ? 'Edit Unit' : 'Add School Unit'}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={save} noValidate>
              <div className="modal-body">
                {/* Logo + name */}
                <div style={{ display: 'flex', gap: 20, marginBottom: 18, alignItems: 'flex-start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                    <div onClick={() => logoRef.current.click()} style={{ width: 80, height: 80, borderRadius: 14, background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', border: '2px dashed #cbd5e1' }}>
                      {logoPreview ? <img src={logoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Camera size={22} color="#94a3b8" />}
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Logo</span>
                    <input ref={logoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleLogo} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div className="form-group">
                      <label className="form-label">Unit / Branch Name *</label>
                      <input className={`form-control ${errors.unitName ? 'input-error' : ''}`} value={form.unitName} onChange={(e) => set('unitName', e.target.value)} placeholder="e.g. ABC Vidhya Mandir - Branch 2" />
                      {errors.unitName && <span className="field-error">{errors.unitName}</span>}
                    </div>
                  </div>
                </div>

                <div className="form-section-title">🏫 Official Details</div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">GST No</label><input className="form-control" value={form.gstNo || ''} onChange={(e) => set('gstNo', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Registration / Affiliation No</label><input className="form-control" value={form.registrationNo || ''} onChange={(e) => set('registrationNo', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Principal Name</label><input className="form-control" value={form.principalName || ''} onChange={(e) => set('principalName', e.target.value)} /></div>
                </div>

                <div className="form-section-title" style={{ marginTop: 14 }}>📍 Address &amp; Contact</div>
                <div className="form-row">
                  <div className="form-group"><label className="form-label">City</label><input className="form-control" value={form.city || ''} onChange={(e) => set('city', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">State</label><input className="form-control" value={form.state || ''} onChange={(e) => set('state', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Pincode</label><input className="form-control" value={form.pincode || ''} onChange={(e) => set('pincode', e.target.value)} /></div>
                  <div className="form-group"><label className="form-label">Phone</label><input className={`form-control ${errors.phone ? 'input-error' : ''}`} value={form.phone || ''} onChange={(e) => set('phone', e.target.value)} />{errors.phone && <span className="field-error">{errors.phone}</span>}</div>
                  <div className="form-group"><label className="form-label">Email</label><input type="email" className={`form-control ${errors.email ? 'input-error' : ''}`} value={form.email || ''} onChange={(e) => set('email', e.target.value)} />{errors.email && <span className="field-error">{errors.email}</span>}</div>
                </div>
                <div className="form-group"><label className="form-label">Full Address</label><textarea className="form-control" value={form.address || ''} onChange={(e) => set('address', e.target.value)} rows="2" /></div>

                {editId && (
                  <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                      <input type="checkbox" checked={form.isActive} onChange={(e) => set('isActive', e.target.checked)} style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
                      <span style={{ color: form.isActive ? 'var(--secondary)' : 'var(--text-muted)', fontWeight: 700 }}>{form.isActive ? 'Active Unit' : 'Inactive'}</span>
                    </label>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Unit</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default function UnitsPage() {
  return (
    <RouteGuard module="Units">
      <UnitsInner />
    </RouteGuard>
  );
}
