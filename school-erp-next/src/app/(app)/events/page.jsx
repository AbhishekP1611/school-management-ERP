'use client';

import { useState, useEffect } from 'react';
import API from '@/lib/api';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import { showSuccess, showError, confirmAction, confirmSave } from '@/lib/alert';
import { runValidation, required } from '@/lib/validate';
import DataGrid from '@/components/DataGrid';
import { useAuth } from '@/lib/AuthContext';
import { usePermissions } from '@/lib/PermissionContext';

const EMPTY = {
  eventTitle: '', description: '', eventDate: '', endDate: '', venue: '', eventType: '', isPublished: true,
};

export default function EventsPage() {
  const { user } = useAuth();
  const { can } = usePermissions();
  const canManage = can('Events', 'canCreate') || can('Events', 'canEdit');
  const canDelete = can('Events', 'canDelete');

  const [events, setEvents] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [formData, setFormData] = useState(EMPTY);
  const [errors, setErrors] = useState({});

  const set = (field, val) => {
    setFormData((f) => ({ ...f, [field]: val }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const loadData = () => {
    API.get('/events').then((res) => setEvents(res.data)).catch(console.error);
  };
  useEffect(() => { loadData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = runValidation(formData, {
      eventTitle: [required('Event title is required')],
      eventDate: [required('Start date is required')],
    });
    if (Object.keys(errs).length) { setErrors(errs); return; }
    if (!(await confirmSave('Save Event?', 'Do you want to save this event?'))) return;
    try {
      if (editId) {
        await API.put(`/events/${editId}`, formData);
        showSuccess('Event updated');
      } else {
        await API.post('/events', formData);
        showSuccess('Event added');
      }
      setShowModal(false);
      loadData();
    } catch (err) {
      showError(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (!(await confirmAction('Delete Event?', 'Are you sure you want to delete this event?'))) return;
    try {
      await API.delete(`/events/${id}`);
      showSuccess('Event deleted');
      loadData();
    } catch {
      showError('Failed to delete');
    }
  };

  const openForm = (ev = null) => {
    setErrors({});
    if (ev) {
      setEditId(ev.eventId);
      setFormData({ ...EMPTY, ...ev, description: ev.description || '', venue: ev.venue || '', endDate: ev.endDate || '' });
    } else {
      setEditId(null);
      setFormData(EMPTY);
    }
    setShowModal(true);
  };

  const columns = [
    { key: 'eventTitle', label: 'Event Title', render: (ev) => <span style={{ fontWeight: 600 }}>{ev.eventTitle}</span> },
    { key: 'eventType', label: 'Type', value: (ev) => ev.eventType || 'General', render: (ev) => <span className="badge badge-info">{ev.eventType || 'General'}</span> },
    { key: 'eventDate', label: 'Date', value: (ev) => `${ev.eventDate}${ev.endDate ? ' to ' + ev.endDate : ''}`, render: (ev) => `${ev.eventDate}${ev.endDate ? ` to ${ev.endDate}` : ''}` },
    { key: 'venue', label: 'Venue', value: (ev) => ev.venue || '', render: (ev) => ev.venue || '-' },
  ];

  return (
    <>
      <DataGrid
        title="School Events"
        subtitle="Calendar and notices"
        columns={columns}
        rows={events}
        rowKey={(ev) => ev.eventId}
        exportName="Events"
        emptyText="No events found."
        toolbar={
          canManage ? (
            <button className="btn btn-primary" onClick={() => openForm()}>
              <Plus size={16} /> Add Event
            </button>
          ) : null
        }
        actions={(canManage || canDelete) ? (ev) => (
          <div style={{ display: 'flex', gap: '8px' }}>
            {canManage && <button className="btn btn-outline btn-sm" onClick={() => openForm(ev)}><Edit2 size={14} /></button>}
            {canDelete && <button className="btn btn-danger btn-sm" onClick={() => handleDelete(ev.eventId)}><Trash2 size={14} /></button>}
          </div>
        ) : undefined}
      />

      {showModal && (
        <div className="modal-overlay">
          <div className="modal modal-sm">
            <div className="modal-header">
              <div className="modal-title">{editId ? 'Edit Event' : 'Add New Event'}</div>
              <button className="modal-close" onClick={() => setShowModal(false)}>&times;</button>
            </div>
            <form onSubmit={handleSubmit} noValidate>
              <div className="modal-body">
                <div className="form-group">
                  <label className="form-label">Event Title *</label>
                  <input className={`form-control ${errors.eventTitle ? 'input-error' : ''}`} value={formData.eventTitle} onChange={(e) => set('eventTitle', e.target.value)} />
                  {errors.eventTitle && <span className="field-error">{errors.eventTitle}</span>}
                </div>
                <div className="form-group">
                  <label className="form-label">Event Type</label>
                  <select className="form-control" value={formData.eventType} onChange={(e) => set('eventType', e.target.value)}>
                    <option value="">General</option><option>Sports</option><option>Cultural</option><option>Holiday</option><option>Exam</option>
                  </select>
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">Start Date *</label>
                    <input type="date" className={`form-control ${errors.eventDate ? 'input-error' : ''}`} value={formData.eventDate} onChange={(e) => set('eventDate', e.target.value)} />
                    {errors.eventDate && <span className="field-error">{errors.eventDate}</span>}
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label className="form-label">End Date</label>
                    <input type="date" className="form-control" value={formData.endDate || ''} onChange={(e) => set('endDate', e.target.value)} />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Venue</label>
                  <input className="form-control" value={formData.venue || ''} onChange={(e) => set('venue', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Description</label>
                  <textarea className="form-control" value={formData.description || ''} onChange={(e) => set('description', e.target.value)} rows="3" />
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">Save Event</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
