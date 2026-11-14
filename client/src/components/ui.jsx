import React, { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { CalendarDays, Users, MapPin } from "lucide-react";
import { date } from "../lib/format";
import { coverFor, bgStyle } from "../lib/media";

export function seats(e) {
  const cap = e?.capacity || 1, reg = e?.registeredCount || 0, left = Math.max(0, cap - reg);
  const state = left === 0 ? 'full' : left / cap <= 0.12 ? 'hot' : '';
  return { left, pct: Math.min(100, Math.round((reg / cap) * 100)), state };
}
export function SeatNote({ event }) {
  const s = seats(event);
  return (
    <span className={`seat-note ${s.state}`}>
      {s.state === 'full' ? (event.waitlistEnabled ? 'Full · waitlist open' : 'Full') : s.state === 'hot' ? `Only ${s.left} seats left` : `${s.left} seats left`}
    </span>
  );
}
export function DateChip({ d }) {
  const x = new Date(d);
  return (
    <div className="datechip">
      <small>{x.toLocaleDateString('en-IN', { month: 'short' })}</small>
      <b>{x.getDate()}</b>
    </div>
  );
}
export function Skeleton({ count = 6 }) {
  return (
    <div className="skeleton-grid" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => <div className="loading" key={i} />)}
    </div>
  );
}

export function PageTitle({ eyebrow, title, sub, action }) {
  return (
    <div className="page-title">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {action}
    </div>
  );
}
export function Stat({ label, value, icon: Icon, detail }) {
  return (
    <div className="stat-card">
      <div className="stat-top">
        <span>{label}</span>
        <span className="stat-icon">
          <Icon size={18} />
        </span>
      </div>
      <strong>{value ?? '—'}</strong>
      {detail && <small>{detail}</small>}
    </div>
  );
}
export function Status({ value }) {
  const c = (value || '').toLowerCase().replaceAll(' ', '-');
  return <span className={`status ${c}`}>{value}</span>;
}
export function EventCard({ event }) {
  return (
    <Link to={`/event/${event._id}`} className="event-card">
      <div className="event-cover">
        <div className="photo" style={bgStyle(coverFor(event))} />
        <span className="category-pill">{event.category?.name || 'Campus event'}</span>
        <DateChip d={event.startAt} />
      </div>
      <div className="event-card-body">
        <div className="row-between">
          <span className="muted tiny">
            {new Date(event.startAt).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
          </span>
          {!['Approved', 'Ongoing'].includes(event.status) && <Status value={event.status} />}
        </div>
        <h3>{event.title}</h3>
        <p>{event.summary}</p>
        <div className="event-meta">
          <span>
            <MapPin size={14} />
            {event.venue}
          </span>
          <SeatNote event={event} />
        </div>
        <div className={`capacity ${seats(event).state === 'hot' ? 'hot' : ''}`}>
          <i style={{ width: `${seats(event).pct}%` }} />
        </div>
      </div>
    </Link>
  );
}
export function useParamsSafe() {
  return useParams();
}
export function EventTable({ items, manage = false }) {
  return (
    <table>
      <thead>
        <tr>
          <th>Event</th>
          <th>Date</th>
          <th>Registrations</th>
          <th>Status</th>
          {manage && <th>Actions</th>}
        </tr>
      </thead>
      <tbody>
        {items.map((e) => (
          <tr key={e._id}>
            <td>
              <Link to={`/event/${e._id}`}>
                <b>{e.title}</b>
              </Link>
              <small className="block muted">{e.category?.name}</small>
            </td>
            <td>{date(e.startAt)}</td>
            <td>
              {e.registeredCount}/{e.capacity}
            </td>
            <td>
              <Status value={e.status} />
            </td>
            {manage && (
              <td>
                <Link className="text-btn" to={`/manage/${e._id}`}>
                  Manage
                </Link>{' '}
                ·{' '}
                <Link className="text-btn" to={`/edit/${e._id}`}>
                  Edit
                </Link>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
export function Empty({ title, text }) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <CalendarDays size={24} />
      </div>
      <h3>{title}</h3>
      <p>{text}</p>
    </div>
  );
}
export function AskModal({ title, label, min = 1, confirmText = 'Submit', onSubmit, onClose }) {
  const [v, setV] = useState(''),
    [err, setErr] = useState(''),
    [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault();
    if (v.trim().length < min) return setErr(`Please enter at least ${min} characters.`);
    setBusy(true);
    try {
      await onSubmit(v.trim());
      onClose();
    } catch (x) {
      setErr(x.message);
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={go}>
        <h3>{title}</h3>
        <label>
          {label}
          <textarea rows="4" value={v} onChange={(e) => setV(e.target.value)} autoFocus />
        </label>
        {err && <div className="alert error">{err}</div>}
        <div className="form-actions">
          <button type="button" className="btn secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn primary" disabled={busy}>
            {busy ? 'Please wait…' : confirmText}
          </button>
        </div>
      </form>
    </div>
  );
}


export function NotFound() {
  return (
    <div className="empty" style={{ padding: "70px 20px" }}>
      <span className="empty-icon" style={{ fontFamily: "var(--display)", fontWeight: 700 }}>404</span>
      <h3>This page doesn't exist</h3>
      <span>The link may be old, or the page may have moved.</span>
      <Link className="btn primary small" to="/">Go to your home page</Link>
    </div>
  );
}
