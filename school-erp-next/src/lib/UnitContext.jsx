'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import API from './api';
import { useAuth } from './AuthContext';

const UnitContext = createContext(null);

export function UnitProvider({ children }) {
  const { user, ready } = useAuth();
  const [unit, setUnit] = useState(null);

  useEffect(() => {
    if (!ready || !user) { setUnit(null); setCachedUnit(null); return; }
    API.get('/units/current')
      .then((r) => { setUnit(r.data); setCachedUnit(r.data); })
      .catch(() => { setUnit(null); setCachedUnit(null); });
  }, [ready, user]);

  return <UnitContext.Provider value={{ unit }}>{children}</UnitContext.Provider>;
}

export const useUnit = () => useContext(UnitContext);

// A plain (non-hook) getter for use inside print helpers etc.
let cachedUnit = null;
export function setCachedUnit(u) { cachedUnit = u; }
export function getCachedUnit() { return cachedUnit; }
