import { Router } from "express";
import crypto from "crypto";
import { body } from "express-validator";
import { User, Club, Category, Event, Registration, Attendance, Notification, AuditLog } from "../models/index.js";
import { protect, allowRoles, ownerOrAdmin } from "../middleware/auth.js";
import { signToken, hashPassword, comparePassword, notify, audit, fail, asyncHandler } from "../utils/core.js";
import { PW_RE, sha, esc, roleList, allowedClient, validate, safe } from "../utils/http.js";
import { sendMail, templates } from "../utils/mailer.js";

const r = Router();
// Registration and attendance
r.post(
  '/events/:id/register',
  protect,
  allowRoles('student'),
  asyncHandler(async (req, res) => {
    const e = await Event.findById(req.params.id);
    if (!e) return fail(res, 404, 'Event not found');
    if (e.status !== 'Approved' && e.status !== 'Ongoing')
      return fail(res, 409, 'Registration is not available for this event.');
    const now = new Date();
    if (e.registrationOpensAt && now < e.registrationOpensAt)
      return fail(res, 409, 'Registration has not opened yet.');
    if (now > e.registrationDeadline) return fail(res, 409, 'Registration for this event has closed.');
    if (e.eligibility?.departments?.length && !e.eligibility.departments.includes(req.user.department))
      return fail(res, 403, 'You are not eligible for this event.');
    if (e.eligibility?.years?.length && !e.eligibility.years.includes(req.user.year))
      return fail(res, 403, 'You are not eligible for this event.');
    const existing = await Registration.findOne({ event: e._id, student: req.user._id });
    if (existing && existing.status !== 'Cancelled')
      return fail(res, 409, 'You are already registered for this event.');
    let status = 'Confirmed',
      waitlistPosition = null;
    // Atomic seat reservation: only succeeds while registeredCount < capacity, so two simultaneous requests cannot over-book.
    let fresh = await Event.findOneAndUpdate(
      { _id: e._id, $expr: { $lt: ['$registeredCount', '$capacity'] } },
      { $inc: { registeredCount: 1 } },
      { new: true },
    );
    if (!fresh) {
      if (!e.waitlistEnabled) return fail(res, 409, 'Registration is currently full.');
      status = 'Waitlisted';
      fresh = await Event.findByIdAndUpdate(e._id, { $inc: { waitlistCount: 1 } }, { new: true });
      waitlistPosition = fresh.waitlistCount;
    }
    let reg;
    try {
      if (existing) {
        existing.status = status;
        existing.registeredAt = new Date();
        existing.cancelledAt = null;
        existing.waitlistPosition = waitlistPosition;
        reg = await existing.save();
      } else
        reg = await Registration.create({ event: e._id, student: req.user._id, status, waitlistPosition });
    } catch (err) {
      await Event.updateOne(
        { _id: e._id },
        { $inc: status === 'Confirmed' ? { registeredCount: -1 } : { waitlistCount: -1 } },
      );
      throw err;
    }
    await notify(
      req.user._id,
      status === 'Confirmed' ? 'Registration confirmed' : 'Added to waitlist',
      `${req.user.name}, your status for ${e.title} is ${status}.`,
      'registration',
      e._id,
    );
    sendMail(
      req.user,
      status === 'Confirmed' ? templates.registered(req.user, e, reg) : templates.waitlisted(req.user, e, waitlistPosition),
    );
    if (status === 'Confirmed' && fresh.registeredCount >= Math.ceil(fresh.capacity * 0.9))
      await notify(
        e.organizer,
        `${e.title} is 90% full`,
        `${fresh.registeredCount} of ${fresh.capacity} seats are filled.`,
        'capacity',
        e._id,
      );
    res.status(201).json({ success: true, registration: reg, registeredCount: fresh.registeredCount });
  }),
);
r.delete(
  '/events/:id/register',
  protect,
  allowRoles('student'),
  asyncHandler(async (req, res) => {
    const reg = await Registration.findOneAndUpdate(
      { event: req.params.id, student: req.user._id, status: { $in: ['Confirmed', 'Waitlisted'] } },
      { $set: { status: 'Cancelled', cancelledAt: new Date() } },
      { new: false },
    );
    if (!reg) return fail(res, 404, 'Active registration not found.');
    const wasConfirmed = reg.status === 'Confirmed';
    reg.status = 'Cancelled';
    const e = await Event.findById(req.params.id);
    if (!e) return fail(res, 404, 'Event not found');
    if (wasConfirmed) {
      let promoted = null;
      if (e.waitlistEnabled)
        promoted = await Registration.findOneAndUpdate(
          { event: e._id, status: 'Waitlisted' },
          { $set: { status: 'Confirmed', waitlistPosition: null } },
          { sort: { registeredAt: 1 }, new: true },
        );
      if (promoted) User.findById(promoted.student).then((s) => sendMail(s, templates.promoted(s, e, promoted)));
      if (promoted)
        await notify(
          promoted.student,
          'A seat is now available',
          `You have been moved from the waitlist into ${e.title}.`,
          'waitlist',
          e._id,
        );
      else
        await Event.updateOne({ _id: e._id, registeredCount: { $gt: 0 } }, { $inc: { registeredCount: -1 } });
    }
    await notify(
      req.user._id,
      'Registration cancelled',
      `Your registration for ${e.title} has been cancelled.`,
      'registration',
      e._id,
    );
    res.json({ success: true, registration: reg });
  }),
);
r.get(
  '/registrations/me',
  protect,
  allowRoles('student'),
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      items: await Registration.find({ student: req.user._id })
        .populate({ path: 'event', populate: { path: 'category', select: 'name colour' } })
        .sort('-createdAt'),
    }),
  ),
);
r.get(
  '/events/:id/participants',
  protect,
  allowRoles('faculty', 'club', 'admin'),
  asyncHandler(async (req, res) => {
    const e = await Event.findById(req.params.id);
    if (!e) return fail(res, 404, 'Event not found');
    if (req.user.role !== 'admin' && String(e.organizer) !== String(req.user._id))
      return fail(res, 403, 'You can view participants of your own events only.');
    res.json({
      success: true,
      items: await Registration.find({ event: e._id })
        .populate('student', 'name email rollNumber department year')
        .sort('registeredAt'),
    });
  }),
);
r.put(
  '/registrations/:id/attendance',
  protect,
  allowRoles('faculty', 'club', 'admin'),
  asyncHandler(async (req, res) => {
    const reg = await Registration.findById(req.params.id).populate('event');
    if (!reg) return fail(res, 404, 'Registration not found');
    if (req.user.role !== 'admin' && String(reg.event.organizer) !== String(req.user._id))
      return fail(res, 403, 'You cannot mark attendance for this event.');
    if (reg.status === 'Cancelled' || reg.status === 'Waitlisted')
      return fail(res, 409, 'Only confirmed participants can have attendance marked.');
    const status = req.body.status === 'Not attended' ? 'Not attended' : 'Attended';
    reg.status = status;
    await reg.save();
    const att = await Attendance.findOneAndUpdate(
      { registration: reg._id },
      {
        event: reg.event._id,
        registration: reg._id,
        student: reg.student,
        markedBy: req.user._id,
        status,
        markedAt: new Date(),
      },
      { upsert: true, new: true },
    );
    res.json({ success: true, attendance: att, registration: reg });
  }),
);

export default r;
