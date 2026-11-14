import { Router } from "express";
import crypto from "crypto";
import { body } from "express-validator";
import { User, Club, Category, Event, Registration, Attendance, Notification, AuditLog } from "../models/index.js";
import { protect, allowRoles, ownerOrAdmin } from "../middleware/auth.js";
import { signToken, hashPassword, comparePassword, notify, audit, fail, asyncHandler } from "../utils/core.js";
import { PW_RE, sha, esc, roleList, allowedClient, validate, safe } from "../utils/http.js";
import { sendMail, templates } from "../utils/mailer.js";

const r = Router();
const buildReport = async (req) => {
  const match = {};
  if (req.user.role !== 'admin') match.organizer = req.user._id;
  if (req.query.from || req.query.to)
    match.startAt = {
      ...(req.query.from ? { $gte: new Date(req.query.from) } : {}),
      ...(req.query.to ? { $lte: new Date(req.query.to) } : {}),
    };
  if (req.query.category) match.category = req.query.category;
  const events = await Event.find(match).populate('category', 'name').populate('organizer', 'name').lean();
  const regs = await Registration.find({ event: { $in: events.map((e) => e._id) } }).lean();
  const count = (arr, f) =>
    Object.entries(
      arr.reduce((a, x) => {
        const k = f(x);
        a[k] = (a[k] || 0) + 1;
        return a;
      }, {}),
    ).map(([name, value]) => ({ name, value }));
  const attended = regs.filter((x) => x.status === 'Attended').length;
  const marked = regs.filter((x) => ['Attended', 'Not attended'].includes(x.status)).length;
  const perEvent = events.map((e) => {
    const rs = regs.filter((x) => String(x.event) === String(e._id));
    return {
      title: e.title,
      status: e.status,
      startAt: e.startAt,
      capacity: e.capacity,
      registeredCount: e.registeredCount,
      waitlisted: rs.filter((x) => x.status === 'Waitlisted').length,
      attended: rs.filter((x) => x.status === 'Attended').length,
      absent: rs.filter((x) => x.status === 'Not attended').length,
      fillRate: e.capacity ? Math.round((e.registeredCount / e.capacity) * 100) : 0,
      organizer: e.organizer?.name || '—',
    };
  });
  const orgMap = {};
  for (const e of perEvent) {
    const o =
      orgMap[e.organizer] || (orgMap[e.organizer] = { name: e.organizer, events: 0, registrations: 0 });
    o.events++;
    o.registrations += e.registeredCount || 0;
  }
  return {
    summary: {
      events: events.length,
      registrations: regs.length,
      completed: events.filter((e) => ['Completed', 'Archived'].includes(e.status)).length,
      attendanceRate: marked ? Math.round((attended / marked) * 100) : 0,
    },
    byStatus: count(events, (e) => e.status),
    byCategory: count(events, (e) => e.category?.name || 'Other'),
    registrationsByStatus: count(regs, (x) => x.status),
    trend: count(events, (e) => new Date(e.startAt).toISOString().slice(0, 7)).sort((a, b) =>
      a.name.localeCompare(b.name),
    ),
    organizers: Object.values(orgMap).sort((a, b) => b.registrations - a.registrations),
    events: perEvent,
  };
};
r.get(
  '/reports/:type',
  protect,
  allowRoles('faculty', 'club', 'admin'),
  asyncHandler(async (req, res) =>
    res.json({ success: true, report: req.params.type, data: await buildReport(req) }),
  ),
);
r.get(
  '/reports/:type/export',
  protect,
  allowRoles('faculty', 'club', 'admin'),
  asyncHandler(async (req, res) => {
    const d = await buildReport(req);
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = [
      [
        'Event',
        'Status',
        'Date',
        'Capacity',
        'Registered',
        'Waitlisted',
        'Attended',
        'Absent',
        'Fill rate %',
        'Organizer',
      ],
      ...d.events.map((e) => [
        e.title,
        e.status,
        new Date(e.startAt).toISOString().slice(0, 10),
        e.capacity,
        e.registeredCount,
        e.waitlisted,
        e.attended,
        e.absent,
        e.fillRate,
        e.organizer,
      ]),
    ];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="unievents-report.csv"');
    res.send(rows.map((x) => x.map(q).join(',')).join('\n'));
  }),
);

export default r;
