'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import API from '@/lib/api';
import { Plus, Edit2, Trash2, Bus, MapPin, Clock, Users, Navigation } from 'lucide-react';
import { showSuccess, showError, confirmAction, confirmSave } from '@/lib/alert';
import RouteGuard from '@/components/RouteGuard';
import PlaceAutocomplete from '@/components/PlaceAutocomplete';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/lib/PermissionContext';

// Leaflet map — client-only (no SSR)
const RouteMap = dynamic(() => import('@/components/RouteMap'), { ssr: false, loading: () => <div className="empty-state" style={{ height: 420 }}>Loading map…</div> });

const EMPTY_STOP = { stopName: '', stopTime: '', latitude: '', longitude: '' };
const EMPTY_BUS = { busId: 0, busNumber: '', driverName: '', driverPhone: '', capacity: 40, startLocation: 'School', destination: '', stops: [] };

function TransportInner() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const canCreate = can('Transport', 'canCreate');
  const canEdit = can('Transport', 'canEdit');
  const canDelete = can('Transport', 'canDelete');

  const [routes, setRoutes] = useState([]);
  const [selected, setSelected] = useState(null); // bus for the map

  const load = () => API.get('/transport/routes').then((r) => {
    setRoutes(r.data);
    // prefer keeping current selection; else pick the first bus that actually has stops
    setSelected((prev) =>
      r.data.find((b) => b.busId === prev?.busId)
      || r.data.find((b) => b.stops.length > 0)
      || r.data[0]
      || null);
  }).catch(console.error);
  useEffect(() => { load(); }, []);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">Transport</div>
          <div className="page-subtitle">Bus routes, live map &amp; stops — students are assigned from the Student window</div>
        </div>
      </div>

      <RoutesTab routes={routes} selected={selected} setSelected={setSelected} reload={load} canCreate={canCreate} canEdit={canEdit} canDelete={canDelete} />
    </>
  );
}

// ── ROUTES + MAP ──────────────────────────────────────────────
function RoutesTab({ routes, selected, setSelected, reload, canCreate, canEdit, canDelete }) {
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_BUS);

  const openForm = (bus = null) => {
    if (bus) {
      setForm({
        busId: bus.busId, busNumber: bus.busNumber, driverName: bus.driverName,
        driverPhone: bus.driverPhone || '', capacity: bus.capacity,
        startLocation: bus.startLocation || 'School', destination: bus.destination || '',
        stops: bus.stops.map((s) => ({ stopName: s.stopName, stopTime: s.stopTime || '', latitude: s.latitude, longitude: s.longitude })),
      });
    } else {
      setForm({ ...EMPTY_BUS, stops: [{ ...EMPTY_STOP }] });
    }
    setShowModal(true);
  };

  const setStop = (i, k, v) => setForm((f) => ({ ...f, stops: f.stops.map((s, idx) => (idx === i ? { ...s, [k]: v } : s)) }));
  // set the place name + coordinates together from the autocomplete picker
  const setStopPlace = (i, { name, lat, lon }) => setForm((f) => ({
    ...f,
    stops: f.stops.map((s, idx) => (idx === i ? { ...s, stopName: name, latitude: lat ?? '', longitude: lon ?? '' } : s)),
  }));
  const addStop = () => setForm((f) => ({ ...f, stops: [...f.stops, { ...EMPTY_STOP }] }));
  const removeStop = (i) => setForm((f) => ({ ...f, stops: f.stops.filter((_, idx) => idx !== i) }));

  const save = async () => {
    if (!form.busNumber || !form.driverName) { showError('Bus number and driver are required'); return; }
    const validStops = form.stops.filter((s) => s.stopName && s.latitude && s.longitude);
    if (validStops.length < 2) { showError('Add at least 2 stops — type each place name and pick it from the suggestions so its location is set'); return; }
    if (!(await confirmSave('Save Route?', 'Save this bus route and its stops?'))) return;
    try {
      await API.post('/transport/routes', {
        ...form,
        capacity: Number(form.capacity) || 40,
        stops: validStops.map((s) => ({ stopName: s.stopName, stopTime: s.stopTime, latitude: Number(s.latitude), longitude: Number(s.longitude) })),
      });
      showSuccess('Route saved');
      setShowModal(false);
      reload();
    } catch (err) { showError(err.response?.data?.message || 'Failed'); }
  };

  const del = async (id) => {
    if (!(await confirmAction('Delete Route?', 'Delete this bus route and all assignments?'))) return;
    try { await API.delete(`/transport/routes/${id}`); showSuccess('Deleted'); reload(); }
    catch { showError('Failed'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* ── Route boxes on top (horizontal grid) ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>Bus Routes <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({routes.length})</span></div>
          {canEdit && <button className="btn btn-primary btn-sm" onClick={() => openForm()}><Plus size={15} /> Add Bus Route</button>}
        </div>
        {routes.length === 0 ? (
          <div className="card empty-state" style={{ padding: 24 }}>No bus routes yet.</div>
        ) : (
          <div className="bus-cards">
            {routes.map((b) => {
              const active = selected?.busId === b.busId;
              return (
                <div key={b.busId} className={`bus-card ${active ? 'active' : ''}`} onClick={() => setSelected(b)}>
                  <div className="bus-card-head">
                    <div style={{ display: 'flex', gap: 9, alignItems: 'center', minWidth: 0 }}>
                      <div className="bus-card-icon"><Bus size={18} /></div>
                      <div style={{ minWidth: 0 }}>
                        <div className="bus-card-num">{b.busNumber}</div>
                        <div className="bus-card-driver">{b.driverName} · {b.driverPhone}</div>
                      </div>
                    </div>
                    {(canEdit || canDelete) && (
                      <div style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                        {canEdit && <button className="btn btn-outline btn-sm" onClick={() => openForm(b)}><Edit2 size={12} /></button>}
                        {canDelete && <button className="btn btn-danger btn-sm" onClick={() => del(b.busId)}><Trash2 size={12} /></button>}
                      </div>
                    )}
                  </div>
                  <div className="bus-card-route"><MapPin size={12} /> {b.startLocation} → {b.destination}</div>
                  <div className="bus-card-meta">
                    <span><MapPin size={12} /> {b.stops.length} stops</span>
                    <span><Navigation size={12} /> {b.totalDistanceKm} km</span>
                    <span><Clock size={12} /> ~{b.etaMinutes} min</span>
                    <span><Users size={12} /> {b.assignedCount}/{b.capacity}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Map full-width below ── */}
      <div className="card" style={{ padding: 16 }}>
        {selected ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
              <div style={{ fontWeight: 700, fontSize: 15 }}>{selected.busNumber} — Route Map <span style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: 13 }}>({selected.startLocation} → {selected.destination})</span></div>
              <div style={{ display: 'flex', gap: 10, fontSize: 12, color: 'var(--text-muted)' }}>
                <span>🟢 Start</span><span>🔵 Stops</span><span>🔴 End</span>
              </div>
            </div>
            <RouteMap stops={selected.stops} height={460} />
            {/* Stop timeline — horizontal chips below the map */}
            <div className="bus-stops-row">
              {selected.stops.map((s, i) => (
                <div key={s.stopId} className="bus-stop-chip">
                  <div className="bus-stop-num" style={{ background: i === 0 ? '#16a34a' : i === selected.stops.length - 1 ? '#dc2626' : 'var(--primary)' }}>{i + 1}</div>
                  <div className="bus-stop-info">
                    <div className="bus-stop-name">{s.stopName}</div>
                    {s.stopTime && <div className="bus-stop-time">{s.stopTime}</div>}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : <div className="empty-state" style={{ padding: 40 }}>Select or add a bus route to see the map.</div>}
      </div>

      {/* Route form modal */}
      {showModal && (
        <div className="modal-overlay">
          <div className="modal modal-lg">
            <div className="modal-header"><div className="modal-title">{form.busId ? 'Edit Route' : 'Add Bus Route'}</div><button className="modal-close" onClick={() => setShowModal(false)}>&times;</button></div>
            <div className="modal-body">
              <div className="form-row">
                <div className="form-group"><label className="form-label">Bus Number *</label><input className="form-control" value={form.busNumber} onChange={(e) => setForm((f) => ({ ...f, busNumber: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Driver *</label><input className="form-control" value={form.driverName} onChange={(e) => setForm((f) => ({ ...f, driverName: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Driver Phone</label><input className="form-control" value={form.driverPhone} onChange={(e) => setForm((f) => ({ ...f, driverPhone: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Capacity</label><input type="number" className="form-control" value={form.capacity} onChange={(e) => setForm((f) => ({ ...f, capacity: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Start</label><input className="form-control" value={form.startLocation} onChange={(e) => setForm((f) => ({ ...f, startLocation: e.target.value }))} /></div>
                <div className="form-group"><label className="form-label">Destination</label><input className="form-control" value={form.destination} onChange={(e) => setForm((f) => ({ ...f, destination: e.target.value }))} /></div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10, marginBottom: 4 }}>
                <div className="form-section-title" style={{ margin: 0 }}>📍 Stops (in order) — type a place name &amp; pick from the map suggestions (coordinates fill in automatically)</div>
                <button className="btn btn-outline btn-sm" style={{ flexShrink: 0 }} onClick={addStop}><Plus size={14} /> Add Stop</button>
              </div>
              {form.stops.map((s, i) => (
                <div key={i} className="form-row" style={{ alignItems: 'flex-start', marginBottom: 8 }}>
                  <div className="form-group" style={{ marginBottom: 0, flex: 2 }}>
                    <label className="form-label">Stop {i + 1} — Place</label>
                    <PlaceAutocomplete
                      value={s.stopName}
                      lat={s.latitude}
                      lon={s.longitude}
                      placeholder="e.g. Vijay Nagar, Indore"
                      onSelect={(p) => setStopPlace(i, p)}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}><label className="form-label">Time</label><input className="form-control" value={s.stopTime} onChange={(e) => setStop(i, 'stopTime', e.target.value)} placeholder="07:30" /></div>
                  <div className="form-group" style={{ marginBottom: 0, flex: '0 0 auto', paddingTop: 24 }}><button className="btn btn-danger" onClick={() => removeStop(i)} disabled={form.stops.length <= 1}><Trash2 size={14} /></button></div>
                </div>
              ))}
            </div>
            <div className="modal-footer"><button className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button><button className="btn btn-primary" onClick={save}>💾 Save Route</button></div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TransportPage() {
  return (
    <RouteGuard module="Transport">
      <TransportInner />
    </RouteGuard>
  );
}
