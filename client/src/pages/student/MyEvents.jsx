import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { Award, Compass, RefreshCw } from "lucide-react";
import { api } from "../../api";
import { PageTitle, Status, Empty, Skeleton } from "../../components/ui";
import { coverFor, bgStyle } from "../../lib/media";

const when = (d) => new Date(d).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
const daysTo = (d) => Math.ceil((new Date(d) - Date.now()) / 864e5);

function Ticket({ r }) {
  const e = r.event;
  const confirmed = r.status === 'Confirmed';
  const n = daysTo(e.startAt);
  return (
    <div className="ticket">
      <div className="tl">
        <Link to={`/event/${e._id}`} className="photo" style={bgStyle(coverFor(e))} aria-label={e.title} />
        <div className="bd">
          <span className="eyebrow">{confirmed ? 'Admit one' : r.status}</span>
          <h3>
            <Link to={`/event/${e._id}`}>{e.title}</Link>
          </h3>
          <span className="muted small">{when(e.startAt)}</span>
          <span className="muted small">{e.venue}</span>
          <div className="row-between" style={{ justifyContent: 'flex-start', marginTop: 4 }}>
            <Status value={r.status} />
            {n >= 0 && <span className="status">{n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `In ${n} days`}</span>}
            {r.status === 'Waitlisted' && r.waitlistPosition && <span className="status">Position #{r.waitlistPosition}</span>}
          </div>
        </div>
      </div>
      <div className="tr">
        {confirmed ? (
          <>
            <div style={{ background: '#fff', padding: 8, borderRadius: 10 }}>
              <QRCodeSVG value={r.ticketCode} size={112} level="M" />
            </div>
            <code>{r.ticketCode}</code>
          </>
        ) : r.status === 'Attended' ? (
          <Link className="btn secondary small" to={`/certificate/${r.ticketCode}`}>
            <Award size={15} /> Certificate
          </Link>
        ) : (
          <span className="muted small">Your QR ticket appears here when a seat is confirmed.</span>
        )}
      </div>
    </div>
  );
}

export function MyEvents() {
  const [items, setItems] = useState(null),
    [error, setError] = useState(''),
    [tab, setTab] = useState('upcoming');
  const load = () => {
    setError('');
    api.get('/tickets/me').then((x) => setItems(x.items)).catch((e) => setError(e.message));
  };
  useEffect(load, []);
  const now = Date.now();
  const groups = {
    upcoming: (items || []).filter((r) => r.status === 'Confirmed' && new Date(r.event.endAt) >= now).sort((a, b) => new Date(a.event.startAt) - new Date(b.event.startAt)),
    waitlist: (items || []).filter((r) => r.status === 'Waitlisted'),
    past: (items || []).filter((r) => ['Attended', 'Not attended'].includes(r.status) || (r.status === 'Confirmed' && new Date(r.event.endAt) < now)),
  };
  const certs = (items || []).filter((r) => r.status === 'Attended').length;
  const list = groups[tab];
  return (
    <>
      <PageTitle
        eyebrow="Your registrations"
        title="My tickets"
        sub={items ? `${groups.upcoming.length} upcoming · ${groups.waitlist.length} waitlisted · ${certs} certificates` : 'Loading your tickets…'}
        action={
          <Link className="btn secondary" to="/">
            <Compass size={16} /> Find events
          </Link>
        }
      />
      <div className="tabs" role="tablist">
        {[['upcoming', 'Upcoming'], ['waitlist', 'Waitlisted'], ['past', 'Past']].map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'selected' : ''} onClick={() => setTab(k)}>
            {label} <span className="muted">{groups[k].length}</span>
          </button>
        ))}
      </div>
      {error ? (
        <div className="empty">
          <h3>Couldn't load your tickets</h3>
          <span>{error}</span>
          <button className="btn secondary small" onClick={load}>
            <RefreshCw size={15} /> Try again
          </button>
        </div>
      ) : !items ? (
        <Skeleton count={2} />
      ) : list.length ? (
        <div className="ticket-list">
          {list.map((r) => (
            <Ticket r={r} key={r._id} />
          ))}
        </div>
      ) : (
        <Empty
          title={tab === 'upcoming' ? 'No upcoming tickets' : tab === 'waitlist' ? 'You are not on any waitlist' : 'No past events yet'}
          text={tab === 'upcoming' ? 'When you register for an event, your QR ticket shows up here.' : 'Events you attend appear here with their certificates.'}
        />
      )}
    </>
  );
}
