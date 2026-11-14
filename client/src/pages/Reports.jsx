import React, { useEffect, useState } from "react";
import { CalendarDays, Users, CheckCircle2, ChartNoAxesCombined, FileText } from "lucide-react";
import { api } from "../api";
import { date } from "../lib/format";
import { PageTitle, Stat, Status, Empty } from "../components/ui";

export function Reports() {
  const [data, setData] = useState(null),
    [type, setType] = useState('events'),
    [range, setRange] = useState({ from: '', to: '' }),
    [error, setError] = useState('');
  const params = { from: range.from || undefined, to: range.to || undefined };
  useEffect(() => {
    setError('');
    api
      .get(`/reports/${type}`, { params })
      .then((x) => setData(x.data))
      .catch((e) => setError(e.message));
  }, [type, range.from, range.to]);
  const exportCsv = async () => {
    try {
      const blob = await api.get(`/reports/${type}/export`, { params, responseType: 'blob' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([blob], { type: 'text/csv' }));
      a.download = 'unievents-report.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setError(e.message);
    }
  };
  const Bars = ({ title, rows }) => (
    <div className="table-card pad">
      <h3>{title}</h3>
      {rows.length ? (
        rows.map((x) => (
          <div className="bar-row" key={x.name}>
            <span>{x.name}</span>
            <div className="bar">
              <i style={{ width: `${(100 * x.value) / Math.max(1, ...rows.map((y) => y.value))}%` }} />
            </div>
            <b>{x.value}</b>
          </div>
        ))
      ) : (
        <p className="muted">No data for this period.</p>
      )}
    </div>
  );
  const done = data ? data.events.filter((e) => ['Completed', 'Archived'].includes(e.status)) : [];
  return (
    <>
      <PageTitle
        eyebrow="INSIGHTS & PERFORMANCE"
        title="Reports and Analytics"
        sub="Review event activity and participation using stored system data."
        action={
          <button className="btn secondary" onClick={exportCsv}>
            <FileText size={16} /> Export CSV
          </button>
        }
      />
      <div className="tabs">
        {['events', 'registrations', 'attendance', 'trends', 'organizers'].map((t) => (
          <button className={type === t ? 'selected' : ''} onClick={() => setType(t)} key={t}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="inline-add">
        <label className="small">
          From{' '}
          <input
            type="date"
            value={range.from}
            onChange={(e) => setRange({ ...range, from: e.target.value })}
          />
        </label>
        <label className="small">
          To{' '}
          <input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
        </label>
        {(range.from || range.to) && (
          <button className="text-btn" onClick={() => setRange({ from: '', to: '' })}>
            Clear dates
          </button>
        )}
      </div>
      {error && <div className="alert error">{error}</div>}
      {data && (
        <>
          <div className="stats-grid">
            <Stat label="Events" value={data.summary.events} icon={CalendarDays} />
            <Stat label="Registrations" value={data.summary.registrations} icon={Users} />
            <Stat label="Completed" value={data.summary.completed} icon={CheckCircle2} />
            <Stat
              label="Attendance rate"
              value={`${data.summary.attendanceRate}%`}
              icon={ChartNoAxesCombined}
            />
          </div>
          {type === 'events' && (
            <>
              <div className="two-col">
                <Bars title="Events by status" rows={data.byStatus} />
                <Bars title="Events by category" rows={data.byCategory} />
              </div>
              <div className="table-card">
                <table>
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Date</th>
                      <th>Capacity</th>
                      <th>Registered</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.map((e, i) => (
                      <tr key={i}>
                        <td>{e.title}</td>
                        <td>{date(e.startAt)}</td>
                        <td>{e.capacity}</td>
                        <td>{e.registeredCount}</td>
                        <td>
                          <Status value={e.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {type === 'registrations' && (
            <>
              <div className="two-col">
                <Bars title="Registrations by status" rows={data.registrationsByStatus} />
                <Bars
                  title="Fill rate by event (%)"
                  rows={data.events.map((e) => ({ name: e.title, value: e.fillRate }))}
                />
              </div>
              <div className="table-card">
                <table>
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Capacity</th>
                      <th>Registered</th>
                      <th>Waitlisted</th>
                      <th>Fill rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.events.map((e, i) => (
                      <tr key={i}>
                        <td>{e.title}</td>
                        <td>{e.capacity}</td>
                        <td>{e.registeredCount}</td>
                        <td>{e.waitlisted}</td>
                        <td>{e.fillRate}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {type === 'attendance' && (
            <div className="table-card">
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Registered</th>
                    <th>Attended</th>
                    <th>Absent</th>
                    <th>Attendance</th>
                  </tr>
                </thead>
                <tbody>
                  {done.map((e, i) => (
                    <tr key={i}>
                      <td>{e.title}</td>
                      <td>{date(e.startAt)}</td>
                      <td>{e.registeredCount}</td>
                      <td>{e.attended}</td>
                      <td>{e.absent}</td>
                      <td>
                        {e.attended + e.absent
                          ? Math.round((100 * e.attended) / (e.attended + e.absent)) + '%'
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!done.length && (
                <Empty
                  title="No completed events"
                  text="Attendance appears here once events are completed."
                />
              )}
            </div>
          )}
          {type === 'trends' && (
            <div className="two-col">
              <Bars title="Events per month" rows={data.trend} />
              <Bars title="Events by category" rows={data.byCategory} />
            </div>
          )}
          {type === 'organizers' && (
            <div className="table-card">
              <table>
                <thead>
                  <tr>
                    <th>Organizer</th>
                    <th>Events</th>
                    <th>Registrations</th>
                  </tr>
                </thead>
                <tbody>
                  {data.organizers.map((o) => (
                    <tr key={o.name}>
                      <td>{o.name}</td>
                      <td>{o.events}</td>
                      <td>{o.registrations}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!data.organizers.length && <Empty title="No data" text="No events in this period." />}
            </div>
          )}
        </>
      )}
    </>
  );
}

