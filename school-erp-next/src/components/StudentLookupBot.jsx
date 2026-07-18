'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import API from '@/lib/api';
import {
  Bot, X, Search, GraduationCap, IndianRupee, Library as LibraryIcon,
  Bus, ClipboardCheck, CalendarCheck, User, ArrowLeft, CheckCircle2, XCircle, Filter,
} from 'lucide-react';
import { useAcademicYear } from '@/lib/AcademicYearContext';

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export default function StudentLookupBot({ onClose }) {
  const { years: allYears, year: currentYear } = useAcademicYear();
  const [q, setQ] = useState('');
  const [filterYear, setFilterYear] = useState('');    // year filter
  const [filterClass, setFilterClass] = useState('');  // class filter
  const [classes, setClasses] = useState([]);
  const [results, setResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [picked, setPicked] = useState(null);     // chosen student
  const [years, setYears] = useState([]);
  const [year, setYear] = useState('');
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [weakness, setWeakness] = useState(null);       // AI weakness analysis
  const [weakLoading, setWeakLoading] = useState(false);
  const deb = useRef(null);

  // default the year filter to the current academic year
  useEffect(() => { if (currentYear && !filterYear) setFilterYear(currentYear); }, [currentYear]);

  // classes are master data (not year-scoped) — load once; the year filter applies to students
  useEffect(() => {
    API.get('/student-lookup/classes').then((r) => setClasses(r.data || [])).catch(() => setClasses([]));
  }, []);

  // search as filters/text change (need at least one filter)
  useEffect(() => {
    if (picked) return;
    if (!q.trim() && !filterYear && !filterClass) { setResults([]); return; }
    setSearching(true);
    clearTimeout(deb.current);
    deb.current = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        if (q.trim()) params.set('q', q.trim());
        if (filterYear) params.set('year', filterYear);
        if (filterClass) params.set('classId', filterClass);
        const r = await API.get(`/student-lookup/search?${params.toString()}`);
        setResults(r.data || []);
      } catch { setResults([]); } finally { setSearching(false); }
    }, 300);
    return () => clearTimeout(deb.current);
  }, [q, filterYear, filterClass, picked]);

  const pick = async (s) => {
    setPicked(s); setResults([]); setDetail(null); setWeakness(null);
    try {
      const r = await API.get(`/student-lookup/years?studentId=${s.studentId}`);
      const ys = r.data || [];
      setYears(ys);
      setYear(ys[0] || s.academicYear || '');
    } catch { setYears([]); }
  };

  const loadDetail = useCallback(() => {
    if (!picked || !year) return;
    setLoading(true);
    API.get(`/student-lookup/detail?studentId=${picked.studentId}&year=${year}`)
      .then((r) => setDetail(r.data))
      .catch(() => setDetail(null))
      .finally(() => setLoading(false));
  }, [picked, year]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  // Clear any old analysis when the student/year changes.
  useEffect(() => { setWeakness(null); }, [picked, year]);

  const runWeakness = () => {
    if (!picked || !year) return;
    setWeakLoading(true);
    API.get(`/student-lookup/weakness?studentId=${picked.studentId}&year=${year}`)
      .then((r) => setWeakness(r.data))
      .catch(() => setWeakness({ hasData: false, message: "Couldn't analyze this student's results." }))
      .finally(() => setWeakLoading(false));
  };

  const reset = () => { setPicked(null); setDetail(null); setWeakness(null); setQ(''); setResults([]); setYears([]); };

  return (
    <div className="bot-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bot-panel">
        <div className="bot-head">
          <div className="bot-title"><Bot size={18} /> Student Assistant</div>
          <button className="bot-close" onClick={onClose}><X size={18} /></button>
        </div>

        {!picked ? (
          <div className="bot-body">
            <div className="bot-hello">
              <div className="bot-hello-icon"><Bot size={26} /></div>
              <div>
                <div className="bot-hello-t">Find a student 👋</div>
                <div className="bot-hello-s">Filter by year & class, or type a name — I'll pull up their full record.</div>
              </div>
            </div>

            {/* Year + Class filters */}
            <div className="bot-filters">
              <div className="bot-filter">
                <label><Filter size={11} /> Year</label>
                <select value={filterYear} onChange={(e) => setFilterYear(e.target.value)}>
                  <option value="">Any year</option>
                  {(allYears || []).map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div className="bot-filter">
                <label><Filter size={11} /> Class</label>
                <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
                  <option value="">All classes</option>
                  {classes.map((c) => <option key={c.classId} value={c.classId}>{c.name}</option>)}
                </select>
              </div>
            </div>

            <div className="bot-search">
              <Search size={16} className="bot-search-ico" />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Student name or admission no… (optional)" />
            </div>
            {searching && <div className="bot-hint">Searching…</div>}
            <div className="bot-results">
              {results.map((s) => (
                <button key={s.studentId} className="bot-result" onClick={() => pick(s)}>
                  <div className="bot-result-av">{s.name.charAt(0)}</div>
                  <div className="bot-result-main">
                    <div className="bot-result-name">{s.name}{!s.active && <span className="bot-inactive">inactive</span>}</div>
                    <div className="bot-result-sub">{s.admissionNo} · {s.className || '—'} · {s.academicYear}</div>
                  </div>
                </button>
              ))}
              {!searching && (q.trim() || filterYear || filterClass) && results.length === 0 && <div className="bot-hint">No students match these filters.</div>}
              {!searching && results.length > 0 && <div className="bot-hint" style={{ paddingTop: 4 }}>{results.length} student{results.length > 1 ? 's' : ''} found</div>}
            </div>
          </div>
        ) : (
          <div className="bot-body">
            {/* student header + year switcher */}
            <div className="bot-student-head">
              <button className="bot-back" onClick={reset}><ArrowLeft size={16} /></button>
              <div className="bot-result-av lg">{picked.name.charAt(0)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="bot-student-name">{picked.name}</div>
                <div className="bot-student-sub">{picked.admissionNo}{detail?.profile?.className ? ` · ${detail.profile.className}` : ''}</div>
              </div>
              <select className="bot-year" value={year} onChange={(e) => setYear(e.target.value)}>
                {years.map((y) => <option key={y} value={y}>{y}</option>)}
                {years.length === 0 && <option value={year}>{year}</option>}
              </select>
            </div>

            {loading ? <div className="bot-loading"><span className="loading-spinner" /> Loading {year}…</div>
              : !detail ? <div className="bot-hint">Couldn't load details.</div>
              : (
                <div className="bot-detail">
                  {/* AI Weakness Analysis */}
                  <div className="bot-ai-card">
                    <div className="bot-ai-head">
                      <span className="bot-ai-title">🤖 AI Weakness Analysis</span>
                      {!weakness && (
                        <button className="bot-ai-btn" onClick={runWeakness} disabled={weakLoading}>
                          {weakLoading ? <><span className="loading-spinner" /> Analyzing…</> : 'Analyze results'}
                        </button>
                      )}
                    </div>

                    {weakness && !weakness.hasData && (
                      <div className="bot-hint">{weakness.message}</div>
                    )}

                    {weakness && weakness.hasData && (
                      <div className="bot-ai-body">
                        <div className="bot-ai-summary">
                          {weakness.summary} <span className="bot-ai-overall">Overall {weakness.overallPct}%</span>
                        </div>

                        {/* Subject bars, weakest first */}
                        <div className="bot-ai-subjects">
                          {weakness.allSubjects.map((s) => {
                            const cls = s.level === 'critical' ? 'crit' : s.level === 'weak' ? 'weak' : s.level === 'borderline' ? 'bord' : 'ok';
                            return (
                              <div key={s.subject} className={`bot-ai-sub ${cls}`}>
                                <div className="bot-ai-sub-top">
                                  <span className="bot-ai-sub-name">{s.subject}</span>
                                  <span className="bot-ai-sub-pct">{s.avgPct}%</span>
                                </div>
                                <div className="bot-ai-bar"><div style={{ width: `${Math.min(100, s.avgPct)}%` }} /></div>
                                <div className="bot-ai-sub-meta">
                                  class avg {s.classAvg}% · {s.gap >= 0 ? `+${s.gap}` : s.gap}% vs class
                                  {s.trend === 'declining' && <span className="bot-ai-trend down"> ▼ declining</span>}
                                  {s.trend === 'improving' && <span className="bot-ai-trend up"> ▲ improving</span>}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Suggestions */}
                        {weakness.suggestions?.length > 0 && (
                          <div className="bot-ai-tips">
                            <div className="bot-ai-tips-head">💡 Suggestions</div>
                            <ul>{weakness.suggestions.map((t, i) => <li key={i}>{t}</li>)}</ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Fees */}
                  <Section icon={<IndianRupee size={15} />} title="Fees" accent="#16a34a">
                    <div className="bot-fee-strip">
                      <div><span>Total</span><b>{fmt(detail.fees.totalAmount)}</b></div>
                      <div className="ok"><span>Paid</span><b>{fmt(detail.fees.totalPaid)}</b></div>
                      <div className={detail.fees.totalDue > 0 ? 'bad' : ''}><span>Due</span><b>{fmt(detail.fees.totalDue)}</b></div>
                    </div>
                    {detail.fees.items.length > 0 && (
                      <table className="bot-tbl">
                        <thead><tr><th>Type</th><th>Amount</th><th>Paid</th><th>Status</th></tr></thead>
                        <tbody>{detail.fees.items.map((f, i) => (
                          <tr key={i}><td>{f.feeType}</td><td>{fmt(f.amount - f.discount)}</td><td>{fmt(f.paidAmount)}</td>
                            <td><span className={`bot-badge ${f.status === 'Paid' ? 'pass' : f.balance > 0 ? 'fail' : 'warn'}`}>{f.status}</span></td></tr>
                        ))}</tbody>
                      </table>
                    )}
                  </Section>

                  {/* Exam results */}
                  <Section icon={<GraduationCap size={15} />} title="Exam Results" accent="#2563eb">
                    {detail.exams.length === 0 ? <div className="bot-empty">No exam results for {year}.</div>
                      : detail.exams.map((ex, i) => (
                        <div className="bot-exam" key={i}>
                          <div className="bot-exam-head">
                            <b>{ex.examName}</b>
                            <span className={`bot-badge ${ex.failed === 0 ? 'pass' : 'fail'}`}>{ex.percent}% · {ex.failed === 0 ? 'Pass' : `${ex.failed} fail`}</span>
                          </div>
                          <table className="bot-tbl">
                            <tbody>{ex.subjects.map((sub, j) => (
                              <tr key={j}>
                                <td>{sub.subject}</td>
                                <td style={{ textAlign: 'right' }}>{sub.absent ? 'AB' : sub.marks} / {sub.max}</td>
                                <td style={{ width: 24 }}>{sub.passed ? <CheckCircle2 size={14} color="#16a34a" /> : <XCircle size={14} color="#dc2626" />}</td>
                              </tr>
                            ))}</tbody>
                          </table>
                        </div>
                      ))}
                  </Section>

                  {/* Supplementary */}
                  {detail.supplementary.length > 0 && (
                    <Section icon={<ClipboardCheck size={15} />} title="Supplementary" accent="#d97706">
                      <table className="bot-tbl">
                        <thead><tr><th>Subject</th><th>From</th><th>Marks</th><th>Status</th></tr></thead>
                        <tbody>{detail.supplementary.map((s, i) => (
                          <tr key={i}><td>{s.subjectName}</td><td>{s.fromClass}</td>
                            <td>{s.suppMarks ?? s.marksObtained ?? '—'}/{s.passingMarks ?? '—'}</td>
                            <td><span className={`bot-badge ${s.status === 'Pass' ? 'pass' : s.status === 'Fail' ? 'fail' : 'warn'}`}>{s.status}</span></td></tr>
                        ))}</tbody>
                      </table>
                    </Section>
                  )}

                  {/* Library */}
                  <Section icon={<LibraryIcon size={15} />} title="Library" accent="#0891b2">
                    <div className="bot-mini-row">
                      <span>{detail.library.issuedCount} issued</span>
                      <span>{detail.library.notReturned} not returned</span>
                      {detail.library.finesThisYear > 0 && <span className="bad">Fines {fmt(detail.library.finesThisYear)}</span>}
                    </div>
                    {detail.library.issued.length > 0 && (
                      <table className="bot-tbl">
                        <thead><tr><th>Book</th><th>Issued</th><th>Status</th></tr></thead>
                        <tbody>{detail.library.issued.map((b, i) => (
                          <tr key={i}><td>{b.bookName}</td><td>{b.issueDate}</td>
                            <td><span className={`bot-badge ${b.returned ? 'pass' : 'warn'}`}>{b.returned ? 'Returned' : 'With student'}</span></td></tr>
                        ))}</tbody>
                      </table>
                    )}
                  </Section>

                  {/* Transport */}
                  <Section icon={<Bus size={15} />} title="Transport" accent="#7c3aed">
                    {detail.transport ? (
                      <div className="bot-mini-row">
                        <span><b>{detail.transport.busNumber}</b></span>
                        {detail.transport.route && <span>Route: {detail.transport.route}</span>}
                        {detail.transport.stop && <span>Stop: {detail.transport.stop}</span>}
                        {detail.transport.driver && <span>Driver: {detail.transport.driver}</span>}
                      </div>
                    ) : <div className="bot-empty">Not using school transport.</div>}
                  </Section>

                  {/* Attendance */}
                  <Section icon={<CalendarCheck size={15} />} title="Attendance" accent="#e11d48">
                    {detail.attendance.total === 0 ? <div className="bot-empty">No attendance marked for {year}.</div>
                      : <div className="bot-mini-row">
                          <span className="ok"><b>{detail.attendance.percent}%</b> present</span>
                          <span>{detail.attendance.present} P</span>
                          <span>{detail.attendance.absent} A</span>
                          {detail.attendance.late > 0 && <span>{detail.attendance.late} Late</span>}
                          {detail.attendance.leave > 0 && <span>{detail.attendance.leave} Leave</span>}
                          <span className="bot-muted">of {detail.attendance.total} days</span>
                        </div>}
                  </Section>
                </div>
              )}
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ icon, title, accent, children }) {
  return (
    <div className="bot-section">
      <div className="bot-section-head" style={{ color: accent }}>{icon} {title}</div>
      <div className="bot-section-body">{children}</div>
    </div>
  );
}
