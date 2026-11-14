import crypto from "crypto";
import { validationResult } from "express-validator";
import { fail } from "./core.js";
export const PW_RE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,20}$/;
export const sha = (t) => crypto.createHash('sha256').update(String(t)).digest('hex');
export const esc = (t) => String(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const roleList = (u) => [u.role, ...(u.extraRoles || [])];
export const allowedClient = () =>
  (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, '');
export const validate = (req, res, next) => {
  const e = validationResult(req);
  if (!e.isEmpty()) return fail(res, 422, 'Please correct the highlighted fields.', 'VALIDATION', e.array());
  next();
};
export const safe = (u) => ({
  id: u._id,
  name: u.name,
  email: u.email,
  role: u.role,
  extraRoles: u.extraRoles,
  department: u.department,
  year: u.year,
  rollNumber: u.rollNumber,
  phone: u.phone,
  bio: u.bio,
  roles: roleList(u),
  notificationPreferences: u.notificationPreferences,
});
