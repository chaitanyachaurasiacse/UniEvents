import React, { useEffect, useState } from "react";
import { useNavigate, useLocation, Link, Routes, Route } from "react-router-dom";
import { CalendarDays, Compass, LayoutDashboard, Users, CheckCheck, Bell, LogOut, Plus, Menu, ChartNoAxesCombined, Tags, Building2, UserCircle, ShieldCheck } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../lib/auth";
import { roles, initials, datetime } from "../lib/format";
import { Discover } from "../pages/student/Discover";
import { EventDetail } from "../pages/EventDetail";
import { MyEvents } from "../pages/student/MyEvents";
import { OrganizerDashboard, OrganizerEvents } from "../pages/organizer/OrganizerDashboard";
import { EventForm } from "../pages/organizer/EventForm";
import { ManageEvent } from "../pages/organizer/ManageEvent";
import { AdminDashboard, AdminEvents, Pending, UsersPage, SimpleAdmin, Announcements, Audit } from "../pages/admin/AdminPages";
import { Reports } from "../pages/Reports";
import { Profile } from "../pages/Profile";
import { NotFound } from "./ui";
import { CheckIn } from "../pages/organizer/CheckIn";

export const navByRole = {
  student: [
    ['Discover', Compass, '/'],
    ['My Events', CalendarDays, '/my-events'],
    ['Profile', UserCircle, '/profile'],
  ],
  faculty: [
    ['Overview', LayoutDashboard, '/'],
    ['Create Event', Plus, '/create'],
    ['My Events', CalendarDays, '/my-events'],
    ['Reports', ChartNoAxesCombined, '/reports'],
  ],
  club: [
    ['Overview', LayoutDashboard, '/'],
    ['Create Event', Plus, '/create'],
    ['My Events', CalendarDays, '/my-events'],
    ['Reports', ChartNoAxesCombined, '/reports'],
  ],
  admin: [
    ['Overview', LayoutDashboard, '/'],
    ['All Events', CalendarDays, '/all-events'],
    ['Pending Approvals', CheckCheck, '/pending'],
    ['Users', Users, '/users'],
    ['Clubs', Building2, '/clubs'],
    ['Categories', Tags, '/categories'],
    ['Announcements', Bell, '/announcements'],
    ['Reports', ChartNoAxesCombined, '/reports'],
    ['Audit Log', ShieldCheck, '/audit'],
  ],
};
export function Shell() {
  const { user, logout, switchRole } = useAuth(),
    [collapsed, setCollapsed] = useState(false),
    [notif, setNotif] = useState(false),
    [unread, setUnread] = useState(0),
    [pend, setPend] = useState(0);
  const loc = useLocation(),
    nav = useNavigate();
  useEffect(() => {
    api
      .get('/notifications')
      .then((x) => setUnread(x.unread || 0))
      .catch(() => {});
    if (user.role === 'admin')
      api
        .get('/events/pending')
        .then((x) => setPend(x.items.length))
        .catch(() => {});
  }, [loc.pathname, user.role]);
  const links = [...(navByRole[user.role] || navByRole.student)];
  if (!links.some((l) => l[2] === '/profile')) links.push(['Profile', UserCircle, '/profile']);
  return (
    <div className="app-shell">
      <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
        <div className="brand">
          <span className="brand-mark">U</span>
          {!collapsed && 'UniEvents'}
        </div>
        <div className="side-label">WORKSPACE</div>
        <nav>
          {links.map(([label, Icon, path]) => (
            <Link key={path} to={path} className={`nav-link ${loc.pathname === path ? 'active' : ''}`}>
              <Icon size={18} />
              {!collapsed && <span>{label}</span>}
              {label === 'Pending Approvals' && pend > 0 && <span className="nav-count">{pend}</span>}
            </Link>
          ))}
        </nav>
        <div className="side-bottom">
          <div className="user-mini">
            <div className="avatar">{initials(user.name)}</div>
            {!collapsed && (
              <div>
                <b>{user.name}</b>
                <small>{roles[user.role]}</small>
              </div>
            )}
          </div>
          <button className="icon-btn" title="Sign out" onClick={logout}>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <button className="icon-btn" onClick={() => setCollapsed(!collapsed)}>
            <Menu size={19} />
          </button>
          <div className="top-spacer" />
          {user.roles?.length > 1 && (
            <select
              className="role-switch"
              title="Switch workspace"
              value={user.role}
              onChange={async (e) => {
                try {
                  await switchRole(e.target.value);
                  nav('/');
                } catch (x) {
                  console.error(x);
                }
              }}
            >
              {user.roles.map((r) => (
                <option key={r} value={r}>
                  {roles[r]}
                </option>
              ))}
            </select>
          )}
          <span className="term-label">Academic Session 2026–2027</span>
          <button className="icon-btn notification-btn" onClick={() => setNotif(!notif)}>
            <Bell size={19} />
            {unread > 0 && <i />}
          </button>
          <div className="top-avatar">{initials(user.name)}</div>
        </header>
        {notif && (
          <NotificationPanel
            close={() => setNotif(false)}
            refresh={() => api.get('/notifications').then((x) => setUnread(x.unread || 0))}
          />
        )}
        <div className="page-content">
          <RoutesView />
        </div>
      </main>
    </div>
  );
}
export function NotificationPanel({ close, refresh }) {
  const [items, setItems] = useState([]);
  useEffect(() => {
    api.get('/notifications').then((x) => setItems(x.items));
  }, []);
  const read = async (id) => {
    await api.put(`/notifications/${id}/read`);
    setItems((a) => a.map((n) => (n._id === id ? { ...n, isRead: true } : n)));
    refresh();
  };
  return (
    <div className="notification-panel">
      <div className="row-between">
        <b>Notifications</b>
        <button
          className="text-btn"
          onClick={async () => {
            await api.put('/notifications/read-all');
            setItems((a) => a.map((n) => ({ ...n, isRead: true })));
            refresh();
          }}
        >
          Mark all read
        </button>
        <button className="icon-btn" onClick={close}>
          ×
        </button>
      </div>
      {items.length ? (
        items.map((n) => (
          <button className={`notice ${n.isRead ? '' : 'unread'}`} key={n._id} onClick={() => read(n._id)}>
            <b>{n.title}</b>
            <span>{n.message}</span>
            <small>{datetime(n.createdAt)}</small>
          </button>
        ))
      ) : (
        <div className="empty">You're all caught up.</div>
      )}
    </div>
  );
}
export function RoutesView() {
  const { user } = useAuth();
  if (user.role === 'student') return <StudentRoutes />;
  if (user.role === 'admin') return <AdminRoutes />;
  return <OrganizerRoutes />;
}
export function StudentRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Discover />} />
      <Route path="/event/:id" element={<EventDetail />} />
      <Route path="/my-events" element={<MyEvents />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
export function OrganizerRoutes() {
  return (
    <Routes>
      <Route path="/" element={<OrganizerDashboard />} />
      <Route path="/event/:id" element={<EventDetail />} />
      <Route path="/create" element={<EventForm />} />
      <Route path="/edit/:id" element={<EventForm />} />
      <Route path="/my-events" element={<OrganizerEvents />} />
      <Route path="/manage/:id" element={<ManageEvent />} />
      <Route path="/checkin/:id" element={<CheckIn />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
export function AdminRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AdminDashboard />} />
      <Route path="/all-events" element={<AdminEvents />} />
      <Route path="/event/:id" element={<EventDetail />} />
      <Route path="/manage/:id" element={<ManageEvent />} />
      <Route path="/checkin/:id" element={<CheckIn />} />
      <Route path="/pending" element={<Pending />} />
      <Route path="/users" element={<UsersPage />} />
      <Route path="/clubs" element={<SimpleAdmin type="clubs" />} />
      <Route path="/categories" element={<SimpleAdmin type="categories" />} />
      <Route path="/announcements" element={<Announcements />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/audit" element={<Audit />} />
      <Route path="/profile" element={<Profile />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
