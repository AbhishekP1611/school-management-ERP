'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import API from './api';
import { useAuth } from './AuthContext';

const AcademicYearContext = createContext(null);

const STORE_KEY = 'academic_year';

// Plain (non-hook) selected year — read by the axios layer to attach ?year=.
let cachedYear = null;
export function getSelectedYear() { return cachedYear; }
function setCachedYear(y) { cachedYear = y; }

export function AcademicYearProvider({ children }) {
  const { user, ready } = useAuth();
  const [years, setYears] = useState([]);
  const [current, setCurrent] = useState(null);       // the actual running year
  const [year, setYearState] = useState(null);        // the selected/filter year
  const [loaded, setLoaded] = useState(false);

  const setYear = useCallback((y) => {
    setYearState(y);
    setCachedYear(y);
    try { localStorage.setItem(STORE_KEY, y); } catch {}
  }, []);

  useEffect(() => {
    if (!ready || !user) {
      setYears([]); setCurrent(null); setYearState(null); setCachedYear(null); setLoaded(false);
      return;
    }
    API.get('/academic-years')
      .then((r) => {
        const list = r.data?.years || [];
        const cur = r.data?.current || list[0] || null;
        setYears(list);
        setCurrent(cur);
        // restore saved year if it's still valid, else default to current
        let saved = null;
        try { saved = localStorage.getItem(STORE_KEY); } catch {}
        const chosen = saved && list.includes(saved) ? saved : cur;
        setYearState(chosen);
        setCachedYear(chosen);
      })
      .catch(() => { setYears([]); setCurrent(null); })
      .finally(() => setLoaded(true));
  }, [ready, user]);

  return (
    <AcademicYearContext.Provider value={{ years, year, current, setYear, loaded }}>
      {children}
    </AcademicYearContext.Provider>
  );
}

export const useAcademicYear = () => useContext(AcademicYearContext);
