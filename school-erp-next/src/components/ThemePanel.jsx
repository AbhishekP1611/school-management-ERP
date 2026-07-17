'use client';

import { useEffect, useRef, useState } from 'react';
import { Sun, Moon, Check, Palette, Pipette, Sliders, RotateCcw, ChevronDown } from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';
import { isValidHex, normalizeHex } from '@/lib/colorUtils';

export default function ThemePanel({ onClose, anchorClass = '' }) {
  const { theme, setMode, accent, setAccent, accents, customHex, setCustomAccent, isCustom,
          customTune, updateCustomTune, resetCustomTune } = useTheme();
  const ref = useRef(null);
  const [hexInput, setHexInput] = useState(customHex || '#3b82f6');
  const [advOpen, setAdvOpen] = useState(false);

  // keep the text field in sync when the stored custom color changes
  useEffect(() => { setHexInput(customHex || '#3b82f6'); }, [customHex]);

  const commitHex = (v) => {
    if (isValidHex(v)) setCustomAccent(normalizeHex(v));
  };

  // Close on outside click / Escape.
  useEffect(() => {
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [onClose]);

  return (
    <div className={`theme-panel ${anchorClass}`} ref={ref}>
      <div className="theme-panel-head">
        <Palette size={15} /> <span>Appearance</span>
      </div>

      <div className="theme-panel-label">Mode</div>
      <div className="theme-mode-row">
        <button
          className={`theme-mode-btn ${theme === 'light' ? 'active' : ''}`}
          onClick={() => setMode('light')}
        >
          <Sun size={16} /> Light
        </button>
        <button
          className={`theme-mode-btn ${theme === 'dark' ? 'active' : ''}`}
          onClick={() => setMode('dark')}
        >
          <Moon size={16} /> Dark
        </button>
      </div>

      <div className="theme-panel-label">Accent color</div>
      <div className="theme-accent-grid">
        {accents.map((a) => (
          <button
            key={a.key}
            className={`theme-swatch ${accent === a.key ? 'active' : ''}`}
            style={{ background: a.color }}
            title={a.label}
            onClick={() => setAccent(a.key)}
          >
            {accent === a.key && <Check size={15} color="#fff" strokeWidth={3} />}
          </button>
        ))}
      </div>

      {/* ── Custom color — pick any color you like ── */}
      <div className="theme-panel-label" style={{ marginTop: 14 }}>Custom color</div>
      <div className="theme-custom-row">
        {/* live swatch = the native color wheel */}
        <label className={`theme-custom-swatch ${isCustom ? 'active' : ''}`} title="Pick any color" style={{ background: customHex }}>
          {isCustom ? <Check size={15} color="#fff" strokeWidth={3} /> : <Pipette size={14} color="#fff" />}
          <input
            type="color"
            value={isValidHex(customHex) ? customHex : '#3b82f6'}
            onChange={(e) => setCustomAccent(e.target.value)}
            aria-label="Custom accent color"
          />
        </label>

        {/* hex input */}
        <div className="theme-hex-wrap">
          <span className="theme-hex-hash">#</span>
          <input
            type="text"
            className="theme-hex-input"
            value={(hexInput || '').replace('#', '')}
            maxLength={6}
            placeholder="3b82f6"
            onChange={(e) => setHexInput('#' + e.target.value.replace(/[^0-9a-fA-F]/g, ''))}
            onBlur={() => commitHex(hexInput)}
            onKeyDown={(e) => { if (e.key === 'Enter') commitHex(hexInput); }}
          />
          <button className="theme-hex-apply" onClick={() => commitHex(hexInput)} disabled={!isValidHex(hexInput)}>Apply</button>
        </div>
      </div>
      <div className="theme-custom-hint">Pick from the wheel or type a hex code — it becomes your theme instantly.</div>

      {/* ── Advanced fine-tune ── */}
      <button className={`theme-adv-toggle ${advOpen ? 'open' : ''}`} onClick={() => setAdvOpen((o) => !o)}>
        <Sliders size={13} /> Advanced — dark / light control
        <ChevronDown size={14} className="theme-adv-chev" />
      </button>

      {advOpen && (
        <div className="theme-adv-body">
          <Slider
            label="Brightness"
            hint="darker ← → lighter"
            min={-40} max={40} step={2}
            value={Math.round((customTune?.brightness ?? 0) * 100)}
            onChange={(v) => updateCustomTune({ brightness: v / 100 })}
          />
          <Slider
            label="Shade depth"
            hint="how dark the sidebar & buttons go"
            min={0} max={100} step={2}
            value={Math.round((customTune?.shade ?? 0.5) * 100)}
            onChange={(v) => updateCustomTune({ shade: v / 100 })}
          />
          <Slider
            label="Tint lightness"
            hint="how light the badges & backgrounds are"
            min={0} max={100} step={2}
            value={Math.round((customTune?.tint ?? 0.5) * 100)}
            onChange={(v) => updateCustomTune({ tint: v / 100 })}
          />
          <button className="theme-adv-reset" onClick={resetCustomTune}>
            <RotateCcw size={12} /> Reset to defaults
          </button>
        </div>
      )}
    </div>
  );
}

function Slider({ label, hint, min, max, step, value, onChange }) {
  return (
    <div className="theme-slider">
      <div className="theme-slider-head">
        <span className="theme-slider-label">{label}</span>
        <span className="theme-slider-val">{value}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ accentColor: 'var(--primary)' }}
      />
      <div className="theme-slider-hint">{hint}</div>
    </div>
  );
}
