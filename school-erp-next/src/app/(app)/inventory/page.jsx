'use client';

import { useState, useEffect } from 'react';
import API from '@/lib/api';
import { Plus, Edit2, Trash2, Boxes, IndianRupee, Layers, AlertTriangle, ShieldCheck, Package } from 'lucide-react';
import { showSuccess, showError, confirmAction, confirmSave } from '@/lib/alert';
import RouteGuard from '@/components/RouteGuard';
import { usePermissions } from '@/lib/PermissionContext';

const CATEGORIES = ['Furniture', 'Electronics', 'Lab Equipment', 'Sports', 'Books', 'Vehicle', 'Stationery', 'Musical', 'Other'];
const CONDITIONS = ['New', 'Good', 'Fair', 'Damaged', 'Disposed'];

const EMPTY = {
  assetName: '', assetCode: '', category: 'Furniture', quantity: 1, unitPrice: '',
  purchaseDate: '', vendor: '', invoiceNo: '',
  warrantyMonths: '', warrantyUntil: '', lifespanYears: '',
  condition: 'Good', location: '', remarks: '',
};

const fmt = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

function InventoryInner() {
  const { can } = usePermissions();
  const canCreate = can('Inventory', 'canCreate');
  const canEdit = can('Inventory', 'canEdit');
  const canDelete = can('Inventory', 'canDelete');

  const [assets, setAssets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [catFilter, setCatFilter] = useState('');
  const [search, setSearch] = useState('');

  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(EMPTY);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const load = () => {
    API.get(`/inventory/assets?category=${catFilter}&search=${search}`).then((r) => setAssets(r.data)).catch(console.error);
    API.get('/inventory/summary').then((r) => setSummary(r.data)).catch(() => setSummary(null));
  };
  useEffect(() => { load(); }, [catFilter, search]);

  const openForm = (a = null) => {
    if (a) {
      setEditId(a.assetId);
      setForm({
        assetName: a.assetName, assetCode: a.assetCode || '', category: a.category, quantity: a.quantity,
        unitPrice: a.unitPrice, purchaseDate: a.purchaseDate || '', vendor: a.vendor || '', invoiceNo: a.invoiceNo || '',
        warrantyMonths: a.warrantyMonths ?? '', warrantyUntil: a.warrantyUntil || '', lifespanYears: a.lifespanYears ?? '',
        condition: a.condition, location: a.location || '', remarks: a.remarks || '',
      });
    } else {
      setEditId(null);
      setForm(EMPTY);
    }
    setShowModal(true);
  };

  const save = async () => {
    if (!form.assetName.trim()) { showError('Asset name is required'); return; }
    if (!(await confirmSave(editId ? 'Update Asset?' : 'Add Asset?', 'Save this asset entry?'))) return;
    const payload = {
      ...form,
      quantity: Number(form.quantity) || 1,
      unitPrice: Number(form.unitPrice) || 0,
      warrantyMonths: form.warrantyMonths === '' ? null : Number(form.warrantyMonths),
      lifespanYears: form.lifespanYears === '' ? null : Number(form.lifespanYears),
      purchaseDate: form.purchaseDate || null,
      warrantyUntil: form.warrantyUntil || null,
    };
    try {
      if (editId) await API.put(`/inventory/assets/${editId}`, payload);
      else await API.post('/inventory/assets', payload);
      showSuccess('Saved');
      setShowModal(false);
      load();
    } catch (err) { showError(err.response?.data?.message || 'Failed'); }
  };

  const del = async (a) => {
    if (!(await confirmAction('Delete Asset?', `Remove "${a.assetName}" from inventory?`))) return;
    try { await API.delete(`/inventory/assets/${a.assetId}`); showSuccess('Deleted'); load(); }
    catch { showError('Failed'); }
  };

  const condBadge = (c) => {
    const map = { New: 'badge-green', Good: 'badge-info', Fair: 'badge-amber', Damaged: 'badge-red', Disposed: 'badge-gray' };
    return <span className={`badge ${map[c] || 'badge-info'}`}>{c}</span>;
  };

  const warrantyCell = (a) => {
    if (!a.warrantyUntil) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    if (a.warrantyExpired) return <span className="badge badge-red">Expired</span>;
    const soon = a.warrantyDaysLeft != null && a.warrantyDaysLeft <= 30;
    return <span style={{ color: soon ? '#d9730d' : 'var(--text-primary)', fontWeight: soon ? 700 : 400 }}>
      {a.warrantyUntil}{soon ? ` · ${a.warrantyDaysLeft}d left` : ''}
    </span>;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div className="page-header">
        <div>
          <div className="page-title">Inventory &amp; Assets</div>
          <div className="page-subtitle">Every school asset — what, how many, when &amp; from whom bought, cost &amp; warranty</div>
        </div>
        {canCreate && <button className="btn btn-primary" onClick={() => openForm()}><Plus size={16} /> Add Asset</button>}
      </div>

      {/* ── Stat cards ── */}
      {summary && (
        <div className="dash-stats" style={{ marginBottom: 18 }}>
          <StatCard icon={<Boxes size={20} />} color="#6366f1" label="Total Assets" value={summary.totalAssets} sub={`${summary.totalItems} items`} />
          <StatCard icon={<IndianRupee size={20} />} color="#16a34a" label="Total Value" value={fmt(summary.totalValue)} />
          <StatCard icon={<Layers size={20} />} color="#0891b2" label="Categories" value={summary.categories} />
          <StatCard icon={<AlertTriangle size={20} />} color="#dc2626" label="Damaged / Disposed" value={summary.damaged} />
          <StatCard icon={<ShieldCheck size={20} />} color="#d9730d" label="Warranty ending ≤30d" value={summary.warrantyExpiringSoon} />
        </div>
      )}

      {/* ── Filters ── */}
      <div className="card" style={{ padding: 14, marginBottom: 14, display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="form-control" style={{ maxWidth: 260 }} placeholder="Search name / code / vendor…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select className="form-control" style={{ maxWidth: 200 }} value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
          <option value="">All Categories</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--text-muted)' }}>{assets.length} asset(s)</div>
      </div>

      {/* ── Table (only the grid body scrolls; page header/cards/filters stay put) ── */}
      <div className="card" style={{ padding: 0, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div className="table-wrapper" style={{ overflowX: 'auto', overflowY: 'auto', flex: 1, minHeight: 0, borderRadius: 12 }}>
          <table>
            <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
              <tr>
                <th>Asset</th><th>Category</th><th>Qty</th><th>Unit Price</th><th>Total Value</th>
                <th>Purchased</th><th>Vendor</th><th>Warranty Until</th><th>Life</th><th>Condition</th><th>Location</th>
                {(canEdit || canDelete) && <th></th>}
              </tr>
            </thead>
            <tbody>
              {assets.map((a) => (
                <tr key={a.assetId}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{a.assetName}</div>
                    {a.assetCode && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{a.assetCode}</div>}
                  </td>
                  <td><span className="badge badge-purple">{a.category}</span></td>
                  <td>{a.quantity}</td>
                  <td>{fmt(a.unitPrice)}</td>
                  <td style={{ fontWeight: 700 }}>{fmt(a.totalValue)}</td>
                  <td>{a.purchaseDate || '—'}</td>
                  <td>{a.vendor || '—'}</td>
                  <td>{warrantyCell(a)}</td>
                  <td>{a.lifespanYears ? `${a.lifespanYears} yr` : '—'}</td>
                  <td>{condBadge(a.condition)}</td>
                  <td>{a.location || '—'}</td>
                  {(canEdit || canDelete) && (
                    <td>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {canEdit && <button className="btn btn-outline btn-sm" onClick={() => openForm(a)}><Edit2 size={13} /></button>}
                        {canDelete && <button className="btn btn-danger btn-sm" onClick={() => del(a)}><Trash2 size={13} /></button>}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
              {assets.length === 0 && <tr><td colSpan={12} className="empty-state">No assets yet. Click “Add Asset”.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Add / Edit modal ── */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header">
              <div className="modal-title"><Package size={16} style={{ verticalAlign: -3, marginRight: 6 }} />{editId ? 'Edit Asset' : 'Add Asset'}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <div className="modal-body">
              <div className="form-section-title">📦 Asset details</div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Asset Name *</label><input className="form-control" value={form.assetName} onChange={(e) => set('assetName', e.target.value)} placeholder="e.g. Dell Desktop Computer" /></div>
                <div className="form-group"><label className="form-label">Asset Code / Tag</label><input className="form-control" value={form.assetCode} onChange={(e) => set('assetCode', e.target.value)} placeholder="e.g. PC-014" /></div>
                <div className="form-group"><label className="form-label">Category</label>
                  <select className="form-control" value={form.category} onChange={(e) => set('category', e.target.value)}>{CATEGORIES.map((c) => <option key={c}>{c}</option>)}</select>
                </div>
                <div className="form-group"><label className="form-label">Quantity</label><input type="number" min="1" className="form-control" value={form.quantity} onChange={(e) => set('quantity', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Unit Price (₹)</label><input type="number" className="form-control" value={form.unitPrice} onChange={(e) => set('unitPrice', e.target.value)} placeholder="0" /></div>
                <div className="form-group"><label className="form-label">Condition</label>
                  <select className="form-control" value={form.condition} onChange={(e) => set('condition', e.target.value)}>{CONDITIONS.map((c) => <option key={c}>{c}</option>)}</select>
                </div>
              </div>

              <div className="form-section-title" style={{ marginTop: 12 }}>🧾 Purchase</div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Purchase Date</label><input type="date" className="form-control" value={form.purchaseDate} onChange={(e) => set('purchaseDate', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Vendor / Supplier</label><input className="form-control" value={form.vendor} onChange={(e) => set('vendor', e.target.value)} placeholder="e.g. Sharma Electronics" /></div>
                <div className="form-group"><label className="form-label">Invoice / Bill No</label><input className="form-control" value={form.invoiceNo} onChange={(e) => set('invoiceNo', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Location</label><input className="form-control" value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="e.g. Computer Lab, Block A" /></div>
              </div>

              <div className="form-section-title" style={{ marginTop: 12 }}>🛡️ Warranty &amp; life <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--text-muted)' }}>— kab tak chalega</span></div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Warranty (months)</label><input type="number" className="form-control" value={form.warrantyMonths} onChange={(e) => set('warrantyMonths', e.target.value)} placeholder="e.g. 24" />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Auto-fills “until” from purchase date if left blank below.</span>
                </div>
                <div className="form-group"><label className="form-label">Warranty Until</label><input type="date" className="form-control" value={form.warrantyUntil} onChange={(e) => set('warrantyUntil', e.target.value)} /></div>
                <div className="form-group"><label className="form-label">Expected Life (years)</label><input type="number" className="form-control" value={form.lifespanYears} onChange={(e) => set('lifespanYears', e.target.value)} placeholder="e.g. 5" /></div>
              </div>

              <div className="form-group">
                <label className="form-label">Remarks</label>
                <textarea className="form-control" rows="2" value={form.remarks} onChange={(e) => set('remarks', e.target.value)} placeholder="Any notes…" />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={save}>💾 Save Asset</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, color, label, value, sub }) {
  return (
    <div className="card" style={{ padding: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: color + '22', color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.1 }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{label}{sub ? ` · ${sub}` : ''}</div>
      </div>
    </div>
  );
}

export default function InventoryPage() {
  return (
    <RouteGuard module="Inventory">
      <InventoryInner />
    </RouteGuard>
  );
}
