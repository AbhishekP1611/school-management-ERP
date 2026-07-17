'use client';

import { useState, useEffect } from 'react';
import API from '@/lib/api';
import { Plus, Edit2, Trash2, BookOpen, BookUp, IndianRupee, RotateCcw } from 'lucide-react';
import { showSuccess, showError, confirmAction, confirmSave } from '@/lib/alert';
import { runValidation, required } from '@/lib/validate';
import DataGrid from '@/components/DataGrid';
import RouteGuard from '@/components/RouteGuard';

const FINE_PER_DAY = 10;

function LibraryInner() {
  const [tab, setTab] = useState('Books');
  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Library Management</div>
          <div className="page-subtitle">Books, issue / return &amp; fines</div>
        </div>
      </div>
      <div className="tab-bar">
        <button className={`tab-btn ${tab === 'Books' ? 'active' : ''}`} onClick={() => setTab('Books')}><BookOpen size={14} style={{ marginRight: 6 }} />Inventory</button>
        <button className={`tab-btn ${tab === 'Issued' ? 'active' : ''}`} onClick={() => setTab('Issued')}><BookUp size={14} style={{ marginRight: 6 }} />Issued Books</button>
        <button className={`tab-btn ${tab === 'Fines' ? 'active' : ''}`} onClick={() => setTab('Fines')}><IndianRupee size={14} style={{ marginRight: 6 }} />Fines</button>
      </div>
      {tab === 'Books' && <BooksTab />}
      {tab === 'Issued' && <IssuedTab />}
      {tab === 'Fines' && <FinesTab />}
    </>
  );
}

// ── BOOKS INVENTORY ───────────────────────────────────────────
const EMPTY_BOOK = { bookName: '', author: '', price: 0, usableUntil: '' };

function BooksTab() {
  const [books, setBooks] = useState([]);
  const [students, setStudents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_BOOK);
  const [errors, setErrors] = useState({});

  // issue modal
  const [issueBook, setIssueBook] = useState(null);
  const [issueStudent, setIssueStudent] = useState('');
  const [issueDue, setIssueDue] = useState('');

  const set = (k, v) => { setForm((f) => ({ ...f, [k]: v })); if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined })); };

  const load = () => {
    API.get('/library/books').then((r) => setBooks(r.data)).catch(console.error);
    API.get('/students').then((r) => setStudents(r.data)).catch(console.error);
  };
  useEffect(() => { load(); }, []);

  const openForm = (b = null) => {
    setErrors({});
    if (b) { setEditId(b.bookId); setForm({ ...EMPTY_BOOK, ...b }); }
    else { setEditId(null); setForm(EMPTY_BOOK); }
    setShowModal(true);
  };

  const save = async (e) => {
    e.preventDefault();
    const errs = runValidation(form, { bookName: [required('Book name is required')] });
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (!(await confirmSave('Save Book?', 'Save this book to the inventory?'))) return;
    try {
      if (editId) { await API.put(`/library/books/${editId}`, form); showSuccess('Book updated'); }
      else { await API.post('/library/books', form); showSuccess('Book added'); }
      setShowModal(false); load();
    } catch (err) { showError(err.response?.data?.message || 'Failed'); }
  };

  const del = async (id) => {
    if (!(await confirmAction('Delete Book?', 'Remove this book from inventory?'))) return;
    try { await API.delete(`/library/books/${id}`); showSuccess('Book deleted'); load(); }
    catch (err) { showError(err.response?.data?.message || 'Failed'); }
  };

  const openIssue = (b) => {
    setIssueBook(b);
    setIssueStudent('');
    const d = new Date(); d.setDate(d.getDate() + 7);
    setIssueDue(d.toISOString().split('T')[0]);
  };

  const doIssue = async () => {
    if (!issueStudent) { showError('Select a student'); return; }
    try {
      await API.post('/library/issue', { bookId: issueBook.bookId, studentId: Number(issueStudent), dueDate: issueDue });
      showSuccess('Book issued');
      setIssueBook(null); load();
    } catch (err) { showError(err.response?.data?.message || 'Failed to issue'); }
  };

  const columns = [
    { key: 'bookName', label: 'Book', render: (b) => <span style={{ fontWeight: 600 }}>{b.bookName}</span> },
    { key: 'author', label: 'Author', value: (b) => b.author || '', render: (b) => b.author || '-' },
    { key: 'price', label: 'Price', value: (b) => b.price, render: (b) => `₹${b.price}` },
    { key: 'isAvailable', label: 'Status', value: (b) => (b.isAvailable ? 'Available' : 'Issued'), render: (b) => <span className={`badge ${b.isAvailable ? 'badge-success' : 'badge-warning'}`}>{b.isAvailable ? 'Available' : 'Issued'}</span> },
  ];

  return (
    <>
      <DataGrid
        columns={columns}
        rows={books}
        rowKey={(b) => b.bookId}
        exportName="Books"
        emptyText="No books in inventory."
        title="Book Inventory"
        toolbar={<button className="btn btn-primary" onClick={() => openForm()}><Plus size={16} /> Add Book</button>}
        actions={(b) => (
          <div style={{ display: 'flex', gap: 8 }}>
            {b.isAvailable && <button className="btn btn-success btn-sm" title="Issue" onClick={() => openIssue(b)}><BookUp size={14} /></button>}
            <button className="btn btn-outline btn-sm" onClick={() => openForm(b)}><Edit2 size={14} /></button>
            <button className="btn btn-danger btn-sm" onClick={() => del(b.bookId)}><Trash2 size={14} /></button>
          </div>
        )}
      />

      {/* Add/Edit book */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal modal-sm">
            <div className="modal-header"><div className="modal-title">{editId ? 'Edit Book' : 'Add Book'}</div><button className="modal-close" onClick={() => setShowModal(false)}>&times;</button></div>
            <form onSubmit={save} noValidate>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Book Name *</label>
                  <input className={`form-control ${errors.bookName ? 'input-error' : ''}`} value={form.bookName} onChange={(e) => set('bookName', e.target.value)} />
                  {errors.bookName && <span className="field-error">{errors.bookName}</span>}
                </div>
                <div className="form-group"><label className="form-label">Author</label><input className="form-control" value={form.author || ''} onChange={(e) => set('author', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Price</label><input type="number" className="form-control" value={form.price} onChange={(e) => set('price', parseFloat(e.target.value) || 0)} /></div>
                <div className="form-group"><label className="form-label">Usable Until (optional)</label><input type="date" className="form-control" value={form.usableUntil || ''} onChange={(e) => set('usableUntil', e.target.value)} /></div>
              </div>
              <div className="modal-footer"><button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button><button type="submit" className="btn btn-primary">Save</button></div>
            </form>
          </div>
        </div>
      )}

      {/* Issue book */}
      {issueBook && (
        <div className="modal-overlay">
          <div className="modal modal-sm">
            <div className="modal-header"><div className="modal-title">Issue "{issueBook.bookName}"</div><button className="modal-close" onClick={() => setIssueBook(null)}>&times;</button></div>
            <div className="modal-body">
              <div className="form-group">
                <label className="form-label">Student *</label>
                <select className="form-control" value={issueStudent} onChange={(e) => setIssueStudent(e.target.value)}>
                  <option value="">Select Student</option>
                  {students.map((s) => <option key={s.studentId} value={s.studentId}>{s.firstName} {s.lastName} ({s.admissionNo})</option>)}
                </select>
              </div>
              <div className="form-group"><label className="form-label">Due Date</label><input type="date" className="form-control" value={issueDue} onChange={(e) => setIssueDue(e.target.value)} /></div>
            </div>
            <div className="modal-footer"><button className="btn btn-outline" onClick={() => setIssueBook(null)}>Cancel</button><button className="btn btn-primary" onClick={doIssue}><BookUp size={16} /> Issue Book</button></div>
          </div>
        </div>
      )}
    </>
  );
}

// ── ISSUED BOOKS (with return) ────────────────────────────────
function IssuedTab() {
  const [issued, setIssued] = useState([]);
  const [collectRow, setCollectRow] = useState(null);
  const [fineAmount, setFineAmount] = useState(0);

  const load = () => API.get('/library/issued').then((r) => setIssued(r.data)).catch(console.error);
  useEffect(() => { load(); }, []);

  const openCollect = (row) => {
    setCollectRow(row);
    setFineAmount(row.daysOverdue * FINE_PER_DAY); // auto ₹10/day late
  };

  const doCollect = async () => {
    try {
      await API.post('/library/collect', { issueId: collectRow.issueId, fineAmount: Number(fineAmount) || 0, remarks: fineAmount > 0 ? `${collectRow.daysOverdue} days late @ ₹${FINE_PER_DAY}/day` : null });
      showSuccess('Book returned');
      setCollectRow(null); load();
    } catch (err) { showError(err.response?.data?.message || 'Failed'); }
  };

  const columns = [
    { key: 'bookName', label: 'Book', render: (r) => <span style={{ fontWeight: 600 }}>{r.bookName}</span> },
    { key: 'studentName', label: 'Student', value: (r) => `${r.studentName} ${r.admissionNo || ''}`, render: (r) => <><div>{r.studentName}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.admissionNo}</div></> },
    { key: 'issueDate', label: 'Issued' },
    { key: 'dueDate', label: 'Due' },
    { key: 'daysOverdue', label: 'Overdue', value: (r) => r.daysOverdue, render: (r) => r.daysOverdue > 0 ? <span className="badge badge-danger">{r.daysOverdue} days</span> : <span className="badge badge-success">On time</span> },
  ];

  return (
    <>
      <DataGrid
        columns={columns}
        rows={issued}
        rowKey={(r) => r.issueId}
        exportName="IssuedBooks"
        emptyText="No books currently issued."
        title="Issued Books"
        actions={(r) => <button className="btn btn-primary btn-sm" onClick={() => openCollect(r)}><RotateCcw size={14} /> Return</button>}
      />

      {collectRow && (
        <div className="modal-overlay">
          <div className="modal modal-sm">
            <div className="modal-header"><div className="modal-title">Return Book</div><button className="modal-close" onClick={() => setCollectRow(null)}>&times;</button></div>
            <div className="modal-body">
              <p style={{ marginBottom: 14, fontSize: 14 }}><strong>{collectRow.bookName}</strong> — {collectRow.studentName}</p>
              {collectRow.daysOverdue > 0 && (
                <div className="alert alert-danger" style={{ marginBottom: 14 }}>
                  Overdue by <strong>{collectRow.daysOverdue} days</strong> → fine @ ₹{FINE_PER_DAY}/day
                </div>
              )}
              <div className="form-group">
                <label className="form-label">Fine Amount (₹)</label>
                <input type="number" className="form-control" value={fineAmount} onChange={(e) => setFineAmount(e.target.value)} />
              </div>
            </div>
            <div className="modal-footer"><button className="btn btn-outline" onClick={() => setCollectRow(null)}>Cancel</button><button className="btn btn-primary" onClick={doCollect}>Confirm Return</button></div>
          </div>
        </div>
      )}
    </>
  );
}

// ── FINES ─────────────────────────────────────────────────────
function FinesTab() {
  const [fines, setFines] = useState([]);
  useEffect(() => { API.get('/library/fines').then((r) => setFines(r.data)).catch(console.error); }, []);

  const columns = [
    { key: 'studentName', label: 'Student', value: (f) => f.studentName || '', render: (f) => <span style={{ fontWeight: 600 }}>{f.studentName}</span> },
    { key: 'bookName', label: 'Book' },
    { key: 'fineAmount', label: 'Fine', value: (f) => f.fineAmount, render: (f) => <span style={{ fontWeight: 600, color: 'var(--danger)' }}>₹{f.fineAmount}</span> },
    { key: 'remarks', label: 'Remarks', value: (f) => f.remarks || '', render: (f) => f.remarks || '-' },
    { key: 'date', label: 'Date' },
  ];

  const total = fines.reduce((a, f) => a + Number(f.fineAmount || 0), 0);

  return (
    <>
      <DataGrid
        columns={columns}
        rows={fines}
        rowKey={(f) => f.fineId}
        exportName="Fines"
        emptyText="No fines collected."
        title="Library Fines"
        subtitle={`Total collected: ₹${total.toLocaleString()}`}
      />
    </>
  );
}

export default function LibraryPage() {
  return (
    <RouteGuard module="Library">
      <LibraryInner />
    </RouteGuard>
  );
}
