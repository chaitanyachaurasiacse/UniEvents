import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Search, MapPin, ChevronRight, RefreshCw } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../lib/auth";
import { PageTitle, EventCard, Empty, Skeleton, SeatNote } from "../../components/ui";
import { coverFor, bgStyle } from "../../lib/media";

const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

export function Discover() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]),
    [featured, setFeatured] = useState([]),
    [cats, setCats] = useState([]),
    [q, setQ] = useState(''),
    [query, setQuery] = useState(''),
    [category, setCategory] = useState(''),
    [busy, setBusy] = useState(true),
    [error, setError] = useState(''),
    [slide, setSlide] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setQuery(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const load = () => {
    setBusy(true);
    setError('');
    api
      .get('/events', { params: { q: query, category, upcoming: 'true', sort: 'date', limit: 50 } })
      .then((x) => setEvents(x.items))
      .catch((e) => setError(e.message))
      .finally(() => setBusy(false));
  };
  useEffect(load, [query, category]);
  useEffect(() => {
    api.get('/events/featured').then((x) => setFeatured(x.items)).catch(() => {});
    api.get('/categories').then((x) => setCats(x.items)).catch(() => {});
  }, []);

  const heroes = featured.length ? featured : events.slice(0, 3);
  useEffect(() => {
    if (heroes.length < 2) return;
    const t = setInterval(() => setSlide((s) => (s + 1) % heroes.length), 6500);
    return () => clearInterval(t);
  }, [heroes.length]);
  const hero = heroes[slide % (heroes.length || 1)];
  const thisWeek = events.filter((e) => new Date(e.startAt) - Date.now() < 7 * 864e5).length;

  return (
    <>
      <PageTitle
        eyebrow={`${greet()}, ${user.name.split(' ')[0]}`}
        title="What's on at campus"
        sub={busy ? 'Loading events…' : `${events.length} upcoming events · ${thisWeek} this week`}
      />
      {hero && !query && !category && (
        <Link to={`/event/${hero._id}`} className="hero-event">
          <div className="photo" style={bgStyle(coverFor(hero))} />
          <div>
            <span className="eyebrow">Featured · {hero.category?.name || 'Campus event'}</span>
            <h2>{hero.title}</h2>
            <p>{hero.summary}</p>
            <div className="hero-meta">
              <span>
                <CalendarDays size={15} />
                {new Date(hero.startAt).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}
              </span>
              <span>
                <MapPin size={15} />
                {hero.venue}
              </span>
              <SeatNote event={hero} />
            </div>
            <span className="btn gold">
              View event <ChevronRight size={16} />
            </span>
          </div>
        </Link>
      )}
      <div className="search-row">
        <div className="search-box">
          <Search size={18} />
          <input placeholder="Search by title, venue or topic" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search events" />
        </div>
      </div>
      <div className="chips" role="group" aria-label="Filter by category">
        <button className={`chip ${category === '' ? 'on' : ''}`} onClick={() => setCategory('')}>
          All
        </button>
        {cats.map((c) => (
          <button key={c._id} className={`chip ${category === c._id ? 'on' : ''}`} onClick={() => setCategory(c._id)}>
            {c.name}
          </button>
        ))}
      </div>
      {error ? (
        <div className="empty">
          <h3>Couldn't load events</h3>
          <span>{error}</span>
          <button className="btn secondary small" onClick={load}>
            <RefreshCw size={15} /> Try again
          </button>
        </div>
      ) : busy ? (
        <Skeleton count={6} />
      ) : events.length ? (
        <div className="event-grid">
          {events.map((e) => (
            <EventCard event={e} key={e._id} />
          ))}
        </div>
      ) : (
        <Empty
          title={query || category ? 'No events match your filters' : 'No upcoming events yet'}
          text={query || category ? 'Try another search or clear the category filter.' : 'Check back soon for new campus events.'}
        />
      )}
    </>
  );
}
