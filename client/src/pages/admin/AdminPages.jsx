import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, ClipboardList, Users, Plus, Clock, MapPin } from "lucide-react";
import { api } from "../../api";
import { roles, date, datetime } from "../../lib/format";
import { OverviewCharts } from "../../components/Charts";
import { PageTitle, Stat, Status, EventTable, Empty, AskModal } from "../../components/ui";

export function AdminDashboard() {
  const [stats, setStats] = useState({}),
    [recent, setRecent] = useState([]);
  useEffect(() => {
    api.get('/admin/overview').then((x) => {
      setStats(x.stats);
      setRecent(x.recent);
    });
  }, []);
  return (
    <>
      <PageTitle
        eyebrow="UNIVERSITY OVERVIEW"
        title="Administration"
        sub="Monitor campus events, registrations and approval activity."
      />
      <div className="stats-grid">
        <Stat label="Active users" value={stats.users} icon={Users} />
        <Stat label="Total events" value={stats.events} icon={CalendarDays} />
        <Stat label="Pending approvals" value={stats.pending} icon={Clock} />
        <Stat label="Registrations" value={stats.registrations} icon={ClipboardList} />
      </div>
      <OverviewCharts />
      <div className="section-head">
        <div>
          <h2>Recent activity</h2>
          <p>Latest events across the university.</p>
        </div>
        <Link to="/all-events" className="text-btn">
          All events
        </Link>
      </div>
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>Organizer</th>
              <th>Created</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((e) => (
              <tr key={e._id}>
                <td>
                  <b>{e.title}</b>
                </td>
                <td>{e.organizer?.name}</td>
                <td>{date(e.createdAt)}</td>
                <td>
                  <Status value={e.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
export function AdminEvents() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api
      .get('/events', { params: { scope: 'all', limit: 50 } })
      .then((x) => setItems(x.items))
      .catch(() => {});
  }, []);
  return (
    <>
      <PageTitle eyebrow="EVENT DIRECTORY" title="All Events" sub="University-wide event directory." />
      <div className="table-card">
        <EventTable items={items} />
      </div>
    </>
  );
}
export function Pending() {
  const [items, setItems] = useState([]),
    [error, setError] = useState(''),
    [ask, setAsk] = useState(null);
  const load = () =>
    api
      .get('/events/pending')
      .then((x) => setItems(x.items))
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  const approve = async (id) => {
    try {
      await api.put(`/events/${id}/approve`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="REVIEW QUEUE"
        title="Pending Approvals"
        sub="Review submissions before they become visible to students."
      />
      {ask && (
        <AskModal
          title={ask.action === 'reject' ? 'Reject event' : 'Request changes'}
          label={
            ask.action === 'reject'
              ? 'Reason for rejection (minimum 20 characters)'
              : 'Requested changes (minimum 10 characters)'
          }
          min={ask.action === 'reject' ? 20 : 10}
          confirmText={ask.action === 'reject' ? 'Reject event' : 'Send request'}
          onSubmit={async (t) => {
            await api.put(
              `/events/${ask.id}/${ask.action}`,
              ask.action === 'reject' ? { reason: t } : { comment: t },
            );
            load();
          }}
          onClose={() => setAsk(null)}
        />
      )}
      {error && <div className="alert error">{error}</div>}
      <div className="review-list">
        {items.map((e) => (
          <div className="review-card" key={e._id}>
            <div className="row-between">
              <Status value={e.status} />
              <small className="muted">Submitted {date(e.submittedAt)}</small>
            </div>
            <h3>
              <Link to={`/event/${e._id}`}>{e.title}</Link>
            </h3>
            <p>{e.summary}</p>
            <div className="event-meta">
              <span>
                <Users size={14} />
                {e.organizer?.name}
              </span>
              <span>
                <CalendarDays size={14} />
                {date(e.startAt)}
              </span>
              <span>
                <MapPin size={14} />
                {e.venue}
              </span>
            </div>
            <div className="review-actions">
              <button
                className="btn secondary"
                onClick={() => setAsk({ id: e._id, action: 'request-changes' })}
              >
                Request changes
              </button>
              <button className="btn danger-outline" onClick={() => setAsk({ id: e._id, action: 'reject' })}>
                Reject
              </button>
              <button className="btn primary" onClick={() => approve(e._id)}>
                Approve event
              </button>
            </div>
          </div>
        ))}
        {!items.length && <Empty title="All caught up" text="There are no events awaiting approval." />}
      </div>
    </>
  );
}
export function UsersPage() {
  const [items, setItems] = useState([]),
    [error, setError] = useState(''),
    [showNew, setShowNew] = useState(false),
    [nu, setNu] = useState({ name: '', email: '', role: 'faculty', department: '', password: '' });
  const addStaff = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api.post('/users', nu);
      setNu({ name: '', email: '', role: 'faculty', department: '', password: '' });
      setShowNew(false);
      load();
    } catch (x) {
      setError(x.message);
    }
  };
  const load = () =>
    api
      .get('/users')
      .then((x) => setItems(x.items))
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, []);
  const toggle = async (u) => {
    try {
      await api.put(`/users/${u._id}/status`, { isActive: !u.isActive });
      load();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="ACCESS MANAGEMENT"
        title="Users"
        sub="Manage university accounts and workspace access."
        action={
          <button className="btn primary" onClick={() => setShowNew(!showNew)}>
            <Plus size={16} /> Add staff account
          </button>
        }
      />
      {error && <div className="alert error">{error}</div>}
      {showNew && (
        <form className="form-card" onSubmit={addStaff}>
          <div className="form-grid">
            <label>
              Full name *
              <input
                value={nu.name}
                onChange={(e) => setNu({ ...nu, name: e.target.value })}
                required
                minLength="2"
                maxLength="60"
              />
            </label>
            <label>
              University e-mail *
              <input
                type="email"
                value={nu.email}
                onChange={(e) => setNu({ ...nu, email: e.target.value })}
                required
              />
            </label>
            <label>
              Role *
              <select value={nu.role} onChange={(e) => setNu({ ...nu, role: e.target.value })}>
                <option value="faculty">Faculty</option>
                <option value="club">Club organizer</option>
                <option value="admin">Administrator</option>
              </select>
            </label>
            <label>
              Department
              <input value={nu.department} onChange={(e) => setNu({ ...nu, department: e.target.value })} />
            </label>
            <label className="span2">
              Initial password (leave blank for Welcome@123)
              <input
                type="text"
                value={nu.password}
                onChange={(e) => setNu({ ...nu, password: e.target.value })}
              />
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn secondary" onClick={() => setShowNew(false)}>
              Cancel
            </button>
            <button className="btn primary">Create account</button>
          </div>
        </form>
      )}
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((u) => (
              <tr key={u._id}>
                <td>
                  <b>{u.name}</b>
                </td>
                <td>{u.email}</td>
                <td>{roles[u.role]}</td>
                <td>{u.department}</td>
                <td>
                  <Status value={u.isActive ? 'Active' : 'Inactive'} />
                </td>
                <td>
                  <button className="text-btn" onClick={() => toggle(u)}>
                    {u.isActive ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
export function SimpleAdmin({ type }) {
  const [items, setItems] = useState([]),
    [name, setName] = useState(''),
    [error, setError] = useState('');
  const load = () =>
    api
      .get(`/${type}`)
      .then((x) => setItems(x.items))
      .catch((e) => setError(e.message));
  useEffect(() => {
    load();
  }, [type]);
  const off = async (x) => {
    try {
      await api.put(`/${type}/${x._id}`, { isActive: false });
      load();
    } catch (e) {
      setError(e.message);
    }
  };
  const add = async (e) => {
    e.preventDefault();
    try {
      await api.post(
        `/${type}`,
        type === 'categories'
          ? { name, colour: '#6558d3' }
          : { name, description: 'University student club' },
      );
      setName('');
      load();
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="SYSTEM CONFIGURATION"
        title={type === 'clubs' ? 'Clubs' : 'Event Categories'}
        sub="Maintain the groups and categories used by UniEvents."
      />
      <form className="inline-add" onSubmit={add}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={type === 'clubs' ? 'Club name' : 'Category name'}
          required
        />
        <button className="btn primary">Add</button>
      </form>
      {error && <div className="alert error">{error}</div>}
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description / Colour</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr key={x._id}>
                <td>
                  <b>{x.name}</b>
                </td>
                <td>{x.description || x.colour}</td>
                <td>
                  <Status value={x.isActive ? 'Active' : 'Inactive'} />
                </td>
                <td>
                  <button className="text-btn" onClick={() => off(x)}>
                    Deactivate
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
export function Announcements() {
  const [title, setTitle] = useState(''),
    [message, setMessage] = useState(''),
    [audience, setAudience] = useState('all'),
    [urgent, setUrgent] = useState(false),
    [done, setDone] = useState(''),
    [error, setError] = useState('');
  const send = async (e) => {
    e.preventDefault();
    setDone('');
    setError('');
    try {
      const x = await api.post('/announcements', { title, message, audience, urgent });
      setDone(`Announcement delivered to ${x.recipients} users.`);
      setTitle('');
      setMessage('');
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <>
      <PageTitle
        eyebrow="COMMUNICATION"
        title="Announcements"
        sub="Send university-wide or role-specific announcements."
      />
      <form className="form-card narrow" onSubmit={send}>
        <label>
          Announcement title
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength="120" />
        </label>
        <label>
          Message
          <textarea
            rows="5"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
            maxLength="1000"
          />
        </label>
        <label>
          Audience
          <select value={audience} onChange={(e) => setAudience(e.target.value)}>
            <option value="all">Everyone</option>
            <option value="student">Students</option>
            <option value="faculty">Faculty</option>
            <option value="club">Club organizers</option>
          </select>
        </label>
        <label className="check-label">
          <input type="checkbox" checked={urgent} onChange={(e) => setUrgent(e.target.checked)} /> Mark as
          urgent
        </label>
        {error && <div className="alert error">{error}</div>}
        {done && <div className="alert success">{done}</div>}
        <button className="btn primary">Send announcement</button>
      </form>
    </>
  );
}
export function Audit() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api
      .get('/admin/audit')
      .then((x) => setItems(x.items))
      .catch(() => {});
  }, []);
  return (
    <>
      <PageTitle
        eyebrow="SECURITY & GOVERNANCE"
        title="Audit Log"
        sub="Read-only history of administrative actions."
      />
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>User</th>
              <th>Action</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {items.map((x) => (
              <tr key={x._id}>
                <td>{datetime(x.createdAt)}</td>
                <td>{x.user?.name || 'System'}</td>
                <td>{x.action}</td>
                <td>{x.targetType}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
