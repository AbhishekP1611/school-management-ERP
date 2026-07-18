'use client';

import { useState, useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import API from '@/lib/api';
import { Plus, Edit2, Trash2, Camera, Printer, Bus as BusIcon, MapPin, Clock, Navigation, Users, X } from 'lucide-react';
import { showSuccess, showError, confirmAction, confirmSave } from '@/lib/alert';
import { runValidation, required, email as emailRule, phone as phoneRule } from '@/lib/validate';
import { printFeeReceipt } from '@/lib/printReceipt';
import DataGrid from '@/components/DataGrid';
import RouteGuard from '@/components/RouteGuard';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/lib/PermissionContext';
import { useAcademicYear } from '@/lib/AcademicYearContext';

// Leaflet map for the bus-route popup — client-only (no SSR)
const RouteMap = dynamic(() => import('@/components/RouteMap'), { ssr: false, loading: () => <div className="empty-state" style={{ height: 260 }}>Loading map…</div> });

const EMPTY_FORM = {
  admissionNo: '', rollNo: '', firstName: '', lastName: '',
  gender: '', dateOfBirth: '', bloodGroup: '',
  phone: '', email: '', address: '',
  classId: '', parentName: '', parentPhone: '', parentEmail: '',
  admissionDate: new Date().toISOString().split('T')[0],
  academicYear: '2025-26', photoUrl: '',
  // extended
  religion: '', category: 'General', aadharNo: '',
  fatherName: '', motherName: '', fatherOccupation: '', motherOccupation: '',
  emergencyContact: '', busId: '', stopId: '', isActive: true,
};

const EMPTY_FEE ={ feeType: 'Tuition', amount: '', discount: 0, paidAmount: '', paymentMode: 'Cash', status: 'Paid', paymentDate: new Date().toISOString().split('T')[0], remarks: '' };

function StudentsInner() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const { year: selectedYear } = useAcademicYear();   // topbar-selected academic year
  const canCreate = can('Students', 'canCreate');
  const canEdit = can('Students', 'canEdit');
  const canDelete = can('Students', 'canDelete');
  const canSave = canCreate || canEdit;   // form save allowed if either
  const photoRef = useRef();

  const [students, setStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [buses, setBuses] = useState([]);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [activeTab, setActiveTab] = useState('Details');
  const [editId, setEditId] = useState(null);
  const [studentFees, setStudentFees] = useState([]);
  const [marksheet, setMarksheet] = useState([]);          // exam-wise results (read-only)
  const [selectedExamId, setSelectedExamId] = useState('');
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [photoPreview, setPhotoPreview] = useState('');
  const [loadingNext, setLoadingNext] = useState(false);
  const [loadingRoll, setLoadingRoll] = useState(false);
  const [errors, setErrors] = useState({});

  // bus/route picker popup
  const [showBusPopup, setShowBusPopup] = useState(false);
  const [popupBusId, setPopupBusId] = useState('');   // route highlighted inside the popup
  const [popupStopId, setPopupStopId] = useState('');  // stop staged inside the popup

  // sub-forms
  const [feeForm, setFeeForm] = useState(EMPTY_FEE);

  const set = (field, val) => {
    setFormData((f) => ({ ...f, [field]: val }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  // Roll No is class-wise: picking a class fetches that class's next roll no
  // (its last roll + 1; section & stream don't matter). Clearing the class clears it.
  const handleClassChange = async (classId) => {
    set('classId', classId);
    if (editId) return;              // editing keeps the student's existing roll no
    if (!classId) { set('rollNo', ''); return; }
    setLoadingRoll(true);
    try {
      const r = await API.get(`/students/next-roll-no?classId=${classId}`);
      set('rollNo', r.data.nextRollNo);
    } catch {} finally { setLoadingRoll(false); }
  };

  const loadData = () => {
    API.get(`/students?search=${search}&classId=${classFilter}`).then((r) => setStudents(r.data)).catch(console.error);
    API.get('/classes').then((r) => setClasses(r.data)).catch(console.error);
    // full routes (with stops) so the bus popup can show each route
    API.get('/transport/routes').then((r) => setBuses(r.data)).catch(() => setBuses([]));
  };
  useEffect(() => { loadData(); }, [search, classFilter]);

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
      // ── Mandatory fields ──
      firstName:   [required('First name is required')],
      lastName:    [required('Last name is required')],
      classId:     [required('Please select a class')],
      dateOfBirth: [required('Date of birth is required')],
      gender:      [required('Please select gender')],
      fatherName:  [required("Father's name is required")],
      parentPhone: [required('Parent phone is required'), phoneRule()],
      // ── Optional, but must be valid if filled ──
      email:            [emailRule()],
      phone:            [phoneRule()],
      parentEmail:      [emailRule()],
      emergencyContact: [phoneRule()],
    });
    if (Object.keys(errs).length) {
      // No popup — just highlight the offending fields inline and jump to their tab.
      setErrors(errs);
      setActiveTab('Details');
      return;
    }

    // On CREATE, at least one fee row is mandatory.
    if (!editId && studentFees.length === 0) {
      showError('Please add at least one fee record in the Fees tab.');
      setActiveTab('Fees');
      return;
    }

    if (!(await confirmSave('Save Student?', 'Do you want to save these student details?'))) return;

    const payload = {
      ...formData,
      busId: formData.busId ? Number(formData.busId) : null,
      stopId: formData.busId && formData.stopId ? Number(formData.stopId) : null,
    };

    // Bundle staged fees on create (single save). Academic results are read-only
    // here — they come from the Exams & Results module.
    if (!editId) {
      payload.fees = studentFees.map((f) => ({
        feeType: f.feeType,
        amount: f.amount,
        discount: f.discount,
        paidAmount: f.paidAmount,
        paymentMode: f.paymentMode,
        status: f.status,
        paymentDate: f.paymentDate,
        remarks: f.remarks,
      }));
    }

    try {
      if (editId) {
        await API.put(`/students/${editId}`, payload);
        showSuccess('Student updated');
      } else {
        await API.post('/students', payload);
        showSuccess('Student added');
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      showError(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirmAction('Delete Student?', 'Are you sure you want to delete this student?'))) return;
    try {
      await API.delete(`/students/${id}`);
      showSuccess('Student deleted');
      loadData();
    } catch {
      showError('Failed to delete');
    }
  };

  const openForm = async (studentToEdit = null) => {
    setActiveTab('Details');
    setStudentFees([]);
    setMarksheet([]);
    setSelectedExamId('');
    setPhotoPreview('');
    setErrors({});
    setFeeForm(EMPTY_FEE);

    if (studentToEdit) {
      setEditId(studentToEdit.studentId);
      try {
        const res = await API.get(`/students/${studentToEdit.studentId}`);
        const s = res.data.student;
        setStudentFees(res.data.fees || []);
        setFormData({ ...EMPTY_FORM, ...s, classId: s.classId || '', busId: s.busId || '', stopId: s.stopId || '', photoUrl: s.photoUrl || '', category: s.category || 'General' });
        setPhotoPreview(s.photoUrl || '');
        // load exam-wise results (read-only) from the Exams module
        API.get(`/results/by-student?studentId=${studentToEdit.studentId}`).then((r) => setMarksheet(r.data)).catch(() => setMarksheet([]));
      } catch { showError('Failed to load student details'); }
    } else {
      setEditId(null);
      // Default a new student to the academic year currently selected in the topbar,
      // so they show up under the active year (not a hardcoded one).
      setFormData({ ...EMPTY_FORM, academicYear: selectedYear || EMPTY_FORM.academicYear });
      setLoadingNext(true);
      try {
        // Admission No is a global running sequence (fetched now).
        // Roll No is class-wise — it fills in when a class is picked (handleClassChange).
        const r = await API.get('/students/next-admission-no');
        set('admissionNo', r.data.nextAdmissionNo);
      } catch {} finally { setLoadingNext(false); }
    }
    setShowModal(true);
  };

  // ── Fee add / delete ──
  const addFee = async () => {
    if (!feeForm.amount || !feeForm.feeType) {
      showError('Fee type and amount are required');
      return;
    }
    const amount = Number(feeForm.amount) || 0;
    const discount = Number(feeForm.discount) || 0;
    const paid = Number(feeForm.paidAmount) || 0;
    const localRow = {
      feeId: editId ? undefined : `tmp_${Date.now()}`,
      feeType: feeForm.feeType,
      amount, discount, paidAmount: paid,
      balanceAmount: amount - discount - paid,
      paymentMode: feeForm.paymentMode,
      status: feeForm.status,
      paymentDate: feeForm.paymentDate,
      remarks: feeForm.remarks,
    };
    if (!editId) {
      setStudentFees((f) => [...f, localRow]);
      setFeeForm(EMPTY_FEE);
      return;
    }
    try {
      await API.post('/fees', { studentId: editId, ...localRow, feeId: undefined });
      const res = await API.get(`/students/${editId}`);
      setStudentFees(res.data.fees || []);
      setFeeForm(EMPTY_FEE);
      showSuccess('Fee record added');
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to add fee');
    }
  };

  const removeLocalFee = (feeId) => {
    setStudentFees((f) => f.filter((r) => r.feeId !== feeId));
  };

  const feeTotals = studentFees.reduce(
    (acc, f) => ({
      total: acc.total + (f.amount || 0),
      paid: acc.paid + (f.paidAmount || 0),
      balance: acc.balance + (f.balanceAmount || 0),
    }),
    { total: 0, paid: 0, balance: 0 }
  );

  const columns = [
    {
      key: 'firstName', label: 'Student',
      value: (s) => `${s.firstName} ${s.lastName} ${s.email || ''}`,
      exportFormat: (_, s) => `${s.firstName} ${s.lastName}`,
      render: (s) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {s.photoUrl
            ? <img src={s.photoUrl} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
            : <div className="user-avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{s.firstName.charAt(0)}</div>}
          <div>
            <div style={{ fontWeight: 600 }}>{s.firstName} {s.lastName}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.email || ''}</div>
          </div>
        </div>
      ),
    },
    { key: 'admissionNo', label: 'Admission No', render: (s) => <span className="badge badge-grey">{s.admissionNo}</span> },
    { key: 'rollNo', label: 'Roll No', value: (s) => s.rollNo || '', render: (s) => s.rollNo || '-' },
    { key: 'className', label: 'Class', value: (s) => (s.className ? `${s.className} (${s.section || ''})` : ''), render: (s) => (s.className ? `${s.className} (${s.section || ''})` : '-') },
    {
      key: 'gender', label: 'Gender / DOB',
      value: (s) => `${s.gender} ${s.dateOfBirth || ''}`,
      render: (s) => <>{s.gender} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({s.dateOfBirth || '-'})</span></>,
    },
    { key: 'bloodGroup', label: 'Blood Group', value: (s) => s.bloodGroup || '', render: (s) => s.bloodGroup ? <span className="badge badge-danger">{s.bloodGroup}</span> : '-' },
    { key: 'phone', label: 'Contact', value: (s) => s.phone || '', render: (s) => s.phone || '-' },
    {
      key: 'parentName', label: 'Parent',
      value: (s) => `${s.parentName || ''} ${s.parentPhone || ''}`,
      render: (s) => (
        <>
          <div style={{ fontSize: 12 }}>{s.parentName || '-'}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.parentPhone || ''}</div>
        </>
      ),
    },
  ];

  const setFee = (k, v) => setFeeForm((f) => ({ ...f, [k]: v }));

  return (
    <>
      <DataGrid
        title="Students"
        subtitle="Manage student records, fees & academic history"
        columns={columns}
        rows={students}
        rowKey={(s) => s.studentId}
        exportName="Students"
        emptyText="No students found."
        toolbar={
          <>
            <div className="search-bar">
              <input type="text" placeholder="Search students..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ paddingLeft: 12 }} />
            </div>
            <select className="form-control" style={{ width: '150px' }} value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
              <option value="">All Classes</option>
              {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}{c.stream ? ` ${c.stream}` : ''} ({c.section})</option>)}
            </select>
            {canCreate && (
              <button className="btn btn-primary" onClick={() => openForm()}>
                <Plus size={16} /> Add Student
              </button>
            )}
          </>
        }
        actions={(s) => (
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-outline btn-sm" onClick={() => openForm(s)} title={canEdit ? 'Edit' : 'View'}><Edit2 size={14} /></button>
            {canDelete && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(s.studentId)}><Trash2 size={14} /></button>}
          </div>
        )}
      />

      {showModal && (
        <div className="modal-overlay">
          <div className="modal student-modal" style={{ width: '80vw', maxWidth: 1400 }}>
            {/* ── Header ── */}
            <div className="modal-header" style={{ flexDirection: 'column', alignItems: 'flex-start', background: editId ? 'linear-gradient(135deg,#1e1b4b,#4f46e5)' : '#fff', borderRadius: '16px 16px 0 0' }}>
              {editId ? (
                <div style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 16 }}>
                  <div style={{ position: 'relative' }}>
                    {photoPreview
                      ? <img src={photoPreview} alt="profile" style={{ width: 72, height: 72, borderRadius: '50%', objectFit: 'cover', border: '3px solid rgba(255,255,255,0.5)' }} />
                      : <div style={{ width: 72, height: 72, borderRadius: '50%', background: 'rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#fff', border: '3px solid rgba(255,255,255,0.3)' }}>{formData.firstName?.charAt(0) || '?'}</div>}
                    {canSave && (
                      <button onClick={() => photoRef.current.click()} style={{ position: 'absolute', bottom: 0, right: 0, width: 22, height: 22, borderRadius: '50%', background: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Camera size={12} color="#6c63ff" />
                      </button>
                    )}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{formData.firstName} {formData.lastName}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '2px 10px', borderRadius: 20, fontSize: 11 }}>🎓 {formData.admissionNo}</span>
                      {formData.className && <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '2px 10px', borderRadius: 20, fontSize: 11 }}>📚 {formData.className} {formData.section}</span>}
                      {formData.gender && <span style={{ background: 'rgba(255,255,255,0.15)', color: '#fff', padding: '2px 10px', borderRadius: 20, fontSize: 11 }}>{formData.gender}</span>}
                    </div>
                  </div>
                  <button className="modal-close" onClick={() => setShowModal(false)} style={{ color: '#fff', background: 'rgba(255,255,255,0.15)' }}>&times;</button>
                </div>
              ) : (
                <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div className="modal-title">Add New Student</div>
                  <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
                </div>
              )}

              {/* Tabs — shown in BOTH add & edit. Order: Details → Fees → History */}
              <div style={{ display: 'flex', gap: 20, marginTop: 14, borderTop: `1px solid ${editId ? 'rgba(255,255,255,0.15)' : 'var(--border-col)'}`, width: '100%', paddingTop: 12 }}>
                {(editId ? ['Details', 'Fees', 'History'] : ['Details', 'Fees']).map((tab) => {
                  const activeColor = editId ? '#fff' : 'var(--primary)';
                  const idleColor = editId ? 'rgba(255,255,255,0.55)' : 'var(--text-muted)';
                  return (
                    <label key={tab} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: activeTab === tab ? 700 : 400, color: activeTab === tab ? activeColor : idleColor, fontSize: 13 }}>
                      <input type="radio" name="studentTab" checked={activeTab === tab} onChange={() => setActiveTab(tab)} style={{ accentColor: editId ? '#fff' : 'var(--primary)' }} />
                      {tab === 'Details' ? '📝 Student Details' : tab === 'Fees' ? '💰 Fees' : '📜 Academic History'}
                      {tab === 'Fees' && !editId && <span style={{ color: 'var(--danger)', fontSize: 11 }}>*</span>}
                    </label>
                  );
                })}
              </div>
            </div>

            <input ref={photoRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handlePhoto} />

            {/* ── TAB: DETAILS ── */}
            {activeTab === 'Details' && (
              <form onSubmit={handleSubmit} noValidate>
                <div className="modal-body">
                  {!editId && (
                    <div style={{ display: 'flex', gap: 20, marginBottom: 20, alignItems: 'flex-start' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
                        <div onClick={() => photoRef.current.click()} style={{ width: 80, height: 80, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', overflow: 'hidden', border: '2px dashed #cbd5e1' }}>
                          {photoPreview ? <img src={photoPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <Camera size={24} color="#94a3b8" />}
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Click to upload</span>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div className="form-group">
                          <label className="form-label">Admission No (Auto-Generated)</label>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <input className="form-control" value={loadingNext ? 'Generating...' : formData.admissionNo} readOnly style={{ background: '#f8fafc', fontWeight: 700, color: 'var(--primary)', letterSpacing: 1 }} />
                            <span style={{ background: 'var(--primary-light)', color: 'var(--primary)', padding: '4px 10px', borderRadius: 8, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>Next Available</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Official Info */}
                  <div className="form-section-title">📋 Official Information</div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Class *</label>
                      <select className={`form-control ${errors.classId ? 'input-error' : ''}`} value={formData.classId} onChange={(e) => handleClassChange(e.target.value)}>
                        <option value="">Select Class</option>
                        {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}{c.stream ? ` ${c.stream}` : ''} ({c.section})</option>)}
                      </select>
                      {errors.classId && <span className="field-error">{errors.classId}</span>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Roll No {!editId && <span style={{ color: 'var(--primary)', fontSize: 11 }}>(Auto — per class)</span>}</label>
                      <input className="form-control" value={loadingRoll ? 'Fetching...' : (formData.rollNo || '')} readOnly placeholder={!editId ? 'Select a class first' : ''} style={{ background: '#f8fafc', fontWeight: 700, color: 'var(--primary)' }} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Bus Route</label>
                      {(() => {
                        const selBus = buses.find((b) => b.busId === Number(formData.busId));
                        const selStop = selBus?.stops?.find((s) => s.stopId === Number(formData.stopId));
                        return (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'stretch' }}>
                            <div className="form-control" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                              {selBus ? (
                                <>
                                  <BusIcon size={15} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    <b>{selBus.busNumber}</b>{selStop ? <> · <MapPin size={11} style={{ verticalAlign: -1 }} /> {selStop.stopName}</> : ''}
                                  </span>
                                </>
                              ) : <span style={{ color: 'var(--text-muted)' }}>No Transport</span>}
                            </div>
                            <button type="button" className="btn btn-outline" onClick={() => { setPopupBusId(formData.busId || ''); setPopupStopId(formData.stopId || ''); setShowBusPopup(true); }}>
                              {selBus ? 'Change' : 'Select'}
                            </button>
                            {selBus && (
                              <button type="button" className="btn btn-danger" title="Remove transport" onClick={() => { set('busId', ''); set('stopId', ''); }}><X size={14} /></button>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Admission Date</label>
                      <input type="date" className="form-control" value={formData.admissionDate || ''} onChange={(e) => set('admissionDate', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Academic Year <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>(from topbar)</span></label>
                      <input className="form-control" value={formData.academicYear || ''} readOnly style={{ background: '#f8fafc' }} />
                    </div>
                    <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                        <input type="checkbox" checked={formData.isActive} onChange={(e) => set('isActive', e.target.checked)} style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
                        <span style={{ color: formData.isActive ? 'var(--secondary)' : 'var(--text-muted)', fontWeight: 700 }}>{formData.isActive ? 'Active Student' : 'Inactive'}</span>
                      </label>
                    </div>
                  </div>

                  {/* Personal Info */}
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
                      <label className="form-label">Date of Birth *</label>
                      <input type="date" className={`form-control ${errors.dateOfBirth ? 'input-error' : ''}`} value={formData.dateOfBirth || ''} onChange={(e) => set('dateOfBirth', e.target.value)} />
                      {errors.dateOfBirth && <span className="field-error">{errors.dateOfBirth}</span>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Gender *</label>
                      <select className={`form-control ${errors.gender ? 'input-error' : ''}`} value={formData.gender || ''} onChange={(e) => set('gender', e.target.value)}>
                        <option value="">Select</option>
                        <option>Male</option><option>Female</option><option>Other</option>
                      </select>
                      {errors.gender && <span className="field-error">{errors.gender}</span>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Blood Group</label>
                      <select className="form-control" value={formData.bloodGroup || ''} onChange={(e) => set('bloodGroup', e.target.value)}>
                        <option value="">Select</option>
                        {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => <option key={g}>{g}</option>)}
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
                    <div className="form-group">
                      <label className="form-label">Email</label>
                      <input type="email" className={`form-control ${errors.email ? 'input-error' : ''}`} value={formData.email || ''} onChange={(e) => set('email', e.target.value)} />
                      {errors.email && <span className="field-error">{errors.email}</span>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Phone</label>
                      <input className={`form-control ${errors.phone ? 'input-error' : ''}`} value={formData.phone || ''} onChange={(e) => set('phone', e.target.value)} />
                      {errors.phone && <span className="field-error">{errors.phone}</span>}
                    </div>
                  </div>

                  {/* Family & Contact */}
                  <div className="form-section-title" style={{ marginTop: 16 }}>👨‍👩‍👧 Family & Contact</div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Father's Name *</label>
                      <input className={`form-control ${errors.fatherName ? 'input-error' : ''}`} value={formData.fatherName || ''} onChange={(e) => set('fatherName', e.target.value)} />
                      {errors.fatherName && <span className="field-error">{errors.fatherName}</span>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Mother's Name</label>
                      <input className="form-control" value={formData.motherName || ''} onChange={(e) => set('motherName', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Father's Occupation</label>
                      <input className="form-control" value={formData.fatherOccupation || ''} onChange={(e) => set('fatherOccupation', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Mother's Occupation</label>
                      <input className="form-control" value={formData.motherOccupation || ''} onChange={(e) => set('motherOccupation', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Parent / Guardian Name</label>
                      <input className="form-control" value={formData.parentName || ''} onChange={(e) => set('parentName', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Parent Phone *</label>
                      <input className={`form-control ${errors.parentPhone ? 'input-error' : ''}`} value={formData.parentPhone || ''} onChange={(e) => set('parentPhone', e.target.value)} />
                      {errors.parentPhone && <span className="field-error">{errors.parentPhone}</span>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Parent Email</label>
                      <input type="email" className={`form-control ${errors.parentEmail ? 'input-error' : ''}`} value={formData.parentEmail || ''} onChange={(e) => set('parentEmail', e.target.value)} />
                      {errors.parentEmail && <span className="field-error">{errors.parentEmail}</span>}
                    </div>
                    <div className="form-group">
                      <label className="form-label">Emergency Contact</label>
                      <input className={`form-control ${errors.emergencyContact ? 'input-error' : ''}`} value={formData.emergencyContact || ''} onChange={(e) => set('emergencyContact', e.target.value)} />
                      {errors.emergencyContact && <span className="field-error">{errors.emergencyContact}</span>}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Address</label>
                    <textarea className="form-control" value={formData.address || ''} onChange={(e) => set('address', e.target.value)} rows="2" placeholder="Full address..." />
                  </div>
                </div>

                <div className="modal-footer">
                  <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                  {canSave && <button type="submit" className="btn btn-primary">💾 Save Student</button>}
                </div>
              </form>
            )}

            {/* ── TAB: ACADEMIC HISTORY (read-only — results come from Exams module) ── */}
            {activeTab === 'History' && (
              <div className="modal-body">
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 18, flexWrap: 'wrap' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', flex: 1, minWidth: 200 }}>
                    Class: <strong style={{ color: 'var(--text-primary)' }}>{formData.className || '-'} {formData.section || ''}</strong>
                    &nbsp;·&nbsp; results are entered in the <strong>Exams &amp; Results</strong> module.
                  </div>
                  <div className="form-group" style={{ marginBottom: 0, minWidth: 220 }}>
                    <label className="form-label">Select Exam</label>
                    <select className="form-control" value={selectedExamId} onChange={(e) => setSelectedExamId(e.target.value)}>
                      <option value="">All Exams</option>
                      {marksheet.map((ex) => <option key={ex.examId} value={ex.examId}>{ex.examName}</option>)}
                    </select>
                  </div>
                </div>

                {marksheet.length === 0 ? (
                  <div className="empty-state" style={{ padding: '40px 20px' }}>
                    <div style={{ fontSize: 40, marginBottom: 10 }}>📄</div>
                    No results recorded yet for this student.<br />
                    <span style={{ fontSize: 12 }}>Enter marks in the Exams &amp; Results module.</span>
                  </div>
                ) : (
                  marksheet
                    .filter((ex) => !selectedExamId || ex.examId === Number(selectedExamId))
                    .map((ex) => (
                      <div key={ex.examId} style={{ marginBottom: 18, border: '1px solid var(--border-col)', borderRadius: 10, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--surface-2)', fontWeight: 700 }}>
                          <span>📝 {ex.examName}</span>
                          <span style={{ color: 'var(--primary)', fontSize: 13 }}>Grade {ex.grade} · {ex.percentage}% · {ex.totalObtained}/{ex.totalMax}</span>
                        </div>
                        <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 480 }}>
                          <thead>
                            <tr style={{ background: '#f8fafc' }}>
                              {['Subject', 'Date', 'Max', 'Obtained', 'Result'].map((h, i) => (
                                <th key={i} style={{ padding: '8px 12px', fontSize: 11, fontWeight: 600, textAlign: 'left', color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {ex.subjects.map((s, i) => (
                              <tr key={i} style={{ borderBottom: '1px solid #f1f5f9' }}>
                                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{s.subjectName}</td>
                                <td style={{ padding: '8px 12px', fontSize: 12 }}>{s.examDate || '-'}</td>
                                <td style={{ padding: '8px 12px' }}>{s.maxMarks}</td>
                                <td style={{ padding: '8px 12px', fontWeight: 600 }}>{s.isAbsent ? 'AB' : (s.marksObtained ?? '-')}</td>
                                <td style={{ padding: '8px 12px' }}>
                                  <span className={`badge ${s.result === 'Pass' ? 'badge-success' : s.result === 'Absent' ? 'badge-warning' : 'badge-danger'}`}>{s.result}</span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        </div>
                      </div>
                    ))
                )}
              </div>
            )}

            {/* ── TAB: FEES ── */}
            {activeTab === 'Fees' && (
              <div className="modal-body">
                {/* Summary cards */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 18 }}>
                  {[
                    { label: 'Total Billed', value: feeTotals.total, color: '#3b82f6', bg: '#dbeafe' },
                    { label: 'Total Paid', value: feeTotals.paid, color: '#10b981', bg: '#dcfce7' },
                    { label: 'Balance Due', value: feeTotals.balance, color: feeTotals.balance > 0 ? '#ef4444' : '#10b981', bg: feeTotals.balance > 0 ? '#fee2e2' : '#dcfce7' },
                  ].map((s) => (
                    <div key={s.label} style={{ background: s.bg, borderRadius: 10, padding: '12px 16px' }}>
                      <div style={{ fontSize: 11, color: s.color, fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>₹{s.value.toLocaleString()}</div>
                    </div>
                  ))}
                </div>

                {/* Record payment */}
                <div style={{ background: '#f8fafc', borderRadius: 12, padding: 16, marginBottom: 18 }}>
                  <div className="form-section-title" style={{ marginBottom: 12 }}>➕ Record Payment</div>
                  <div className="form-row" style={{ alignItems: 'flex-end' }}>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Fee Type</label>
                      <select className="form-control" value={feeForm.feeType} onChange={(e) => setFee('feeType', e.target.value)}>
                        <option>Tuition</option><option>Transport</option><option>Exam</option><option>Library</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Amount</label>
                      <input type="number" className="form-control" value={feeForm.amount} onChange={(e) => setFee('amount', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Paid</label>
                      <input type="number" className="form-control" value={feeForm.paidAmount} onChange={(e) => setFee('paidAmount', e.target.value)} />
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Mode</label>
                      <select className="form-control" value={feeForm.paymentMode} onChange={(e) => setFee('paymentMode', e.target.value)}>
                        <option>Cash</option><option>Online</option><option>Cheque</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <label className="form-label">Status</label>
                      <select className="form-control" value={feeForm.status} onChange={(e) => setFee('status', e.target.value)}>
                        <option>Paid</option><option>Partial</option><option>Pending</option>
                      </select>
                    </div>
                    <div className="form-group" style={{ marginBottom: 0 }}>
                      <button type="button" className="btn btn-primary" style={{ width: '100%' }} onClick={addFee}><Plus size={16} /> Add</button>
                    </div>
                  </div>
                </div>

                <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
                  <thead>
                    <tr style={{ background: '#f8fafc' }}>
                      {['Type', 'Amount', 'Discount', 'Paid', 'Balance', 'Mode', 'Status', 'Date', ''].map((h, i) => (
                        <th key={i} style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, textAlign: 'left', color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {studentFees.map((f) => (
                      <tr key={f.feeId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 600 }}>{f.feeType}</td>
                        <td style={{ padding: '10px 12px' }}>₹{f.amount}</td>
                        <td style={{ padding: '10px 12px', color: '#10b981' }}>₹{f.discount || 0}</td>
                        <td style={{ padding: '10px 12px', color: '#10b981' }}>₹{f.paidAmount}</td>
                        <td style={{ padding: '10px 12px', color: f.balanceAmount > 0 ? '#ef4444' : '#64748b', fontWeight: 600 }}>₹{f.balanceAmount}</td>
                        <td style={{ padding: '10px 12px' }}>{f.paymentMode || '-'}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span className={`badge ${f.status === 'Paid' ? 'badge-success' : f.status === 'Pending' ? 'badge-danger' : 'badge-warning'}`}>{f.status}</span>
                        </td>
                        <td style={{ padding: '10px 12px', fontSize: 12 }}>{f.paymentDate || '-'}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                            {/* print only saved fee rows */}
                            {!String(f.feeId).startsWith('tmp_') && (
                              <button className="btn btn-success btn-sm" title="Print Receipt" onClick={() => printFeeReceipt(f, { firstName: formData.firstName, lastName: formData.lastName, admissionNo: formData.admissionNo, className: formData.className, section: formData.section, rollNo: formData.rollNo })}><Printer size={13} /></button>
                            )}
                            {/* only staged (unsaved) rows can be removed here */}
                            {String(f.feeId).startsWith('tmp_') && (
                              <button className="btn btn-danger btn-sm" onClick={() => removeLocalFee(f.feeId)}><Trash2 size={13} /></button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {studentFees.length === 0 && (
                      <tr><td colSpan="9" style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>No fee records yet. {!editId && 'Add at least one.'}</td></tr>
                    )}
                  </tbody>
                </table>
                </div>

                {/* Save button available on the Fees/History tabs in create mode too */}
                {!editId && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 }}>
                    <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                    <button type="button" className="btn btn-primary" onClick={handleSubmit}>💾 Save Student</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bus & Route picker popup ── */}
      {showBusPopup && (() => {
        const popupBus = buses.find((b) => b.busId === Number(popupBusId));
        return (
          <div className="modal-overlay" style={{ zIndex: 1200 }}>
            <div className="modal modal-lg">
              <div className="modal-header">
                <div className="modal-title"><BusIcon size={16} style={{ verticalAlign: -3, marginRight: 6 }} />Select Bus &amp; Boarding Stop</div>
                <button className="modal-close" onClick={() => setShowBusPopup(false)}>&times;</button>
              </div>
              <div className="modal-body">
                {buses.length === 0 ? (
                  <div className="empty-state" style={{ padding: 30 }}>No bus routes exist yet. Add routes in the Transport module first.</div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
                    {/* Route list */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }}>
                      {buses.map((b) => {
                        const full = b.seatsAvailable <= 0 && b.busId !== Number(formData.busId);
                        return (
                          <div key={b.busId}
                            className={`bus-card ${b.busId === Number(popupBusId) ? 'active' : ''}`}
                            style={{ cursor: full ? 'not-allowed' : 'pointer', opacity: full ? 0.5 : 1, margin: 0 }}
                            onClick={() => { if (!full) { setPopupBusId(b.busId); if (b.busId !== Number(popupBusId)) setPopupStopId(''); } }}>
                            <div className="bus-card-head">
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center', minWidth: 0 }}>
                                <div className="bus-card-icon"><BusIcon size={16} /></div>
                                <div style={{ minWidth: 0 }}>
                                  <div className="bus-card-num">{b.busNumber}</div>
                                  <div className="bus-card-driver">{b.driverName}</div>
                                </div>
                              </div>
                            </div>
                            <div className="bus-card-route"><MapPin size={11} /> {b.startLocation} → {b.destination}</div>
                            <div className="bus-card-meta">
                              <span><MapPin size={11} /> {b.stops.length} stops</span>
                              <span><Navigation size={11} /> {b.totalDistanceKm} km</span>
                              <span><Users size={11} /> {b.assignedCount}/{b.capacity}{full ? ' · full' : ''}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Selected route detail: map + pick a stop */}
                    <div>
                      {popupBus ? (
                        <>
                          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
                            {popupBus.busNumber} — {popupBus.startLocation} → {popupBus.destination}
                            <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: 12 }}> · ~{popupBus.etaMinutes} min</span>
                          </div>
                          <RouteMap stops={popupBus.stops} height={230} />
                          <div style={{ fontSize: 12, fontWeight: 600, margin: '12px 0 6px' }}>Pick the student's boarding stop:</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {popupBus.stops.map((s, i) => {
                              const chosen = Number(popupBusId) === Number(formData.busId) && Number(formData.stopId) === s.stopId;
                              const staged = popupStopId === s.stopId;
                              return (
                                <button type="button" key={s.stopId}
                                  className={`bus-stop-chip ${(staged || chosen) ? 'active' : ''}`}
                                  style={{ cursor: 'pointer', border: (staged || chosen) ? '2px solid var(--primary)' : '1px solid var(--border)', background: 'var(--bg-card)' }}
                                  onClick={() => setPopupStopId(s.stopId)}>
                                  <div className="bus-stop-num" style={{ background: i === 0 ? '#16a34a' : i === popupBus.stops.length - 1 ? '#dc2626' : 'var(--primary)' }}>{i + 1}</div>
                                  <div className="bus-stop-info">
                                    <div className="bus-stop-name">{s.stopName}</div>
                                    {s.stopTime && <div className="bus-stop-time"><Clock size={9} style={{ verticalAlign: -1 }} /> {s.stopTime}</div>}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </>
                      ) : <div className="empty-state" style={{ padding: 40 }}>← Select a bus route to see its map &amp; stops.</div>}
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer">
                <button className="btn btn-outline" onClick={() => setShowBusPopup(false)}>Cancel</button>
                <button className="btn btn-primary" disabled={!popupBusId || !popupStopId}
                  onClick={() => {
                    set('busId', String(popupBusId));
                    set('stopId', String(popupStopId));
                    setShowBusPopup(false);
                  }}>
                  Confirm Bus &amp; Stop
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </>
  );
}

export default function StudentsPage() {
  return (
    <RouteGuard module="Students">
      <StudentsInner />
    </RouteGuard>
  );
}
