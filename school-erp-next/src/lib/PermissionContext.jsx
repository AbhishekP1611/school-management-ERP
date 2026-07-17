'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API from './api';
import { useAuth } from './AuthContext';

const PermissionContext = createContext(null);

export function PermissionProvider({ children }) {
  const { user, ready } = useAuth();
  const [perms, setPerms] = useState({});   // { ModuleName: {canView, canCreate, canEdit, canDelete} }
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(() => {
    if (!user) { setPerms({}); setLoaded(true); return; }
    API.get('/authority/my-permissions')
      .then((r) => setPerms(r.data || {}))
      .catch(() => setPerms({}))
      .finally(() => setLoaded(true));
  }, [user]);

  useEffect(() => {
    if (ready) refresh();
  }, [ready, refresh]);

  // can('Students', 'canView') → boolean. Admin already gets all-true from the API.
  const can = useCallback(
    (module, action = 'canView') => !!perms[module]?.[action],
    [perms]
  );

  return (
    <PermissionContext.Provider value={{ perms, can, loaded, refresh }}>
      {children}
    </PermissionContext.Provider>
  );
}

export const usePermissions = () => useContext(PermissionContext);
