import React from "react";

export const roles = { student: 'Student', faculty: 'Faculty', club: 'Club Organizer', admin: 'Administrator' };
export const initials = (n) =>
  (n || 'U')
    .split(' ')
    .filter((x) => /^[A-Z]/.test(x) && !/^(Dr|Prof|Mr|Ms|Mrs).?$/.test(x))
    .map((x) => x[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
export const date = (d) =>
  d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const datetime = (d) =>
  d
    ? new Date(d).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        hour: 'numeric',
        minute: '2-digit',
      })
    : '—';
export function toLocal(d) {
  if (!d) return '';
  const x = new Date(d);
  return new Date(x.getTime() - x.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}
export const PW_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,20}$/;

/** "Sat 14 Nov, 3:00 – 9:00 pm" for one day, otherwise both dates. */
export const timeRange = (a, b) => {
  const s = new Date(a), e = new Date(b);
  const day = (d) => d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  const t = (d) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  return s.toDateString() === e.toDateString() ? `${day(s)}, ${t(s)} – ${t(e)}` : `${day(s)}, ${t(s)} – ${day(e)}, ${t(e)}`;
};
/** Google Calendar "add event" link. */
export const calendarUrl = (e) => {
  const z = (d) => new Date(d).toISOString().replace(/[-:]/g, '').replace(/.d{3}/, '');
  const q = new URLSearchParams({ action: 'TEMPLATE', text: e.title, dates: `${z(e.startAt)}/${z(e.endAt)}`, location: e.venue || '', details: e.summary || '' });
  return `https://calendar.google.com/calendar/render?${q}`;
};
