'use client';

import { useState, useEffect } from 'react';
import API from '@/lib/api';
import { Plus, Edit2, Trash2, Eye, Users, BookOpen, Award, DoorOpen, Clock, User, X } from 'lucide-react';
import { showSuccess, showError, confirmAction, confirmSave } from '@/lib/alert';
import { runValidation, required } from '@/lib/validate';
import DataGrid from '@/components/DataGrid';
import RouteGuard from '@/components/RouteGuard';

const EMPTY = { className: '', section: '', stream: '', classTeacherId: '', academicYear: '2025-26', roomNumber: '', capacity: '', shift: '' };

const CLASS_NAMES = ['Nursery', 'LKG', 'UKG', 'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5', 'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10', 'Class 11', 'Class 12', 'Other'];
const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'Other'];
const STREAMS = ['Science (Maths)', 'Science (Bio)', 'Commerce', 'Humanities (Arts)', 'Other'];
const SHIFTS = ['Morning', 'Afternoon', 'Evening'];
const STREAM_CLASSES = ['Class 11', 'Class 12'];

function ClassesInner() {
  const [classes, setClasses] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [detail, setDetail] = useState(null); // class detail dossier

  const set = (field, val) => {
    setFormData((f) => ({ ...f, [field]: val }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const loadData = () => {
    API.get('/classes').then((res) => setClasses(res.data)).catch(console.error);
    API.get('/teachers').then((res) => setTeachers(res.data)).catch(console.error);
  };
  useEffect(() => { loadData(); }, []);

  const showStream = STREAM_CLASSES.includes(formData.className);
  const assignedTeacherIds = new Set(classes.filter((c) => c.classTeacherId && c.classId !== editId).map((c) => c.classTeacherId));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const rules = { className: [required('Class name is required')], section: [required('Section is required')] };
    if (showStream) rules.stream = [required('Stream is required for Class 11/12')];
    const errs = runValidation(formData, rules);
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (!(await confirmSave('Save Class?', 'Do you want to save this class record?'))) return;
    const payload = { ...formData, stream: showStream ? formData.stream : null, capacity: formData.capacity === '' ? null : Number(formData.capacity) };
    try {
      if (editId) { await API.put(`/classes/${editId}`, payload); showSuccess('Class updated'); }
      else { await API.post('/classes', payload); showSuccess('Class added'); }
      setShowModal(false);
      loadData();
    } catch (err) { showError(err.response?.data?.message || 'Operation failed'); }
  };

  const handleDelete = async (id) => {
    if (!(await confirmAction('Delete Class?', 'Are you sure you want to delete this class?'))) return;
    try { await API.delete(`/classes/${id}`); showSuccess('Class deleted'); loadData(); }
    catch { showError('Failed to delete'); }
  };

  const openForm = (c = null) => {
    setErrors({});
    if (c) { setEditId(c.classId); setFormData({ ...EMPTY, ...c, stream: c.stream || '', classTeacherId: c.classTeacherId || '', roomNumber: c.roomNumber || '', capacity: c.capacity ?? '', shift: c.shift || '' }); }
    else { setEditId(null); setFormData(EMPTY); }
    setShowModal(true);
  };

  const openDetail = async (id) => {
    setDetail({ loading: true });
    try {
      const res = await API.get(`/classes/${id}/detail`);
      setDetail(res.data);
    } catch { showError('Failed to load class detail'); setDetail(null); }
  };

  const columns = [
    { key: 'className', label: 'Class Name', render: (c) => <span style={{ fontWeight: 600 }}>{c.className}</span> },
    { key: 'section', label: 'Section', render: (c) => <span className="badge badge-purple">{c.section}</span> },
    { key: 'stream', label: 'Stream', value: (c) => c.stream || '', render: (c) => c.stream ? <span className="badge badge-info">{c.stream}</span> : '-' },
    { key: 'roomNumber', label: 'Room', value: (c) => c.roomNumber || '', render: (c) => c.roomNumber || '-' },
    { key: 'shift', label: 'Shift', value: (c) => c.shift || '', render: (c) => c.shift || '-' },
    {
      key: 'classTeacherName', label: 'Class Teacher',
      value: (c) => c.classTeacherName || 'Unassigned',
      render: (c) => c.classTeacherName || <span style={{ color: '#94a3b8' }}>-Unassigned-</span>,
    },
    {
      key: 'studentCount', label: 'Strength',
      value: (c) => c.studentCount,
      render: (c) => <span>{c.studentCount}{c.capacity ? <span style={{ color: 'var(--text-muted)' }}> / {c.capacity}</span> : ''}</span>,
    },
    { key: 'academicYear', label: 'Academic Year' },
  ];

  return (
    <>
      <DataGrid
        title="Class Master"
        subtitle="Manage classes, sections, rooms & class teachers"
        columns={columns}
        rows={classes}
        rowKey={(c) => c.classId}
        exportName="Classes"
        emptyText="No classes found."
        toolbar={<button className="btn btn-primary" onClick={() => openForm()}><Plus size={16} /> Add Class</button>}
        actions={(c) => (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-success btn-sm" title="View details" onClick={() => openDetail(c.classId)}><Eye size={14} /></button>
            <button className="btn btn-outline btn-sm" onClick={() => openForm(c)}><Edit2 size={14} /></button>
            <button className="btn btn-danger btn-sm" onClick={() => handleDelete(c.classId)}><Trash2 size={14} /></button>
          </div>
        )}
      />

      {/* ── Add/Edit Class ── */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <div className="modal-title">{editId ? 'Edit Class' : 'Add New Class'}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} noValidate>
              <div className="modal-body">
                <div className="form-section-title">🏫 Class Info</div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Class Name *</label>
                    <select className={`form-control ${errors.className ? 'input-error' : ''}`} value={formData.className} onChange={(e) => set('className', e.target.value)}>
                      <option value="">Select Class</option>
                      {CLASS_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {errors.className && <span className="field-error">{errors.className}</span>}
                  </div>
                  <div className="form-group">
                    <label className="form-label">Section *</label>
                    <select className={`form-control ${errors.section ? 'input-error' : ''}`} value={formData.section} onChange={(e) => set('section', e.target.value)}>
                      <option value="">Select Section</option>
                      {SECTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    {errors.section && <span className="field-error">{errors.section}</span>}
                  </div>
                  {showStream && (
                    <div className="form-group">
                      <label className="form-label">Stream *</label>
                      <select className={`form-control ${errors.stream ? 'input-error' : ''}`} value={formData.stream} onChange={(e) => set('stream', e.target.value)}>
                        <option value="">Select Stream</option>
                        {STREAMS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                      {errors.stream && <span className="field-error">{errors.stream}</span>}
                    </div>
                  )}
                  <div className="form-group">
                    <label className="form-label">Academic Year</label>
                    <input className="form-control" value={formData.academicYear} onChange={(e) => set('academicYear', e.target.value)} />
                  </div>
                </div>

                <div className="form-section-title" style={{ marginTop: 14 }}>🚪 Room &amp; Schedule</div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Room Number</label>
                    <input className="form-control" value={formData.roomNumber} onChange={(e) => set('roomNumber', e.target.value)} placeholder="e.g. Room 101" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Max Capacity</label>
                    <input type="number" className="form-control" value={formData.capacity} onChange={(e) => set('capacity', e.target.value)} placeholder="e.g. 40" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Shift</label>
                    <select className="form-control" value={formData.shift} onChange={(e) => set('shift', e.target.value)}>
                      <option value="">Select</option>
                      {SHIFTS.map((s) => <option key={s}>{s}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Class Teacher</label>
                    <select className="form-control" value={formData.classTeacherId} onChange={(e) => set('classTeacherId', e.target.value)}>
                      <option value="">Unassigned</option>
                      {teachers.map((t) => {
                        const taken = assignedTeacherIds.has(t.teacherId);
                        return <option key={t.teacherId} value={t.teacherId} disabled={taken}>{t.firstName} {t.lastName}{taken ? ' (Assigned)' : ''}</option>;
                      })}
                    </select>
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Class</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Class Detail View ── */}
      {detail && <ClassDetail detail={detail} onClose={() => setDetail(null)} reload={() => detail?.cls && openDetail(detail.cls.classId)} />}
    </>
  );
}

// ── Class Detail dossier (students + subjects + exams) ──
function ClassDetail({ detail, onClose, reload }) {
  const [tab, setTab] = useState('Students');
  const [newSubject, setNewSubject] = useState('');

  if (detail.loading) {
    return <div className="modal-overlay"><div className="modal modal-sm"><div className="modal-body empty-state"><span className="loading-spinner" style={{ borderTopColor: 'var(--primary)', borderColor: 'rgba(59,130,246,0.2)' }} /></div></div></div>;
  }

  const { cls, students, subjects, exams } = detail;

  const addSubject = async () => {
    if (!newSubject.trim()) { showError('Enter subject name'); return; }
    try {
      await API.post('/subjects', { subjectName: newSubject.trim(), classId: cls.classId });
      setNewSubject('');
      showSuccess('Subject added');
      reload();
    } catch (err) { showError(err.response?.data?.message || 'Failed'); }
  };
  const delSubject = async (id) => {
    if (!(await confirmAction('Delete Subject?', 'Remove this subject?'))) return;
    try { await API.delete(`/subjects/${id}`); showSuccess('Deleted'); reload(); }
    catch (err) { showError(err.response?.data?.message || 'Failed'); }
  };

  return (
    <div className="modal-overlay">
      <div className="modal student-modal" style={{ width: '80vw', maxWidth: 1100 }}>
        {/* Header */}
        <div className="modal-header" style={{ flexDirection: 'column', alignItems: 'flex-start', background: 'linear-gradient(135deg,#172554,#2563eb)', borderRadius: '16px 16px 0 0' }}>
          <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: '#fff' }}>
              <div style={{ fontSize: 20, fontWeight: 800 }}>{cls.className} — {cls.section} {cls.stream ? `(${cls.stream})` : ''}</div>
              <div style={{ display: 'flex', gap: 14, marginTop: 6, flexWrap: 'wrap', fontSize: 12, opacity: 0.9 }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><User size={13} /> {cls.classTeacherName || 'No teacher'}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><DoorOpen size={13} /> {cls.roomNumber || 'No room'}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Clock size={13} /> {cls.shift || 'No shift'}</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Users size={13} /> {cls.studentCount}{cls.capacity ? `/${cls.capacity}` : ''} students</span>
              </div>
            </div>
            <button className="modal-close" onClick={onClose} style={{ color: '#fff', background: 'rgba(255,255,255,0.15)' }}><X size={16} /></button>
          </div>
          <div style={{ display: 'flex', gap: 20, marginTop: 14, borderTop: '1px solid rgba(255,255,255,0.15)', width: '100%', paddingTop: 12 }}>
            {[['Students', Users], ['Subjects', BookOpen], ['Exams', Award]].map(([t, Icon]) => (
              <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontWeight: tab === t ? 700 : 400, color: tab === t ? '#fff' : 'rgba(255,255,255,0.55)', fontSize: 13 }}>
                <input type="radio" checked={tab === t} onChange={() => setTab(t)} style={{ accentColor: '#fff' }} />
                <Icon size={14} /> {t}
              </label>
            ))}
          </div>
        </div>

        <div className="modal-body">
          {/* Students */}
          {tab === 'Students' && (
            <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 560 }}>
              <thead><tr style={{ background: '#f8fafc' }}>{['Roll', 'Student', 'Admission', 'Gender', 'Contact', 'Parent'].map((h) => <th key={h} style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, textAlign: 'left', color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>{h}</th>)}</tr></thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.studentId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px' }}>{s.rollNo || '-'}</td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}>
                      {s.photoUrl ? <img src={s.photoUrl} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} /> : <div className="user-avatar" style={{ width: 28, height: 28, fontSize: 11 }}>{s.name.charAt(0)}</div>}
                      {s.name}
                    </td>
                    <td style={{ padding: '10px 12px' }}><span className="badge badge-grey">{s.admissionNo}</span></td>
                    <td style={{ padding: '10px 12px' }}>{s.gender}</td>
                    <td style={{ padding: '10px 12px' }}>{s.phone || '-'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 12 }}>{s.parent || '-'}</td>
                  </tr>
                ))}
                {students.length === 0 && <tr><td colSpan="6" className="empty-state">No students in this class.</td></tr>}
              </tbody>
            </table>
            </div>
          )}

          {/* Subjects */}
          {tab === 'Subjects' && (
            <>
              <div style={{ display: 'flex', gap: 10, marginBottom: 16, alignItems: 'flex-end' }}>
                <div className="form-group" style={{ marginBottom: 0, flex: 1 }}>
                  <label className="form-label">Add Subject to this class</label>
                  <input className="form-control" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="e.g. Mathematics" onKeyDown={(e) => e.key === 'Enter' && addSubject()} />
                </div>
                <button className="btn btn-primary" onClick={addSubject}><Plus size={16} /> Add</button>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {subjects.map((s) => (
                  <div key={s.subjectId} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', border: '1px solid var(--border-col)', borderRadius: 20, padding: '6px 8px 6px 14px' }}>
                    <span style={{ fontWeight: 600, fontSize: 13 }}>{s.subjectName}</span>
                    <button className="btn btn-danger btn-sm" style={{ height: 26, padding: '0 8px' }} onClick={() => delSubject(s.subjectId)}><Trash2 size={12} /></button>
                  </div>
                ))}
                {subjects.length === 0 && <div className="empty-state" style={{ width: '100%', padding: 30 }}>No subjects yet.</div>}
              </div>
            </>
          )}

          {/* Exams */}
          {tab === 'Exams' && (
            <div className="table-wrapper" style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
              <thead><tr style={{ background: '#f8fafc' }}>{['Exam', 'Subjects'].map((h) => <th key={h} style={{ padding: '10px 12px', fontSize: 11, fontWeight: 600, textAlign: 'left', color: '#64748b', textTransform: 'uppercase', borderBottom: '1px solid #e2e8f0' }}>{h}</th>)}</tr></thead>
              <tbody>
                {exams.map((e) => (
                  <tr key={e.examId} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', fontWeight: 600 }}>{e.examName}</td>
                    <td style={{ padding: '10px 12px' }}><span className="badge badge-info">{e.subjectCount} subjects</span></td>
                  </tr>
                ))}
                {exams.length === 0 && <tr><td colSpan="2" className="empty-state">No exams for this class yet.</td></tr>}
              </tbody>
            </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ClassesPage() {
  return (
    <RouteGuard module="Classes">
      <ClassesInner />
    </RouteGuard>
  );
}
