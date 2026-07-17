'use client';

import { useState, useEffect, useRef } from 'react';
import { MapPin, Loader2, Check } from 'lucide-react';

// Free place search using OpenStreetMap Nominatim (no API key — same source as our map tiles).
// User types a place name → gets suggestions → picks one → we hand back { name, lat, lon }.
// Search is biased around Indore so local stops rank first.
const INDORE_VIEWBOX = '75.65,22.85,76.05,22.55'; // left,top,right,bottom (lon/lat) around Indore

export default function PlaceAutocomplete({ value, lat, lon, onSelect, placeholder }) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(-1);
  const boxRef = useRef(null);
  const skipNextSearch = useRef(false);

  // keep the field in sync when the parent changes the value (e.g. editing an existing route)
  useEffect(() => { setQuery(value || ''); }, [value]);

  // debounce the search
  useEffect(() => {
    if (skipNextSearch.current) { skipNextSearch.current = false; return; }
    const q = query.trim();
    if (q.length < 3) { setResults([]); setOpen(false); return; }
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=6`
          + `&countrycodes=in&viewbox=${INDORE_VIEWBOX}&bounded=0&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
        const data = await res.json();
        setResults(Array.isArray(data) ? data : []);
        setOpen(true);
        setActive(-1);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 350);
    return () => clearTimeout(t);
  }, [query]);

  // close on outside click
  useEffect(() => {
    const onDoc = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const shortLabel = (r) => {
    // prefer a concise name: the main place + city/suburb
    const a = r.address || {};
    const primary = a.road || a.suburb || a.neighbourhood || a.hamlet || a.village || r.name || (r.display_name || '').split(',')[0];
    const city = a.city || a.town || a.county || '';
    return city && !primary.includes(city) ? `${primary}, ${city}` : primary;
  };

  const pick = (r) => {
    const label = shortLabel(r);
    skipNextSearch.current = true;      // don't re-search right after a pick
    setQuery(label);
    setOpen(false);
    setResults([]);
    onSelect({ name: label, lat: Number(r.lat), lon: Number(r.lon) });
  };

  const onKeyDown = (e) => {
    if (!open || results.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); pick(results[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  const hasCoords = lat && lon;

  return (
    <div ref={boxRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative' }}>
        <input
          className="form-control"
          value={query}
          placeholder={placeholder || 'Search a place…'}
          onChange={(e) => { setQuery(e.target.value); onSelect({ name: e.target.value, lat: null, lon: null, typing: true }); }}
          onFocus={() => { if (results.length) setOpen(true); }}
          onKeyDown={onKeyDown}
          style={{ paddingRight: 30 }}
          autoComplete="off"
        />
        <span style={{ position: 'absolute', right: 9, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', display: 'flex' }}>
          {loading ? <Loader2 size={14} className="spin" style={{ color: 'var(--text-muted)' }} />
            : hasCoords ? <Check size={14} style={{ color: '#16a34a' }} />
            : <MapPin size={14} style={{ color: 'var(--text-muted)' }} />}
        </span>
      </div>

      {hasCoords && (
        <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 }}>
          <MapPin size={10} /> {Number(lat).toFixed(5)}, {Number(lon).toFixed(5)}
        </div>
      )}

      {open && results.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 3000,
          background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
          boxShadow: '0 10px 30px rgba(0,0,0,.18)', overflow: 'hidden', maxHeight: 260, overflowY: 'auto',
        }}>
          {results.map((r, i) => (
            <div key={r.place_id}
              onMouseDown={(e) => { e.preventDefault(); pick(r); }}
              onMouseEnter={() => setActive(i)}
              style={{
                padding: '9px 11px', cursor: 'pointer', display: 'flex', gap: 8, alignItems: 'flex-start',
                background: active === i ? 'var(--bg-hover, rgba(37,99,235,.08))' : 'transparent',
                borderBottom: i < results.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
              <MapPin size={13} style={{ color: 'var(--primary)', marginTop: 3, flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.35, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{shortLabel(r)}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.35, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.display_name}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
