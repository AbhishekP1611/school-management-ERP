'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/lib/PermissionContext';
import { useNav } from '@/lib/NavContext';

/**
 * Client-side guard. Redirects to /login if not authenticated.
 * Access is PURELY permission-based (ID → Authority table), never role-based:
 *   - pass `module` to require canView on that RBAC module.
 *
 * If the user lacks access to the requested module, they're sent to their FIRST
 * allowed module (top of their ordered nav — e.g. a teacher with only Students
 * lands on /students). If they can view NO module at all, a clear "no access"
 * message is shown instead of bouncing in a redirect loop.
 */
export default function RouteGuard({ children, module }) {
  const router = useRouter();
  const { user, ready } = useAuth();
  const { can, loaded: permsLoaded } = usePermissions();
  const { firstRoute, loaded: navLoaded } = useNav();

  const loaded = permsLoaded && navLoaded;
  const allowed = () => (module ? can(module, 'canView') : true);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (loaded && !allowed()) {
      if (firstRoute && firstRoute !== window.location.pathname) router.replace(firstRoute);
    }
  }, [ready, user, loaded, module, firstRoute, router]);

  // Wait for auth + permissions + nav before deciding.
  if (!ready || !user || !loaded) {
    return (
      <div style={{ display: 'flex', height: '60vh', alignItems: 'center', justifyContent: 'center' }}>
        <span className="loading-spinner" style={{ borderTopColor: '#3b82f6', borderColor: 'rgba(59,130,246,0.2)' }} />
      </div>
    );
  }

  if (!allowed()) {
    // No accessible module at all → show a clear message (no redirect loop).
    if (!firstRoute) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, height: '60vh', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 20 }}>
          <div style={{ fontSize: 40 }}>🔒</div>
          <div style={{ fontWeight: 700, fontSize: 18 }}>No access assigned</div>
          <div style={{ color: 'var(--text-muted)', maxWidth: 420 }}>
            Your account doesn&apos;t have permission to any module yet. Please contact your school administrator to get access.
          </div>
        </div>
      );
    }
    return null; // effect above is redirecting
  }

  return children;
}
