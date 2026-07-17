'use client';

import { useEffect, useRef } from 'react';

// Leaflet-based route map. Loaded dynamically (client-only) to avoid SSR issues.
// Draws ordered stop markers + a route polyline. No API key needed (OpenStreetMap).
export default function RouteMap({ stops = [], height = 420 }) {
  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const layerRef = useRef(null);

  useEffect(() => {
    let L;
    let cancelled = false;

    (async () => {
      L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !containerRef.current) return;

      // init map once
      if (!mapRef.current) {
        mapRef.current = L.map(containerRef.current, { scrollWheelZoom: true, zoomControl: true });
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19,
        }).addTo(mapRef.current);
      }

      // clear previous markers/lines
      if (layerRef.current) mapRef.current.removeLayer(layerRef.current);
      const group = L.layerGroup().addTo(mapRef.current);
      layerRef.current = group;

      const pts = stops
        .filter((s) => s.latitude && s.longitude)
        .map((s) => [s.latitude, s.longitude]);

      if (pts.length === 0) {
        mapRef.current.setView([22.7196, 75.8577], 12); // default (Indore)
        return;
      }

      // route line
      L.polyline(pts, { color: '#2563eb', weight: 5, opacity: 0.75 }).addTo(group);

      // numbered stop markers
      stops.forEach((s, i) => {
        if (!s.latitude || !s.longitude) return;
        const isFirst = i === 0;
        const isLast = i === stops.length - 1;
        const bg = isFirst ? '#16a34a' : isLast ? '#dc2626' : '#2563eb';
        const icon = L.divIcon({
          className: 'route-pin',
          html: `<div style="background:${bg};color:#fff;width:30px;height:30px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 3px 8px rgba(0,0,0,.4);border:2px solid #fff">
                   <span style="transform:rotate(45deg);font-size:12px;font-weight:700">${i + 1}</span>
                 </div>`,
          iconSize: [30, 30],
          iconAnchor: [15, 30],
        });
        L.marker([s.latitude, s.longitude], { icon })
          .addTo(group)
          .bindPopup(`<b>${s.stopName}</b><br/>Stop ${i + 1}${s.stopTime ? ' · ' + s.stopTime : ''}`);
      });

      mapRef.current.fitBounds(pts, { padding: [40, 40], maxZoom: 15 });
    })();

    return () => { cancelled = true; };
  }, [stops]);

  // clean up map on unmount
  useEffect(() => () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } }, []);

  return <div ref={containerRef} style={{ height, width: '100%', borderRadius: 12, overflow: 'hidden', zIndex: 1 }} />;
}
