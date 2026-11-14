import React, { useState } from "react";
import { Settings } from "lucide-react";
import { api } from "../api";
import { useAuth } from "../lib/auth";
import { roles, initials } from "../lib/format";
import { PageTitle, Status } from "../components/ui";

export function Profile() {
  const { user, setUser } = useAuth(),
    pr = user.notificationPreferences || {};
  const [form, setForm] = useState({
      name: user.name,
      phone: user.phone || '',
      bio: user.bio || '',
      department: user.department || '',
      year: user.year || '',
      notificationPreferences: {
        reminders: pr.reminders !== false,
        updates: pr.updates !== false,
        announcements: pr.announcements !== false,
      },
    }),
    [pw, setPw] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' }),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [pwMsg, setPwMsg] = useState(''),
    [pwErr, setPwErr] = useState('');
  const save = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    try {
      const x = await api.put('/profile', form);
      setUser(x.user);
      setMessage('Your profile has been updated.');
    } catch (e) {
      setError(e.message);
    }
  };
  const changePw = async (e) => {
    e.preventDefault();
    setPwMsg('');
    setPwErr('');
    try {
      const x = await api.put('/profile/password', pw);
      setPwMsg(x.message);
      setPw({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (e) {
      setPwErr(e.message);
    }
  };
  const pref = (k, label) => (
    <label className="check-label">
      <input
        type="checkbox"
        checked={form.notificationPreferences[k]}
        onChange={(e) =>
          setForm((f) => ({
            ...f,
            notificationPreferences: { ...f.notificationPreferences, [k]: e.target.checked },
          }))
        }
      />{' '}
      {label}
    </label>
  );
  return (
    <>
      <PageTitle
        eyebrow="ACCOUNT"
        title="Profile and Settings"
        sub="Manage your personal information, notifications and password."
      />
      <form className="form-card narrow" onSubmit={save}>
        <div className="profile-head">
          <div className="avatar big">{initials(user.name)}</div>
          <div>
            <h2>{user.name}</h2>
            <Status value={roles[user.role]} />
            <p className="muted">{user.email}</p>
          </div>
        </div>
        {user.role === 'student' && (
          <label>
            University roll number
            <input value={user.rollNumber || ''} disabled readOnly />
            <small className="muted">Your roll number identifies you on tickets and certificates. Ask the administrator if it needs correcting.</small>
          </label>
        )}
        <label>
          Full name
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
            minLength="2"
            maxLength="60"
          />
        </label>
        <label>
          Phone number
          <input
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            maxLength="10"
            inputMode="numeric"
            pattern="[0-9]{10}"
            title="Enter a 10-digit phone number"
          />
        </label>
        <label>
          Department
          <input
            value={form.department}
            onChange={(e) => setForm((f) => ({ ...f, department: e.target.value }))}
          />
        </label>
        <label>
          Year
          <input value={form.year} onChange={(e) => setForm((f) => ({ ...f, year: e.target.value }))} />
        </label>
        <label>
          Bio
          <textarea
            rows="3"
            value={form.bio}
            onChange={(e) => setForm((f) => ({ ...f, bio: e.target.value }))}
            maxLength="200"
          />
        </label>
        <h3>Notification preferences</h3>
        {pref('reminders', 'Event reminders')}
        {pref('updates', 'Event and registration updates')}
        {pref('announcements', 'University announcements')}
        {error && <div className="alert error">{error}</div>}
        {message && <div className="alert success">{message}</div>}
        <button className="btn primary">Save changes</button>
      </form>
      <form className="form-card narrow" onSubmit={changePw}>
        <h3>Change password</h3>
        <label>
          Current password
          <input
            type="password"
            value={pw.currentPassword}
            onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })}
            required
          />
        </label>
        <label>
          New password
          <input
            type="password"
            value={pw.newPassword}
            onChange={(e) => setPw({ ...pw, newPassword: e.target.value })}
            required
          />
        </label>
        <label>
          Confirm new password
          <input
            type="password"
            value={pw.confirmPassword}
            onChange={(e) => setPw({ ...pw, confirmPassword: e.target.value })}
            required
          />
        </label>
        <p className="muted small">
          8–20 characters with an upper-case letter, a lower-case letter, a digit and a special character.
        </p>
        {pwErr && <div className="alert error">{pwErr}</div>}
        {pwMsg && <div className="alert success">{pwMsg}</div>}
        <button className="btn primary">Update password</button>
      </form>
    </>
  );
}

