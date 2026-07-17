'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API from './api';
import { useAuth } from './AuthContext';

// The user's navigable modules (active + viewable), ordered by SortOrder — served by
// GET /authority/nav. This is the single source of truth for the sidebar AND the
// default landing route, so adding/reordering modules in the Modules window is enough.
const NavContext = createContext(null);

export function NavProvider({ children }) {
  const { user, ready } = useAuth();
  const [nav, setNav] = useState([]);      // [{ moduleName, displayName, route, icon }]
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    if (!user) { setNav([]); setLoaded(true); return; }
    setLoaded(false);
    API.get('/authority/nav')
      .then((r) => setNav(Array.isArray(r.data) ? r.data : []))
      .catch(() => setNav([]))
      .finally(() => setLoaded(true));
  }, [user]);

  useEffect(() => { if (ready) refresh(); }, [ready, refresh]);

  // First route the user can land on (top of their ordered nav). null if none.
  const firstRoute = nav.length ? nav[0].route : null;

  return (
    <NavContext.Provider value={{ nav, loaded, refresh, firstRoute }}>
      {children}
    </NavContext.Provider>
  );
}

export const useNav = () => useContext(NavContext);
