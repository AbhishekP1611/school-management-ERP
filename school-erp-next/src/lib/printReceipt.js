// Opens a print-ready fee receipt in a new window and triggers the print dialog.
// Self-contained HTML + inline CSS so it prints cleanly from any browser.

import { getCachedUnit } from './UnitContext';

// School header comes from the logged-in user's UNIT (falls back to a default).
function schoolInfo() {
  const u = getCachedUnit() || {};
  return {
    name:    u.unitName || 'School ERP',
    tagline: 'Excellence in Education',
    address: [u.address, u.city, u.state, u.pincode].filter(Boolean).join(', '),
    phone:   u.phone || '',
    gst:     u.gstNo || '',
    logo:    u.logoUrl || '',
  };
}

const money = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * @param {object} fee     one fee row (feeType, amount, discount, paidAmount, balanceAmount, status, paymentMode, paymentDate)
 * @param {object} student { firstName, lastName, admissionNo, className, section, rollNo }
 */
export function printFeeReceipt(fee, student = {}) {
  const SCHOOL = schoolInfo();
  const today = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const receiptNo = `RC-${fee.feeId ?? Math.floor(Math.random() * 9000 + 1000)}`;
  const studentName = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.studentName || '—';
  const cls = `${student.className || ''} ${student.section || ''}`.trim() || '—';

  const statusColor = fee.status === 'Paid' ? '#16a34a' : fee.status === 'Pending' ? '#dc2626' : '#ca8a04';

  const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Fee Receipt - ${esc(studentName)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; color:#1e293b; background:#f1f5f9; padding:24px; }
  .receipt { max-width:640px; margin:0 auto; background:#fff; border-radius:14px; overflow:hidden; box-shadow:0 10px 40px rgba(0,0,0,.12); }
  .head { background:linear-gradient(135deg,#2563eb,#3b82f6); color:#fff; padding:26px 30px; display:flex; align-items:center; gap:16px; }
  .logo { width:60px; height:60px; border-radius:14px; background:rgba(255,255,255,.18); display:flex; align-items:center; justify-content:center; font-size:30px; flex-shrink:0; }
  .head h1 { font-size:24px; font-weight:800; letter-spacing:.5px; }
  .head .tag { font-size:12px; opacity:.85; }
  .head .meta { font-size:11px; opacity:.8; margin-top:4px; }
  .ribbon { background:#dbeafe; color:#1e40af; text-align:center; padding:8px; font-weight:700; letter-spacing:2px; font-size:13px; text-transform:uppercase; }
  .body { padding:26px 30px; }
  .rowline { display:flex; justify-content:space-between; margin-bottom:18px; font-size:13px; }
  .info-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px 24px; margin-bottom:22px; }
  .info-item .lbl { font-size:10px; text-transform:uppercase; letter-spacing:.5px; color:#64748b; font-weight:600; }
  .info-item .val { font-size:14px; font-weight:600; color:#1e293b; }
  table { width:100%; border-collapse:collapse; margin-bottom:20px; }
  th { background:#f8fafc; text-align:left; padding:10px 12px; font-size:11px; text-transform:uppercase; letter-spacing:.5px; color:#64748b; border-bottom:2px solid #e2e8f0; }
  td { padding:12px; font-size:14px; border-bottom:1px solid #f1f5f9; }
  .totals { margin-left:auto; width:260px; }
  .totals .t { display:flex; justify-content:space-between; padding:6px 0; font-size:14px; }
  .totals .grand { border-top:2px solid #e2e8f0; margin-top:6px; padding-top:10px; font-size:16px; font-weight:800; }
  .status { display:inline-block; padding:4px 14px; border-radius:20px; font-weight:700; font-size:13px; color:#fff; background:${statusColor}; }
  .foot { border-top:1px dashed #cbd5e1; padding:18px 30px; display:flex; justify-content:space-between; align-items:flex-end; font-size:12px; color:#64748b; }
  .sign { text-align:center; }
  .sign .line { width:150px; border-top:1px solid #94a3b8; margin-bottom:4px; }
  .note { text-align:center; font-size:11px; color:#94a3b8; padding:0 30px 22px; }
  @media print {
    body { background:#fff; padding:0; }
    .receipt { box-shadow:none; border-radius:0; max-width:100%; }
    .noprint { display:none; }
  }
  .printbtn { display:block; margin:20px auto 0; padding:10px 26px; background:#2563eb; color:#fff; border:none; border-radius:10px; font-size:14px; font-weight:600; cursor:pointer; }
</style>
</head>
<body>
  <div class="receipt">
    <div class="head">
      <div class="logo">${SCHOOL.logo ? `<img src="${SCHOOL.logo}" style="width:100%;height:100%;object-fit:cover;border-radius:12px"/>` : '🎓'}</div>
      <div>
        <h1>${esc(SCHOOL.name)}</h1>
        <div class="tag">${esc(SCHOOL.tagline)}</div>
        <div class="meta">${esc(SCHOOL.address)}${SCHOOL.phone ? ' &nbsp;•&nbsp; ' + esc(SCHOOL.phone) : ''}${SCHOOL.gst ? ' &nbsp;•&nbsp; GST: ' + esc(SCHOOL.gst) : ''}</div>
      </div>
    </div>
    <div class="ribbon">Fee Receipt</div>
    <div class="body">
      <div class="rowline">
        <div><strong>Receipt No:</strong> ${esc(receiptNo)}</div>
        <div><strong>Date:</strong> ${esc(fee.paymentDate || today)}</div>
      </div>

      <div class="info-grid">
        <div class="info-item"><div class="lbl">Student Name</div><div class="val">${esc(studentName)}</div></div>
        <div class="info-item"><div class="lbl">Admission No</div><div class="val">${esc(student.admissionNo || '—')}</div></div>
        <div class="info-item"><div class="lbl">Class</div><div class="val">${esc(cls)}</div></div>
        <div class="info-item"><div class="lbl">Roll No</div><div class="val">${esc(student.rollNo || '—')}</div></div>
      </div>

      <table>
        <thead>
          <tr><th>Fee Type</th><th>Mode</th><th style="text-align:right">Amount</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>${esc(fee.feeType)}</strong></td>
            <td>${esc(fee.paymentMode || '—')}</td>
            <td style="text-align:right">${money(fee.amount)}</td>
          </tr>
        </tbody>
      </table>

      <div class="totals">
        <div class="t"><span>Total Amount</span><span>${money(fee.amount)}</span></div>
        <div class="t"><span>Discount</span><span>- ${money(fee.discount)}</span></div>
        <div class="t"><span>Paid Amount</span><span style="color:#16a34a">${money(fee.paidAmount)}</span></div>
        <div class="t grand"><span>Balance Due</span><span style="color:${(fee.balanceAmount ?? 0) > 0 ? '#dc2626' : '#16a34a'}">${money(fee.balanceAmount)}</span></div>
        <div class="t" style="margin-top:8px"><span>Status</span><span class="status">${esc(fee.status)}</span></div>
      </div>
    </div>

    <div class="foot">
      <div>Thank you for your payment.<br/>This is a computer-generated receipt.</div>
      <div class="sign"><div class="line"></div>Authorised Signatory</div>
    </div>
    <div class="note">${esc(SCHOOL.name)} — ${esc(SCHOOL.phone)}</div>
  </div>

  <button class="printbtn noprint" onclick="window.print()">🖨️ Print Receipt</button>

  <script>
    window.onload = function () { setTimeout(function () { window.print(); }, 350); };
  </script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=760,height=900');
  if (!w) {
    import('./alert').then(({ showError }) => showError('Please allow pop-ups to print the receipt.'));
    return;
  }
  w.document.write(html);
  w.document.close();
}
