import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, Users, CheckCircle2 } from "lucide-react";
import { api } from "../../api";
import { date } from "../../lib/format";
import { saveFile } from "../../lib/native";
import { PageTitle, Stat, Status, useParamsSafe, Empty, AskModal } from "../../components/ui";

export function ManageEvent() {
  const { id } = useParamsSafe(),
    [event, setEvent] = useState(null),
    [people, setPeople] = useState([]),
    [error, setError] = useState(''),
    [ask, setAsk] = useState(false);
  const load = () => {
    api
      .get(`/events/${id}`)
      .then((x) => setEvent(x.event))
      .catch((e) => setError(e.message));
    api
      .get(`/events/${id}/participants`)
      .then((x) => setPeople(x.items))
      .catch((e) => setError(e.message));
  };
  useEffect(() => {
    load();
  }, [id]);
  const attendance = async (r, status) => {
    try {
      await api.put(`/registrations/${r._id}/attendance`, { status });
      load();
    } catch (e) {
      setError(e.message);
    }
  };
  const submitEvent = async () => {
    try {
      await api.post(`/events/${id}/submit`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };
  const completeEvent = async () => {
    try {
      await api.put(`/events/${id}/complete`);
      load();
    } catch (e) {
      setError(e.message);
    }
  };
  const exportCsv = () => {
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Name', 'Email', 'Roll number', 'Department', 'Year', 'Status'],
      ...people.map((r) => [
        r.student?.name,
        r.student?.email,
        r.student?.rollNumber,
        r.student?.department,
        r.student?.year,
        r.status,
      ]),
    ];
    saveFile('participants.csv', rows.map((x) => x.map(q).join(',')).join('\n')).catch((e) => setError(e.message));
  };
  if (!event) return <div className="loading">{error || 'Loading…'}</div>;
  return (
    <>
      <PageTitle
        eyebrow="EVENT OPERATIONS"
        title={event.title}
        sub={`${event.venue} · ${date(event.startAt)}`}
      />
      <div className="manage-actions">
        <Link className="btn secondary" to={`/event/${event._id}`}>
          View event page
        </Link>
        <Link className="btn secondary" to={`/edit/${event._id}`}>
          Edit
        </Link>
        {['Approved', 'Ongoing'].includes(event.status) && (
          <Link className="btn gold" to={`/checkin/${event._id}`}>
            Open door check-in
          </Link>
        )}
        {['Draft', 'Changes Requested', 'Rejected'].includes(event.status) && (
          <button className="btn primary" onClick={submitEvent}>
            Submit for approval
          </button>
        )}
        {['Approved', 'Ongoing'].includes(event.status) && new Date() >= new Date(event.endAt) && (
          <button className="btn primary" onClick={completeEvent}>
            Close event
          </button>
        )}
        {!['Completed', 'Cancelled', 'Archived'].includes(event.status) && (
          <button className="btn danger-outline" onClick={() => setAsk(true)}>
            Cancel event
          </button>
        )}
        <button className="btn secondary" onClick={exportCsv} disabled={!people.length}>
          Export participants (CSV)
        </button>
      </div>
      {ask && (
        <AskModal
          title="Cancel this event"
          label="Reason (shown to registered students)"
          min={5}
          confirmText="Cancel event"
          onSubmit={async (t) => {
            await api.put(`/events/${id}/cancel`, { reason: t });
            load();
          }}
          onClose={() => setAsk(false)}
        />
      )}
      {error && <div className="alert error">{error}</div>}
      <div className="stats-grid">
        <Stat label="Registered" value={event.registeredCount} icon={Users} />
        <Stat label="Capacity" value={event.capacity} icon={CalendarDays} />
        <Stat label="Status" value={event.status} icon={CheckCircle2} />
      </div>
      <div className="section-head">
        <div>
          <h2>Participants and attendance</h2>
          <p>Mark each registered participant as attended or not attended.</p>
        </div>
      </div>
      <div className="table-card">
        <table>
          <thead>
            <tr>
              <th>Student</th>
              <th>Roll number</th>
              <th>Department</th>
              <th>Status</th>
              <th>Attendance</th>
            </tr>
          </thead>
          <tbody>
            {people.map((r) => (
              <tr key={r._id}>
                <td>{r.student?.name}</td>
                <td>{r.student?.rollNumber}</td>
                <td>{r.student?.department}</td>
                <td>
                  <Status value={r.status} />
                </td>
                <td>
                  <button
                    className="btn tiny secondary"
                    disabled={['Waitlisted', 'Cancelled'].includes(r.status)}
                    onClick={() => attendance(r, 'Attended')}
                  >
                    Present
                  </button>{' '}
                  <button
                    className="btn tiny secondary"
                    disabled={['Waitlisted', 'Cancelled'].includes(r.status)}
                    onClick={() => attendance(r, 'Not attended')}
                  >
                    Absent
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!people.length && (
          <Empty title="No registrations yet" text="Participants will appear here after they register." />
        )}
      </div>
    </>
  );
}
