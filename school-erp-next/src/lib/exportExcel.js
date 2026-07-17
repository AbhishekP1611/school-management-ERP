import * as XLSX from 'xlsx';

/**
 * Export an array of row objects to a downloadable .xlsx file.
 *
 * @param {Array<Object>} rows      Data rows (plain objects).
 * @param {string}        fileName  File name without extension (e.g. "Students").
 * @param {Array<{key:string,label:string,format?:Function}>} [columns]
 *        Optional column map — controls order, headers & value formatting.
 *        If omitted, all keys of the first row are exported as-is.
 */
export function exportToExcel(rows, fileName = 'export', columns = null) {
  if (!rows || rows.length === 0) {
    // Nothing to export — surface a gentle toast instead of a blank file.
    import('./alert').then(({ showError }) => showError('Nothing to export — the table is empty.'));
    return;
  }

  let data;
  if (columns && columns.length) {
    data = rows.map((row) => {
      const obj = {};
      columns.forEach((c) => {
        const raw = row[c.key];
        obj[c.label] = c.format ? c.format(raw, row) : (raw ?? '');
      });
      return obj;
    });
  } else {
    data = rows;
  }

  const worksheet = XLSX.utils.json_to_sheet(data);

  // Auto column widths based on content length
  const headers = Object.keys(data[0]);
  worksheet['!cols'] = headers.map((h) => {
    const maxLen = Math.max(
      h.length,
      ...data.map((r) => String(r[h] ?? '').length)
    );
    return { wch: Math.min(Math.max(maxLen + 2, 10), 45) };
  });

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, fileName.slice(0, 31));

  const stamp = new Date().toISOString().split('T')[0];
  XLSX.writeFile(workbook, `${fileName}_${stamp}.xlsx`);
}
