import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Mail, ScanLine, Lock, Users, ChartNoAxesCombined, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { coverFor, bgStyle } from "../lib/media";
import { EventCard, Skeleton } from "../components/ui";

const features = [
  [Mail, 'E-mail that actually arrives', 'Confirmations, waitlist promotions, reminders and password resets go to Gmail and university inboxes.'],
  [ScanLine, 'QR tickets at the door', 'Every confirmed seat gets a ticket code. Organizers mark attendance as students walk in.'],
  [Lock, "Seats that can't be overbooked", 'Each registration reserves a seat in one atomic database update, so two students never get the last seat.'],
  [Users, 'A waitlist that runs itself', 'When someone cancels, the next student is promoted and e-mailed automatically.'],
  [ChartNoAxesCombined, 'Reports for every role', 'Registrations, fill rates, attendance and trends, filterable by date and category, with CSV export.'],
  [ShieldCheck, 'Approvals and an audit log', 'Admins approve, reject or request changes with a reason, and every decision is recorded.'],
];
const steps = [
  ['Draft', 'Organizer writes the event up'],
  ['Review', 'Admin approves or asks for changes'],
  ['Published', 'Students see it with live seats'],
  ['Registration', 'Seats reserved, waitlist takes over'],
  ['Check-in', 'Tickets checked at the door'],
  ['Certificate', 'Attendance is on record'],
];

export function Landing() {
  const [data, setData] = useState(null);
  useEffect(() => {
    api.get('/public/events').then(setData).catch(() => setData({ items: [], stats: {} }));
  }, []);
  const items = data?.items || [];
  const fmt = (d) => new Date(d).toLocaleString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });

  return (
    <div>
      <header className="site-nav">
        <div className="wrap">
          <Link to="/" className="brand">
            <span className="brand-mark" />
            UniEvents
          </Link>
          <nav>
            <a href="#whats-on">What's on</a>
            <a href="#features">Features</a>
            <a href="#lifecycle">How it works</a>
          </nav>
          <div className="grow" />
          <Link to="/signin" className="btn glass small">
            Sign in
          </Link>
        </div>
      </header>

      <section className="hero">
        <div className="photo" />
        <div className="wrap">
          <div>
            <span className="glass-pill">
              <span className="live-dot" />
              {data ? `${data.stats?.upcoming ?? 0} events open on campus` : 'Campus events, live'}
            </span>
            <h1 style={{ marginTop: 20 }}>
              Every event.
              <br />
              <em>One university.</em>
            </h1>
            <p className="lede">
              Discover what's happening at Babu Banarasi Das University, register in one click, get your ticket by
              e-mail and walk in. Organizers and admins run the whole thing from the same place.
            </p>
            <div className="cta">
              <Link to="/signin" className="btn gold lg">
                Sign in <ArrowRight size={18} />
              </Link>
              <Link to="/register" className="btn glass lg">
                Create a student account
              </Link>
            </div>
            <div className="facts">
              <div>
                <b>{data?.stats?.upcoming ?? '–'}</b>upcoming events
              </div>
              <div>
                <b>{data?.stats?.seats?.toLocaleString('en-IN') ?? '–'}</b>seats on offer
              </div>
              <div>
                <b>4</b>role-based workspaces
              </div>
            </div>
          </div>
          <div className="hero-list" aria-label="Coming up">
            {items.slice(0, 3).map((e) => (
              <Link to="/signin" key={e._id}>
                <span className="th" style={bgStyle(coverFor(e))} />
                <span>
                  <b>{e.title}</b>
                  <span>
                    {fmt(e.startAt)} · {e.venue}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="whats-on">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow">What's on</span>
              <h2>From the main stage to the cricket ground.</h2>
            </div>
            <p>Every approved event from every department and club, with live seat counts. Sign in to register.</p>
          </div>
          {!data ? (
            <Skeleton count={3} />
          ) : items.length ? (
            <div className="event-grid">
              {items.slice(0, 6).map((e) => (
                <EventCard event={{ ...e, status: 'Approved' }} key={e._id} />
              ))}
            </div>
          ) : (
            <div className="empty">
              <h3>No upcoming events right now</h3>
              <span>New events appear here as soon as an admin approves them.</span>
            </div>
          )}
        </div>
      </section>

      <section className="section alt" id="features">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow">Under the hood</span>
              <h2>Built like a real product.</h2>
            </div>
            <p>Four workspaces, students, faculty organizers, club organizers and administrators, on one platform.</p>
          </div>
          <div className="features">
            {features.map(([Icon, t, d]) => (
              <div className="feat" key={t}>
                <span className="ic">
                  <Icon size={20} />
                </span>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="lifecycle">
        <div className="wrap">
          <div className="sec-head">
            <div>
              <span className="eyebrow">The lifecycle</span>
              <h2>From a proposal to the door.</h2>
            </div>
            <p>Every event follows the same path, and every step is recorded.</p>
          </div>
          <ol className="flow">
            {steps.map(([t, d], i) => (
              <li key={t}>
                <span className="n">{i + 1}</span>
                <b>{t}</b>
                <span>{d}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 0 }}>
        <div className="wrap">
          <div className="cta-band">
            <div>
              <h2>Your next campus event is one click away.</h2>
              <p>Sign in with your university e-mail, or create a student account in under a minute.</p>
            </div>
            <Link to="/signin" className="btn gold lg">
              Sign in <ArrowRight size={18} />
            </Link>
          </div>
        </div>
      </section>
      <footer className="site-foot">
        <div className="wrap">
          <span>UniEvents · Babu Banarasi Das University, Lucknow · B.Tech CSE (AI) major project</span>
          <span>Photos: Unsplash</span>
        </div>
      </footer>
    </div>
  );
}
