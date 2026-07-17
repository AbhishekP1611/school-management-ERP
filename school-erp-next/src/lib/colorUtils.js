// Derive a full accent palette (primary / primary-dark / primary-light / sidebar-bg)
// from a single hex color the user picks — so a custom accent behaves like a built-in one,
// in both light and dark mode.

function clamp(n) { return Math.max(0, Math.min(255, Math.round(n))); }

function hexToRgb(hex) {
  let h = hex.replace('#', '').trim();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => clamp(v).toString(16).padStart(2, '0')).join('');
}

// Mix a color toward white (amount 0..1) — for light tints.
function lighten(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
}

// Mix a color toward black (amount 0..1) — for dark shades.
function darken(hex, amt) {
  const { r, g, b } = hexToRgb(hex);
  return rgbToHex(r * (1 - amt), g * (1 - amt), b * (1 - amt));
}

// Perceived luminance 0..1 (for readable-on-color decisions if ever needed).
export function luminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

// Advanced fine-tune knobs (all optional, 0..1 unless noted):
//   brightness  −0.4..+0.4  → shift the BASE color darker(−)/lighter(+) before deriving
//   shade        0..1       → how DARK the sidebar / dark-button shade is
//   tint         0..1       → how LIGHT the badge/background tint is
export const DEFAULT_TUNE = { brightness: 0, shade: 0.5, tint: 0.5 };

function shiftBrightness(hex, b) {
  if (!b) return hex;
  return b > 0 ? lighten(hex, b) : darken(hex, -b);
}

// Returns { primary, primaryDark, primaryLight, sidebarBg } for a mode ('light'|'dark').
// `tune` lets the user dial the darkness/lightness beyond the sensible defaults.
export function derivePalette(hex, mode, tune = DEFAULT_TUNE) {
  const t = { ...DEFAULT_TUNE, ...(tune || {}) };
  const base = shiftBrightness(hex, t.brightness);

  // Map the 0..1 knobs onto usable ranges (so the middle == the old defaults).
  // shade 0.5 → ~0.55 sidebar darken (light) ; tint 0.5 → ~0.86 lighten (light)
  const sidebarDark = 0.30 + t.shade * 0.55;        // 0.30 … 0.85
  const darkBtn     = 0.10 + t.shade * 0.28;        // 0.10 … 0.38
  const lightTint   = 0.70 + t.tint * 0.28;         // 0.70 … 0.98 (light mode)
  const darkTint    = 0.45 + (1 - t.tint) * 0.35;   // deeper panel when tint is low (dark mode)

  if (mode === 'dark') {
    return {
      primary:      lighten(base, 0.12),
      primaryDark:  base,
      primaryLight: darken(base, darkTint),
      sidebarBg:    darken(base, Math.min(0.9, sidebarDark + 0.15)),
    };
  }
  return {
    primary:      base,
    primaryDark:  darken(base, darkBtn),
    primaryLight: lighten(base, lightTint),
    sidebarBg:    darken(base, sidebarDark),
  };
}

// Apply a derived custom palette directly onto <html> via inline CSS vars.
// Setting them inline wins over the [data-accent] stylesheet rules.
export function applyCustomAccent(hex, mode, tune = DEFAULT_TUNE) {
  const p = derivePalette(hex, mode, tune);
  const root = document.documentElement;
  root.style.setProperty('--primary', p.primary);
  root.style.setProperty('--primary-dark', p.primaryDark);
  root.style.setProperty('--primary-light', p.primaryLight);
  root.style.setProperty('--sidebar-bg', p.sidebarBg);
}

// Remove the inline overrides so a built-in [data-accent] palette takes over again.
export function clearCustomAccent() {
  const root = document.documentElement;
  ['--primary', '--primary-dark', '--primary-light', '--sidebar-bg'].forEach((v) => root.style.removeProperty(v));
}

export const isValidHex = (v) => /^#?[0-9a-fA-F]{6}$/.test((v || '').trim());
export const normalizeHex = (v) => {
  let h = (v || '').trim();
  if (!h.startsWith('#')) h = '#' + h;
  return h.toLowerCase();
};
