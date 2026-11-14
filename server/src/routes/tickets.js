import { Router } from 'express';
import { Event, Registration, Attendance, Category } from '../models/index.js';
import { protect, allowRoles } from '../middleware/auth.js';
import { fail, asyncHandler } from '../utils/core.js';

const r = Router();
const DAY = 864e5;

// Student's tickets. Older registrations created before ticket codes existed get one here.
r.get(
  '/tickets/me',
  protect,
  allowRoles('student'),
  asyncHandler(async (req, res) => {
    const regs = await Registration.find({ student: req.user._id, status: { $ne: 'Cancelled' } })
      .populate({ path: 'event', populate: { path: 'category', select: 'name' } })
      .sort('-createdAt');
    for (const reg of regs) if (!reg.ticketCode) await reg.save();
    res.json({ success: true, items: regs.filter((x) => x.event) });
  }),
);

// Door check-in: the organizer scans (or types) a ticket code for one of their events.
r.post(
  '/events/:id/checkin',
  protect,
  allowRoles('faculty', 'club', 'admin'),
  asyncHandler(async (req, res) => {
    const e = await Event.findById(req.params.id);
    if (!e) return fail(res, 404, 'Event not found', 'NOT_FOUND');
    if (req.user.role !== 'admin' && String(e.organizer) !== String(req.user._id))
      return fail(res, 403, 'You can check people in only at your own events.', 'FORBIDDEN');
    const now = Date.now();
    if (now < new Date(e.startAt).getTime() - 12 * 36e5)
      return fail(res, 409, 'Check-in opens 12 hours before the event starts.', 'NOT_OPEN');
    if (now > new Date(e.endAt).getTime() + 6 * 36e5)
      return fail(res, 409, 'Check-in for this event has closed.', 'CLOSED');
    const code = String(req.body.code || '').trim().toUpperCase();
    if (!/^UE-[A-Z0-9]{8}$/.test(code))
      return fail(res, 422, 'That is not a UniEvents ticket. Codes look like UE-7KQ2MZ4P.', 'BAD_CODE');
    const reg = await Registration.findOne({ ticketCode: code }).populate('student', 'name rollNumber department year');
    if (!reg || String(reg.event) !== String(e._id))
      return fail(res, 404, 'No ticket with this code exists for this event.', 'NOT_FOUND');
    if (reg.status === 'Attended')
      return fail(res, 409, `${reg.student.name} is already checked in.`, 'DUPLICATE', { student: reg.student });
    if (reg.status !== 'Confirmed')
      return fail(res, 409, `This ticket is ${reg.status.toLowerCase()} and cannot be used.`, 'INVALID_STATE');
    reg.status = 'Attended';
    await reg.save();
    await Attendance.findOneAndUpdate(
      { registration: reg._id },
      { event: e._id, registration: reg._id, student: reg.student._id, markedBy: req.user._id, status: 'Attended', markedAt: new Date() },
      { upsert: true },
    );
    const checkedIn = await Registration.countDocuments({ event: e._id, status: 'Attended' });
    res.json({ success: true, student: reg.student, checkedIn, registered: e.registeredCount });
  }),
);

r.get(
  '/events/:id/checkins',
  protect,
  allowRoles('faculty', 'club', 'admin'),
  asyncHandler(async (req, res) => {
    const e = await Event.findById(req.params.id).select('title venue startAt registeredCount organizer');
    if (!e) return fail(res, 404, 'Event not found', 'NOT_FOUND');
    if (req.user.role !== 'admin' && String(e.organizer) !== String(req.user._id))
      return fail(res, 403, 'You can view check-ins only for your own events.', 'FORBIDDEN');
    const items = await Attendance.find({ event: e._id, status: 'Attended' })
      .populate('student', 'name rollNumber')
      .sort('-markedAt')
      .limit(50);
    res.json({ success: true, event: e, items, checkedIn: items.length });
  }),
);

// Public certificate check: anyone with the code can confirm it is genuine.
r.get(
  '/certificates/:code',
  asyncHandler(async (req, res) => {
    const reg = await Registration.findOne({ ticketCode: String(req.params.code).toUpperCase(), status: 'Attended' })
      .populate('student', 'name department')
      .populate({ path: 'event', select: 'title venue startAt endAt organizer club', populate: [{ path: 'organizer', select: 'name' }, { path: 'club', select: 'name' }] });
    if (!reg || !reg.event) return fail(res, 404, 'No certificate exists with this code.', 'NOT_FOUND');
    const att = await Attendance.findOne({ registration: reg._id }).select('markedAt');
    res.json({
      success: true,
      certificate: {
        code: reg.ticketCode,
        student: reg.student.name,
        department: reg.student.department,
        event: reg.event.title,
        venue: reg.event.venue,
        date: reg.event.startAt,
        host: reg.event.club?.name || reg.event.organizer?.name,
        checkedInAt: att?.markedAt,
      },
    });
  }),
);

// Chart data: registrations per day for the last 30 days and registrations by category.
// Admins see the whole university; organizers see their own events.
r.get(
  '/stats/overview',
  protect,
  allowRoles('faculty', 'club', 'admin'),
  asyncHandler(async (req, res) => {
    const evMatch = req.user.role === 'admin' ? {} : { organizer: req.user._id };
    const events = await Event.find(evMatch).select('_id category capacity registeredCount status venue startAt').lean();
    const ids = events.map((e) => e._id);
    const since = new Date(Date.now() - 29 * DAY);
    since.setHours(0, 0, 0, 0);
    const perDay = await Registration.aggregate([
      { $match: { event: { $in: ids }, registeredAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$registeredAt', timezone: 'Asia/Kolkata' } }, n: { $sum: 1 } } },
    ]);
    const map = Object.fromEntries(perDay.map((d) => [d._id, d.n]));
    const trend = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(since.getTime() + i * DAY);
      const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      return { date: key, value: map[key] || 0 };
    });
    const cats = await Category.find().select('name').lean();
    const catName = Object.fromEntries(cats.map((c) => [String(c._id), c.name]));
    const byCat = {};
    for (const e of events) {
      const k = catName[String(e.category)] || 'Other';
      byCat[k] = (byCat[k] || 0) + (e.registeredCount || 0);
    }
    const live = events.filter((e) => ['Approved', 'Ongoing'].includes(e.status));
    const cap = live.reduce((a, e) => a + e.capacity, 0), reg = live.reduce((a, e) => a + (e.registeredCount || 0), 0);
    const [attended, marked] = await Promise.all([
      Registration.countDocuments({ event: { $in: ids }, status: 'Attended' }),
      Registration.countDocuments({ event: { $in: ids }, status: { $in: ['Attended', 'Not attended'] } }),
    ]);
    res.json({
      success: true,
      trend,
      byCategory: Object.entries(byCat).map(([name, value]) => ({ name, value })).filter((x) => x.value).sort((a, b) => b.value - a.value),
      fillRate: cap ? Math.round((reg / cap) * 100) : 0,
      attendanceRate: marked ? Math.round((attended / marked) * 100) : null,
    });
  }),
);

export default r;
