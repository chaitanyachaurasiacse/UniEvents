import React, { useState } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { api } from "../../api";
import { useAuth } from "../../lib/auth";
import { PW_RULE } from "../../lib/format";
import { Discover } from "../student/Discover";

export function AuthFrame({ children }) {
  return (
    <div className="auth-page">
      <div className="auth-art">
        <div className="photo" />
        <div className="brand large">
          <span className="brand-mark">U</span> UniEvents
        </div>
        <div className="art-copy">
          <span className="eyebrow">A MORE CONNECTED CAMPUS</span>
          <h1>
            Every event.
            <br />
            One university.
          </h1>
          <p>Discover meaningful experiences and make campus life unforgettable.</p>
        </div>
        <div className="art-foot">Babu Banarasi Das University · Lucknow</div>
      </div>
      <div className="auth-side">{children}</div>
    </div>
  );
}


export function Register() {
  const { setUser } = useAuth(),
    nav = useNavigate(),
    [f, setF] = useState({
      name: '',
      email: '',
      rollNumber: '',
      department: 'Computer Science & Engineering',
      year: '1st Year',
      password: '',
      confirmPassword: '',
    }),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const ch = (e) => setF((x) => ({ ...x, [e.target.name]: e.target.value }));
  const go = async (e) => {
    e.preventDefault();
    setError('');
    if (!PW_RULE.test(f.password))
      return setError(
        'Password must be 8–20 characters with an upper-case letter, a lower-case letter, a digit and a special character.',
      );
    if (f.password !== f.confirmPassword) return setError('The passwords entered do not match.');
    setBusy(true);
    try {
      const x = await api.post('/auth/register', f);
      sessionStorage.removeItem('unievents_role');
      sessionStorage.setItem('unievents_token', x.token);
      setUser(x.user);
      nav('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthFrame>
      <form className="auth-card" onSubmit={go}>
        <span className="eyebrow">JOIN UNIEVENTS</span>
        <h2>Create your account</h2>
        <p className="muted">Students sign up with their university e-mail address.</p>
        {error && <div className="alert error">{error}</div>}
        <label>
          Full name
          <input name="name" value={f.name} onChange={ch} required minLength="2" maxLength="60" />
        </label>
        <label>
          University email
          <input name="email" type="email" value={f.email} onChange={ch} required />
        </label>
        <label>
          Roll number
          <input
            name="rollNumber"
            value={f.rollNumber}
            onChange={ch}
            required
            minLength="6"
            maxLength="15"
            pattern="[A-Za-z0-9]{6,15}"
            title="6 to 15 letters or digits"
          />
        </label>
        <label>
          Department
          <input name="department" value={f.department} onChange={ch} required />
        </label>
        <label>
          Year
          <select name="year" value={f.year} onChange={ch}>
            {['1st Year', '2nd Year', '3rd Year', '4th Year'].map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </label>
        <label>
          Password
          <input name="password" type="password" value={f.password} onChange={ch} required />
        </label>
        <label>
          Confirm password
          <input name="confirmPassword" type="password" value={f.confirmPassword} onChange={ch} required />
        </label>
        <p className="muted small">
          8–20 characters with upper-case, lower-case, a digit and a special character.
        </p>
        <button className="btn primary full" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="muted center">
          Already registered?{' '}
          <Link to="/signin" className="small-link">
            Sign in
          </Link>
        </p>
      </form>
    </AuthFrame>
  );
}

export function Forgot() {
  const [email, setEmail] = useState(''),
    [res, setRes] = useState(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      setRes(await api.post('/auth/forgot-password', { email }));
    } catch (x) {
      setError(x.message);
    } finally {
      setBusy(false);
    }
  };
  let token = '';
  try {
    if (res?.resetUrl) token = new URL(res.resetUrl).searchParams.get('token') || '';
  } catch {}
  return (
    <AuthFrame>
      <form className="auth-card" onSubmit={go}>
        <span className="eyebrow">ACCOUNT RECOVERY</span>
        <h2>Forgot your password?</h2>
        <p className="muted">Enter your university e-mail address and we will send you a reset link.</p>
        {error && <div className="alert error">{error}</div>}
        {res ? (
          <>
            <div className="alert success">{res.message}</div>
            {token && (
              <div className="demo-box">
                <b>Demo mode</b>
                <span>No mail server is configured, so the reset link is shown here.</span>
                <Link className="btn primary full" to={`/reset?token=${token}`}>
                  Open reset link
                </Link>
              </div>
            )}
          </>
        ) : (
          <>
            <label>
              University email
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>
            <button className="btn primary full" disabled={busy}>
              {busy ? 'Please wait…' : 'Send reset link'}
            </button>
          </>
        )}
        <p className="muted center">
          <Link to="/signin" className="small-link">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthFrame>
  );
}

export function Reset() {
  const loc = useLocation(),
    token = new URLSearchParams(loc.search).get('token') || '',
    [f, setF] = useState({ password: '', confirmPassword: '' }),
    [error, setError] = useState(''),
    [done, setDone] = useState(''),
    [busy, setBusy] = useState(false);
  const go = async (e) => {
    e.preventDefault();
    setError('');
    if (!PW_RULE.test(f.password))
      return setError(
        'Password must be 8–20 characters with an upper-case letter, a lower-case letter, a digit and a special character.',
      );
    if (f.password !== f.confirmPassword) return setError('The passwords entered do not match.');
    setBusy(true);
    try {
      const x = await api.post('/auth/reset-password', { token, ...f });
      setDone(x.message);
    } catch (x) {
      setError(x.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <AuthFrame>
      <form className="auth-card" onSubmit={go}>
        <span className="eyebrow">ACCOUNT RECOVERY</span>
        <h2>Choose a new password</h2>
        {!token && <div className="alert error">This reset link is incomplete. Request a new one.</div>}
        {error && <div className="alert error">{error}</div>}
        {done ? (
          <div className="alert success">{done}</div>
        ) : (
          <>
            <label>
              New password
              <input
                type="password"
                value={f.password}
                onChange={(e) => setF({ ...f, password: e.target.value })}
                required
              />
            </label>
            <label>
              Confirm new password
              <input
                type="password"
                value={f.confirmPassword}
                onChange={(e) => setF({ ...f, confirmPassword: e.target.value })}
                required
              />
            </label>
            <button className="btn primary full" disabled={busy || !token}>
              {busy ? 'Please wait…' : 'Reset password'}
            </button>
          </>
        )}
        <p className="muted center">
          <Link to="/signin" className="small-link">
            Back to sign in
          </Link>
        </p>
      </form>
    </AuthFrame>
  );
}

