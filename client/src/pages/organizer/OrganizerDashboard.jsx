import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Users, Plus, Clock, CheckCircle2 } from "lucide-react";
import { api } from "../../api";
import { OverviewCharts } from "../../components/Charts";
import { PageTitle, Stat, EventTable } from "../../components/ui";

export function OrganizerDashboard() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api
      .get('/events/mine')
      .then((x) => setItems(x.items))
      .catch(() => {});
  }, []);
  const pending = items.filter((e) => e.status === 'Pending').length;
  return (
    <>
      <PageTitle
        eyebrow="EVENT MANAGEMENT"
        title="Overview"
        sub="Manage your events and keep track of participation."
        action={
          <Link className="btn primary" to="/create">
            <Plus size={16} /> Create event
          </Link>
        }
      />
      <div className="stats-grid">
        <Stat label="Total events" value={items.length} icon={CalendarDays} />
        <Stat label="Pending review" value={pending} icon={Clock} />
        <Stat label="Registrations" value={items.reduce((a, e) => a + e.registeredCount, 0)} icon={Users} />
        <Stat
          label="Completed"
          value={items.filter((e) => e.status === 'Completed').length}
          icon={CheckCircle2}
        />
      </div>
      <OverviewCharts />
      <div className="section-head">
        <div>
          <h2>Recent events</h2>
          <p>Your latest event submissions.</p>
        </div>
        <Link to="/my-events" className="text-btn">
          View all
        </Link>
      </div>
      <div className="table-card">
        <EventTable items={items.slice(0, 8)} manage />
      </div>
    </>
  );
}
export function OrganizerEvents() {
  const [items, setItems] = useState([]);
  const load = () => api.get('/events/mine').then((x) => setItems(x.items));
  useEffect(() => {
    load();
  }, []);
  return (
    <>
      <PageTitle
        eyebrow="EVENT MANAGEMENT"
        title="My Events"
        sub="Drafts, submissions and published events."
        action={
          <Link className="btn primary" to="/create">
            <Plus size={16} /> Create event
          </Link>
        }
      />
      <div className="table-card">
        <EventTable items={items} manage />
      </div>
    </>
  );
}
