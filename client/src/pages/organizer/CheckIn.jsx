import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, CameraOff, Ticket } from "lucide-react";
import { api } from "../../api";
import { PageTitle } from "../../components/ui";
import { initials } from "../../lib/format";

const time = (d) => new Date(d).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

export function CheckIn() {
  const { id } = useParams();
  const [event, setEvent] = useState(null),
    [list, setList] = useState([]),
    [count, setCount] = useState(0),
    [code, setCode] = useState(''),
    [msg, setMsg] = useState(null),
    [camera, setCamera] = useState(false),
    [camError, setCamError] = useState('');
  const scanner = useRef(null),
    lastCode = useRef({ code: '', at: 0 }),
    busy = useRef(false);

  const load = () =>
    api.get(`/events/${id}/checkins`).then((x) => {
      setEvent(x.event);
      setList(x.items);
      setCount(x.checkedIn);
    }).catch((e) => setMsg({ ok: false, text: e.message }));
  useEffect(() => { load(); }, [id]);

  const submit = useCallback(async (raw) => {
    const c = String(raw || '').trim().toUpperCase();
    if (!c || busy.current) return;
    // The camera reads the same code many times a second; ignore repeats for a few seconds.
    if (lastCode.current.code === c && Date.now() - lastCode.current.at < 4000) return;
    lastCode.current = { code: c, at: Date.now() };
    busy.current = true;
    try {
      const x = await api.post(`/events/${id}/checkin`, { code: c });
      setMsg({ ok: true, text: `${x.student.name} checked in` });
      setCount(x.checkedIn);
      setList((l) => [{ _id: c, student: x.student, markedAt: new Date().toISOString(), fresh: true }, ...l]);
      setCode('');
    } catch (e) {
      setMsg({ ok: false, text: e.message });
    } finally {
      busy.current = false;
    }
  }, [id]);

  const stop = async () => {
    try { if (scanner.current?.isScanning) await scanner.current.stop(); } catch {}
    setCamera(false);
  };
  const start = async () => {
    setCamError('');
    try {
      scanner.current = scanner.current || new Html5Qrcode('qr-reader');
      await scanner.current.start({ facingMode: 'environment' }, { fps: 10, qrbox: { width: 240, height: 240 } }, (text) => submit(text), () => {});
      setCamera(true);
    } catch (e) {
      setCamError('The camera could not start. Allow camera access in the browser, or type the ticket code below.');
      setCamera(false);
    }
  };
  useEffect(() => () => { stop(); }, []);

  const pct = event?.registeredCount ? Math.round((count / event.registeredCount) * 100) : 0;
  return (
    <>
      <Link to={`/manage/${id}`} className="back-link">← Back to event</Link>
      <PageTitle
        eyebrow="Door check-in"
        title={event ? event.title : 'Check-in'}
        sub={event ? `${new Date(event.startAt).toLocaleString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })} · ${event.venue}` : ''}
      />
      <div className="two-col">
        <div className="pad" style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          <div className="scanner">
            <div id="qr-reader" />
            {!camera && (
              <div className="scanner-idle">
                <Camera size={34} />
                <span>Scan students' QR tickets with this device's camera</span>
              </div>
            )}
          </div>
          {camError && <div className="alert error">{camError}</div>}
          <button className={`btn ${camera ? 'secondary' : 'gold'} full`} onClick={camera ? stop : start}>
            {camera ? <><CameraOff size={17} /> Stop camera</> : <><Camera size={17} /> Start camera</>}
          </button>
          <form
            className="inline-add"
            onSubmit={(e) => {
              e.preventDefault();
              lastCode.current = { code: '', at: 0 };
              submit(code);
            }}
          >
            <span className="field-box" style={{ flex: 1, height: 44 }}>
              <Ticket size={17} />
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Or type a code, e.g. UE-7KQ2MZ4P" aria-label="Ticket code" style={{ fontFamily: 'var(--mono)' }} />
            </span>
            <button className="btn primary">Check in</button>
          </form>
          {msg && (
            <div className={`alert ${msg.ok ? 'success' : 'error'}`} role="status">
              {msg.text}
            </div>
          )}
        </div>
        <div className="pad" style={{ display: 'grid', gap: 10, alignContent: 'start' }}>
          <div className="row-between">
            <h3 style={{ fontSize: 18 }}>Checked in</h3>
            <b style={{ font: '700 24px var(--display)' }}>
              {count} / {event?.registeredCount ?? '–'}
            </b>
          </div>
          <div className="capacity large">
            <i style={{ width: `${pct}%`, background: 'var(--good)' }} />
          </div>
          <span className="muted small">{pct}% of registered students have arrived</span>
          <div className="att-list">
            {list.length ? (
              list.map((a) => (
                <div className={`att ${a.fresh ? 'fresh' : ''}`} key={a._id}>
                  <span className="avatar" style={{ width: 32, height: 32, fontSize: 12 }}>{initials(a.student?.name)}</span>
                  <div>
                    <b>{a.student?.name}</b>
                    <div className="muted tiny">{a.student?.rollNumber || 'Ticket verified'}</div>
                  </div>
                  <time>{time(a.markedAt)}</time>
                </div>
              ))
            ) : (
              <p className="muted small" style={{ padding: '18px 0' }}>Nobody has been checked in yet.</p>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
