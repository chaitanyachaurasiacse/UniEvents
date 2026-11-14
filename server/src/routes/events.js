import { Router } from "express";
import crypto from "crypto";
import { body } from "express-validator";
import { User, Club, Category, Event, Registration, Attendance, Notification, AuditLog } from "../models/index.js";
import { protect, allowRoles, ownerOrAdmin } from "../middleware/auth.js";
import { signToken, hashPassword, comparePassword, notify, audit, fail, asyncHandler } from "../utils/core.js";
import { PW_RE, sha, esc, roleList, allowedClient, validate, safe } from "../utils/http.js";
import { sendMail, templates } from "../utils/mailer.js";
import { eventRules, announcementRules, staffRules, profileRules, nameRules } from "../utils/validators.js";

const r = Router();
// Public, read-only list for the landing page: approved upcoming events, no personal data.
r.get(
  "/public/events",
  asyncHandler(async (req, res) => {
    const items = await Event.find({ status: { $in: ["Approved", "Ongoing"] }, endAt: { $gte: new Date() } })
      .select("title summary venue startAt endAt capacity registeredCount waitlistEnabled imageUrl category featured")
      .populate("category", "name")
      .sort("startAt")
      .limit(8)
      .lean();
    const [upcoming, seats] = await Promise.all([
      Event.countDocuments({ status: { $in: ["Approved", "Ongoing"] }, endAt: { $gte: new Date() } }),
      Event.aggregate([{ $match: { status: { $in: ["Approved", "Ongoing"] } } }, { $group: { _id: null, cap: { $sum: "$capacity" }, reg: { $sum: "$registeredCount" } } }]),
    ]);
    res.json({ success: true, items, stats: { upcoming, seats: seats[0]?.cap || 0, registrations: seats[0]?.reg || 0 } });
  }),
);
// Public-to-authenticated event directory
r.get(
  '/events',
  protect,
  asyncHandler(async (req, res) => {
    const q = { status: { $in: ['Approved', 'Ongoing', 'Completed', 'Cancelled'] } };
    if (req.query.q)
      q.$or = [
        { title: new RegExp(esc(req.query.q), 'i') },
        { description: new RegExp(esc(req.query.q), 'i') },
        { venue: new RegExp(esc(req.query.q), 'i') },
      ];
    if (req.query.category) q.category = req.query.category;
    if (req.query.from || req.query.to)
      q.startAt = {
        ...(req.query.from ? { $gte: new Date(req.query.from) } : {}),
        ...(req.query.to ? { $lte: new Date(req.query.to) } : {}),
      };
    if (req.query.status) q.status = req.query.status;
    if (req.query.upcoming === 'true') {
      q.status = { $in: ['Approved', 'Ongoing'] };
      q.endAt = { $gte: new Date() };
    }
    if (req.query.scope === 'all' && req.user.role === 'admin' && !req.query.status) delete q.status;
    const page = Math.max(1, +req.query.page || 1),
      limit = Math.min(50, +req.query.limit || 12);
    const [items, total] = await Promise.all([
      Event.find(q)
        .populate('category', 'name colour')
        .populate('organizer', 'name role')
        .sort(req.query.sort === 'date' ? 'startAt' : '-createdAt')
        .skip((page - 1) * limit)
        .limit(limit),
      Event.countDocuments(q),
    ]);
    res.json({ success: true, items, total, page, pages: Math.ceil(total / limit) });
  }),
);
r.get(
  '/events/featured',
  protect,
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      items: await Event.find({ status: 'Approved', featured: true, startAt: { $gte: new Date() } })
        .populate('category', 'name colour')
        .sort('startAt')
        .limit(5),
    }),
  ),
);
r.get(
  '/events/mine',
  protect,
  allowRoles('faculty', 'club'),
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      items: await Event.find({ organizer: req.user._id })
        .populate('category', 'name colour')
        .sort('-createdAt'),
    }),
  ),
);
r.get(
  '/events/pending',
  protect,
  allowRoles('admin'),
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      items: await Event.find({ status: 'Pending' })
        .populate('organizer', 'name email role')
        .populate('category', 'name colour')
        .sort('submittedAt'),
    }),
  ),
);
r.get(
  '/events/:id',
  protect,
  asyncHandler(async (req, res) => {
    const e = await Event.findById(req.params.id)
      .populate('category', 'name colour')
      .populate('organizer', 'name email')
      .populate('club', 'name');
    if (!e) return fail(res, 404, 'Event not found', 'NOT_FOUND');
    if (
      ['Draft', 'Pending', 'Rejected', 'Changes Requested'].includes(e.status) &&
      req.user.role !== 'admin' &&
      String(e.organizer._id) !== String(req.user._id)
    )
      return fail(res, 404, 'Event not found', 'NOT_FOUND');
    const registration =
      req.user.role === 'student'
        ? await Registration.findOne({ event: e._id, student: req.user._id, status: { $ne: 'Cancelled' } })
        : null;
    res.json({ success: true, event: e, registration });
  }),
);

// Another live or pending event in the same venue whose time overlaps this one.
const findClash = (e) =>
  Event.findOne({
    _id: { $ne: e._id },
    venue: new RegExp("^" + esc(e.venue.trim()) + "$", "i"),
    status: { $in: ["Pending", "Approved", "Ongoing"] },
    startAt: { $lt: e.endAt },
    endAt: { $gt: e.startAt },
  }).select("title startAt endAt status");
const clashMessage = (c) =>
  `The venue is already booked for "${c.title}" (${new Date(c.startAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })}). Choose another venue or time.`;
const eventFields = [
  'title',
  'summary',
  'description',
  'category',
  'venue',
  'startAt',
  'endAt',
  'registrationOpensAt',
  'registrationDeadline',
  'capacity',
  'club',
  'featured',
  'waitlistEnabled',
  'imageUrl',
  'eligibility',
];
r.post(
  '/events',
  protect,
  allowRoles('faculty', 'club'),
  eventRules(false),
  asyncHandler(async (req, res) => {
    const data = {};
    for (const k of eventFields) if (req.body[k] !== undefined) data[k] = req.body[k];
    data.organizer = req.user._id;
    if (data.startAt && data.endAt && new Date(data.endAt) <= new Date(data.startAt))
      return fail(res, 422, 'The end time must be after the start time.', 'INVALID_DATES');
    if (req.user.role === 'club' && !data.club) {
      const c = await Club.findOne({ coordinator: req.user._id, isActive: true });
      if (c) data.club = c._id;
    }
    if (!data.club) delete data.club;
    const e = await Event.create(data);
    e.statusHistory.push({ status: 'Draft', by: req.user._id });
    await e.save();
    res.status(201).json({ success: true, event: e });
  }),
);
r.put(
  '/events/:id',
  protect,
  ownerOrAdmin,
  eventRules(true),
  asyncHandler(async (req, res) => {
    const e = req.event;
    if (
      req.user.role !== 'admin' &&
      !['Draft', 'Changes Requested', 'Rejected', 'Approved'].includes(e.status)
    )
      return fail(res, 409, 'This event cannot be edited in its current status.', 'INVALID_STATE');
    const old = { venue: e.venue, startAt: e.startAt, endAt: e.endAt, description: e.description };
    for (const k of eventFields)
      if (req.body[k] !== undefined && !(k === 'club' && !req.body[k])) e[k] = req.body[k];
    if (new Date(e.endAt) <= new Date(e.startAt))
      return fail(res, 422, 'The end time must be after the start time.', 'INVALID_DATES');
    if (e.capacity < e.registeredCount)
      return fail(
        res,
        422,
        'Capacity cannot be lower than the number of registered participants.',
        'VALIDATION',
      );
    if (
      e.status === 'Approved' &&
      (old.venue !== e.venue ||
        String(old.startAt) !== String(e.startAt) ||
        String(old.endAt) !== String(e.endAt) ||
        old.description !== e.description)
    ) {
      e.status = 'Pending';
      e.submittedAt = new Date();
      e.statusHistory.push({
        status: 'Pending',
        by: req.user._id,
        note: 'Major change requires re-approval',
      });
      const admins = await User.find({ role: 'admin', isActive: true });
      for (const a of admins)
        await notify(a._id, 'Event resubmitted', `${e.title} requires review.`, 'approval', e._id);
    }
    await e.save();
    res.json({ success: true, event: e });
  }),
);
r.post(
  '/events/:id/submit',
  protect,
  ownerOrAdmin,
  asyncHandler(async (req, res) => {
    const e = req.event;
    if (!['Draft', 'Changes Requested', 'Rejected'].includes(e.status))
      return fail(res, 409, 'This event cannot be submitted in its current status.', 'INVALID_STATE');
    if (
      !e.title ||
      !e.summary ||
      !e.description ||
      !e.category ||
      !e.venue ||
      !e.startAt ||
      !e.endAt ||
      !e.registrationDeadline ||
      !e.capacity
    )
      return fail(res, 422, 'Complete all required event fields before submitting.', 'VALIDATION');
    if (new Date(e.endAt) <= new Date(e.startAt) || new Date(e.registrationDeadline) > new Date(e.startAt))
      return fail(res, 422, 'Check the event dates and registration deadline.', 'INVALID_DATES');
    const clashS = await findClash(e);
    if (clashS) return fail(res, 409, clashMessage(clashS), 'VENUE_CLASH');
    if (e.changeRequestCount > 3)
      return fail(res, 409, 'The maximum number of change requests has been reached.', 'LIMIT');
    e.status = 'Pending';
    e.submittedAt = new Date();
    e.statusHistory.push({ status: 'Pending', by: req.user._id });
    await e.save();
    for (const a of await User.find({ role: 'admin', isActive: true }))
      await notify(a._id, 'New event submitted', `${e.title} is awaiting review.`, 'approval', e._id);
    res.json({ success: true, event: e });
  }),
);
r.put(
  '/events/:id/approve',
  protect,
  allowRoles('admin'),
  asyncHandler(async (req, res) => {
    const e = await Event.findById(req.params.id);
    if (!e) return fail(res, 404, 'Event not found');
    if (String(e.organizer) === String(req.user._id))
      return fail(res, 403, 'An administrator cannot approve their own event.');
    if (e.status !== 'Pending') return fail(res, 409, 'Only pending events can be approved.');
    const clashA = await findClash(e);
    if (clashA && clashA.status !== 'Pending') return fail(res, 409, clashMessage(clashA), 'VENUE_CLASH');
    e.status = 'Approved';
    e.approvedBy = req.user._id;
    e.reviewedAt = new Date();
    e.statusHistory.push({ status: 'Approved', by: req.user._id });
    await e.save();
    await notify(
      e.organizer,
      'Event approved',
      `Your event ${e.title} has been approved and published.`,
      'approval',
      e._id,
    );
    User.findById(e.organizer).then((o) => sendMail(o, templates.decision(o, e, 'Approved')));
    await audit(req.user._id, 'approve', 'Event', e._id, {}, req.ip);
    res.json({ success: true, event: e });
  }),
);
r.put(
  '/events/:id/reject',
  protect,
  allowRoles('admin'),
  asyncHandler(async (req, res) => {
    const reason = (req.body.reason || '').trim();
    if (reason.length < 20)
      return fail(res, 422, 'A rejection reason of at least 20 characters is required.');
    const e = await Event.findById(req.params.id);
    if (!e || e.status !== 'Pending') return fail(res, 404, 'Pending event not found.');
    e.status = 'Rejected';
    e.rejectionReason = reason;
    e.reviewedAt = new Date();
    e.statusHistory.push({ status: 'Rejected', by: req.user._id, note: reason });
    await e.save();
    await notify(e.organizer, 'Event rejected', `${e.title}: ${reason}`, 'approval', e._id);
    User.findById(e.organizer).then((o) => sendMail(o, templates.decision(o, e, 'Rejected', reason)));
    await audit(req.user._id, 'reject', 'Event', e._id, { reason }, req.ip);
    res.json({ success: true, event: e });
  }),
);
r.put(
  '/events/:id/request-changes',
  protect,
  allowRoles('admin'),
  asyncHandler(async (req, res) => {
    const comment = (req.body.comment || '').trim();
    if (comment.length < 10) return fail(res, 422, 'Please provide a useful change request.');
    const e = await Event.findById(req.params.id);
    if (!e || e.status !== 'Pending') return fail(res, 404, 'Pending event not found.');
    if (e.changeRequestCount >= 3)
      return fail(res, 409, 'The maximum number of change requests has been reached.');
    e.status = 'Changes Requested';
    e.reviewComment = comment;
    e.changeRequestCount++;
    e.statusHistory.push({ status: 'Changes Requested', by: req.user._id, note: comment });
    await e.save();
    User.findById(e.organizer).then((o) => sendMail(o, templates.decision(o, e, 'Changes requested', comment)));
    await notify(e.organizer, 'Changes requested', `${e.title}: ${comment}`, 'approval', e._id);
    res.json({ success: true, event: e });
  }),
);
r.put(
  '/events/:id/cancel',
  protect,
  ownerOrAdmin,
  asyncHandler(async (req, res) => {
    const e = req.event;
    const reason = (req.body.reason || '').trim();
    if (reason.length < 5) return fail(res, 422, 'Please give a reason for cancelling the event.');
    if (['Completed', 'Archived', 'Cancelled'].includes(e.status))
      return fail(res, 409, 'This event cannot be cancelled.');
    e.status = 'Cancelled';
    e.cancelReason = reason;
    e.statusHistory.push({ status: 'Cancelled', by: req.user._id, note: reason });
    await e.save();
    const regs = await Registration.find({ event: e._id, status: { $in: ['Confirmed', 'Waitlisted'] } });
    for (const reg of regs) User.findById(reg.student).then((s) => sendMail(s, templates.cancelled(s, e, reason)));
    for (const reg of regs)
      await notify(
        reg.student,
        `${e.title} cancelled`,
        `The event has been cancelled. Reason: ${reason}`,
        'cancellation',
        e._id,
      );
    res.json({ success: true, event: e });
  }),
);
r.put(
  '/events/:id/complete',
  protect,
  ownerOrAdmin,
  asyncHandler(async (req, res) => {
    const e = req.event;
    if (new Date() < new Date(e.endAt))
      return fail(res, 409, 'An event can be closed only after its scheduled end time.');
    e.status = 'Completed';
    e.statusHistory.push({ status: 'Completed', by: req.user._id });
    await e.save();
    res.json({ success: true, event: e });
  }),
);

export default r;
