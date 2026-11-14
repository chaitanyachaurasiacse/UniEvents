import { Router } from "express";
import crypto from "crypto";
import { body } from "express-validator";
import { User, Club, Category, Event, Registration, Attendance, Notification, AuditLog } from "../models/index.js";
import { protect, allowRoles, ownerOrAdmin } from "../middleware/auth.js";
import { signToken, hashPassword, comparePassword, notify, audit, fail, asyncHandler } from "../utils/core.js";
import { PW_RE, sha, esc, roleList, allowedClient, validate, safe } from "../utils/http.js";
import { sendMail, templates } from "../utils/mailer.js";

const r = Router();
// Authentication
r.post(
  '/auth/register',
  [
    body('name').trim().isLength({ min: 2, max: 60 }),
    body('email').isEmail(),
    body('rollNumber').isAlphanumeric().isLength({ min: 6, max: 15 }),
    body('password').matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,20}$/),
    body('confirmPassword').custom((v, { req }) => v === req.body.password),
    validate,
  ],
  asyncHandler(async (req, res) => {
    const email = req.body.email.toLowerCase().trim();
    const doms = (process.env.UNIVERSITY_DOMAINS || '')
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    if (doms.length && !doms.includes(email.split('@')[1]))
      return fail(res, 422, 'Use your university e-mail address to create an account.', 'VALIDATION');
    if (await User.findOne({ $or: [{ email }, { rollNumber: req.body.rollNumber }] }))
      return fail(res, 409, 'An account with this email or roll number already exists.', 'DUPLICATE');
    const u = await User.create({
      name: req.body.name,
      email,
      rollNumber: req.body.rollNumber,
      passwordHash: await hashPassword(req.body.password),
      role: 'student',
      department: req.body.department || 'Computer Science & Engineering',
      year: req.body.year || '1st Year',
    });
    res
      .status(201)
      .json({
        success: true,
        message: 'Account created. You are now signed in.',
        user: safe(u),
        token: signToken(u),
      });
  }),
);
r.post(
  '/auth/login',
  asyncHandler(async (req, res) => {
    const email = (req.body.email || '').toLowerCase().trim(),
      u = await User.findOne({ email });
    if (!u) return fail(res, 401, 'The credentials entered are incorrect.', 'INVALID_CREDENTIALS');
    if (u.lockedUntil > Date.now())
      return fail(res, 423, 'Too many unsuccessful attempts. Try again later.', 'ACCOUNT_LOCKED');
    if (!u.isActive)
      return fail(
        res,
        403,
        'This account has been deactivated. Contact the administrator.',
        'ACCOUNT_INACTIVE',
      );
    if (!(await comparePassword(req.body.password || '', u.passwordHash))) {
      u.failedLoginAttempts++;
      if (u.failedLoginAttempts >= 5) {
        u.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        u.failedLoginAttempts = 0;
      }
      await u.save();
      return fail(res, 401, 'The credentials entered are incorrect.', 'INVALID_CREDENTIALS');
    }
    u.failedLoginAttempts = 0;
    u.lockedUntil = null;
    u.lastLoginAt = new Date();
    await u.save();
    res.json({ success: true, token: signToken(u), user: safe(u) });
  }),
);
r.get('/auth/me', protect, (req, res) => res.json({ success: true, user: safe(req.user) }));
r.post('/auth/logout', protect, (req, res) => res.json({ success: true, message: 'Signed out' }));
r.post(
  '/auth/forgot-password',
  asyncHandler(async (req, res) => {
    const email = (req.body.email || '').toLowerCase().trim();
    const u = email ? await User.findOne({ email, isActive: true }) : null;
    let resetUrl;
    if (u) {
      const raw = crypto.randomBytes(32).toString('hex');
      u.resetTokenHash = sha(raw);
      u.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000);
      await u.save();
      const url = `${allowedClient()}/reset?token=${raw}`;
      const sent = await sendMail(u, templates.resetPassword(u, url));
      // Without a mail provider, demo mode shows the link on screen instead.
      if (!sent && process.env.DEMO_RESET_LINKS === 'true') resetUrl = url;
    }
    res.json({
      success: true,
      message: 'If this e-mail is registered, a password reset link has been sent.',
      resetUrl,
    });
  }),
);
r.post(
  '/auth/reset-password',
  asyncHandler(async (req, res) => {
    const { token, password, confirmPassword } = req.body;
    if (!PW_RE.test(password || ''))
      return fail(
        res,
        422,
        'Password must be 8–20 characters with upper-case, lower-case, a digit and a special character.',
        'VALIDATION',
      );
    if (password !== confirmPassword)
      return fail(res, 422, 'The passwords entered do not match.', 'VALIDATION');
    const u = await User.findOne({
      resetTokenHash: sha(token || ''),
      resetTokenExpires: { $gt: new Date() },
    });
    if (!u) return fail(res, 400, 'This reset link is invalid or has expired.', 'INVALID_TOKEN');
    u.passwordHash = await hashPassword(password);
    u.resetTokenHash = undefined;
    u.resetTokenExpires = undefined;
    u.failedLoginAttempts = 0;
    u.lockedUntil = null;
    await u.save();
    res.json({ success: true, message: 'Your password has been reset. You can now sign in.' });
  }),
);

export default r;
