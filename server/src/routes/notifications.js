import { Router } from "express";
import crypto from "crypto";
import { body } from "express-validator";
import { User, Club, Category, Event, Registration, Attendance, Notification, AuditLog } from "../models/index.js";
import { protect, allowRoles, ownerOrAdmin } from "../middleware/auth.js";
import { signToken, hashPassword, comparePassword, notify, audit, fail, asyncHandler } from "../utils/core.js";
import { PW_RE, sha, esc, roleList, allowedClient, validate, safe } from "../utils/http.js";
import { sendMail, templates } from "../utils/mailer.js";

const r = Router();
// Notifications and announcements
r.get(
  '/notifications',
  protect,
  asyncHandler(async (req, res) => {
    const filter = { recipient: req.user._id };
    if (req.query.unread === 'true') filter.isRead = false;
    const items = await Notification.find(filter)
      .populate('event', 'title')
      .sort('-createdAt')
      .limit(Math.min(100, +req.query.limit || 20));
    const unread = await Notification.countDocuments({ recipient: req.user._id, isRead: false });
    res.json({ success: true, items, unread });
  }),
);
r.put(
  '/notifications/read-all',
  protect,
  asyncHandler(async (req, res) => {
    await Notification.updateMany(
      { recipient: req.user._id, isRead: false },
      { $set: { isRead: true, readAt: new Date() } },
    );
    res.json({ success: true });
  }),
);
r.put(
  '/notifications/:id/read',
  protect,
  asyncHandler(async (req, res) => {
    const n = await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { $set: { isRead: true, readAt: new Date() } },
      { new: true },
    );
    if (!n) return fail(res, 404, 'Notification not found');
    res.json({ success: true, notification: n });
  }),
);
r.delete(
  '/notifications/:id',
  protect,
  asyncHandler(async (req, res) => {
    const n = await Notification.findOneAndDelete({
      _id: req.params.id,
      recipient: req.user._id,
      isAnnouncement: false,
    });
    if (!n) return fail(res, 404, 'Notification not found or cannot be deleted');
    res.json({ success: true });
  }),
);

export default r;
