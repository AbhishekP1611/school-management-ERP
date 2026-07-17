'use client';

import { useState, useEffect, useCallback } from 'react';
import API from '@/lib/api';
import {
  Wallet, Plus, Edit2, Trash2, X, Target, TrendingUp, TrendingDown,
  CalendarRange, CalendarClock, GraduationCap, BookOpen, AlertCircle,
  Image as ImageIcon, Zap, Receipt, FileBarChart, FileSpreadsheet, Printer, Phone,
} from 'lucide-react';
import { showSuccess, showError, confirmAction, confirmSave } from '@/lib/alert';
import { exportToExcel } from '@/lib/exportExcel';
import { usePermissions } from '@/lib/PermissionContext';
import { useAcademicYear } from '@/lib/AcademicYearContext';
import RouteGuard from '@/components/RouteGuard';

const fmtMoney = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const EMPTY = { category: '', plannedAmount: '', period: 'Yearly', notes: '' };
const MODES = ['Cash', 'Bank', 'UPI', 'Cheque'];

function FinanceInner() {
  const { can } = usePermissions();
  const canCreate = can('Finance', 'canCreate');
  const canEdit = can('Finance', 'canEdit');
  const canDelete = can('Finance', 'canDelete');
  const { year } = useAcademicYear();

  const [tab, setTab] = useState('budget');   // budget | income | yearly | monthly
  const [data, setData] = useState({ items: [], totalBudget: 0 });
  const [categories, setCategories] = useState([]);
  const [periodFilter, setPeriodFilter] = useState('All');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState(null);

  const loadSummary = useCallback(() => {
    if (!year) return;
    API.get(`/finance/summary?year=${year}`).then((r) => setSummary(r.data)).catch(() => setSummary(null));
  }, [year]);
  useEffect(() => { loadSummary(); }, [loadSummary]);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const p = periodFilter !== 'All' ? `&period=${periodFilter}` : '';
    API.get(`/finance/budgets?year=${year || ''}${p}`)
      .then((r) => setData(r.data || { items: [], totalBudget: 0 }))
      .catch(() => setData({ items: [], totalBudget: 0 }))
      .finally(() => setLoading(false));
  }, [year, periodFilter]);

  useEffect(() => { if (year) load(); }, [load, year]);
  useEffect(() => { API.get('/finance/categories').then((r) => setCategories(r.data || [])).catch(() => {}); }, []);

  const openForm = (b = null) => {
    if (b) { setEditId(b.budgetId); setForm({ category: b.category, plannedAmount: b.plannedAmount, period: b.period, notes: b.notes || '' }); }
    else { setEditId(null); setForm(EMPTY); }
    setShowForm(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.category.trim()) { showError('Category is required'); return; }
    if (form.plannedAmount === '' || Number(form.plannedAmount) < 0) { showError('Enter a valid amount'); return; }
    if (!(await confirmSave(editId ? 'Update budget?' : 'Save budget?', `${form.category} — ${fmtMoney(form.plannedAmount)} (${form.period})`))) return;
    setSaving(true);
    try {
      const payload = { category: form.category.trim(), plannedAmount: Number(form.plannedAmount), period: form.period, academicYear: year, notes: form.notes || null };
      if (editId) await API.put(`/finance/budgets/${editId}`, payload);
      else await API.post('/finance/budgets', payload);
      showSuccess(editId ? 'Budget updated' : 'Budget saved');
      setShowForm(false); load();
      API.get('/finance/categories').then((r) => setCategories(r.data || [])).catch(() => {});
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const del = async (b) => {
    if (!(await confirmAction('Delete budget?', `Remove the ${b.period.toLowerCase()} budget for "${b.category}"?`))) return;
    try { await API.delete(`/finance/budgets/${b.budgetId}`); showSuccess('Deleted'); load(); }
    catch (err) { showError(err.response?.data?.message || 'Failed'); }
  };

  const items = data.items || [];
  const yearlyTotal = items.filter((b) => b.period === 'Yearly').reduce((s, b) => s + Number(b.plannedAmount), 0);
  const monthlyTotal = items.filter((b) => b.period === 'Monthly').reduce((s, b) => s + Number(b.plannedAmount), 0);

  const profit = summary ? summary.totalProfit : 0;

  return (
    <div className="page-wrap fin-page">
      {/* Headline summary — Profit / Earn / Expense / Today */}
      {summary && (
        <div className="fin-summary">
          <div className={`fin-sum-card ${profit >= 0 ? 'profit' : 'loss'}`}>
            <div className="fs-icon">{profit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}</div>
            <div><div className="fs-k">Net {profit >= 0 ? 'Profit' : 'Loss'}</div><div className="fs-v">{fmtMoney(Math.abs(profit))}</div></div>
          </div>
          <div className="fin-sum-card earn">
            <div className="fs-icon"><TrendingUp size={18} /></div>
            <div><div className="fs-k">Total Earn</div><div className="fs-v">{fmtMoney(summary.totalEarn)}</div></div>
          </div>
          <div className="fin-sum-card exp">
            <div className="fs-icon"><Receipt size={18} /></div>
            <div><div className="fs-k">Total Expense</div><div className="fs-v">{fmtMoney(summary.totalExpense)}</div></div>
          </div>
          <div className="fin-sum-card today">
            <div className="fs-icon"><Zap size={18} /></div>
            <div><div className="fs-k">Today's Expense</div><div className="fs-v">{fmtMoney(summary.todaysExpense)}</div></div>
          </div>
        </div>
      )}

      {/* Module tabs */}
      <div className="fin-tabs">
        <button className={`fin-tab ${tab === 'budget' ? 'active' : ''}`} onClick={() => setTab('budget')}>
          <Target size={16} /> Budget Planning
        </button>
        <button className={`fin-tab ${tab === 'income' ? 'active' : ''}`} onClick={() => setTab('income')}>
          <TrendingUp size={16} /> Income
        </button>
        <button className={`fin-tab ${tab === 'yearly' ? 'active' : ''}`} onClick={() => setTab('yearly')}>
          <CalendarRange size={16} /> Yearly Expense
        </button>
        <button className={`fin-tab ${tab === 'monthly' ? 'active' : ''}`} onClick={() => setTab('monthly')}>
          <CalendarClock size={16} /> Monthly Expense
        </button>
        <button className={`fin-tab ${tab === 'reports' ? 'active' : ''}`} onClick={() => setTab('reports')}>
          <FileBarChart size={16} /> Reports
        </button>
      </div>

      {tab === 'income' && <IncomeView year={year} />}
      {tab === 'yearly' && <ExpenseView year={year} type="Yearly" categories={categories} onChanged={loadSummary} />}
      {tab === 'monthly' && <ExpenseView year={year} type="Monthly" categories={categories} onChanged={loadSummary} />}
      {tab === 'reports' && <ReportsView year={year} />}

      {/* ── Budget Planning ── */}
      {tab === 'budget' && (
      <div className="fin-window">
        <div className="fin-window-head">
          <div className="fin-window-title"><Target size={17} /> Budget Planning <span className="fin-year">{year}</span></div>
          <div className="fin-window-actions">
            <select className="form-control fin-period" value={periodFilter} onChange={(e) => setPeriodFilter(e.target.value)}>
              <option value="All">All periods</option>
              <option value="Yearly">Yearly</option>
              <option value="Monthly">Monthly</option>
            </select>
            {canCreate && <button className="btn btn-primary" onClick={() => openForm()}><Plus size={16} /> Add Budget</button>}
          </div>
        </div>

        {loading ? (
          <div className="empty-state"><span className="loading-spinner" /> Loading…</div>
        ) : items.length === 0 ? (
          <div className="empty-state fin-empty">
            <Target size={38} />
            <p>No budgets planned for {year} yet.</p>
            {canCreate && <button className="btn btn-outline btn-sm" onClick={() => openForm()}><Plus size={14} /> Plan your first budget</button>}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="fin-table">
              <thead>
                <tr><th>Category</th><th>Period</th><th style={{ textAlign: 'right' }}>Planned Amount</th><th>Notes</th>{(canEdit || canDelete) && <th></th>}</tr>
              </thead>
              <tbody>
                {items.map((b) => (
                  <tr key={b.budgetId}>
                    <td style={{ fontWeight: 600 }}>{b.category}</td>
                    <td><span className={`fin-period-badge ${b.period.toLowerCase()}`}>{b.period}</span></td>
                    <td className="fin-amt">{fmtMoney(b.plannedAmount)}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{b.notes || '—'}</td>
                    {(canEdit || canDelete) && (
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {canEdit && <button className="btn btn-outline btn-sm" onClick={() => openForm(b)}><Edit2 size={13} /></button>}
                          {canDelete && <button className="btn btn-danger btn-sm" onClick={() => del(b)}><Trash2 size={13} /></button>}
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Totals grid (bottom) */}
        <div className="fin-totals">
          <div className="fin-total-card yearly">
            <div className="ft-label">Yearly Budget</div>
            <div className="ft-value">{fmtMoney(yearlyTotal)}</div>
          </div>
          <div className="fin-total-card monthly">
            <div className="ft-label">Monthly Budget</div>
            <div className="ft-value">{fmtMoney(monthlyTotal)}</div>
          </div>
          <div className="fin-total-card grand">
            <div className="ft-label">Total Budget</div>
            <div className="ft-value">{fmtMoney(data.totalBudget)}</div>
          </div>
        </div>
      </div>
      )}

      {/* Add / Edit budget form (budget tab only) */}
      {tab === 'budget' && showForm && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setShowForm(false); }}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <div className="modal-title"><Target size={17} /> {editId ? 'Edit Budget' : 'Add Budget'}</div>
              <button className="modal-close" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <form onSubmit={save}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <input className="form-control" list="fin-cats" value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                    placeholder="e.g. Rent, Salary, Supplies" autoFocus />
                  <datalist id="fin-cats">
                    {categories.map((c) => <option key={c} value={c} />)}
                  </datalist>
                </div>
                <div style={{ display: 'flex', gap: 10 }}>
                  <div className="form-group" style={{ flex: 1.3 }}>
                    <label className="form-label">Planned Amount (₹) *</label>
                    <input type="number" min="0" className="form-control" value={form.plannedAmount}
                      onChange={(e) => setForm((f) => ({ ...f, plannedAmount: e.target.value }))} placeholder="0" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Period</label>
                    <select className="form-control" value={form.period} onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}>
                      <option value="Yearly">Yearly</option>
                      <option value="Monthly">Monthly</option>
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Notes (optional)</label>
                  <input className="form-control" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
                </div>
                <div className="fin-hint">This budget will appear in the expense dropdown so you can compare planned vs actual for <b>{year}</b>.</div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="loading-spinner" /> : <><Target size={16} /> {editId ? 'Update' : 'Save'} Budget</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Income view: student fees + library fines, class-wise, with amount due ──
function IncomeView({ year }) {
  const [inc, setInc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('class');   // class | fines

  useEffect(() => {
    if (!year) return;
    setLoading(true);
    API.get(`/finance/income?year=${year}`)
      .then((r) => setInc(r.data))
      .catch(() => setInc(null))
      .finally(() => setLoading(false));
  }, [year]);

  if (loading) return <div className="fin-window"><div className="empty-state"><span className="loading-spinner" /> Loading…</div></div>;
  if (!inc) return <div className="fin-window"><div className="empty-state">Couldn't load income.</div></div>;

  const byClass = inc.byClass || [];
  const maxCollected = Math.max(1, ...byClass.map((c) => c.collected));

  return (
    <div className="fin-window">
      <div className="fin-window-head">
        <div className="fin-window-title"><TrendingUp size={17} /> Income <span className="fin-year">{year}</span></div>
        <div className="fin-window-actions">
          <div className="fin-subtabs">
            <button className={`fin-subtab ${view === 'class' ? 'active' : ''}`} onClick={() => setView('class')}><GraduationCap size={14} /> Class-wise</button>
            <button className={`fin-subtab ${view === 'fines' ? 'active' : ''}`} onClick={() => setView('fines')}><BookOpen size={14} /> Fines</button>
          </div>
        </div>
      </div>

      {/* top stat strip */}
      <div className="fin-income-strip">
        <div className="fis-card"><div className="fis-k">Fees Collected</div><div className="fis-v profit">{fmtMoney(inc.fees.collected)}</div></div>
        <div className="fis-card"><div className="fis-k">Library Fines</div><div className="fis-v profit">{fmtMoney(inc.fines.collected)}</div></div>
        <div className="fis-card due"><div className="fis-k"><AlertCircle size={12} /> Due from Students</div><div className="fis-v loss">{fmtMoney(inc.totalDue)}</div></div>
      </div>

      {view === 'class' ? (
        byClass.length === 0 ? (
          <div className="empty-state fin-empty"><GraduationCap size={36} /><p>No fee income recorded for {year}.</p></div>
        ) : (
          <div className="table-wrapper">
            <table className="fin-table">
              <thead><tr><th>Class</th><th>Collected</th><th style={{ width: '32%' }}>Share</th><th style={{ textAlign: 'right' }}>Due</th></tr></thead>
              <tbody>
                {byClass.map((c) => (
                  <tr key={c.classId ?? 'na'}>
                    <td style={{ fontWeight: 600 }}>{c.className}</td>
                    <td className="fin-amt" style={{ textAlign: 'left' }}>{fmtMoney(c.collected)}</td>
                    <td>
                      <div className="fin-bar-track">
                        <div className="fin-bar-fill" style={{ width: `${(c.collected / maxCollected) * 100}%` }} />
                      </div>
                    </td>
                    <td className="fin-amt" style={{ color: c.due > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                      {c.due > 0 ? fmtMoney(c.due) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : (
        <div className="fin-fines-panel">
          <BookOpen size={34} />
          <div className="fin-fines-amt">{fmtMoney(inc.fines.collected)}</div>
          <p>Total library fines collected in {year}</p>
          <div className="fin-hint" style={{ maxWidth: 380 }}>Fines are charged when a late book is returned, so they count as collected income. Manage individual fines in the Library module.</div>
        </div>
      )}

      {/* Totals grid */}
      <div className="fin-totals">
        <div className="fin-total-card yearly"><div className="ft-label">Fees Collected</div><div className="ft-value">{fmtMoney(inc.fees.collected)}</div></div>
        <div className="fin-total-card monthly"><div className="ft-label">Fines Collected</div><div className="ft-value">{fmtMoney(inc.fines.collected)}</div></div>
        <div className="fin-total-card grand"><div className="ft-label">Total Income</div><div className="ft-value">{fmtMoney(inc.totalIncome)}</div></div>
      </div>
    </div>
  );
}

// ── Expense view (Yearly / Monthly) — budget-aware form, image, reason ──
const EMPTY_EXP = { category: '', amount: '', reason: '', paidTo: '', paymentMode: 'Cash', imageUrl: '', isExceptional: false, expenseDate: new Date().toISOString().split('T')[0] };

function ExpenseView({ year, type, categories, onChanged }) {
  const { can } = usePermissions();
  const canCreate = can('Finance', 'canCreate');
  const canEdit = can('Finance', 'canEdit');
  const canDelete = can('Finance', 'canDelete');

  const [data, setData] = useState({ items: [], total: 0, byCategory: [] });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY_EXP);
  const [saving, setSaving] = useState(false);
  const [budgetInfo, setBudgetInfo] = useState(null);   // { planned, hasBudget, alreadySpent }

  const load = useCallback(() => {
    if (!year) return;
    setLoading(true);
    API.get(`/finance/expenses?year=${year}&type=${type}`)
      .then((r) => setData(r.data || { items: [], total: 0, byCategory: [] }))
      .catch(() => setData({ items: [], total: 0, byCategory: [] }))
      .finally(() => setLoading(false));
  }, [year, type]);
  useEffect(() => { load(); }, [load]);

  // when a category is picked in the form, fetch its budget for planned-vs-actual
  useEffect(() => {
    if (!showForm || !form.category.trim()) { setBudgetInfo(null); return; }
    const t = setTimeout(() => {
      API.get(`/finance/budget-for?category=${encodeURIComponent(form.category.trim())}&type=${type}&year=${year}`)
        .then((r) => setBudgetInfo(r.data)).catch(() => setBudgetInfo(null));
    }, 250);
    return () => clearTimeout(t);
  }, [form.category, showForm, type, year]);

  const openForm = (e = null) => {
    if (e) { setEditId(e.expenseId); setForm({ category: e.category, amount: e.amount, reason: e.reason || '', paidTo: e.paidTo || '', paymentMode: e.paymentMode || 'Cash', imageUrl: e.imageUrl || '', isExceptional: e.isExceptional, expenseDate: e.expenseDate }); }
    else { setEditId(null); setForm(EMPTY_EXP); }
    setBudgetInfo(null);
    setShowForm(true);
  };

  const onImage = (file) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { showError('Image must be under 2 MB'); return; }
    const reader = new FileReader();
    reader.onload = () => setForm((f) => ({ ...f, imageUrl: reader.result }));
    reader.readAsDataURL(file);
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.category.trim()) { showError('Category is required'); return; }
    if (form.amount === '' || Number(form.amount) <= 0) { showError('Enter a valid amount'); return; }
    if (!(await confirmSave(editId ? 'Update expense?' : 'Record expense?', `${form.category} — ${fmtMoney(form.amount)}`))) return;
    setSaving(true);
    try {
      const payload = { category: form.category.trim(), expenseType: type, amount: Number(form.amount), reason: form.reason || null, paidTo: form.paidTo || null, paymentMode: form.paymentMode, imageUrl: form.imageUrl || null, isExceptional: form.isExceptional, expenseDate: form.expenseDate, academicYear: year };
      if (editId) await API.put(`/finance/expenses/${editId}`, payload);
      else await API.post('/finance/expenses', payload);
      showSuccess(editId ? 'Expense updated' : 'Expense recorded');
      setShowForm(false); load(); onChanged && onChanged();
    } catch (err) {
      showError(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  };

  const del = async (e) => {
    if (!(await confirmAction('Delete expense?', `Remove ${e.category} — ${fmtMoney(e.amount)}?`))) return;
    try { await API.delete(`/finance/expenses/${e.expenseId}`); showSuccess('Deleted'); load(); onChanged && onChanged(); }
    catch (err) { showError(err.response?.data?.message || 'Failed'); }
  };

  const items = data.items || [];
  const label = type === 'Yearly' ? 'Yearly' : 'Monthly';
  // projected spend for the form's category (already + this entry)
  const projected = budgetInfo ? Number(budgetInfo.alreadySpent) + Number(form.amount || 0) : 0;
  const overBudget = budgetInfo && budgetInfo.hasBudget && projected > Number(budgetInfo.planned);

  return (
    <div className="fin-window">
      <div className="fin-window-head">
        <div className="fin-window-title">
          {type === 'Yearly' ? <CalendarRange size={17} /> : <CalendarClock size={17} />} {label} Expense <span className="fin-year">{year}</span>
        </div>
        <div className="fin-window-actions">
          {canCreate && <button className="btn btn-primary" onClick={() => openForm()}><Plus size={16} /> Add Expense</button>}
        </div>
      </div>

      {/* planned-vs-actual per category */}
      {data.byCategory && data.byCategory.length > 0 && (
        <div className="fin-pva">
          {data.byCategory.map((c) => {
            const pct = c.planned > 0 ? Math.min(100, (c.spent / c.planned) * 100) : 0;
            const over = c.planned > 0 && c.spent > c.planned;
            return (
              <div className="fin-pva-item" key={c.category}>
                <div className="fin-pva-head">
                  <span>{c.category}</span>
                  <span className={over ? 'loss' : ''}>{fmtMoney(c.spent)}{c.planned > 0 && <span className="fin-pva-plan"> / {fmtMoney(c.planned)}</span>}</span>
                </div>
                {c.planned > 0 && (
                  <div className="fin-bar-track"><div className={`fin-bar-fill ${over ? 'over' : ''}`} style={{ width: `${pct}%` }} /></div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {loading ? (
        <div className="empty-state"><span className="loading-spinner" /> Loading…</div>
      ) : items.length === 0 ? (
        <div className="empty-state fin-empty">
          <Receipt size={36} /><p>No {label.toLowerCase()} expenses recorded for {year}.</p>
          {canCreate && <button className="btn btn-outline btn-sm" onClick={() => openForm()}><Plus size={14} /> Add first expense</button>}
        </div>
      ) : (
        <div className="table-wrapper">
          <table className="fin-table">
            <thead><tr><th></th><th>Category</th><th>Reason</th><th>Paid To</th><th>Date</th><th style={{ textAlign: 'right' }}>Amount</th>{(canEdit || canDelete) && <th></th>}</tr></thead>
            <tbody>
              {items.map((e) => (
                <tr key={e.expenseId}>
                  <td>{e.imageUrl ? <img src={e.imageUrl} alt="bill" className="fin-thumb" onClick={() => window.open(e.imageUrl, '_blank')} /> : <span className="fin-noimg"><ImageIcon size={14} /></span>}</td>
                  <td style={{ fontWeight: 600 }}>{e.category}{e.isExceptional && <span className="fin-exc"><Zap size={10} /> Exceptional</span>}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 13, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.reason || '—'}</td>
                  <td style={{ fontSize: 13 }}>{e.paidTo || '—'}</td>
                  <td style={{ fontSize: 13 }}>{e.expenseDate}</td>
                  <td className="fin-amt">{fmtMoney(e.amount)}</td>
                  {(canEdit || canDelete) && (
                    <td><div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                      {canEdit && <button className="btn btn-outline btn-sm" onClick={() => openForm(e)}><Edit2 size={13} /></button>}
                      {canDelete && <button className="btn btn-danger btn-sm" onClick={() => del(e)}><Trash2 size={13} /></button>}
                    </div></td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="fin-totals">
        <div className="fin-total-card grand" style={{ gridColumn: '1 / -1' }}>
          <div className="ft-label">Total {label} Expense</div>
          <div className="ft-value">{fmtMoney(data.total)}</div>
        </div>
      </div>

      {/* Add/Edit expense form */}
      {showForm && (
        <div className="modal-overlay" onMouseDown={(ev) => { if (ev.target === ev.currentTarget) setShowForm(false); }}>
          <div className="modal modal-sm">
            <div className="modal-header">
              <div className="modal-title"><Receipt size={17} /> {editId ? 'Edit' : 'Add'} {label} Expense</div>
              <button className="modal-close" onClick={() => setShowForm(false)}><X size={18} /></button>
            </div>
            <form onSubmit={save}>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Category *</label>
                  <input className="form-control" list="fin-exp-cats" value={form.category}
                    onChange={(ev) => setForm((f) => ({ ...f, category: ev.target.value }))} placeholder="e.g. Rent, Salary" autoFocus />
                  <datalist id="fin-exp-cats">{(categories || []).map((c) => <option key={c} value={c} />)}</datalist>
                </div>

                {/* budget hint — planned vs actual */}
                {budgetInfo && form.category.trim() && (
                  budgetInfo.hasBudget ? (
                    <div className={`fin-budget-hint ${overBudget ? 'over' : 'ok'}`}>
                      <Target size={13} /> Budget: <b>{fmtMoney(budgetInfo.planned)}</b> · Already spent: {fmtMoney(budgetInfo.alreadySpent)}
                      {form.amount && <> · After this: <b>{fmtMoney(projected)}</b> {overBudget && <span>(over budget!)</span>}</>}
                    </div>
                  ) : (
                    <div className="fin-budget-hint none"><AlertCircle size={13} /> No {label.toLowerCase()} budget planned for "{form.category}". This will be an unplanned expense.</div>
                  )
                )}

                <div style={{ display: 'flex', gap: 10 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Amount (₹) *</label>
                    <input type="number" min="0" className="form-control" value={form.amount} onChange={(ev) => setForm((f) => ({ ...f, amount: ev.target.value }))} placeholder="0" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Date *</label>
                    <input type="date" className="form-control" value={form.expenseDate} max={new Date().toISOString().split('T')[0]} onChange={(ev) => setForm((f) => ({ ...f, expenseDate: ev.target.value }))} />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Reason (kahan / kis liye)</label>
                  <input className="form-control" value={form.reason} onChange={(ev) => setForm((f) => ({ ...f, reason: ev.target.value }))} placeholder="e.g. July building rent" />
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Paid To</label>
                    <input className="form-control" value={form.paidTo} onChange={(ev) => setForm((f) => ({ ...f, paidTo: ev.target.value }))} placeholder="Vendor / person" />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Mode</label>
                    <select className="form-control" value={form.paymentMode} onChange={(ev) => setForm((f) => ({ ...f, paymentMode: ev.target.value }))}>
                      {MODES.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                </div>

                {/* image + exceptional */}
                <div className="form-group">
                  <label className="form-label">Bill / Receipt (optional)</label>
                  <div className="fin-img-row">
                    {form.imageUrl && <img src={form.imageUrl} alt="bill" className="fin-img-preview" />}
                    <label className="btn btn-outline btn-sm">
                      <ImageIcon size={14} /> {form.imageUrl ? 'Change' : 'Upload'} image
                      <input type="file" accept="image/*" hidden onChange={(ev) => onImage(ev.target.files?.[0])} />
                    </label>
                    {form.imageUrl && <button type="button" className="btn btn-danger btn-sm" onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}><X size={14} /></button>}
                  </div>
                </div>

                <label className="fin-exc-toggle">
                  <input type="checkbox" checked={form.isExceptional} onChange={(ev) => setForm((f) => ({ ...f, isExceptional: ev.target.checked }))} />
                  <span><Zap size={14} /> Exceptional / unplanned expense</span>
                </label>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <span className="loading-spinner" /> : <><Receipt size={16} /> {editId ? 'Update' : 'Record'} Expense</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Reports view: P&L statement + fee defaulters + export/print ──
function ReportsView({ year }) {
  const [rep, setRep] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!year) return;
    setLoading(true);
    API.get(`/finance/report?year=${year}`)
      .then((r) => setRep(r.data))
      .catch(() => setRep(null))
      .finally(() => setLoading(false));
  }, [year]);

  const exportDefaulters = () => {
    if (!rep?.defaulters?.length) { showError('No defaulters to export.'); return; }
    exportToExcel(
      rep.defaulters,
      `Fee_Defaulters_${year}`,
      [
        { key: 'name', label: 'Student' },
        { key: 'admissionNo', label: 'Admission No' },
        { key: 'className', label: 'Class' },
        { key: 'parentPhone', label: 'Parent Phone' },
        { key: 'due', label: 'Amount Due (₹)' },
      ]
    );
  };

  const exportPL = () => {
    if (!rep) return;
    const rows = [
      { line: 'INCOME', amount: '' },
      { line: 'Fees Collected', amount: rep.income.feesCollected },
      { line: 'Library Fines', amount: rep.income.finesCollected },
      { line: 'Total Income', amount: rep.income.totalIncome },
      { line: '', amount: '' },
      { line: 'EXPENSE', amount: '' },
      ...rep.expense.byCategory.map((c) => ({ line: `${c.category} (${c.type})`, amount: c.amount })),
      { line: 'Total Expense', amount: rep.expense.totalExpense },
      { line: '', amount: '' },
      { line: 'NET PROFIT / LOSS', amount: rep.netProfit },
      { line: 'Fees Still Due', amount: rep.feesDue },
    ];
    exportToExcel(rows, `PL_Statement_${year}`, [
      { key: 'line', label: 'Particulars' },
      { key: 'amount', label: 'Amount (₹)' },
    ]);
  };

  const printReport = () => {
    if (!rep) return;
    const win = window.open('', '_blank', 'width=820,height=900');
    const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
    const expRows = rep.expense.byCategory.map((c) =>
      `<tr><td>${c.category} <span style="color:#888;font-size:11px">(${c.type})</span></td><td class="r">${money(c.amount)}</td></tr>`).join('') ||
      '<tr><td colspan="2" style="text-align:center;color:#888">No expenses recorded</td></tr>';
    const defRows = rep.defaulters.map((d, i) =>
      `<tr><td>${i + 1}</td><td>${d.name}</td><td>${d.admissionNo}</td><td>${d.className}</td><td>${d.parentPhone || '-'}</td><td class="r">${money(d.due)}</td></tr>`).join('') ||
      '<tr><td colspan="6" style="text-align:center;color:#888">No defaulters 🎉</td></tr>';
    win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Finance Report ${year}</title>
      <style>
        body{font-family:Segoe UI,Arial,sans-serif;color:#1e293b;padding:30px;max-width:760px;margin:auto}
        h1{font-size:22px;margin:0 0 2px}.sub{color:#64748b;font-size:13px;margin-bottom:22px}
        h2{font-size:15px;margin:24px 0 8px;color:#2563eb;border-bottom:2px solid #e2e8f0;padding-bottom:5px}
        table{width:100%;border-collapse:collapse;font-size:13px}
        td,th{padding:8px 12px;border-bottom:1px solid #eef2f7;text-align:left}
        th{background:#f8fafc;font-size:11px;text-transform:uppercase;color:#64748b}
        .r{text-align:right;font-variant-numeric:tabular-nums;font-weight:600}
        .tot{font-weight:800;background:#f1f5f9}
        .net{font-size:16px;font-weight:800;padding:12px;border-radius:8px;margin-top:16px;text-align:center;background:${rep.netProfit >= 0 ? '#dcfce7' : '#fee2e2'};color:${rep.netProfit >= 0 ? '#16a34a' : '#dc2626'}}
      </style></head><body>
      <h1>Finance Report</h1><div class="sub">Academic Year ${year} · Generated ${new Date().toLocaleDateString('en-GB')}</div>
      <h2>Income</h2><table>
        <tr><td>Fees Collected</td><td class="r">${money(rep.income.feesCollected)}</td></tr>
        <tr><td>Library Fines</td><td class="r">${money(rep.income.finesCollected)}</td></tr>
        <tr class="tot"><td>Total Income</td><td class="r">${money(rep.income.totalIncome)}</td></tr>
      </table>
      <h2>Expense</h2><table>${expRows}<tr class="tot"><td>Total Expense</td><td class="r">${money(rep.expense.totalExpense)}</td></tr></table>
      <div class="net">NET ${rep.netProfit >= 0 ? 'PROFIT' : 'LOSS'}: ${money(Math.abs(rep.netProfit))}</div>
      <h2>Fee Defaulters (Due: ${money(rep.feesDue)})</h2>
      <table><thead><tr><th>#</th><th>Student</th><th>Adm No</th><th>Class</th><th>Parent Phone</th><th class="r">Due</th></tr></thead><tbody>${defRows}</tbody></table>
      <script>window.onload=function(){setTimeout(function(){window.print()},350)}</script>
      </body></html>`);
    win.document.close();
  };

  if (loading) return <div className="fin-window"><div className="empty-state"><span className="loading-spinner" /> Loading…</div></div>;
  if (!rep) return <div className="fin-window"><div className="empty-state">Couldn't load report.</div></div>;

  const money = (n) => fmtMoney(n);

  return (
    <div className="fin-window">
      <div className="fin-window-head">
        <div className="fin-window-title"><FileBarChart size={17} /> Reports <span className="fin-year">{year}</span></div>
        <div className="fin-window-actions">
          <button className="btn btn-outline btn-sm" onClick={exportPL}><FileSpreadsheet size={15} /> P&amp;L Excel</button>
          <button className="btn btn-outline btn-sm" onClick={exportDefaulters}><FileSpreadsheet size={15} /> Defaulters</button>
          <button className="btn btn-primary btn-sm" onClick={printReport}><Printer size={15} /> Print</button>
        </div>
      </div>

      {/* P&L statement */}
      <div className="fin-pl">
        <div className="fin-pl-col">
          <div className="fin-pl-title income">Income</div>
          <div className="fin-pl-row"><span>Fees Collected</span><span className="money">{money(rep.income.feesCollected)}</span></div>
          <div className="fin-pl-row"><span>Library Fines</span><span className="money">{money(rep.income.finesCollected)}</span></div>
          <div className="fin-pl-row total"><span>Total Income</span><span className="money profit">{money(rep.income.totalIncome)}</span></div>
        </div>
        <div className="fin-pl-col">
          <div className="fin-pl-title expense">Expense</div>
          {rep.expense.byCategory.length === 0 && <div className="fin-pl-row"><span style={{ color: 'var(--text-muted)' }}>No expenses recorded</span><span>—</span></div>}
          {rep.expense.byCategory.map((c) => (
            <div className="fin-pl-row" key={c.category + c.type}><span>{c.category} <em>({c.type})</em></span><span className="money">{money(c.amount)}</span></div>
          ))}
          <div className="fin-pl-row total"><span>Total Expense</span><span className="money loss">{money(rep.expense.totalExpense)}</span></div>
        </div>
      </div>

      <div className={`fin-net ${rep.netProfit >= 0 ? 'profit' : 'loss'}`}>
        {rep.netProfit >= 0 ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
        <span>Net {rep.netProfit >= 0 ? 'Profit' : 'Loss'}</span>
        <b>{money(Math.abs(rep.netProfit))}</b>
      </div>

      {/* Defaulters */}
      <div className="fin-def-head">
        <div className="fin-window-title" style={{ fontSize: 15 }}><AlertCircle size={16} /> Fee Defaulters</div>
        <div className="fin-def-total">Total due: <b className="loss">{money(rep.feesDue)}</b></div>
      </div>
      {rep.defaulters.length === 0 ? (
        <div className="empty-state fin-empty" style={{ padding: 28 }}>🎉 No fee defaulters this year.</div>
      ) : (
        <div className="table-wrapper">
          <table className="fin-table">
            <thead><tr><th>Student</th><th>Adm No</th><th>Class</th><th>Parent Phone</th><th style={{ textAlign: 'right' }}>Amount Due</th></tr></thead>
            <tbody>
              {rep.defaulters.map((d) => (
                <tr key={d.admissionNo}>
                  <td style={{ fontWeight: 600 }}>{d.name}</td>
                  <td style={{ fontSize: 13 }}>{d.admissionNo}</td>
                  <td style={{ fontSize: 13 }}>{d.className}</td>
                  <td style={{ fontSize: 13 }}>{d.parentPhone ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Phone size={12} /> {d.parentPhone}</span> : '—'}</td>
                  <td className="fin-amt loss">{money(d.due)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function FinancePage() {
  return (
    <RouteGuard module="Finance">
      <FinanceInner />
    </RouteGuard>
  );
}
