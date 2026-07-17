'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { applyCustomAccent, clearCustomAccent, DEFAULT_TUNE } from './colorUtils';

const ThemeContext = createContext(null);

// Available accent themes (must match the [data-accent] palettes in globals.css).
export const ACCENTS = [
  { key: 'blue',    label: 'Blue',    color: '#3b82f6' },
  { key: 'sky',     label: 'Sky',     color: '#0ea5e9' },
  { key: 'cyan',    label: 'Cyan',    color: '#06b6d4' },
  { key: 'teal',    label: 'Teal',    color: '#0d9488' },
  { key: 'emerald', label: 'Emerald', color: '#10b981' },
  { key: 'green',   label: 'Green',   color: '#22c55e' },
  { key: 'lime',    label: 'Lime',    color: '#65a30d' },
  { key: 'amber',   label: 'Amber',   color: '#f59e0b' },
  { key: 'orange',  label: 'Orange',  color: '#f97316' },
  { key: 'red',     label: 'Red',     color: '#ef4444' },
  { key: 'rose',    label: 'Rose',    color: '#f43f5e' },
  { key: 'pink',    label: 'Pink',    color: '#ec4899' },
  { key: 'fuchsia', label: 'Fuchsia', color: '#d946ef' },
  { key: 'purple',  label: 'Purple',  color: '#a855f7' },
  { key: 'violet',  label: 'Violet',  color: '#8b5cf6' },
  { key: 'indigo',  label: 'Indigo',  color: '#6366f1' },
  { key: 'slate',   label: 'Slate',   color: '#64748b' },
  { key: 'brown',   label: 'Brown',   color: '#a16207' },
];

const MODE_KEY = 'theme';
const ACCENT_KEY = 'accent';
const CUSTOM_KEY = 'accent_custom';        // the user's custom hex, if any
const TUNE_KEY = 'accent_custom_tune';     // the advanced fine-tune knobs
const CUSTOM = 'custom';

function readTune() {
  try {
    const raw = localStorage.getItem(TUNE_KEY);
    return raw ? { ...DEFAULT_TUNE, ...JSON.parse(raw) } : { ...DEFAULT_TUNE };
  } catch { return { ...DEFAULT_TUNE }; }
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');   // 'light' | 'dark' (kept name for compatibility)
  const [accent, setAccentState] = useState('blue');
  const [customHex, setCustomHex] = useState('#3b82f6');
  const [customTune, setCustomTune] = useState(DEFAULT_TUNE);

  // Load saved preferences on mount and apply to <html>.
  useEffect(() => {
    const savedMode   = typeof window !== 'undefined' ? localStorage.getItem(MODE_KEY) : null;
    const savedAccent = typeof window !== 'undefined' ? localStorage.getItem(ACCENT_KEY) : null;
    const savedCustom = typeof window !== 'undefined' ? localStorage.getItem(CUSTOM_KEY) : null;
    const mode = savedMode || 'light';
    const acc  = savedAccent || 'blue';
    const hex  = savedCustom || '#3b82f6';
    const tune = readTune();

    setTheme(mode);
    setAccentState(acc);
    setCustomHex(hex);
    setCustomTune(tune);
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.setAttribute('data-accent', acc);
    if (acc === CUSTOM) applyCustomAccent(hex, mode, tune);
  }, []);

  const applyMode = useCallback((next) => {
    setTheme(next);
    localStorage.setItem(MODE_KEY, next);
    document.documentElement.setAttribute('data-theme', next);
    // custom palette is mode-dependent — re-derive it for the new mode
    if (localStorage.getItem(ACCENT_KEY) === CUSTOM) {
      applyCustomAccent(localStorage.getItem(CUSTOM_KEY) || '#3b82f6', next, readTune());
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      applyMode(next);
      return next;
    });
  }, [applyMode]);

  // Pick a built-in accent → clear any custom inline overrides.
  const setAccent = useCallback((acc) => {
    setAccentState(acc);
    localStorage.setItem(ACCENT_KEY, acc);
    document.documentElement.setAttribute('data-accent', acc);
    clearCustomAccent();
  }, []);

  // Pick/adjust the custom color → derive + apply the palette for the current mode.
  const setCustomAccent = useCallback((hex) => {
    const mode = localStorage.getItem(MODE_KEY) || 'light';
    const tune = readTune();
    setCustomHex(hex);
    setAccentState(CUSTOM);
    localStorage.setItem(ACCENT_KEY, CUSTOM);
    localStorage.setItem(CUSTOM_KEY, hex);
    document.documentElement.setAttribute('data-accent', CUSTOM);
    applyCustomAccent(hex, mode, tune);
  }, []);

  // Adjust the advanced fine-tune knobs (brightness / shade / tint). Live-applies.
  const updateCustomTune = useCallback((partial) => {
    const mode = localStorage.getItem(MODE_KEY) || 'light';
    setCustomTune((prev) => {
      const next = { ...prev, ...partial };
      localStorage.setItem(TUNE_KEY, JSON.stringify(next));
      // switching into custom if not already, so the sliders take effect immediately
      const hex = localStorage.getItem(CUSTOM_KEY) || customHex || '#3b82f6';
      setAccentState(CUSTOM);
      localStorage.setItem(ACCENT_KEY, CUSTOM);
      localStorage.setItem(CUSTOM_KEY, hex);
      document.documentElement.setAttribute('data-accent', CUSTOM);
      applyCustomAccent(hex, mode, next);
      return next;
    });
  }, [customHex]);

  const resetCustomTune = useCallback(() => updateCustomTune(DEFAULT_TUNE), [updateCustomTune]);

  return (
    <ThemeContext.Provider value={{
      theme, toggleTheme, setMode: applyMode,
      accent, setAccent, accents: ACCENTS,
      customHex, setCustomAccent, isCustom: accent === CUSTOM,
      customTune, updateCustomTune, resetCustomTune,
    }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
