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
// Users, clubs, categories
r.get(
  '/users',
  protect,
  allowRoles('admin'),
  asyncHandler(async (req, res) =>
    res.json({ success: true, items: await User.find().select('-passwordHash').sort('name') }),
  ),
);
r.post(
  '/users',
  protect,
  allowRoles('admin'),
  staffRules,
  asyncHandler(async (req, res) => {
    if (!['faculty', 'club', 'admin'].includes(req.body.role)) return fail(res, 422, 'Invalid staff role.');
    const u = await User.create({
      name: req.body.name,
      email: req.body.email.toLowerCase(),
      passwordHash: await hashPassword(req.body.password || 'Welcome@123'),
      role: req.body.role,
      department: req.body.department,
      employeeId: req.body.employeeId,
      isVerified: true,
    });
    res.status(201).json({ success: true, user: safe(u) });
  }),
);
r.put(
  '/users/:id/status',
  protect,
  allowRoles('admin'),
  asyncHandler(async (req, res) => {
    const u = await User.findById(req.params.id);
    if (!u) return fail(res, 404, 'User not found');
    if (
      u.role === 'admin' &&
      req.body.isActive === false &&
      (await User.countDocuments({ role: 'admin', isActive: true })) <= 1
    )
      return fail(res, 409, 'The last administrator cannot be deactivated.');
    u.isActive = !!req.body.isActive;
    await u.save();
    res.json({ success: true, user: safe(u) });
  }),
);
r.get(
  '/clubs',
  protect,
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      items: await Club.find({ isActive: true })
        .populate('coordinator', 'name')
        .populate('facultyAdvisor', 'name'),
    }),
  ),
);
r.post(
  '/clubs',
  protect,
  allowRoles('admin'),
  nameRules,
  asyncHandler(async (req, res) =>
    res.status(201).json({ success: true, club: await Club.create(req.body) }),
  ),
);
r.put(
  '/clubs/:id',
  protect,
  allowRoles('admin'),
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      club: await Club.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }),
    }),
  ),
);
r.get(
  '/categories',
  protect,
  asyncHandler(async (req, res) =>
    res.json({ success: true, items: await Category.find({ isActive: true }).sort('order name') }),
  ),
);
r.post(
  '/categories',
  protect,
  allowRoles('admin'),
  nameRules,
  asyncHandler(async (req, res) =>
    res.status(201).json({ success: true, category: await Category.create(req.body) }),
  ),
);
r.put(
  '/categories/:id',
  protect,
  allowRoles('admin'),
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      category: await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }),
    }),
  ),
);
r.post(
  '/announcements',
  protect,
  allowRoles('admin'),
  announcementRules,
  asyncHandler(async (req, res) => {
    const { title, message, audience = 'all', urgent = false } = req.body;
    if (!title || !message) return fail(res, 422, 'Title and message are required.');
    const roles = audience === 'all' ? ['student', 'faculty', 'club', 'admin'] : [audience];
    const users = await User.find({
      role: { $in: roles },
      isActive: true,
      ...(urgent ? {} : { 'notificationPreferences.announcements': { $ne: false } }),
    }).select('_id');
    await Notification.insertMany(
      users.map((u) => ({
        recipient: u._id,
        title,
        message,
        type: 'announcement',
        isAnnouncement: true,
        urgent,
        createdBy: req.user._id,
      })),
    );
    await audit(req.user._id, 'announcement', 'Notification', null, { title, audience, count: users.length });
    res.status(201).json({ success: true, recipients: users.length });
  }),
);
r.get(
  '/admin/overview',
  protect,
  allowRoles('admin'),
  asyncHandler(async (req, res) => {
    const [users, events, pending, registrations, completed] = await Promise.all([
      User.countDocuments({ isActive: true }),
      Event.countDocuments(),
      Event.countDocuments({ status: 'Pending' }),
      Registration.countDocuments({ status: { $in: ['Confirmed', 'Attended', 'Not attended'] } }),
      Event.countDocuments({ status: { $in: ['Completed', 'Archived'] } }),
    ]);
    res.json({
      success: true,
      stats: { users, events, pending, registrations, completed },
      recent: await Event.find().populate('organizer', 'name').sort('-createdAt').limit(8),
    });
  }),
);
r.get(
  '/admin/audit',
  protect,
  allowRoles('admin'),
  asyncHandler(async (req, res) =>
    res.json({
      success: true,
      items: await AuditLog.find().populate('user', 'name email').sort('-createdAt').limit(100),
    }),
  ),
);

export default r;
