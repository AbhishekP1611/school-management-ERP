'use client';

import { useState, useEffect, useCallback } from 'react';
import API from '@/lib/api';
import {
  ArrowUpCircle, GraduationCap, CheckCircle2, XCircle, RotateCcw, LogOut,
  ClipboardCheck, AlertTriangle, ArrowRight, IndianRupee, X, Sparkles,
} from 'lucide-react';
import { showSuccess, showError, confirmAction, confirmSave } from '@/lib/alert';
import { usePermissions } from '@/lib/PermissionContext';
import { useAcademicYear } from '@/lib/AcademicYearContext';
import RouteGuard from '@/components/RouteGuard';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

// map an autoResult to an initial decision
const autoDecision = (r) => {
  if (r === 'Pass') return 'Promote';
  if (r === 'Supplementary') return 'Supplementary';
  if (r === 'Fail') return 'Detain';
  return 'Promote';   // NoData → default promote (user can change)
};

function PromotionInner() {
  const { can } = usePermissions();
  const canEdit = can('Promotion', 'canEdit');
  const { year, years } = useAcademicYear();

  const [tab, setTab] = useState('promote');

  return (
    <div className="page-wrap promo-page">
      <div className="fin-tabs">
        <button className={`fin-tab ${tab === 'promote' ? 'active' : ''}`} onClick={() => setTab('promote')}>
          <ArrowUpCircle size={16} /> Promote Class
        </button>
        <button className={`fin-tab ${tab === 'supp' ? 'active' : ''}`} onClick={() => setTab('supp')}>
          <ClipboardCheck size={16} /> Supplementary
        </button>
      </div>

      {tab === 'promote' && <PromoteView year={year} years={years} canEdit={canEdit} />}
      {tab === 'supp' && <SupplementaryView year={year} years={years} canEdit={canEdit} />}
    </div>
  );
}

function PromoteView({ year, years, canEdit }) {
  const [classes, setClasses] = useState([]);
  const [classId, setClassId] = useState('');
  const [toYear, setToYear] = useState('');
  const [targetClasses, setTargetClasses] = useState([]);
  const [preview, setPreview] = useState(null);
  const [rows, setRows] = useState([]);       // { studentId, decision, targetClassId, exitReason, ...meta }
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // next academic year (default target) = year with +1 start
  useEffect(() => {
    if (!year) return;
    const start = parseInt(year.split('-')[0], 10) + 1;
    const next = `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
    setToYear(years?.includes(next) ? next : (years?.find((y) => y > year) || next));
  }, [year, years]);

  // classes are master data (not year-scoped) — load once; students filter by year inside preview
  useEffect(() => {
    API.get('/classes').then((r) => setClasses(r.data || [])).catch(() => setClasses([]));
    API.get('/promotion/target-classes').then((r) => setTargetClasses(r.data || [])).catch(() => setTargetClasses([]));
  }, []);

  // Find the next class of the SAME section (e.g. "Class 6 A" → "Class 7 A" in toYear).
  const nextClassSameSection = useCallback((fromClassName) => {
    const num = parseInt((fromClassName.match(/\d+/) || [])[0], 10);
    // section = whatever comes after the class number (A / B / Science...)
    const secMatch = fromClassName.replace(/Class\s*\d+/i, '').trim();
    if (isNaN(num)) return null;
    const nextNum = num + 1;
    // prefer exact number + same section
    let cls = targetClasses.find((c) =>
      c.className.replace(/\D/g, '') === String(nextNum) &&
      (c.section || '').toLowerCase() === secMatch.toLowerCase());
    // fallback: just the next number (any section)
    if (!cls) cls = targetClasses.find((c) => c.className.replace(/\D/g, '') === String(nextNum));
    return cls || null;
  }, [targetClasses]);

  // Re-apply the auto target whenever target classes finish loading (fixes the
  // race where preview loads before target-classes arrive) — only fills empty ones.
  useEffect(() => {
    if (!preview || targetClasses.length === 0) return;
    const nc = nextClassSameSection(preview.fromClassName || '');
    if (!nc) return;
    setRows((rs) => rs.map((r) => (r.decision === 'Promote' && !r.targetClassId ? { ...r, targetClassId: String(nc.classId) } : r)));
  }, [targetClasses, preview, nextClassSameSection]);

  const loadPreview = useCallback(() => {
    if (!classId || !year) return;
    setLoading(true);
    API.get(`/promotion/preview?year=${year}&classId=${classId}`)
      .then((r) => {
        setPreview(r.data);
        // auto next class (same section) for the whole batch
        const nextCls = nextClassSameSection(r.data.fromClassName || '');
        const src = r.data.students || [];
        setRows(src.map((s) => {
          const dec = autoDecision(s.autoResult);
          return {
            studentId: s.studentId,
            admissionNo: s.admissionNo,
            name: s.name,
            rollNo: s.rollNo,
            autoResult: s.autoResult,
            percent: s.percent,
            failedSubjects: s.failedSubjects,
            totalSubjects: s.totalSubjects,
            feeDue: s.feeDue,
            decision: dec,
            // auto-fill target for promotions; user can override (e.g. stream after 10th)
            targetClassId: dec === 'Promote' && nextCls ? String(nextCls.classId) : '',
            exitReason: 'Left',
          };
        }));
      })
      .catch(() => { setPreview(null); setRows([]); })
      .finally(() => setLoading(false));
  }, [classId, year, nextClassSameSection]);

  useEffect(() => { setPreview(null); setRows([]); }, [classId]);

  const setRow = (sid, patch) => setRows((rs) => rs.map((r) => (r.studentId === sid ? { ...r, ...patch } : r)));

  // when a decision flips to Promote and no target set yet, auto-fill next class (same section)
  const changeDecision = (sid, dec) => {
    setRows((rs) => rs.map((r) => {
      if (r.studentId !== sid) return r;
      let tgt = r.targetClassId;
      if (dec === 'Promote' && !tgt && preview) {
        const nc = nextClassSameSection(preview.fromClassName || '');
        if (nc) tgt = String(nc.classId);
      }
      return { ...r, decision: dec, targetClassId: tgt };
    }));
  };

  const bulkDecision = (dec) => setRows((rs) => rs.map((r) => {
    let tgt = r.targetClassId;
    if (dec === 'Promote' && !tgt && preview) {
      const nc = nextClassSameSection(preview.fromClassName || '');
      if (nc) tgt = String(nc.classId);
    }
    return { ...r, decision: dec, targetClassId: tgt };
  }));

  // manual re-map button (same section)
  const autoMapTargets = () => {
    if (!preview) return;
    const nextCls = nextClassSameSection(preview.fromClassName || '');
    setRows((rs) => rs.map((r) => (r.decision === 'Promote' && nextCls ? { ...r, targetClassId: String(nextCls.classId) } : r)));
    if (!nextCls) showError('Could not auto-detect the next class — please pick target classes manually.');
  };

  const counts = rows.reduce((a, r) => { a[r.decision] = (a[r.decision] || 0) + 1; return a; }, {});

  const submit = async () => {
    const promoteMissing = rows.filter((r) => r.decision === 'Promote' && !r.targetClassId);
    if (promoteMissing.length) { showError(`${promoteMissing.length} promoted student(s) have no target class. Use "Auto-map" or pick one.`); return; }
    const summary = `${counts.Promote || 0} promote · ${counts.Detain || 0} detain · ${counts.Supplementary || 0} supplementary · ${counts.Left || 0} left`;
    if (!(await confirmSave('Confirm promotion?', `${summary}\n\nThis moves students to ${toYear}. Past-year data stays untouched.`))) return;
    setSaving(true);
    try {
      const payload = {
        fromYear: year,
        toYear,
        rows: rows.map((r) => ({
          studentId: r.studentId,
          decision: r.decision,
          targetClassId: r.decision === 'Promote' ? Number(r.targetClassId) : null,
          exitReason: r.decision === 'Left' ? r.exitReason : null,
        })),
      };
      const res = await API.post('/promotion/promote', payload);
      showSuccess(res.data?.message || 'Promotion complete');
      // Reload the class: promoted & left students disappear (their year/active changed);
      // only students still in this class+year (e.g. supplementary) remain.
      loadPreview();
    } catch (err) {
      showError(err.response?.data?.message || 'Promotion failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="fin-window">
      <div className="fin-window-head">
        <div className="fin-window-title"><ArrowUpCircle size={17} /> Promote Class <span className="fin-year">{year} → {toYear}</span></div>
      </div>

      {/* class picker */}
      <div className="promo-picker">
        <div className="pp-field">
          <label>Class to promote (from {year})</label>
          <select className="form-control" value={classId} onChange={(e) => setClassId(e.target.value)}>
            <option value="">Select a class</option>
            {classes.map((c) => <option key={c.classId} value={c.classId}>{c.className}{c.stream ? ` ${c.stream}` : ''} ({c.section})</option>)}
          </select>
        </div>
        <button className="btn btn-primary" onClick={loadPreview} disabled={!classId || loading}>
          {loading ? <span className="loading-spinner" /> : <>Load Students <ArrowRight size={15} /></>}
        </button>
      </div>

      {preview && rows.length === 0 && <div className="empty-state" style={{ padding: 30 }}>No active students in this class for {year}.</div>}

      {rows.length > 0 && (
        <>
          {/* bulk actions + summary */}
          <div className="promo-bulk">
            <div className="promo-bulk-actions">
              {canEdit && <>
                <button className="btn btn-outline btn-sm" onClick={() => bulkDecision('Promote')}><CheckCircle2 size={14} /> All Promote</button>
                <button className="btn btn-outline btn-sm" onClick={autoMapTargets}><ArrowRight size={14} /> Auto-map target</button>
              </>}
            </div>
            <div className="promo-summary">
              <span className="pchip pass">{counts.Promote || 0} Promote</span>
              <span className="pchip detain">{counts.Detain || 0} Detain</span>
              <span className="pchip supp">{counts.Supplementary || 0} Supp</span>
              <span className="pchip left">{counts.Left || 0} Left</span>
            </div>
          </div>

          <div className="table-wrapper promo-scroll">
            <table className="fin-table">
              <thead>
                <tr>
                  <th>Student</th><th>Result (auto)</th><th>%</th><th>Decision</th><th>Target / Reason</th><th>Fee Due</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.studentId}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{r.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{r.admissionNo} · Roll {r.rollNo}</div>
                    </td>
                    <td><ResultBadge r={r.autoResult} failed={r.failedSubjects} total={r.totalSubjects} /></td>
                    <td className="fin-amt" style={{ textAlign: 'left' }}>{r.totalSubjects > 0 ? r.percent + '%' : '—'}</td>
                    <td>
                      <select className="form-control promo-dec" value={r.decision} disabled={!canEdit}
                        onChange={(e) => changeDecision(r.studentId, e.target.value)}>
                        <option value="Promote">Promote</option>
                        <option value="Detain">Detain</option>
                        <option value="Supplementary">Supplementary</option>
                        <option value="Left">Left / TC</option>
                      </select>
                    </td>
                    <td>
                      {r.decision === 'Promote' && (
                        <select className={`form-control promo-tgt ${!r.targetClassId ? 'promo-need' : ''}`} value={r.targetClassId} disabled={!canEdit}
                          onChange={(e) => setRow(r.studentId, { targetClassId: e.target.value })}>
                          <option value="">→ class…</option>
                          {targetClasses.map((c) => <option key={c.classId} value={c.classId}>{c.name}</option>)}
                        </select>
                      )}
                      {r.decision === 'Left' && (
                        <select className="form-control promo-tgt" value={r.exitReason} disabled={!canEdit}
                          onChange={(e) => setRow(r.studentId, { exitReason: e.target.value })}>
                          <option value="Left">Left</option>
                          <option value="TC">TC issued</option>
                        </select>
                      )}
                      {r.decision === 'Detain' && <span className="promo-note">Repeats {preview.fromClassName}</span>}
                      {r.decision === 'Supplementary' && <span className="promo-note supp">Stays until supp result</span>}
                    </td>
                    <td className="fin-amt" style={{ color: r.feeDue > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                      {r.feeDue > 0 ? fmt(r.feeDue) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {rows.some((r) => r.feeDue > 0) && (
            <div className="promo-fee-note"><IndianRupee size={13} /> Students with a pending balance will get a "Previous Balance" fee carried into {toYear}.</div>
          )}

          {canEdit && (
            <div className="promo-footer">
              <button className="btn btn-primary" onClick={submit} disabled={saving}>
                {saving ? <span className="loading-spinner" /> : <><ArrowUpCircle size={16} /> Confirm Promotion</>}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ResultBadge({ r, failed, total }) {
  if (r === 'Pass') return <span className="rbadge pass"><CheckCircle2 size={12} /> Pass</span>;
  if (r === 'Supplementary') return <span className="rbadge supp"><AlertTriangle size={12} /> Supp ({failed})</span>;
  if (r === 'Fail') return <span className="rbadge fail"><XCircle size={12} /> Fail ({failed}/{total})</span>;
  return <span className="rbadge nodata">No marks</span>;
}

function SupplementaryView({ year, years, canEdit }) {
  const [list, setList] = useState([]);
  const [status, setStatus] = useState('Pending');
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState({ ready: [], failed: [] });
  const [decideRec, setDecideRec] = useState(null);   // record open in the decide modal
  const [toYear, setToYear] = useState('');
  const [targetClasses, setTargetClasses] = useState([]);

  useEffect(() => {
    if (!year) return;
    const start = parseInt(year.split('-')[0], 10) + 1;
    const next = `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
    setToYear(years?.includes(next) ? next : (years?.find((y) => y > year) || next));
  }, [year, years]);

  useEffect(() => {
    API.get('/promotion/target-classes').then((r) => setTargetClasses(r.data || [])).catch(() => setTargetClasses([]));
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    const y = year ? `year=${year}&` : '';
    API.get(`/promotion/supplementary?${y}status=${status}`).then((r) => setList(r.data || [])).catch(() => setList([])).finally(() => setLoading(false));
    if (year) API.get(`/promotion/ready?year=${year}`).then((r) => setReady(r.data || { ready: [], failed: [] })).catch(() => {});
  }, [year, status]);
  useEffect(() => { load(); }, [load]);

  const promoteCleared = async (stu) => {
    // pick a target class quickly
    const guessNext = (() => {
      const num = parseInt((stu.className.match(/\d+/) || [])[0], 10);
      if (isNaN(num)) return null;
      return targetClasses.find((c) => c.className.includes(String(num + 1)));
    })();
    const options = targetClasses.map((c) => `${c.classId}:${c.name}`).join(', ');
    const { value: pick } = await import('sweetalert2').then((m) => m.default.fire({
      title: `Promote ${stu.name}?`,
      html: `<div style="font-size:13px;color:#64748b;text-align:left">Supplementary cleared. Choose the class in <b>${toYear}</b>:</div>`,
      input: 'select',
      inputOptions: Object.fromEntries(targetClasses.map((c) => [c.classId, c.name])),
      inputValue: guessNext ? guessNext.classId : '',
      showCancelButton: true,
      confirmButtonText: '🎓 Promote',
      confirmButtonColor: '#16a34a',
    }));
    if (!pick) return;
    try {
      await API.post('/promotion/promote-supplementary', { studentId: stu.studentId, targetClassId: Number(pick), toYear });
      showSuccess(`${stu.name} promoted`);
      load();
    } catch (err) { showError(err.response?.data?.message || 'Failed'); }
  };

  return (
    <>
      {/* Ready-to-promote panel (students who cleared all supp) */}
      {(ready.ready?.length > 0 || ready.failed?.length > 0) && (
        <div className="fin-window" style={{ marginBottom: 16 }}>
          <div className="fin-window-title" style={{ marginBottom: 12 }}><Sparkles size={16} /> After Supplementary — {year}</div>
          {ready.ready?.length > 0 && (
            <div className="promo-ready">
              <div className="promo-ready-label pass">✅ Cleared — ready to promote</div>
              {ready.ready.map((s) => (
                <div className="promo-ready-item" key={s.studentId}>
                  <div><b>{s.name}</b> <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{s.admissionNo} · {s.className}</span></div>
                  {canEdit && <button className="btn btn-sm" style={{ background: '#16a34a', color: '#fff' }} onClick={() => promoteCleared(s)}><ArrowUpCircle size={14} /> Promote to {toYear}</button>}
                </div>
              ))}
            </div>
          )}
          {ready.failed?.length > 0 && (
            <div className="promo-ready">
              <div className="promo-ready-label fail">✖ Failed supplementary — detained</div>
              {ready.failed.map((s) => (
                <div className="promo-ready-item" key={s.studentId}>
                  <div><b>{s.name}</b> <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{s.admissionNo} · {s.className}</span></div>
                  <span className="rbadge fail">Repeats {s.className}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="fin-window">
        <div className="fin-window-head">
          <div className="fin-window-title"><ClipboardCheck size={17} /> Supplementary Records <span className="fin-year">{year}</span></div>
          <div className="fin-window-actions">
            <select className="form-control" style={{ width: 'auto', height: 38 }} value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="Pending">Pending</option>
              <option value="Pass">Passed</option>
              <option value="Fail">Failed</option>
              <option value="All">All</option>
            </select>
          </div>
        </div>

        {loading ? <div className="empty-state"><span className="loading-spinner" /> Loading…</div>
          : list.length === 0 ? <div className="empty-state fin-empty"><ClipboardCheck size={34} /><p>No {status.toLowerCase()} supplementary records.</p></div>
          : (
            <div className="table-wrapper">
              <table className="fin-table">
                <thead><tr><th>Student</th><th>Subject</th><th>From Class</th><th>Exam Marks</th><th>Supp Marks</th><th>Status</th>{canEdit && <th></th>}</tr></thead>
                <tbody>
                  {list.map((s) => (
                    <tr key={s.supplementaryId}>
                      <td><div style={{ fontWeight: 600 }}>{s.studentName}</div><div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{s.admissionNo}</div></td>
                      <td>{s.subjectName || '—'}</td>
                      <td style={{ fontSize: 13 }}>{s.fromClass}</td>
                      <td style={{ fontSize: 13 }}>{s.marksObtained ?? '—'}{s.passingMarks ? ` / ${s.passingMarks}` : ''}</td>
                      <td style={{ fontSize: 13, fontWeight: 600 }}>{s.suppMarks != null ? s.suppMarks : '—'}</td>
                      <td><span className={`rbadge ${s.status === 'Pass' ? 'pass' : s.status === 'Fail' ? 'fail' : 'supp'}`}>{s.status}</span></td>
                      {canEdit && (
                        <td style={{ textAlign: 'right' }}>
                          {s.status === 'Pending'
                            ? <button className="btn btn-sm btn-primary" onClick={() => setDecideRec(s)}><ClipboardCheck size={13} /> Enter Result</button>
                            : <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>decided</span>}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </div>

      {decideRec && <DecideModal rec={decideRec} onClose={() => setDecideRec(null)} onDone={() => { setDecideRec(null); load(); }} />}
    </>
  );
}

function DecideModal({ rec, onClose, onDone }) {
  const [marks, setMarks] = useState('');
  const [saving, setSaving] = useState(false);
  const pass = marks !== '' && rec.passingMarks != null && Number(marks) >= Number(rec.passingMarks);

  const save = async (forceStatus) => {
    if (marks === '' || Number(marks) < 0) { showError('Enter the supplementary exam marks'); return; }
    const st = forceStatus || (pass ? 'Pass' : 'Fail');
    setSaving(true);
    try {
      await API.post(`/promotion/supplementary/${rec.supplementaryId}/decide`, { status: st, newMarks: Number(marks), remarks: null });
      showSuccess(`Marked ${st} (${marks}/${rec.passingMarks ?? '—'})`);
      onDone();
    } catch (err) { showError(err.response?.data?.message || 'Failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal modal-sm">
        <div className="modal-header">
          <div className="modal-title"><ClipboardCheck size={17} /> Supplementary Result</div>
          <button className="modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="modal-body">
          <div className="promo-decide-info">
            <div><b>{rec.studentName}</b> · {rec.admissionNo}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{rec.subjectName} · {rec.fromClass} · original {rec.marksObtained ?? '—'}/{rec.passingMarks ?? '—'}</div>
          </div>
          <div className="form-group" style={{ marginTop: 14 }}>
            <label className="form-label">Supplementary exam marks *</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input type="number" min="0" className="form-control" style={{ width: 120 }} value={marks} onChange={(e) => setMarks(e.target.value)} autoFocus placeholder="0" />
              <span style={{ color: 'var(--text-muted)' }}>/ {rec.passingMarks ?? '—'} passing</span>
            </div>
            {marks !== '' && (
              <div className={`fin-budget-hint ${pass ? 'ok' : 'over'}`} style={{ marginTop: 10 }}>
                {pass ? <><CheckCircle2 size={13} /> Passing — student clears this subject</> : <><XCircle size={13} /> Below passing — student fails this subject</>}
              </div>
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-outline" onClick={onClose}>Cancel</button>
          <button className="btn btn-danger" onClick={() => save('Fail')} disabled={saving}><XCircle size={15} /> Fail</button>
          <button className="btn btn-primary" onClick={() => save('Pass')} disabled={saving} style={{ background: '#16a34a' }}>
            {saving ? <span className="loading-spinner" /> : <><CheckCircle2 size={15} /> Pass</>}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PromotionPage() {
  return (
    <RouteGuard module="Promotion">
      <PromotionInner />
    </RouteGuard>
  );
}
