import React, { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { api } from "../../api";
import { date, toLocal } from "../../lib/format";
import { PageTitle } from "../../components/ui";
import { STOCK_COVERS, bgStyle } from "../../lib/media";

export function EventForm() {
  const nav = useNavigate(),
    loc = useLocation(),
    id = loc.pathname.startsWith('/edit/') ? loc.pathname.split('/').pop() : null;
  const [cats, setCats] = useState([]),
    [form, setForm] = useState({
      title: '',
      summary: '',
      description: '',
      category: '',
      venue: '',
      startAt: '',
      endAt: '',
      registrationDeadline: '',
      capacity: 100,
      waitlistEnabled: true,
      imageUrl: '',
    }),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    api
      .get('/categories')
      .then((x) => {
        setCats(x.items);
        if (!id && x.items[0]) setForm((f) => (f.category ? f : { ...f, category: x.items[0]._id }));
      })
      .catch((e) => setError(e.message));
    if (id)
      api
        .get(`/events/${id}`)
        .then((x) =>
          setForm({
            ...x.event,
            category: x.event.category?._id || x.event.category,
            club: x.event.club?._id || x.event.club || undefined,
            startAt: toLocal(x.event.startAt),
            endAt: toLocal(x.event.endAt),
            registrationDeadline: toLocal(x.event.registrationDeadline),
          }),
        )
        .catch((e) => setError(e.message));
  }, [id]);
  const change = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));
  const save = async (submit) => {
    setError('');
    const need = [
      'title',
      'summary',
      'description',
      'category',
      'venue',
      'startAt',
      'endAt',
      'registrationDeadline',
    ];
    if (need.some((k) => !form[k])) return setError('Please fill in all fields marked with *.');
    const iso = (v) => (v ? new Date(v).toISOString() : undefined);
    const st = new Date(form.startAt),
      en = new Date(form.endAt),
      dl = new Date(form.registrationDeadline);
    if (en <= st) return setError('The end time must be after the start time.');
    if (dl > st) return setError('The registration deadline must be on or before the start time.');
    setBusy(true);
    try {
      const payload = {
        ...form,
        startAt: iso(form.startAt),
        endAt: iso(form.endAt),
        registrationDeadline: iso(form.registrationDeadline),
        capacity: Number(form.capacity),
      };
      let x;
      if (id) x = await api.put(`/events/${id}`, payload);
      else x = await api.post('/events', payload);
      if (submit && (!id || ['Draft', 'Changes Requested', 'Rejected'].includes(form.status)))
        await api.post(`/events/${x.event._id}/submit`);
      nav('/my-events');
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="EVENT MANAGEMENT"
        title={id ? 'Edit event' : 'Create a new event'}
        sub="Add the event information and submit it for administrative review."
      />
      <form
        className="form-card"
        onSubmit={(e) => {
          e.preventDefault();
          save(false);
        }}
      >
        <div className="form-grid">
          <label>
            Event title *<input name="title" value={form.title} onChange={change} required maxLength="120" />
          </label>
          <label>
            Category *
            <select name="category" value={form.category} onChange={change} required>
              {cats.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="span2">
            Short summary *
            <input name="summary" value={form.summary} onChange={change} required maxLength="240" />
          </label>
          <label className="span2">
            Description *
            <textarea
              name="description"
              value={form.description}
              onChange={change}
              rows="5"
              required
              maxLength="5000"
            />
          </label>
          <label>
            Venue *<input name="venue" value={form.venue} onChange={change} required />
          </label>
          <label>
            Capacity *
            <input name="capacity" type="number" min="1" value={form.capacity} onChange={change} required />
          </label>
          <label>
            Start date and time *
            <input name="startAt" type="datetime-local" value={form.startAt} onChange={change} required />
          </label>
          <label>
            End date and time *
            <input name="endAt" type="datetime-local" value={form.endAt} onChange={change} required />
          </label>
          <label>
            Registration deadline *
            <input
              name="registrationDeadline"
              type="datetime-local"
              value={form.registrationDeadline}
              onChange={change}
              required
            />
          </label>
          <label className="check-label">
            <input
              type="checkbox"
              checked={!!form.waitlistEnabled}
              onChange={(e) => setForm((f) => ({ ...f, waitlistEnabled: e.target.checked }))}
            />{' '}
            Enable a waitlist when the event is full
          </label>
          <div className="span2 field-group">
            <span className="field-label">Cover photo</span>
            <div className="cover-picker" role="radiogroup" aria-label="Cover photo">
              <button type="button" role="radio" aria-checked={!form.imageUrl} className={`cover-auto ${!form.imageUrl ? 'on' : ''}`} onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}>
                Automatic
              </button>
              {STOCK_COVERS.map((u) => (
                <button type="button" role="radio" aria-checked={form.imageUrl === u} aria-label={`Cover ${u.split('/').pop()}`} key={u} className={form.imageUrl === u ? 'on' : ''} style={bgStyle(u)} onClick={() => setForm((f) => ({ ...f, imageUrl: u }))} />
              ))}
            </div>
            <small className="muted">Automatic picks a photo that matches the category.</small>
          </div>
        </div>
        {form.status === 'Changes Requested' && form.reviewComment && (
          <div className="alert error">Changes requested by the administrator: {form.reviewComment}</div>
        )}
        {form.status === 'Rejected' && form.rejectionReason && (
          <div className="alert error">Rejected: {form.rejectionReason}</div>
        )}
        {error && <div className="alert error">{error}</div>}
        <div className="form-actions">
          <button type="button" className="btn secondary" disabled={busy} onClick={() => save(false)}>
            Save draft
          </button>
          <button type="button" className="btn primary" disabled={busy} onClick={() => save(true)}>
            Submit for approval
          </button>
        </div>
      </form>
    </>
  );
}
