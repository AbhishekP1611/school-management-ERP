'use client';

import { useState, useEffect } from 'react';
import { ChevronsRight, ChevronsLeft, Pin, PinOff, GraduationCap } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useNav } from '@/lib/NavContext';
import { getIcon } from '@/lib/iconMap';

const PIN_KEY = 'sidebar_pinned';

export default function Sidebar({ mobileOpen = false }) {
  // The sidebar is fully table-driven: /authority/nav returns the user's active,
  // viewable modules already ordered by SortOrder (managed in the Modules window).
  const { nav, loaded } = useNav();
  const pathname = usePathname();

  // collapsed = only icons (default). expanded = icon + label.
  // On mobile the drawer is always shown expanded (icon + label) when open.
  const [expanded, setExpanded] = useState(false);
  const showLabels = expanded || mobileOpen;
  const [pinned, setPinned] = useState([]); // array of `to` paths

  // load pinned from localStorage
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PIN_KEY) || '[]');
      if (Array.isArray(saved)) setPinned(saved);
    } catch {}
  }, []);

  const togglePin = (to, e) => {
    e.preventDefault();
    e.stopPropagation();
    setPinned((prev) => {
      const next = prev.includes(to) ? prev.filter((p) => p !== to) : [to, ...prev];
      localStorage.setItem(PIN_KEY, JSON.stringify(next));
      return next;
    });
  };

  // links this user can see — served ready-ordered from the API (RBAC canView applied server-side).
  const visible = loaded
    ? nav.map((m) => ({ to: m.route, label: m.displayName || m.moduleName, icon: getIcon(m.icon) }))
    : [];
  // pinned links first (in pin order), then the rest
  const pinnedLinks = pinned
    .map((to) => visible.find((l) => l.to === to))
    .filter(Boolean);
  const otherLinks = visible.filter((l) => !pinned.includes(l.to));

  const renderItem = (link) => {
    const Icon = link.icon;
    const active = pathname === link.to;
    const isPinned = pinned.includes(link.to);
    return (
      <Link
        key={link.to}
        href={link.to}
        className={`nav-item ${active ? 'active' : ''}`}
        title={!showLabels ? link.label : undefined}
      >
        <span className="nav-icon"><Icon size={19} /></span>
        {showLabels && <span className="nav-label">{link.label}</span>}
        {showLabels && (
          <button
            className={`nav-pin ${isPinned ? 'pinned' : ''}`}
            onClick={(e) => togglePin(link.to, e)}
            title={isPinned ? 'Unpin' : 'Pin to top'}
          >
            {isPinned ? <PinOff size={13} /> : <Pin size={13} />}
          </button>
        )}
      </Link>
    );
  };

  return (
    <aside className={`sidebar ${expanded ? 'expanded' : 'collapsed'} ${mobileOpen ? 'open' : ''}`}>
      {/* Brand + collapse toggle */}
      <div className="sidebar-brand">
        <div className="brand-icon"><GraduationCap size={20} /></div>
        {showLabels && (
          <div className="brand-meta">
            <div className="brand-text">School ERP</div>
            <div className="brand-sub">Management System</div>
          </div>
        )}
        <button
          className="sidebar-toggle sidebar-toggle-desktop"
          onClick={() => setExpanded((s) => !s)}
          title={expanded ? 'Collapse menu' : 'Expand menu'}
        >
          {expanded ? <ChevronsLeft size={16} /> : <ChevronsRight size={16} />}
        </button>
      </div>

      <nav className="sidebar-nav">
        {/* Pinned section (only if something is pinned) */}
        {pinnedLinks.length > 0 && (
          <>
            {showLabels && <div className="nav-section-label">📌 Pinned</div>}
            {pinnedLinks.map(renderItem)}
            <div className="nav-divider" />
          </>
        )}

        {showLabels && <div className="nav-section-label">Main Menu</div>}
        {otherLinks.map(renderItem)}
      </nav>
    </aside>
  );
}
