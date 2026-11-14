import React, { useEffect, useState } from "react";
import { useNavigate, useLocation, Link, Routes, Route } from "react-router-dom";
import { CalendarDays, Compass, LayoutDashboard, Users, CheckCheck, Bell, LogOut, Plus, Menu, ChartNoAxesCombined, Tags, Building2, UserCircle, ShieldCheck, Sun, Moon, X } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../lib/auth";
import { useTheme } from "../lib/theme";
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
    ['My Tickets', CalendarDays, '/my-events'],
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
    [sideOpen, setSideOpen] = useState(false),
    [pop, setPop] = useState(null), // 'notifications' | 'account' | null
    [unread, setUnread] = useState(0),
    [pend, setPend] = useState(0),
    [theme, toggleTheme] = useTheme();
  const loc = useLocation(),
    nav = useNavigate();
  const refreshUnread = () => api.get('/notifications').then((x) => setUnread(x.unread || 0)).catch(() => {});

  useEffect(() => {
    refreshUnread();
    if (user.role === 'admin') api.get('/events/pending').then((x) => setPend(x.items.length)).catch(() => {});
    setPop(null);
    setSideOpen(false);
  }, [loc.pathname, user.role]);

  // Close menus on outside click or Escape.
  useEffect(() => {
    if (!pop && !sideOpen) return;
    const onDown = (e) => {
      if (pop && !e.target.closest('.popover, .pop-trigger')) setPop(null);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setPop(null);
        setSideOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [pop, sideOpen]);

  const links = [...(navByRole[user.role] || navByRole.student)];
  if (!links.some((l) => l[2] === '/profile')) links.push(['Profile', UserCircle, '/profile']);
  const signOut = () => {
    logout();
    nav('/');
  };
  const ThemeIcon = theme === 'dark' ? Sun : Moon;
  const themeLabel = theme === 'dark' ? 'Light theme' : 'Dark theme';
  const toggle = (name) => setPop(pop === name ? null : name);

  return (
    <div className={`app-shell ${sideOpen ? 'side-open' : ''}`}>
      <aside className="sidebar" aria-label="Main navigation">
        <div className="side-top">
          <Link to="/" className="brand" aria-label="UniEvents home">
            <span className="brand-mark" />
            UniEvents
          </Link>
          <button className="icon-btn side-close" aria-label="Close menu" onClick={() => setSideOpen(false)}>
            <X size={18} />
          </button>
        </div>
        <div className="side-label">{roles[user.role]} workspace</div>
        <nav>
          {links.map(([label, Icon, path]) => {
            const active = loc.pathname === path;
            return (
              <Link key={path} to={path} className={`nav-link ${active ? 'active' : ''}`} aria-current={active ? 'page' : undefined}>
                <Icon size={18} />
                <span>{label}</span>
                {label === 'Pending Approvals' && pend > 0 && <span className="nav-count">{pend}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="side-bottom">
          <Link to="/profile" className="user-mini" title="Your profile">
            <div className="avatar">{initials(user.name)}</div>
            <div className="who">
              <b>{user.name}</b>
              <small>{roles[user.role]}</small>
            </div>
          </Link>
          <button className="icon-btn signout" title="Sign out" aria-label="Sign out" onClick={signOut}>
            <LogOut size={17} />
          </button>
        </div>
      </aside>
      {sideOpen && <div className="side-scrim" onClick={() => setSideOpen(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="icon-btn menu-btn" aria-label="Open menu" onClick={() => setSideOpen(true)}>
            <Menu size={19} />
          </button>
          <Link to="/" className="brand top-brand" aria-label="UniEvents home">
            <span className="brand-mark" />
            UniEvents
          </Link>
          <div className="top-spacer" />
          {user.roles?.length > 1 && (
            <select
              className="role-switch"
              title="Switch workspace"
              aria-label="Switch workspace"
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
          <button className="icon-btn" onClick={toggleTheme} aria-label={`Switch to ${themeLabel.toLowerCase()}`} title={themeLabel}>
            <ThemeIcon size={18} />
          </button>
          <button
            className="icon-btn notification-btn pop-trigger"
            aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
            aria-expanded={pop === 'notifications'}
            onClick={() => toggle('notifications')}
          >
            <Bell size={19} />
            {unread > 0 && <span className="badge-count">{unread > 9 ? '9+' : unread}</span>}
          </button>
          <button className="top-avatar pop-trigger" aria-label="Account menu" aria-expanded={pop === 'account'} onClick={() => toggle('account')}>
            {initials(user.name)}
          </button>
        </header>

        {pop === 'notifications' && <NotificationPanel close={() => setPop(null)} refresh={refreshUnread} />}
        {pop === 'account' && (
          <div className="popover account-menu" role="menu">
            <div className="account-head">
              <div className="avatar">{initials(user.name)}</div>
              <div>
                <b>{user.name}</b>
                <small>{user.email}</small>
                <span className="status">{roles[user.role]}</span>
              </div>
            </div>
            <Link role="menuitem" to="/profile">
              <UserCircle size={17} /> Profile and settings
            </Link>
            <Link role="menuitem" to={user.role === 'admin' ? '/all-events' : '/my-events'}>
              <CalendarDays size={17} /> {user.role === 'student' ? 'My tickets' : user.role === 'admin' ? 'All events' : 'My events'}
            </Link>
            <button role="menuitem" onClick={toggleTheme}>
              <ThemeIcon size={17} /> {themeLabel}
            </button>
            <button role="menuitem" className="danger-item" onClick={signOut}>
              <LogOut size={17} /> Sign out
            </button>
          </div>
        )}
        <div className="page-content">
          <RoutesView />
        </div>
      </main>
    </div>
  );
}

export function NotificationPanel({ close, refresh }) {
  const [items, setItems] = useState(null);
  const nav = useNavigate();
  useEffect(() => {
    api.get('/notifications').then((x) => setItems(x.items)).catch(() => setItems([]));
  }, []);
  const open = async (n) => {
    if (!n.isRead) {
      await api.put(`/notifications/${n._id}/read`).catch(() => {});
      setItems((a) => a.map((x) => (x._id === n._id ? { ...x, isRead: true } : x)));
      refresh();
    }
    if (n.event?._id) {
      close();
      nav(`/event/${n.event._id}`);
    }
  };
  const anyUnread = items?.some((n) => !n.isRead);
  return (
    <div className="notification-panel popover" role="dialog" aria-label="Notifications">
      <div className="panel-head">
        <b>Notifications</b>
        {anyUnread && (
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
        )}
        <button className="icon-btn" aria-label="Close notifications" onClick={close}>
          <X size={16} />
        </button>
      </div>
      {!items ? (
        <div className="loading" style={{ minHeight: 120, margin: 12 }} />
      ) : items.length ? (
        items.map((n) => (
          <button className={`notice ${n.isRead ? '' : 'unread'}`} key={n._id} onClick={() => open(n)}>
            <b>{n.title}</b>
            <span>{n.message}</span>
            <small>{datetime(n.createdAt)}</small>
          </button>
        ))
      ) : (
        <p className="muted small" style={{ padding: '28px 16px', textAlign: 'center' }}>
          You're all caught up.
        </p>
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
