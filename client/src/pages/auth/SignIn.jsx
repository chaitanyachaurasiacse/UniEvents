import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
import { api } from "../../api";
import { useAuth } from "../../lib/auth";
import { coverFor, bgStyle } from "../../lib/media";

// Demo accounts created by `npm run seed`. Shown so evaluators can try every role.
const DEMO = [
  ['Student', 'student@bbdu.ac.in'],
  ['Faculty', 'faculty@bbdu.ac.in'],
  ['Club', 'club@bbdu.ac.in'],
  ['Admin', 'admin@bbdu.ac.in'],
];
const DEMO_PASSWORD = 'UniEvents@123';

export function SignIn() {
  const { login } = useAuth(),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [show, setShow] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [upcoming, setUpcoming] = useState([]);

  useEffect(() => {
    api.get('/public/events').then((x) => setUpcoming(x.items.slice(0, 3))).catch(() => {});
  }, []);

  const signIn = async (em, pw) => {
    setError('');
    setBusy(true);
    try {
      await login(em, pw);
    } catch (x) {
      setError(x.message);
      setBusy(false);
    }
  };
  const go = (e) => {
    e.preventDefault();
    signIn(email, password);
  };

  return (
    <div className="auth-page">
      <div className="auth-art">
        <div className="photo" />
        <Link to="/" className="brand large">
          <span className="brand-mark" /> UniEvents
        </Link>
        <div className="art-copy">
          <span className="eyebrow">Happening soon</span>
          <h1>Your whole campus calendar, in one place.</h1>
          <div className="now-on">
            {upcoming.map((e) => (
              <div className="now-card" key={e._id}>
                <span className="th" style={bgStyle(coverFor(e))} />
                <div>
                  <b>{e.title}</b>
                  <span>
                    {new Date(e.startAt).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · {e.venue}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="art-foot">
          <span>Babu Banarasi Das University · Lucknow</span>
          <span>Photo: Unsplash</span>
        </div>
      </div>
      <div className="auth-side">
        <form className="auth-card" onSubmit={go} noValidate>
          <div>
            <span className="eyebrow">Welcome back</span>
            <h2 style={{ marginTop: 8 }}>Sign in to UniEvents</h2>
            <p className="muted" style={{ marginTop: 6 }}>
              Use your university e-mail and password.
            </p>
          </div>
          {error && (
            <div className="alert error" role="alert">
              {error}
            </div>
          )}
          <label>
            University e-mail
            <span className="field-box">
              <Mail size={18} />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@bbdu.ac.in" autoComplete="username" required />
            </span>
          </label>
          <label>
            <span className="row-between">
              Password
              <Link to="/forgot" className="small-link">
                Forgot password?
              </Link>
            </span>
            <span className="field-box">
              <Lock size={18} />
              <input type={show ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" required />
              <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>
          <button className="btn primary full lg" disabled={busy || !email || !password}>
            {busy ? 'Signing in…' : (
              <>
                Sign in <ArrowRight size={18} />
              </>
            )}
          </button>
          <p className="muted center small">
            New to UniEvents?{' '}
            <Link to="/register" className="small-link">
              Create a student account
            </Link>
          </p>
          <div className="or">or try a demo workspace</div>
          <div className="demo-roles">
            {DEMO.map(([label, em]) => (
              <button type="button" className="demo-role" key={em} disabled={busy} onClick={() => signIn(em, DEMO_PASSWORD)}>
                <span className="avatar" style={{ width: 30, height: 30, fontSize: 11 }}>
                  {label.slice(0, 2).toUpperCase()}
                </span>
                {label}
              </button>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
}
