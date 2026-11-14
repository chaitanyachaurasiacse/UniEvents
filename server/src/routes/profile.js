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
// Profile and reports
r.get(
  '/profile',
  protect,
  asyncHandler(async (req, res) => res.json({ success: true, user: req.user })),
);
r.put(
  '/profile',
  protect,
  profileRules,
  asyncHandler(async (req, res) => {
    const u = await User.findById(req.user._id);
    for (const k of ['name', 'phone', 'bio', 'department', 'year'])
      if (req.body[k] !== undefined) u[k] = req.body[k];
    if (req.body.notificationPreferences)
      for (const k of ['reminders', 'updates', 'announcements'])
        if (typeof req.body.notificationPreferences[k] === 'boolean')
          u.set(`notificationPreferences.${k}`, req.body.notificationPreferences[k]);
    await u.save();
    res.json({ success: true, user: { ...safe(u), role: req.user.role, roles: req.user.roles } });
  }),
);
r.put(
  '/profile/password',
  protect,
  asyncHandler(async (req, res) => {
    const u = await User.findById(req.user._id);
    if (!(await comparePassword(req.body.currentPassword || '', u.passwordHash)))
      return fail(res, 400, 'The current password is incorrect.');
    if (req.body.newPassword !== req.body.confirmPassword)
      return fail(res, 422, 'The passwords entered do not match.');
    if (!PW_RE.test(req.body.newPassword || ''))
      return fail(
        res,
        422,
        'Password must be 8–20 characters with upper-case, lower-case, a digit and a special character.',
      );
    u.passwordHash = await hashPassword(req.body.newPassword);
    await u.save();
    res.json({ success: true, message: 'Password updated.' });
  }),
);

export default r;
