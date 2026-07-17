'use client';

import { useState, useMemo, useEffect } from 'react';
import { Filter, X, FileSpreadsheet, ChevronLeft, ChevronRight } from 'lucide-react';
import { exportToExcel } from '@/lib/exportExcel';

/**
 * Reusable data grid with:
 *  - a per-column filter icon in EACH header (click → inline search box for that column)
 *  - an Excel export ICON in the top-right (icon only, no text label)
 *
 * Props:
 *  - columns: [{ key, label, render?(row), value?(row), exportFormat?(v,row), filterable?=true, className? }]
 *      • render  → custom cell JSX (optional; defaults to row[key])
 *      • value   → plain text used for filtering + export (defaults to row[key])
 *      • filterable=false → no filter icon on that column (e.g. Actions column)
 *  - rows: array of data objects
 *  - rowKey: (row) => unique key
 *  - exportName: base file name for the Excel download
 *  - emptyText: message when no rows match
 *  - actions: (optional) function(row) => JSX rendered in a trailing "Actions" column
 *  - actionsLabel: header for the actions column (default "Actions")
 *  - title / subtitle / toolbar : optional header area above the grid
 */
export default function DataGrid({
  columns,
  rows,
  rowKey,
  exportName = 'export',
  emptyText = 'No records found.',
  actions,
  actionsLabel = 'Actions',
  title,
  subtitle,
  toolbar,
  pageSize = 10,          // rows per page
  maxHeight = 560,        // fixed grid body height (px) before it scrolls
}) {
  // { [columnKey]: "search text" }
  const [filters, setFilters] = useState({});
  // which column's filter box is currently open
  const [openFilter, setOpenFilter] = useState(null);
  const [page, setPage] = useState(1);

  const cellValue = (col, row) => {
    if (typeof col.value === 'function') return col.value(row);
    const v = row[col.key];
    return v === null || v === undefined ? '' : v;
  };

  // Apply every active column filter
  const filteredRows = useMemo(() => {
    const active = Object.entries(filters).filter(([, val]) => val && val.trim() !== '');
    if (active.length === 0) return rows;
    return rows.filter((row) =>
      active.every(([key, val]) => {
        const col = columns.find((c) => c.key === key);
        if (!col) return true;
        return String(cellValue(col, row)).toLowerCase().includes(val.toLowerCase());
      })
    );
  }, [rows, filters, columns]);

  // ── Pagination ──
  const totalRows = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(
    () => filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [filteredRows, currentPage, pageSize]
  );
  // reset to page 1 when the data/filters change the row count
  useEffect(() => { setPage(1); }, [totalRows === 0 ? 0 : rows]);

  const setFilter = (key, val) => { setFilters((f) => ({ ...f, [key]: val })); setPage(1); };
  const clearFilter = (key) => {
    setFilters((f) => {
      const next = { ...f };
      delete next[key];
      return next;
    });
    setOpenFilter(null);
    setPage(1);
  };

  const handleExport = () => {
    const exportColumns = columns.map((c) => ({
      key: c.key,
      label: c.label,
      format: (_, row) => {
        if (typeof c.exportFormat === 'function') return c.exportFormat(row[c.key], row);
        return cellValue(c, row);
      },
    }));
    exportToExcel(filteredRows, exportName, exportColumns);
  };

  return (
    <>
      {(title || toolbar) && (
        <div className="page-header">
          <div>
            {title && <div className="page-title">{title}</div>}
            {subtitle && <div className="page-subtitle">{subtitle}</div>}
          </div>
          <div className="page-actions">
            {toolbar}
            <button className="grid-excel-btn" onClick={handleExport} title="Export to Excel">
              <FileSpreadsheet size={18} />
            </button>
          </div>
        </div>
      )}

      <div className="card">
        <div className="table-wrapper grid-scroll" style={{ maxHeight }}>
          <table className="grid-table">
            <thead>
              <tr>
                {columns.map((col) => {
                  const filterable = col.filterable !== false;
                  const active = !!(filters[col.key] && filters[col.key].trim());
                  const isOpen = openFilter === col.key;
                  return (
                    <th key={col.key} className={col.className}>
                      <div className="th-inner">
                        <span>{col.label}</span>
                        {filterable && (
                          <button
                            type="button"
                            className={`th-filter-btn ${active ? 'active' : ''}`}
                            onClick={() => setOpenFilter(isOpen ? null : col.key)}
                            title={`Filter ${col.label}`}
                          >
                            <Filter size={13} />
                          </button>
                        )}
                      </div>
                      {filterable && isOpen && (
                        <div className="th-filter-box">
                          <input
                            autoFocus
                            type="text"
                            placeholder={`Search ${col.label}...`}
                            value={filters[col.key] || ''}
                            onChange={(e) => setFilter(col.key, e.target.value)}
                            onKeyDown={(e) => e.key === 'Escape' && setOpenFilter(null)}
                          />
                          <button type="button" onClick={() => clearFilter(col.key)} title="Clear">
                            <X size={13} />
                          </button>
                        </div>
                      )}
                    </th>
                  );
                })}
                {actions && <th>{actionsLabel}</th>}
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((col) => (
                    <td key={col.key} className={col.className}>
                      {typeof col.render === 'function' ? col.render(row) : cellValue(col, row)}
                    </td>
                  ))}
                  {actions && <td>{actions(row)}</td>}
                </tr>
              ))}
              {totalRows === 0 && (
                <tr>
                  <td colSpan={columns.length + (actions ? 1 : 0)} className="empty-state">
                    {emptyText}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pager ── */}
        {totalRows > 0 && (
          <div className="grid-pager">
            <div className="grid-pager-info">
              Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, totalRows)} of {totalRows}
            </div>
            <div className="grid-pager-controls">
              <button className="grid-pager-btn" disabled={currentPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft size={15} /> Prev
              </button>
              <span className="grid-pager-page">Page {currentPage} / {totalPages}</span>
              <button className="grid-pager-btn" disabled={currentPage >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                Next <ChevronRight size={15} />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
