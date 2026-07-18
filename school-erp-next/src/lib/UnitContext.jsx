'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API from './api';
import { useAuth } from './AuthContext';

const UnitContext = createContext(null);

export function UnitProvider({ children }) {
  const { user, ready } = useAuth();
  const [unit, setUnit] = useState(null);        // the ACTIVE unit (full details)
  const [units, setUnits] = useState([]);        // all units this user may switch between
  const [activeUnitId, setActiveUnitId] = useState(null);

  // Load the active unit id + switch list from what login stored.
  useEffect(() => {
    if (!ready || !user) { setUnit(null); setCachedUnit(null); setUnits([]); setActiveUnitId(null); return; }
    let activeId = null;
    let list = [];
    try {
      const au = localStorage.getItem('active_unit');
      if (au) { activeId = Number(au); setActiveUnitId(activeId); }
      const uu = localStorage.getItem('user_units');
      if (uu) { list = JSON.parse(uu); setUnits(list); }
    } catch {}
    // Header name = the ACTIVE unit (not the home unit). Prefer the brief from
    // the login list; fall back to /units/current for full details/prints.
    const activeBrief = list.find((u) => u.unitId === activeId);
    if (activeBrief) { setUnit(activeBrief); setCachedUnit(activeBrief); }
    API.get('/units/current')
      .then((r) => {
        // keep the ACTIVE unit's name, but take full detail (address etc.) for prints
        const full = activeBrief ? { ...r.data, unitId: activeBrief.unitId, unitName: activeBrief.unitName } : r.data;
        setUnit(full); setCachedUnit(full);
      })
      .catch(() => { if (!activeBrief) { setUnit(null); setCachedUnit(null); } });
  }, [ready, user]);

  // Switch the active unit → re-scopes the whole app. Reloads so every page
  // refetches with the new X-Unit-Id.
  const switchUnit = useCallback((unitId) => {
    if (!unitId || Number(unitId) === activeUnitId) return;
    try { localStorage.setItem('active_unit', String(unitId)); } catch {}
    if (typeof window !== 'undefined') window.location.reload();
  }, [activeUnitId]);

  return (
    <UnitContext.Provider value={{ unit, units, activeUnitId, switchUnit }}>
      {children}
    </UnitContext.Provider>
  );
}

export const useUnit = () => useContext(UnitContext);

// A plain (non-hook) getter for use inside print helpers etc.
let cachedUnit = null;
export function setCachedUnit(u) { cachedUnit = u; }
export function getCachedUnit() { return cachedUnit; }
