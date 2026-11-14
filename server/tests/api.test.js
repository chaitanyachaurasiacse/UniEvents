// API tests. They run against a throw-away in-memory MongoDB and never send real e-mail.
import { beforeAll, afterAll, beforeEach, describe, it, expect } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryReplSet } from 'mongodb-memory-server';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.BREVO_API_KEY = '';
process.env.MAIL_REDIRECT_TO = '';
process.env.UNIVERSITY_DOMAINS = 'bbdu.ac.in';

let mongo, app, M, hash;
const PW = 'Test@1234';
const HOUR = 36e5;
const iso = (h) => new Date(Date.now() + h * HOUR).toISOString();

beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri());
  app = (await import('../src/app.js')).default;
  M = await import('../src/models/index.js');
  hash = (await import('../src/utils/core.js')).hashPassword;
}, 120000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
});

let users, cat, tokens;
const login = async (email) => (await request(app).post('/api/auth/login').send({ email, password: PW })).body.token;
const as = (role) => ({ Authorization: `Bearer ${tokens[role]}` });
const eventBody = (over = {}) => ({
  title: 'Test Event Title', summary: 'A short summary for tests', description: 'A long enough description for the test event.',
  category: String(cat._id), venue: 'Seminar Hall 1', startAt: iso(48), endAt: iso(50), registrationDeadline: iso(40), capacity: 2, waitlistEnabled: true, ...over,
});
async function approvedEvent(over = {}) {
  const e = (await request(app).post('/api/events').set(as('faculty')).send(eventBody(over))).body.event;
  await request(app).post(`/api/events/${e._id}/submit`).set(as('faculty'));
  await request(app).put(`/api/events/${e._id}/approve`).set(as('admin'));
  return e;
}

beforeEach(async () => {
  await Promise.all(Object.values(mongoose.connection.collections).map((c) => c.deleteMany({})));
  const passwordHash = await hash(PW);
  const mk = (name, email, role, rollNumber) => ({ name, email, role, passwordHash, rollNumber, isActive: true });
  users = await M.User.insertMany([
    mk('Admin', 'admin@bbdu.ac.in', 'admin'),
    mk('Dr. Ramesh Vaishya', 'faculty@bbdu.ac.in', 'faculty'),
    mk('Club', 'club@bbdu.ac.in', 'club'),
    mk('Chaitanya Chaurasia', 's1@bbdu.ac.in', 'student', '1230439111'),
    mk('Divyanshu', 's2@bbdu.ac.in', 'student', '1230439121'),
    mk('Arijit Tiwari', 's3@bbdu.ac.in', 'student', '1230439077'),
  ]);
  cat = await M.Category.create({ name: 'Technology' });
  const [admin, faculty, club, s1, s2, s3] = await Promise.all(['admin', 'faculty', 'club', 's1', 's2', 's3'].map((u) => login(`${u}@bbdu.ac.in`)));
  tokens = { admin, faculty, club, s1, s2, s3 };
});

describe('authentication', () => {
  it('signs in with correct credentials and rejects wrong ones', async () => {
    expect(tokens.s1).toBeTruthy();
    const bad = await request(app).post('/api/auth/login').send({ email: 's1@bbdu.ac.in', password: 'wrong' });
    expect(bad.status).toBe(401);
  });
  it('locks the account after five failed attempts', async () => {
    for (let i = 0; i < 5; i++) await request(app).post('/api/auth/login').send({ email: 's2@bbdu.ac.in', password: 'wrong' });
    const r = await request(app).post('/api/auth/login').send({ email: 's2@bbdu.ac.in', password: PW });
    expect(r.status).toBe(423);
  });
  it('requires a token for protected routes', async () => {
    expect((await request(app).get('/api/events')).status).toBe(401);
  });
  it('only lets university e-mail addresses register', async () => {
    const r = await request(app).post('/api/auth/register').send({ name: 'Outsider', email: 'x@example.com', rollNumber: '1234567', password: PW, confirmPassword: PW });
    expect(r.status).toBe(422);
  });
  it('does not reveal whether an e-mail exists on password reset', async () => {
    const a = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@bbdu.ac.in' });
    const b = await request(app).post('/api/auth/forgot-password').send({ email: 's1@bbdu.ac.in' });
    expect(a.body.message).toBe(b.body.message);
  });
});

describe('roles', () => {
  it('blocks students from admin and organizer actions', async () => {
    expect((await request(app).get('/api/admin/overview').set(as('s1'))).status).toBe(403);
    expect((await request(app).post('/api/events').set(as('s1')).send(eventBody())).status).toBe(403);
  });
  it('stops organizers from approving events', async () => {
    const e = (await request(app).post('/api/events').set(as('faculty')).send(eventBody())).body.event;
    expect((await request(app).put(`/api/events/${e._id}/approve`).set(as('faculty'))).status).toBe(403);
  });
  it('hides draft events from other users', async () => {
    const e = (await request(app).post('/api/events').set(as('faculty')).send(eventBody())).body.event;
    expect((await request(app).get(`/api/events/${e._id}`).set(as('s1'))).status).toBe(404);
  });
});

describe('event lifecycle and validation', () => {
  it('rejects invalid event data with a readable message', async () => {
    const r = await request(app).post('/api/events').set(as('faculty')).send(eventBody({ title: 'x', capacity: 0 }));
    expect(r.status).toBe(422);
    expect(r.body.error.details.map((d) => d.msg).join(' ')).toMatch(/Title must be/);
  });
  it('rejects an end time before the start time', async () => {
    const r = await request(app).post('/api/events').set(as('faculty')).send(eventBody({ endAt: iso(47) }));
    expect(r.status).toBe(422);
  });
  it('goes draft → pending → approved and becomes public', async () => {
    const e = await approvedEvent();
    const pub = await request(app).get('/api/public/events');
    expect(pub.body.items.map((x) => x._id)).toContain(e._id);
  });
  it('requires a 20-character reason to reject', async () => {
    const e = (await request(app).post('/api/events').set(as('faculty')).send(eventBody())).body.event;
    await request(app).post(`/api/events/${e._id}/submit`).set(as('faculty'));
    expect((await request(app).put(`/api/events/${e._id}/reject`).set(as('admin')).send({ reason: 'no' })).status).toBe(422);
    expect((await request(app).put(`/api/events/${e._id}/reject`).set(as('admin')).send({ reason: 'The venue is under renovation that week.' })).status).toBe(200);
  });
  it('blocks approving an event that clashes with a booked venue', async () => {
    await approvedEvent();
    const clash = (await request(app).post('/api/events').set(as('faculty')).send(eventBody({ title: 'Clashing Event', startAt: iso(49), endAt: iso(51) }))).body.event;
    const r = await request(app).post(`/api/events/${clash._id}/submit`).set(as('faculty'));
    expect(r.status).toBe(409);
    expect(r.body.error.code).toBe('VENUE_CLASH');
  });
});

describe('registration, seats and waitlist', () => {
  it('confirms seats up to capacity, then waitlists', async () => {
    const e = await approvedEvent({ capacity: 1 });
    expect((await request(app).post(`/api/events/${e._id}/register`).set(as('s1'))).body.registration.status).toBe('Confirmed');
    expect((await request(app).post(`/api/events/${e._id}/register`).set(as('s2'))).body.registration.status).toBe('Waitlisted');
  });
  it('never sells more seats than capacity, even with simultaneous requests', async () => {
    const e = await approvedEvent({ capacity: 1, waitlistEnabled: false });
    const rs = await Promise.all(['s1', 's2', 's3'].map((s) => request(app).post(`/api/events/${e._id}/register`).set(as(s))));
    expect(rs.filter((r) => r.status === 201)).toHaveLength(1);
    expect((await M.Event.findById(e._id)).registeredCount).toBe(1);
  });
  it('blocks registering twice', async () => {
    const e = await approvedEvent();
    await request(app).post(`/api/events/${e._id}/register`).set(as('s1'));
    expect((await request(app).post(`/api/events/${e._id}/register`).set(as('s1'))).status).toBe(409);
  });
  it('promotes the first waitlisted student when someone cancels', async () => {
    const e = await approvedEvent({ capacity: 1 });
    await request(app).post(`/api/events/${e._id}/register`).set(as('s1'));
    await request(app).post(`/api/events/${e._id}/register`).set(as('s2'));
    await request(app).delete(`/api/events/${e._id}/register`).set(as('s1'));
    const reg = await M.Registration.findOne({ event: e._id, student: users[4]._id });
    expect(reg.status).toBe('Confirmed');
  });
  it('gives every registration a ticket code', async () => {
    const e = await approvedEvent();
    const r = await request(app).post(`/api/events/${e._id}/register`).set(as('s1'));
    expect(r.body.registration.ticketCode).toMatch(/^UE-[A-Z0-9]{8}$/);
  });
});

describe('check-in and certificates', () => {
  async function ticketForStartingEvent() {
    const e = await approvedEvent({ startAt: iso(1), endAt: iso(3), registrationDeadline: iso(0.5) });
    const reg = (await request(app).post(`/api/events/${e._id}/register`).set(as('s1'))).body.registration;
    return { e, code: reg.ticketCode };
  }
  it('checks a ticket in once and rejects a second scan', async () => {
    const { e, code } = await ticketForStartingEvent();
    expect((await request(app).post(`/api/events/${e._id}/checkin`).set(as('faculty')).send({ code })).status).toBe(200);
    const again = await request(app).post(`/api/events/${e._id}/checkin`).set(as('faculty')).send({ code });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe('DUPLICATE');
  });
  it('rejects malformed codes and other organizers', async () => {
    const { e, code } = await ticketForStartingEvent();
    expect((await request(app).post(`/api/events/${e._id}/checkin`).set(as('faculty')).send({ code: 'hello' })).status).toBe(422);
    expect((await request(app).post(`/api/events/${e._id}/checkin`).set(as('club')).send({ code })).status).toBe(403);
  });
  it('does not open check-in days before the event', async () => {
    const e = await approvedEvent();
    const reg = (await request(app).post(`/api/events/${e._id}/register`).set(as('s1'))).body.registration;
    const r = await request(app).post(`/api/events/${e._id}/checkin`).set(as('faculty')).send({ code: reg.ticketCode });
    expect(r.body.error.code).toBe('NOT_OPEN');
  });
  it('issues a public certificate only after attendance', async () => {
    const { e, code } = await ticketForStartingEvent();
    expect((await request(app).get(`/api/certificates/${code}`)).status).toBe(404);
    await request(app).post(`/api/events/${e._id}/checkin`).set(as('faculty')).send({ code });
    const c = await request(app).get(`/api/certificates/${code}`);
    expect(c.status).toBe(200);
    expect(c.body.certificate.student).toBe('Chaitanya Chaurasia');
  });
});

describe('reports and stats', () => {
  it('returns 30 days of trend data scoped to the organizer', async () => {
    const e = await approvedEvent();
    await request(app).post(`/api/events/${e._id}/register`).set(as('s1'));
    const f = await request(app).get('/api/stats/overview').set(as('faculty'));
    expect(f.body.trend).toHaveLength(30);
    expect(f.body.trend.reduce((a, d) => a + d.value, 0)).toBe(1);
    const c = await request(app).get('/api/stats/overview').set(as('club'));
    expect(c.body.trend.reduce((a, d) => a + d.value, 0)).toBe(0);
  });
  it('exports the events report as CSV', async () => {
    await approvedEvent();
    const r = await request(app).get('/api/reports/events/export').set(as('admin'));
    expect(r.headers['content-type']).toMatch(/text\/csv/);
    expect(r.text.split('\n')[0]).toMatch(/^"Event","Status"/);
  });
});
