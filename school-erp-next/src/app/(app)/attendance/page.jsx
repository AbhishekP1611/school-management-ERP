'use client';

import { useState, useEffect } from 'react';
import API from '@/lib/api';
import { Save, CheckCircle, FileSpreadsheet, Filter, X } from 'lucide-react';
import { showSuccess, showError, confirmSave } from '@/lib/alert';
import { exportToExcel } from '@/lib/exportExcel';
import RouteGuard from '@/components/RouteGuard';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/lib/PermissionContext';
import { useAcademicYear } from '@/lib/AcademicYearContext';

const EXPORT_COLUMNS = [
  { key: 'name', label: 'Name' },
  { key: 'status', label: 'Status' },
  { key: 'remarks', label: 'Remarks' },
];

function AttendanceInner() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const { year } = useAcademicYear();
  const canManageAll = can('Attendance', 'canEdit');

  const today = new Date().toISOString().split('T')[0];
  const [type, setType] = useState('Student');
  const [date, setDate] = useState(today);
  const [records, setRecords] = useState([]);
  const [saving, setSaving] = useState(false);

  const isFuture = date > today;      // attendance can't be taken ahead of time
  const isPast = date < today;

  // class-wise (only for Student attendance)
  const [myClasses, setMyClasses] = useState([]);
  const [classId, setClassId] = useState('');

  // per-column header filters
  const [filters, setFilters] = useState({});
  const [openFilter, setOpenFilter] = useState(null);

  // load the classes this user can take attendance for (classes are master data — not year-scoped)
  useEffect(() => {
    API.get('/attendance/my-classes').then((r) => {
      setMyClasses(r.data);
      // auto-select if only one (typical for a class teacher)
      if (r.data.length === 1) setClassId(String(r.data[0].classId));
      else if (r.data.length && !canManageAll) setClassId(String(r.data[0].classId));
    }).catch(() => setMyClasses([]));
  }, [canManageAll]);

  const loadData = () => {
    // Student attendance is class-wise; require a class to be chosen
    if (type === 'Student' && !classId) { setRecords([]); return; }
    const cls = type === 'Student' && classId ? `&classId=${classId}` : '';
    API.get(`/attendance?referenceType=${type}&date=${date}${cls}`)
      .then((res) => setRecords(res.data))
      .catch(console.error);
  };
  useEffect(() => { loadData(); }, [type, date, classId]);

  const setFilter = (key, val) => setFilters((f) => ({ ...f, [key]: val }));
  const clearFilter = (key) => {
    setFilters((f) => { const n = { ...f }; delete n[key]; return n; });
    setOpenFilter(null);
  };

  const filtered = records.filter((r) => {
    const nameOk = !filters.name || (r.name || '').toLowerCase().includes(filters.name.toLowerCase());
    const statusOk = !filters.status || (r.status || '').toLowerCase().includes(filters.status.toLowerCase());
    return nameOk && statusOk;
  });

  const handleStatusChange = (id, newStatus) => {
    setRecords(records.map((r) => (r.referenceId === id ? { ...r, status: newStatus } : r)));
  };

  const handleSave = async () => {
    if (isFuture) { showError('Attendance cannot be marked for a future date.'); return; }
    if (records.length === 0) return;
    if (!(await confirmSave('Save Attendance?', `Save ${type} attendance for ${date}?`))) return;
    setSaving(true);
    try {
      const payload = {
        referenceType: type,
        attendanceDate: date,
        entries: records.map((r) => ({ referenceId: r.referenceId, status: r.status, remarks: r.remarks })),
      };
      await API.post('/attendance/bulk', payload);
      showSuccess('Attendance saved successfully!');
    } catch {
      showError('Failed to save attendance');
    } finally {
      setSaving(false);
    }
  };

  const markAll = (status) => setRecords(records.map((r) => ({ ...r, status })));

  // reusable header cell with filter funnel
  const FilterableTh = ({ colKey, label }) => {
    const active = !!(filters[colKey] && filters[colKey].trim());
    const isOpen = openFilter === colKey;
    return (
      <th>
        <div className="th-inner">
          <span>{label}</span>
          <button type="button" className={`th-filter-btn ${active ? 'active' : ''}`} onClick={() => setOpenFilter(isOpen ? null : colKey)} title={`Filter ${label}`}>
            <Filter size={13} />
          </button>
        </div>
        {isOpen && (
          <div className="th-filter-box">
            <input autoFocus type="text" placeholder={`Search ${label}...`} value={filters[colKey] || ''} onChange={(e) => setFilter(colKey, e.target.value)} onKeyDown={(e) => e.key === 'Escape' && setOpenFilter(null)} />
            <button type="button" onClick={() => clearFilter(colKey)} title="Clear"><X size={13} /></button>
          </div>
        )}
      </th>
    );
  };

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Attendance Register</div>
          <div className="page-subtitle">Mark daily attendance for students and teachers</div>
        </div>
        <div className="page-actions">
          <button className="grid-excel-btn" onClick={() => exportToExcel(filtered, `Attendance_${type}_${date}`, EXPORT_COLUMNS)} title="Export to Excel">
            <FileSpreadsheet size={18} />
          </button>
          <button className="btn btn-primary" onClick={handleSave} disabled={saving || records.length === 0}>
            {saving ? <span className="loading-spinner" /> : <><Save size={16} /> Save Register</>}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-header" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Students/Teachers tabs — teachers tab only for Admin */}
          <div className="tab-bar" style={{ margin: 0 }}>
            <button className={`tab-btn ${type === 'Student' ? 'active' : ''}`} onClick={() => setType('Student')}>Students</button>
            {canManageAll && <button className={`tab-btn ${type === 'Teacher' ? 'active' : ''}`} onClick={() => setType('Teacher')}>Teachers</button>}
          </div>

          {/* Class dropdown — only for student attendance */}
          {type === 'Student' && (
            <select className="form-control" style={{ width: '190px' }} value={classId} onChange={(e) => setClassId(e.target.value)} disabled={!canManageAll && myClasses.length <= 1}>
              <option value="">Select Class</option>
              {myClasses.map((c) => <option key={c.classId} value={c.classId}>{c.className}</option>)}
            </select>
          )}

          <input type="date" className="form-control" style={{ width: '160px' }} value={date} max={today} onChange={(e) => setDate(e.target.value)} title="Future dates are not allowed" />
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
            <button className="btn btn-outline btn-sm" onClick={() => markAll('Present')} disabled={records.length === 0}><CheckCircle size={14} /> Mark All Present</button>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrapper att-scroll">
            <table>
              <thead>
                <tr>
                  <FilterableTh colKey="name" label="Name" />
                  <FilterableTh colKey="status" label="Status" />
                  <th>Remarks (Optional)</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr><td colSpan="3" className="empty-state">
                    {isFuture
                      ? '📅 Attendance cannot be taken for a future date.'
                      : type === 'Student' && !classId
                        ? 'Select a class to mark attendance.'
                        : isPast
                          ? '🗓️ No attendance was marked for this date.'
                          : 'No records found for this class/date.'}
                  </td></tr>
                ) : filtered.map((r) => (
                  <tr key={r.referenceId}>
                    <td style={{ fontWeight: 500 }}>{r.name}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {['Present', 'Absent', 'Late', 'Leave'].map((s) => (
                          <button
                            key={s}
                            onClick={() => handleStatusChange(r.referenceId, s)}
                            className={`att-status-btn ${r.status === s ? `att-${s}` : ''}`}
                            style={{
                              opacity: r.status === s ? 1 : 0.5,
                              background: r.status === s ? '' : '#f1f5f9',
                              borderColor: r.status === s ? '' : '#e2e8f0',
                              color: r.status === s ? '' : '#64748b',
                            }}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control"
                        style={{ height: '30px' }}
                        value={r.remarks || ''}
                        onChange={(e) => setRecords(records.map((rec) => (rec.referenceId === r.referenceId ? { ...rec, remarks: e.target.value } : rec)))}
                        placeholder="Add note..."
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

export default function AttendancePage() {
  return (
    <RouteGuard module="Attendance">
      <AttendanceInner />
    </RouteGuard>
  );
}
