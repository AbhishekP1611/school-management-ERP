// Opens a print-ready marksheet / report card for a student.

import { getCachedUnit } from './UnitContext';

function schoolInfo() {
  const u = getCachedUnit() || {};
  return {
    name: u.unitName || 'School ERP',
    tagline: 'Excellence in Education',
    address: [u.address, u.city, u.state].filter(Boolean).join(', '),
    gst: u.gstNo || '',
    logo: u.logoUrl || '',
  };
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const num = (n) => (n === null || n === undefined ? '-' : n);

/**
 * @param {object} student  { firstName, lastName, admissionNo, className, section, rollNo }
 * @param {Array}  exams    marksheet data from /results/by-student
 */
export function printMarksheet(student = {}, exams = []) {
  const SCHOOL = schoolInfo();
  const name = `${student.firstName || ''} ${student.lastName || ''}`.trim() || student.studentName || '—';
  const cls = `${student.className || ''} ${student.section || ''}`.trim() || '—';

  const examBlocks = exams.map((ex) => `
    <div class="exam">
      <div class="exam-head">
        <span>${esc(ex.examName)}</span>
        <span class="grade">Grade: ${esc(ex.grade)} &nbsp;•&nbsp; ${ex.percentage}%</span>
      </div>
      <table>
        <thead><tr><th>Subject</th><th>Date</th><th class="r">Max</th><th class="r">Pass</th><th class="r">Obtained</th><th>Result</th></tr></thead>
        <tbody>
          ${ex.subjects.map((s) => `
            <tr>
              <td><strong>${esc(s.subjectName)}</strong></td>
              <td>${esc(s.examDate || '-')}</td>
              <td class="r">${num(s.maxMarks)}</td>
              <td class="r">${num(s.passingMarks)}</td>
              <td class="r">${s.isAbsent ? 'AB' : num(s.marksObtained)}</td>
              <td><span class="pill ${s.result === 'Pass' ? 'p' : s.result === 'Absent' ? 'a' : 'f'}">${esc(s.result)}</span></td>
            </tr>`).join('')}
          <tr class="total">
            <td colspan="2">Total</td>
            <td class="r">${ex.totalMax}</td>
            <td></td>
            <td class="r">${ex.totalObtained}</td>
            <td>${ex.percentage}%</td>
          </tr>
        </tbody>
      </table>
    </div>`).join('');

  const html = `<!doctype html><html><head><meta charset="utf-8"/>
<title>Report Card - ${esc(name)}</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:'Segoe UI',Arial,sans-serif;color:#1e293b;background:#f1f5f9;padding:24px;}
  .sheet{max-width:760px;margin:0 auto;background:#fff;border-radius:14px;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,.12);}
  .head{background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;padding:24px 30px;text-align:center;}
  .head h1{font-size:24px;font-weight:800;letter-spacing:.5px;}
  .head .tag{font-size:12px;opacity:.85;}
  .ribbon{background:#dbeafe;color:#1e40af;text-align:center;padding:8px;font-weight:700;letter-spacing:2px;font-size:13px;text-transform:uppercase;}
  .info{display:grid;grid-template-columns:1fr 1fr;gap:8px 24px;padding:20px 30px;border-bottom:1px solid #f1f5f9;}
  .info .lbl{font-size:10px;text-transform:uppercase;color:#64748b;font-weight:600;}
  .info .val{font-size:14px;font-weight:600;}
  .body{padding:20px 30px;}
  .exam{margin-bottom:22px;}
  .exam-head{display:flex;justify-content:space-between;align-items:center;background:#f8fafc;padding:8px 12px;border-radius:8px 8px 0 0;font-weight:700;font-size:14px;border:1px solid #e2e8f0;}
  .exam-head .grade{color:#2563eb;font-size:13px;}
  table{width:100%;border-collapse:collapse;}
  th{background:#f1f5f9;text-align:left;padding:8px 12px;font-size:11px;text-transform:uppercase;color:#64748b;border-bottom:1px solid #e2e8f0;}
  td{padding:8px 12px;font-size:13px;border-bottom:1px solid #f1f5f9;}
  .r{text-align:right;}
  .total{background:#f8fafc;font-weight:700;}
  .pill{padding:2px 10px;border-radius:20px;font-size:11px;font-weight:700;color:#fff;}
  .pill.p{background:#16a34a;} .pill.f{background:#dc2626;} .pill.a{background:#ca8a04;}
  .foot{border-top:1px dashed #cbd5e1;padding:18px 30px;display:flex;justify-content:space-between;align-items:flex-end;font-size:12px;color:#64748b;}
  .sign{text-align:center;}.sign .line{width:150px;border-top:1px solid #94a3b8;margin-bottom:4px;}
  @media print{body{background:#fff;padding:0;}.sheet{box-shadow:none;border-radius:0;}.noprint{display:none;}}
  .printbtn{display:block;margin:20px auto 0;padding:10px 26px;background:#2563eb;color:#fff;border:none;border-radius:10px;font-size:14px;font-weight:600;cursor:pointer;}
</style></head><body>
  <div class="sheet">
    <div class="head">
      ${SCHOOL.logo ? `<img src="${SCHOOL.logo}" style="width:52px;height:52px;object-fit:cover;border-radius:10px;margin-bottom:8px"/>` : ''}
      <h1>${esc(SCHOOL.name)}</h1>
      <div class="tag">${esc(SCHOOL.tagline)}</div>
      ${(SCHOOL.address || SCHOOL.gst) ? `<div style="font-size:11px;opacity:.85;margin-top:3px">${esc(SCHOOL.address)}${SCHOOL.gst ? ' · GST: ' + esc(SCHOOL.gst) : ''}</div>` : ''}
    </div>
    <div class="ribbon">Report Card / Marksheet</div>
    <div class="info">
      <div><div class="lbl">Student Name</div><div class="val">${esc(name)}</div></div>
      <div><div class="lbl">Admission No</div><div class="val">${esc(student.admissionNo || '—')}</div></div>
      <div><div class="lbl">Class</div><div class="val">${esc(cls)}</div></div>
      <div><div class="lbl">Roll No</div><div class="val">${esc(student.rollNo || '—')}</div></div>
    </div>
    <div class="body">
      ${examBlocks || '<p style="text-align:center;color:#94a3b8;padding:30px">No results recorded yet.</p>'}
    </div>
    <div class="foot">
      <div>This is a computer-generated report card.</div>
      <div class="sign"><div class="line"></div>Principal / Class Teacher</div>
    </div>
  </div>
  <button class="printbtn noprint" onclick="window.print()">🖨️ Print Report Card</button>
  <script>window.onload=function(){setTimeout(function(){window.print();},350);};</script>
</body></html>`;

  const w = window.open('', '_blank', 'width=820,height=900');
  if (!w) { import('./alert').then(({ showError }) => showError('Please allow pop-ups to print.')); return; }
  w.document.write(html);
  w.document.close();
}
