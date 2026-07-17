'use client';

import { Search, FileDown } from 'lucide-react';
import { exportToExcel } from '@/lib/exportExcel';

/**
 * Reusable page header: title + subtitle on the left,
 * search box + Excel export + extra action slots on the right.
 * Used on EVERY grid page so search & export look/behave identically.
 *
 * Props:
 *  - title, subtitle
 *  - search, onSearch        : controlled search value + setter (omit to hide search)
 *  - searchPlaceholder
 *  - exportRows, exportColumns, exportName : data for the Excel button (omit exportRows to hide)
 *  - children                : extra buttons/filters rendered before the export button
 */
export default function PageToolbar({
  title,
  subtitle,
  search,
  onSearch,
  searchPlaceholder = 'Search...',
  exportRows,
  exportColumns,
  exportName = 'export',
  children,
}) {
  const showSearch = typeof onSearch === 'function';
  const showExport = Array.isArray(exportRows);

  return (
    <div className="page-header">
      <div>
        <div className="page-title">{title}</div>
        {subtitle && <div className="page-subtitle">{subtitle}</div>}
      </div>

      <div className="page-actions">
        {showSearch && (
          <div className="search-bar">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => onSearch(e.target.value)}
            />
          </div>
        )}

        {children}

        {showExport && (
          <button
            className="btn btn-success"
            onClick={() => exportToExcel(exportRows, exportName, exportColumns)}
            title="Export current table to Excel"
          >
            <FileDown size={16} /> Excel
          </button>
        )}
      </div>
    </div>
  );
}
