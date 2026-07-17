'use client';

import { useState, useEffect, useRef } from 'react';
import API from '@/lib/api';
import { Plus, Edit2, Trash2, Camera } from 'lucide-react';
import { showSuccess, showError, confirmAction, confirmSave } from '@/lib/alert';
import { runValidation, required, email as emailRule, phone as phoneRule, positive } from '@/lib/validate';
import DataGrid from '@/components/DataGrid';
import RouteGuard from '@/components/RouteGuard';

const EMPTY = {
  employeeId: '', firstName: '', lastName: '', email: '',
  phone: '', designation: '', specialization: '', salary: 0,
  dateOfJoining: '', gender: 'Male', address: '', isActive: true,
  // extended
  photoUrl: '', qualification: '', dateOfBirth: '', experienceYears: '',
  bloodGroup: '', maritalStatus: 'Single', religion: '', category: 'General',
  emergencyContact: '', aadharNo: '',
};

function TeachersInner() {
  const photoRef = useRef();
  const [teachers, setTeachers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState(EMPTY);
  const [photoPreview, setPhotoPreview] = useState('');
  const [loadingNext, setLoadingNext] = useState(false);
  const [errors, setErrors] = useState({});

  const set = (field, val) => {
    setFormData((f) => ({ ...f, [field]: val }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const loadData = () => {
    API.get('/teachers').then((res) => setTeachers(res.data)).catch(console.error);
  };
  useEffect(() => { loadData(); }, []);

  const handlePhoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result);
      set('photoUrl', reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = runValidation(formData, {
      employeeId: [required('Employee ID is required')],
      firstName: [required('First name is required')],
      lastName: [required('Last name is required')],
      email: [required('Email is required'), emailRule()],
      phone: [phoneRule()],
      emergencyContact: [phoneRule()],
      salary: [positive('Salary cannot be negative')],
    });
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (!(await confirmSave('Save Teacher?', 'Do you want to save these teacher details?'))) return;
    const payload = { ...formData, experienceYears: formData.experienceYears === '' ? null : Number(formData.experienceYears) };
    try {
      if (editId) {
        await API.put(`/teachers/${editId}`, payload);
        showSuccess('Teacher updated');
      } else {
        await API.post('/teachers', payload);
        showSuccess('Teacher added');
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      showError(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirmAction('Delete Teacher?', 'Are you sure you want to delete this teacher?'))) return;
    try {
      await API.delete(`/teachers/${id}`);
      showSuccess('Teacher deleted');
      loadData();
    } catch {
      showError('Failed to delete');
    }
  };

  const openForm = async (teacher = null) => {
    setErrors({});
    setPhotoPreview('');
    if (teacher) {
      setEditId(teacher.teacherId);
      setFormData({ ...EMPTY, ...teacher, experienceYears: teacher.experienceYears ?? '', maritalStatus: teacher.maritalStatus || 'Single', category: teacher.category || 'General' });
      setPhotoPreview(teacher.photoUrl || '');
    } else {
      setEditId(null);
      setFormData(EMPTY);
      setLoadingNext(true);
      try {
        const r = await API.get('/teachers/next-employee-id');
        set('employeeId', r.data.nextEmployeeId);
      } catch {} finally { setLoadingNext(false); }
    }
    setShowModal(true);
  };

  const columns = [
    {
      key: 'firstName', label: 'Teacher',
      value: (t) => `${t.firstName} ${t.lastName}`,
      exportFormat: (_, t) => `${t.firstName} ${t.lastName}`,
      render: (t) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {t.photoUrl
            ? <img src={t.photoUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
            : <div className="user-avatar" style={{ width: '32px', height: '32px', fontSize: '12px' }}>{t.firstName.charAt(0)}</div>}
          <div style={{ fontWeight: 600 }}>{t.firstName} {t.lastName}</div>
        </div>
      ),
    },
    { key: 'employeeId', label: 'Employee ID', render: (t) => <span className="badge badge-grey">{t.employeeId}</span> },
    { key: 'designation', label: 'Designation' },
    { key: 'specialization', label: 'Subject' },
    { key: 'qualification', label: 'Qualification', value: (t) => t.qualification || '', render: (t) => t.qualification || '-' },
    { key: 'experienceYears', label: 'Experience', value: (t) => t.experienceYears ?? '', render: (t) => t.experienceYears != null ? `${t.experienceYears} yrs` : '-' },
    { key: 'phone', label: 'Contact' },
  ];

  return (
    <>
      <DataGrid
        title="Faculty Directory"
        subtitle="Manage teaching staff & profiles"
        columns={columns}
        rows={teachers}
        rowKey={(t) => t.teacherId}
        exportName="Teachers"
        emptyText="No teachers found."
        toolbar={
          <button className="btn btn-primary" onClick={() => openForm()}>
            <Plus size={16} /> Add Teacher
          </button>
        }
        actions={(t) => (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-outline btn-sm" onClick={() => openForm(t)}><Edit2 size={14} /></button>
            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t.teacherId)}><Trash2 size={14} /></button>
          </div>
        )}
      />

      {showModal && (
        <div className="modal-overlay">
          <div className="modal student-modal" style={{ width: '80vw', maxWidth: 1300 }}>
            {/* Header */}
            <div className="modal-header" style={{ background: editId ? 'linear-gradient(135deg,#172554,#2563eb)' : 'var(--surface)', borderRadius: '16px 16px 0 0' }}>
              {editId ? (
                <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 16 }}>
                  <div style={{ position: 'relative' }}>
                    {photoPreview
                      ? <img src={photoPreview} alt="profile" style={{ width: 64, height: 64, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.5)' }} />
                      : <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, color: '#fff', border: '3px solid rgba(255,255,255,0.3)' }}>{formData.firstName?.charAt(0) || '?'}</div>}
                    <button onClick={() => photoRef.current.click()} style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', background: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Camera size={12} color="#2563eb" />
                    </button>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{formData.firstName} {formData.lastName}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '2px 10px', borderRadius: 20, fontSize: 11 }}>🆔 {formData.employeeId}</span>
                      {formData.designation && <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '2px 10px', borderRadius: 20, fontSize: 11 }}>{formData.designation}</span>}
                      {formData.specialization && <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '2px 10px', borderRadius: 20, fontSize: 11 }}>📘 {formData.specialization}</span>}
                    </div>
                  </div>
                  <button className="modal-close" onClick={() => setShowModal(false)} style={{ color: '#fff', background: 'rgba(255,255,255,0.15)' }}>&times;</button>
                </div>
              ) : (
                <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="modal-title">Add New Teacher</div>
                  <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
                </div>
              )}
            </div>

            <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />

            <form onSubmit={handleSubmit} noValidate>
              <div className="modal-body">
                {/* Photo + Employee ID (add mode) */}
                {!editId && (
                  <div style={{ display: 'flex', gap: 20, marginBottom: 18, alignItems: 'flex-start' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                      <div onClick={() => photoRef.current.click()} style={{ width: 80, height: 80, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', border: '2px dashed #cbd5e1' }}>
                        {photoPreview ? <img src={photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Camera size={24} color="#94a3b8" />}
                      </div>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Click to upload</span>
                    </div>
                    <div style={{ flex: 1 }}>
                      <div className="form-group">
                        <label className="form-label">Employee ID (Auto-Generated)</label>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <input className="form-control" value={loadingNext ? 'Generating...' : formData.employeeId} readOnly style={{ background: '#f8fafc', fontWeight: 700, color: 'var(--primary)', letterSpacing: 1 }} />
                          <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>Next Available</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Professional */}
                <div className="form-section-title">💼 Professional Details</div>
                <div className="form-row">
                  {editId && (
                    <div className="form-group">
                      <label className="form-label">Employee ID *</label>
                      <input className={`form-control ${errors.employeeId ? 'input-error' : ''}`} value={formData.employeeId} onChange={(e) => set('employeeId', e.target.value)} />
                      {errors.employeeId && <span className="field-error">{errors.employeeId}</span>}
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Designation</label>
                    <input className="form-control" value={formData.designation || ''} onChange={(e) => set('designation', e.target.value)} placeholder="e.g. Senior Teacher" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Subject Specialization</label>
                    <input className="form-control" value={formData.specialization || ''} onChange={(e) => set('specialization', e.target.value)} placeholder="e.g. Mathematics" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Qualification</label>
                    <input className="form-control" value={formData.qualification || ''} onChange={(e) => set('qualification', e.target.value)} placeholder="e.g. M.Sc, B.Ed" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Experience (years)</label>
                    <input type="number" className="form-control" value={formData.experienceYears} onChange={(e) => set('experienceYears', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Basic Salary</label>
                    <input type="number" className={`form-control ${errors.salary ? 'input-error' : ''}`} value={formData.salary} onChange={(e) => set('salary', e.target.value)} />
                    {errors.salary && <span className="field-error">{errors.salary}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Joining Date</label>
                    <input type="date" className="form-control" value={formData.dateOfJoining || ''} onChange={(e) => set('dateOfJoining', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                      <input type="checkbox" checked={formData.isActive} onChange={(e) => set('isActive', e.target.checked)} style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
                      <span style={{ color: formData.isActive ? 'var(--secondary)' : 'var(--text-muted)', fontWeight: 700 }}>{formData.isActive ? 'Active' : 'Inactive'}</span>
                    </label>
                  </div>
                </div>

                {/* Personal */}
                <div className="form-section-title" style={{ marginTop: 16 }}>👤 Personal Details</div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">First Name *</label>
                    <input className={`form-control ${errors.firstName ? 'input-error' : ''}`} value={formData.firstName} onChange={(e) => set('firstName', e.target.value)} />
                    {errors.firstName && <span className="field-error">{errors.firstName}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Last Name *</label>
                    <input className={`form-control ${errors.lastName ? 'input-error' : ''}`} value={formData.lastName} onChange={(e) => set('lastName', e.target.value)} />
                    {errors.lastName && <span className="field-error">{errors.lastName}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Date of Birth</label>
                    <input type="date" className="form-control" value={formData.dateOfBirth || ''} onChange={(e) => set('dateOfBirth', e.target.value)} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Gender</label>
                    <select className="form-control" value={formData.gender} onChange={(e) => set('gender', e.target.value)}>
                      <option>Male</option><option>Female</option><option>Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Blood Group</label>
                    <select className="form-control" value={formData.bloodGroup || ''} onChange={(e) => set('bloodGroup', e.target.value)}>
                      <option value="">Select</option>
                      {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => <option key={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Marital Status</label>
                    <select className="form-control" value={formData.maritalStatus} onChange={(e) => set('maritalStatus', e.target.value)}>
                      <option>Single</option><option>Married</option><option>Other</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Religion</label>
                    <select className="form-control" value={formData.religion || ''} onChange={(e) => set('religion', e.target.value)}>
                      <option value="">Select</option>
                      {['Hindu', 'Muslim', 'Christian', 'Sikh', 'Jain', 'Buddhist', 'Other'].map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Category</label>
                    <select className="form-control" value={formData.category} onChange={(e) => set('category', e.target.value)}>
                      <option>General</option><option>OBC</option><option>SC/ST</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Aadhar No</label>
                    <input className="form-control" value={formData.aadharNo || ''} onChange={(e) => set('aadharNo', e.target.value)} />
                  </div>
                </div>

                {/* Contact */}
                <div className="form-section-title" style={{ marginTop: 16 }}>📞 Contact Information</div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Email *</label>
                    <input type="email" className={`form-control ${errors.email ? 'input-error' : ''}`} value={formData.email} onChange={(e) => set('email', e.target.value)} />
                    {errors.email && <span className="field-error">{errors.email}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Mobile No</label>
                    <input className={`form-control ${errors.phone ? 'input-error' : ''}`} value={formData.phone || ''} onChange={(e) => set('phone', e.target.value)} />
                    {errors.phone && <span className="field-error">{errors.phone}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Emergency Contact</label>
                    <input className={`form-control ${errors.emergencyContact ? 'input-error' : ''}`} value={formData.emergencyContact || ''} onChange={(e) => set('emergencyContact', e.target.value)} />
                    {errors.emergencyContact && <span className="field-error">{errors.emergencyContact}</span>}
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Permanent Address</label>
                  <textarea className="form-control" value={formData.address || ''} onChange={(e) => set('address', e.target.value)} rows="2" placeholder="Full address..." />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">💾 Save Teacher</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

export default function TeachersPage() {
  return (
    <RouteGuard module="Teachers">
      <TeachersInner />
    </RouteGuard>
  );
}
