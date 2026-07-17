'use client';

import { useState, useEffect } from 'react';
import API from '@/lib/api';
import { Plus, Trash2, BookOpen, Award, FileText, Save, Printer } from 'lucide-react';
import { showSuccess, showError, confirmAction, confirmSave } from '@/lib/alert';
import { printMarksheet } from '@/lib/printMarksheet';
import RouteGuard from '@/components/RouteGuard';

const EXAM_NAMES = ['Unit Test 1', 'Unit Test 2', 'Unit Test 3', 'Unit Test 4', 'Mid Term', 'End Term', 'Annual'];

function AcademicsInner() {
  const [tab, setTab] = useState('Subjects');
  const [classes, setClasses] = useState([]);

  useEffect(() => {
    API.get('/classes').then((r) => setClasses(r.data)).catch(console.error);
  }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Exams &amp; Results</div>
          <div className="page-subtitle">Manage subjects, exams and student marksheets</div>
        </div>
      </div>

      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'Subjects' ? 'active' : ''}`} onClick={() => setTab('Subjects')}><BookOpen size={14} style={{ marginRight: 6 }} />Subjects</button>
        <button className={`tab-btn ${tab === 'Exams' ? 'active' : ''}`} onClick={() => setTab('Exams')}><Award size={14} style={{ marginRight: 6 }} />Exams</button>
        <button className={`tab-btn ${tab === 'Results' ? 'active' : ''}`} onClick={() => setTab('Results')}><FileText size={14} style={{ marginRight: 6 }} />Results / Marksheet</button>
      </div>

      {tab === 'Subjects' && <SubjectsTab classes={classes} />}
      {tab === 'Exams' && <ExamsTab classes={classes} />}
      {tab === 'Results' && <ResultsTab classes={classes} />}
    </>
  );
}

// ── SUBJECTS TAB ──────────────────────────────────────────────
function SubjectsTab({ classes }) {
  const [classId, setClassId] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [newSubject, setNewSubject] = useState('');

  const load = (cid) => {
    if (!cid) { setSubjects([]); return; }
    API.get(`/subjects/class/${cid}`).then((r) => setSubjects(r.data)).catch(console.error);
  };
  useEffect(() => { load(classId); }, [classId]);

  const addSubject = async () => {
    if (!classId) { showError('Select a class first'); return; }
    if (!newSubject.trim()) { showError('Enter subject name'); return; }
    try {
      await API.post('/subjects', { subjectName: newSubject.trim(), classId: Number(classId) });
      setNewSubject('');
      load(classId);
      showSuccess('Subject added');
    } catch (err) { showError(err.response?.data?.message || 'Failed'); }
  };

  const del = async (id) => {
    if (!(await confirmAction('Delete Subject?', 'Remove this subject?'))) return;
    try { await API.delete(`/subjects/${id}`); load(classId); showSuccess('Subject deleted'); }
    catch (err) { showError(err.response?.data?.message || 'Failed to delete'); }
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
          <label className="form-label">Select Class</label>
          <select className="form-control" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Choose Class</option>
            {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}{c.stream ? ` ${c.stream}` : ''} ({c.section})</option>)}
          </select>
        </div>
        {classId && (
          <>
            <div className="form-group" style={{ marginBottom: 0, flex: 1, minWidth: 200 }}>
              <label className="form-label">New Subject</label>
              <input className="form-control" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} placeholder="e.g. Mathematics" onKeyDown={(e) => e.key === 'Enter' && addSubject()} />
            </div>
            <button className="btn btn-primary" onClick={addSubject}><Plus size={16} /> Add</button>
          </>
        )}
      </div>

      {classId && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {subjects.map((s) => (
            <div key={s.subjectId} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface-2)', border: '1px solid var(--border-col)', borderRadius: 20, padding: '6px 8px 6px 14px' }}>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{s.subjectName}</span>
              <button className="btn btn-danger btn-sm" style={{ height: 26, padding: '0 8px' }} onClick={() => del(s.subjectId)}><Trash2 size={12} /></button>
            </div>
          ))}
          {subjects.length === 0 && <div className="empty-state" style={{ width: '100%', padding: 30 }}>No subjects yet for this class.</div>}
        </div>
      )}
    </div>
  );
}

// ── EXAMS TAB ─────────────────────────────────────────────────
function ExamsTab({ classes }) {
  const [classId, setClassId] = useState('');
  const [exams, setExams] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [examName, setExamName] = useState('Unit Test 1');
  const [rows, setRows] = useState([]); // {subjectId, examDate, maxMarks, passingMarks}

  const loadExams = (cid) => {
    if (!cid) { setExams([]); return; }
    API.get(`/exams?classId=${cid}`).then((r) => setExams(r.data)).catch(console.error);
    API.get(`/subjects/class/${cid}`).then((r) => setSubjects(r.data)).catch(console.error);
  };
  useEffect(() => { loadExams(classId); }, [classId]);

  const openModal = () => {
    if (!classId) { showError('Select a class first'); return; }
    if (subjects.length === 0) { showError('Add subjects to this class first (Subjects tab).'); return; }
    setExamName('Unit Test 1');
    setRows([{ subjectId: '', examDate: '', maxMarks: 100, passingMarks: 35 }]);
    setShowModal(true);
  };

  const setRow = (i, k, v) => setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [k]: v } : r)));
  const addRow = () => setRows((rs) => [...rs, { subjectId: '', examDate: '', maxMarks: 100, passingMarks: 35 }]);
  const removeRow = (i) => setRows((rs) => rs.filter((_, idx) => idx !== i));

  const saveExam = async () => {
    const valid = rows.filter((r) => r.subjectId);
    if (valid.length === 0) { showError('Add at least one subject'); return; }
    if (!(await confirmSave('Create Exam?', 'Save this exam with the selected subjects?'))) return;
    try {
      await API.post('/exams', {
        examName, classId: Number(classId),
        subjects: valid.map((r) => ({ subjectId: Number(r.subjectId), examDate: r.examDate || null, maxMarks: Number(r.maxMarks) || 100, passingMarks: Number(r.passingMarks) || 35 })),
      });
      setShowModal(false);
      loadExams(classId);
      showSuccess('Exam added');
    } catch (err) { showError(err.response?.data?.message || 'Failed'); }
  };

  const delExam = async (id) => {
    if (!(await confirmAction('Delete Exam?', 'This deletes the exam and all its results.'))) return;
    try { await API.delete(`/exams/${id}`); loadExams(classId); showSuccess('Exam deleted'); }
    catch { showError('Failed to delete'); }
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ display: 'flex', gap: 12, marginBottom: 18, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
          <label className="form-label">Select Class</label>
          <select className="form-control" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Choose Class</option>
            {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}{c.stream ? ` ${c.stream}` : ''} ({c.section})</option>)}
          </select>
        </div>
        {classId && <button className="btn btn-primary" onClick={openModal}><Plus size={16} /> Create Exam</button>}
      </div>

      <div className="table-wrapper">
        <table>
          <thead><tr><th>Exam</th><th>Subjects</th><th>Actions</th></tr></thead>
          <tbody>
            {exams.map((e) => (
              <tr key={e.examId}>
                <td style={{ fontWeight: 600 }}>{e.examName}</td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {e.subjects.map((s) => <span key={s.examSubjectId} className="badge badge-info">{s.subjectName} ({s.examDate || 'no date'})</span>)}
                  </div>
                </td>
                <td><button className="btn btn-danger btn-sm" onClick={() => delExam(e.examId)}><Trash2 size={14} /></button></td>
              </tr>
            ))}
            {exams.length === 0 && <tr><td colSpan="3" className="empty-state">{classId ? 'No exams yet for this class.' : 'Select a class.'}</td></tr>}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <div className="modal-title">Create Exam</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Exam Name</label>
                <select className="form-control" value={examName} onChange={(e) => setExamName(e.target.value)}>
                  {EXAM_NAMES.map((n) => <option key={n}>{n}</option>)}
                </select>
              </div>
              <div className="form-section-title" style={{ marginTop: 8 }}>Subjects &amp; Schedule</div>
              {rows.map((r, i) => (
                <div key={i} className="form-row" style={{ alignItems: 'flex-end', marginBottom: 8 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Subject</label>
                    <select className="form-control" value={r.subjectId} onChange={(e) => setRow(i, 'subjectId', e.target.value)}>
                      <option value="">Select</option>
                      {subjects.map((s) => <option key={s.subjectId} value={s.subjectId}>{s.subjectName}</option>)}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Exam Date</label>
                    <input type="date" className="form-control" value={r.examDate} onChange={(e) => setRow(i, 'examDate', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Max</label>
                    <input type="number" className="form-control" value={r.maxMarks} onChange={(e) => setRow(i, 'maxMarks', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label className="form-label">Pass</label>
                    <input type="number" className="form-control" value={r.passingMarks} onChange={(e) => setRow(i, 'passingMarks', e.target.value)} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <button className="btn btn-danger" onClick={() => removeRow(i)} disabled={rows.length === 1}><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
              <button className="btn btn-outline btn-sm" onClick={addRow}><Plus size={14} /> Add Subject</button>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveExam}><Save size={16} /> Save Exam</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── RESULTS TAB ───────────────────────────────────────────────
function ResultsTab({ classes }) {
  const [mode, setMode] = useState('entry'); // entry | marksheet
  const [classId, setClassId] = useState('');
  const [exams, setExams] = useState([]);
  const [examId, setExamId] = useState('');
  const [examSubjectId, setExamSubjectId] = useState('');
  const [gridMeta, setGridMeta] = useState(null);
  const [rows, setRows] = useState([]);

  // marksheet mode
  const [students, setStudents] = useState([]);
  const [studentId, setStudentId] = useState('');
  const [marksheet, setMarksheet] = useState([]);

  const selectedExam = exams.find((e) => e.examId === Number(examId));

  useEffect(() => {
    if (!classId) { setExams([]); setStudents([]); return; }
    API.get(`/exams?classId=${classId}`).then((r) => setExams(r.data)).catch(console.error);
    API.get(`/students?classId=${classId}`).then((r) => setStudents(r.data)).catch(console.error);
    setExamId(''); setExamSubjectId(''); setRows([]); setGridMeta(null);
    setStudentId(''); setMarksheet([]);
  }, [classId]);

  const loadGrid = (esid) => {
    setExamSubjectId(esid);
    if (!esid) { setRows([]); setGridMeta(null); return; }
    API.get(`/results/by-subject?examSubjectId=${esid}`).then((r) => {
      setGridMeta(r.data.examSubject);
      setRows(r.data.rows);
    }).catch(console.error);
  };

  const setMark = (sid, k, v) => setRows((rs) => rs.map((r) => (r.studentId === sid ? { ...r, [k]: v } : r)));

  const saveMarks = async () => {
    if (!(await confirmSave('Save Marks?', 'Save the entered marks for this subject?'))) return;
    try {
      await API.post('/results/save-subject', {
        examSubjectId: Number(examSubjectId),
        rows: rows.map((r) => ({ studentId: r.studentId, marksObtained: r.isAbsent ? null : (r.marksObtained === '' || r.marksObtained == null ? null : Number(r.marksObtained)), isAbsent: r.isAbsent })),
      });
      showSuccess('Results saved');
    } catch { showError('Failed to save'); }
  };

  const loadMarksheet = (sid) => {
    setStudentId(sid);
    if (!sid) { setMarksheet([]); return; }
    API.get(`/results/by-student?studentId=${sid}`).then((r) => setMarksheet(r.data)).catch(console.error);
  };

  const doPrint = () => {
    const s = students.find((x) => x.studentId === Number(studentId));
    printMarksheet(s || {}, marksheet);
  };

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="tab-bar" style={{ marginBottom: 18 }}>
        <button className={`tab-btn ${mode === 'entry' ? 'active' : ''}`} onClick={() => setMode('entry')}>Marks Entry</button>
        <button className={`tab-btn ${mode === 'marksheet' ? 'active' : ''}`} onClick={() => setMode('marksheet')}>Marksheet / Report Card</button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ marginBottom: 0, minWidth: 170 }}>
          <label className="form-label">Class</label>
          <select className="form-control" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Choose Class</option>
            {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}{c.stream ? ` ${c.stream}` : ''} ({c.section})</option>)}
          </select>
        </div>

        {mode === 'entry' && classId && (
          <>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
              <label className="form-label">Exam</label>
              <select className="form-control" value={examId} onChange={(e) => { setExamId(e.target.value); setExamSubjectId(''); setRows([]); }}>
                <option value="">Choose Exam</option>
                {exams.map((e) => <option key={e.examId} value={e.examId}>{e.examName}</option>)}
              </select>
            </div>
            {selectedExam && (
              <div className="form-group" style={{ marginBottom: 0, minWidth: 160 }}>
                <label className="form-label">Subject</label>
                <select className="form-control" value={examSubjectId} onChange={(e) => loadGrid(e.target.value)}>
                  <option value="">Choose Subject</option>
                  {selectedExam.subjects.map((s) => <option key={s.examSubjectId} value={s.examSubjectId}>{s.subjectName}</option>)}
                </select>
              </div>
            )}
          </>
        )}

        {mode === 'marksheet' && classId && (
          <>
            <div className="form-group" style={{ marginBottom: 0, minWidth: 200 }}>
              <label className="form-label">Student</label>
              <select className="form-control" value={studentId} onChange={(e) => loadMarksheet(e.target.value)}>
                <option value="">Choose Student</option>
                {students.map((s) => <option key={s.studentId} value={s.studentId}>{s.firstName} {s.lastName} ({s.admissionNo})</option>)}
              </select>
            </div>
            {studentId && marksheet.length > 0 && <button className="btn btn-success" onClick={doPrint}><Printer size={16} /> Print Report Card</button>}
          </>
        )}
      </div>

      {/* Marks entry grid */}
      {mode === 'entry' && gridMeta && (
        <>
          <div style={{ marginBottom: 12, fontSize: 13, color: 'var(--text-muted)' }}>
            <strong>{gridMeta.subjectName}</strong> — Max: {gridMeta.maxMarks}, Pass: {gridMeta.passingMarks}, Date: {gridMeta.examDate || '-'}
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>Roll</th><th>Student</th><th>Marks (/{gridMeta.maxMarks})</th><th>Absent</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.studentId}>
                    <td>{r.rollNo || '-'}</td>
                    <td style={{ fontWeight: 600 }}>{r.studentName} <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>({r.admissionNo})</span></td>
                    <td>
                      <input type="number" className="form-control" style={{ width: 110, height: 32 }} value={r.marksObtained ?? ''} disabled={r.isAbsent}
                        onChange={(e) => setMark(r.studentId, 'marksObtained', e.target.value)} placeholder="—" />
                    </td>
                    <td>
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                        <input type="checkbox" checked={r.isAbsent} onChange={(e) => setMark(r.studentId, 'isAbsent', e.target.checked)} style={{ accentColor: 'var(--primary)', width: 16, height: 16 }} />
                        Absent
                      </label>
                    </td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan="4" className="empty-state">No students in this class.</td></tr>}
              </tbody>
            </table>
          </div>
          {rows.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 16 }}>
              <button className="btn btn-primary" onClick={saveMarks}><Save size={16} /> Save Marks</button>
            </div>
          )}
        </>
      )}

      {/* Marksheet preview */}
      {mode === 'marksheet' && studentId && (
        marksheet.length === 0
          ? <div className="empty-state">No results recorded for this student yet.</div>
          : marksheet.map((ex) => (
            <div key={ex.examId} style={{ marginBottom: 18, border: '1px solid var(--border-col)', borderRadius: 10, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--surface-2)', fontWeight: 700 }}>
                <span>{ex.examName}</span>
                <span style={{ color: 'var(--primary)' }}>Grade {ex.grade} • {ex.percentage}%</span>
              </div>
              <table>
                <thead><tr><th>Subject</th><th>Max</th><th>Obtained</th><th>Result</th></tr></thead>
                <tbody>
                  {ex.subjects.map((s, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{s.subjectName}</td>
                      <td>{s.maxMarks}</td>
                      <td>{s.isAbsent ? 'AB' : (s.marksObtained ?? '-')}</td>
                      <td><span className={`badge ${s.result === 'Pass' ? 'badge-success' : s.result === 'Absent' ? 'badge-warning' : 'badge-danger'}`}>{s.result}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))
      )}
    </div>
  );
}

export default function AcademicsPage() {
  return (
    <RouteGuard module="Academics">
      <AcademicsInner />
    </RouteGuard>
  );
}
