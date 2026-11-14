import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Users, MapPin } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../lib/auth";
import { date, datetime } from "../lib/format";
import { Status, useParamsSafe, SeatNote, seats } from "../components/ui";
import { coverFor, bgStyle } from "../lib/media";

export function EventDetail() {
  const { user } = useAuth(),
    { id } = useParamsSafe(),
    [event, setEvent] = useState(null),
    [registration, setRegistration] = useState(null),
    [error, setError] = useState(''),
    [loadError, setLoadError] = useState(''),
    [busy, setBusy] = useState(false);
  const load = () =>
    api
      .get(`/events/${id}`)
      .then((x) => {
        setEvent(x.event);
        setRegistration(x.registration);
      })
      .catch((e) => setLoadError(e.message));
  useEffect(() => {
    load();
  }, [id]);
  if (loadError)
    return (
      <>
        <Link to="/" className="back-link">
          ← Back
        </Link>
        <div className="alert error">{loadError}</div>
      </>
    );
  if (!event) return <div className="loading" style={{ minHeight: 420 }} aria-label="Loading event" />;
  const act = async () => {
    setBusy(true);
    setError('');
    try {
      if (registration) await api.delete(`/events/${id}/register`);
      else {
        const x = await api.post(`/events/${id}/register`);
        setRegistration(x.registration);
      }
      load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };
  const full = event.registeredCount >= event.capacity,
    isStudent = user.role === 'student',
    canWait = full && event.waitlistEnabled;
  return (
    <>
      <Link to="/" className="back-link">
        ← Back to discover
      </Link>
      <div className="detail-layout">
        <div>
          <div className="detail-cover">
            <div className="photo" style={bgStyle(coverFor(event))} />
            <span className="category-pill">{event.category?.name || 'Campus event'}</span>
          </div>
          <div className="detail-main">
            <Status value={event.status} />
            <h1>{event.title}</h1>
            <p className="lead">{event.summary}</p>
            <h3>About this event</h3>
            <p className="description">{event.description}</p>
            <div className="detail-facts">
              <div>
                <CalendarDays />
                <span>
                  <b>Date and time</b>
                  {datetime(event.startAt)} – {datetime(event.endAt)}
                </span>
              </div>
              <div>
                <MapPin />
                <span>
                  <b>Venue</b>
                  {event.venue}
                </span>
              </div>
              <div>
                <Users />
                <span>
                  <b>Organizer</b>
                  {event.organizer?.name || 'University'}
                </span>
              </div>
            </div>
          </div>
        </div>
        <aside className="register-card">
          <span className="eyebrow">REGISTRATION</span>
          <h2>
            {event.registeredCount} <small>/ {event.capacity}</small>
          </h2>
          <p className="muted">Seats registered</p>
          <div className={`capacity large ${seats(event).state === 'hot' ? 'hot' : ''}`}>
            <i style={{ width: `${seats(event).pct}%` }} />
          </div>
          <SeatNote event={event} />
          <div className="fact-line">
            <span>Registration deadline</span>
            <b>{date(event.registrationDeadline)}</b>
          </div>
          {!isStudent ? (
            <Link className="btn secondary full" to={`/manage/${event._id}`}>
              Manage this event
            </Link>
          ) : registration ? (
            <>
              <Status value={registration.status} />
              <button className="btn danger full" onClick={act} disabled={busy}>
                {registration.status === 'Waitlisted' ? 'Leave waitlist' : 'Cancel registration'}
              </button>
            </>
          ) : (
            <button
              className="btn primary full"
              onClick={act}
              disabled={
                busy || (full && !event.waitlistEnabled) || !['Approved', 'Ongoing'].includes(event.status)
              }
            >
              {busy ? 'Please wait' : canWait ? 'Join waitlist' : full ? 'Registration full' : 'Register now'}
            </button>
          )}
          <small className="muted">Registration is subject to eligibility and availability.</small>
          {error && <div className="alert error">{error}</div>}
        </aside>
      </div>
    </>
  );
}
