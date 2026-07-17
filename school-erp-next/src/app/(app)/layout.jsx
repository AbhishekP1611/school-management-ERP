'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Topbar from '@/components/Topbar';
import RouteGuard from '@/components/RouteGuard';

export default function AppLayout({ children }) {
  const pathname = usePathname();
  // Mobile nav drawer (only used < 768px; desktop ignores it).
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Close the drawer whenever the route changes (tapping a link navigates → close).
  useEffect(() => { setMobileNavOpen(false); }, [pathname]);

  // Lock body scroll while the drawer is open on mobile.
  useEffect(() => {
    document.body.style.overflow = mobileNavOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileNavOpen]);

  return (
    <RouteGuard>
      <div className={`app-layout ${mobileNavOpen ? 'nav-open' : ''}`}>
        <Sidebar mobileOpen={mobileNavOpen} />
        {/* Backdrop — tap to close the drawer (mobile only) */}
        <div className="mobile-nav-backdrop" onClick={() => setMobileNavOpen(false)} />
        <main className="main-content">
          <Topbar onMenuClick={() => setMobileNavOpen((o) => !o)} />
          <div className="page-body">{children}</div>
        </main>
      </div>
    </RouteGuard>
  );
}
