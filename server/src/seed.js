// Demo data for UniEvents.
//   npm run seed -- --reset    wipes events, registrations and users, then rebuilds a realistic semester.
// Without --reset nothing is changed. Dates are relative to today so the demo always looks current.
import 'dotenv/config';
import mongoose from 'mongoose';
import { User, Category, Club, Event, Registration, Attendance, Notification, AuditLog, newTicketCode } from './models/index.js';
import { hashPassword } from './utils/core.js';

const uri = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/unievents';
const dbName = (uri.split('/').pop() || '').split('?')[0];
if (!process.argv.includes('--reset')) {
  console.log(`This replaces ALL users, events and registrations in database "${dbName}".`);
  console.log('Run again with --reset to continue:  npm run seed -- --reset');
  process.exit(0);
}
await mongoose.connect(uri);
console.log(`Seeding database "${dbName}"…`);

const PASSWORD = 'UniEvents@123';
const pass = await hashPassword(PASSWORD);
const HOUR = 36e5, DAY = 24 * HOUR;
const today = new Date();
today.setHours(0, 0, 0, 0);
const at = (dayOffset, h, m = 0) => new Date(today.getTime() + dayOffset * DAY + h * HOUR + m * 6e4);

await Promise.all([User, Category, Club, Event, Registration, Attendance, Notification, AuditLog].map((M) => M.deleteMany({})));

// People: the project team as students, the supervisor as faculty, Student Affairs as admin.
const mk = (name, email, role, extra = {}) => ({
  name, email, role, passwordHash: pass, department: 'Computer Science & Engineering', year: '4th Year', isActive: true, isVerified: true, isDemo: true, ...extra,
});
const [admin, faculty, clubLead, chaitanya, divyanshu, arijit] = await User.insertMany([
  mk('Office of Student Affairs', 'admin@bbdu.ac.in', 'admin', { extraRoles: ['faculty'], designation: 'Administrator' }),
  mk('Dr. Ramesh Vaishya', 'faculty@bbdu.ac.in', 'faculty', { designation: 'Project Supervisor', employeeId: 'BBDU-F-0142' }),
  mk('Technology Club Coordinator', 'club@bbdu.ac.in', 'club'),
  mk('Chaitanya Chaurasia', 'student@bbdu.ac.in', 'student', { rollNumber: '1230439111' }),
  mk('Divyanshu', 'divyanshu@bbdu.ac.in', 'student', { rollNumber: '1230439121' }),
  mk('Arijit Tiwari', 'arijit@bbdu.ac.in', 'student', { rollNumber: '1230439077' }),
]);
const team = [chaitanya, divyanshu, arijit];

// Other registered students are labelled by roll number rather than given invented names.
const depts = ['Computer Science & Engineering', 'Electronics & Communication', 'Mechanical Engineering', 'Civil Engineering', 'Management'];
const years = ['1st Year', '2nd Year', '3rd Year', '4th Year'];
const crowd = await User.insertMany(
  Array.from({ length: 420 }, (_, i) => {
    const roll = String(1230440000 + i * 7);
    return mk(`Student ${roll}`, `s${roll}@bbdu.ac.in`, 'student', { rollNumber: roll, department: depts[i % 5], year: years[i % 4] });
  }),
);

const cats = Object.fromEntries(
  (await Category.insertMany(
    [['Technology', '#5b4fe0'], ['Academic', '#2563eb'], ['Cultural', '#d97706'], ['Sports', '#16a34a'], ['Workshop', '#0891b2'], ['Entrepreneurship', '#db2777']].map(
      ([name, colour], order) => ({ name, colour, order }),
    ),
  )).map((c) => [c.name, c._id]),
);
const clubs = Object.fromEntries(
  (await Club.insertMany(
    [['Technology Club', 'Coding, robotics and the annual hackathon.'], ['Cultural Society', 'Music, dance, drama and Rang Utsav.'], ['Sports Committee', 'Inter-department and inter-hostel tournaments.'], ['E-Cell', 'Entrepreneurship cell: pitch days and founder talks.'], ['Literary Society', 'Poetry, debate and open mic nights.']].map(
      ([name, description]) => ({ name, description, coordinator: clubLead._id, facultyAdvisor: faculty._id }),
    ),
  )).map((c) => [c.name, c._id]),
);

// [title, category, by, club, venue, start, hours, capacity, fill, status, extras]
const F = faculty, C = clubLead;
const nowH = new Date().getHours();
const E = [
  ['Intro to Machine Learning Seminar', 'Technology', F, null, 'Seminar Hall 2', at(-21, 11), 2, 120, 0.86, 'Completed', { img: 'tech-quiz' }],
  ['Web Development Bootcamp', 'Workshop', C, 'Technology Club', 'Computer Lab 2', at(-14, 10), 6, 60, 0.95, 'Completed', { img: 'web-bootcamp' }],
  ['Tech Quiz Championship', 'Technology', C, 'Technology Club', 'Seminar Hall 2', at(-9, 14), 3, 80, 0.9, 'Completed', { img: 'p1' }],
  ['Blood Donation Drive', 'Academic', F, null, 'University Health Centre', at(-5, 9), 6, 150, 0.62, 'Completed', { img: 'blood-drive' }],
  ['Placement Prep Bootcamp', 'Academic', F, null, 'Block C Computer Labs', at(0, Math.max(8, nowH - 1)), 6, 200, 0.72, 'Ongoing', { img: 'placement-prep', checkins: 0.55 }],
  ['Research Paper Writing Workshop', 'Academic', F, null, 'Library Seminar Hall', at(2, 14), 3, 40, 0.55, 'Approved', { img: 'paper-writing' }],
  ['Future of AI: Student Innovation Summit', 'Technology', F, null, 'Main Auditorium, Block A', at(5, 10), 6.5, 400, 0.78, 'Approved', { img: 'ai-summit', featured: true }],
  ['Robotics Build Sprint', 'Workshop', C, 'Technology Club', 'Mechanical Workshop Bay', at(6, 10), 8, 60, 0.95, 'Approved', { img: 'robotics-sprint' }],
  ['Inter-Department Cricket Cup', 'Sports', C, 'Sports Committee', 'University Sports Ground', at(8, 8), 57, 160, 1, 'Approved', { img: 'cricket-cup', waitlist: 6 }],
  ['Poetry and Open Mic Evening', 'Cultural', C, 'Literary Society', 'Amphitheatre Lawn', at(10, 17, 30), 2.5, 120, 0.4, 'Approved', { img: 'open-mic' }],
  ['Hackathon 2026: Build for Campus', 'Technology', C, 'Technology Club', 'Innovation Lab, Block C', at(12, 9), 24, 120, 0.87, 'Approved', { img: 'hackathon', featured: true }],
  ['Startup Pitch Day', 'Entrepreneurship', C, 'E-Cell', 'Seminar Hall 2', at(15, 11), 4, 150, 0.41, 'Approved', { img: 'pitch-day' }],
  ['Rang Utsav: Annual Cultural Night', 'Cultural', C, 'Cultural Society', 'Open Air Theatre', at(20, 18), 4, 600, 0.6, 'Approved', { img: 'rang-utsav', featured: true }],
  ['Blockchain 101 Seminar', 'Technology', C, 'Technology Club', 'Seminar Hall 1', at(16, 11), 2, 120, 0, 'Pending', { img: 'p1' }],
  ['Inter-Hostel Football League', 'Sports', C, 'Sports Committee', 'University Sports Ground', at(22, 7, 30), 4, 220, 0, 'Pending', { img: 'p2' }],
  ['Alumni Talk: Careers in Data', 'Academic', F, null, 'Main Auditorium, Block A', at(9, 12), 2, 300, 0, 'Pending', { img: 'p4' }],
  ['Kathak Workshop with a Guest Artist', 'Cultural', C, 'Cultural Society', 'Dance Studio, Block D', at(18, 15), 3, 50, 0, 'Changes Requested', { img: 'p3', review: 'Please add the guest artist’s name and confirm the dance studio booking with the Cultural Society office.' }],
  ['Intro to Open Source: Your First Pull Request', 'Workshop', F, null, 'Computer Lab 1', at(25, 10), 3, 80, 0, 'Draft', { img: 'web-bootcamp' }],
  ['Night Trek to Kukrail Forest', 'Sports', C, 'Sports Committee', 'Kukrail Reserve Forest', at(14, 21), 5, 40, 0, 'Rejected', { img: 'p2', reject: 'Overnight off-campus activities need written approval from the Dean of Students and parental consent forms.' }],
  ['Guest Lecture: Quantum Computing Basics', 'Technology', F, null, 'Seminar Hall 1', at(3, 15), 2, 120, 0.3, 'Cancelled', { img: 'ai-summit', cancel: 'The guest speaker had to travel abroad at short notice. We will announce a new date.' }],
];

const summaries = {
  'Intro to Machine Learning Seminar': 'A beginner-friendly tour of supervised learning with live notebooks.',
  'Web Development Bootcamp': 'Build and deploy a full website in one day with mentors from the Technology Club.',
  'Tech Quiz Championship': 'Inter-department technical quiz with prizes for the top three teams.',
  'Blood Donation Drive': 'Annual blood donation camp with the district blood bank.',
  'Placement Prep Bootcamp': 'Aptitude drills, a mock technical interview and a resume review.',
  'Research Paper Writing Workshop': 'Structure, cite and publish your first research paper.',
  'Future of AI: Student Innovation Summit': 'Student research demos, a keynote and a poster session judged by industry mentors.',
  'Robotics Build Sprint': 'Build a line-following robot in a day. Kits and mentors provided.',
  'Inter-Department Cricket Cup': 'Three days of T10 knockout cricket between 16 department teams.',
  'Poetry and Open Mic Evening': 'Hindi, Urdu and English poetry, stand-up and acoustic sets.',
  'Hackathon 2026: Build for Campus': '24 hours, teams of four, one brief: fix something that annoys students on campus.',
  'Startup Pitch Day': 'Ten student startups pitch to founders and investors from Lucknow.',
  'Rang Utsav: Annual Cultural Night': 'Classical and folk dance, the battle of bands and the department fashion walk.',
  'Blockchain 101 Seminar': 'How blockchains work, smart contracts in plain language and a live demo on a test network.',
  'Inter-Hostel Football League': 'Seven-a-side football between hostel teams over two weekends.',
  'Alumni Talk: Careers in Data': 'BBDU alumni working in analytics and data engineering talk about their first two years in industry.',
  'Kathak Workshop with a Guest Artist': 'A three-hour introduction to Kathak footwork and expressions with a visiting performer.',
  'Intro to Open Source: Your First Pull Request': 'Find a beginner-friendly issue, fork a repository and open your first pull request with mentors.',
  'Night Trek to Kukrail Forest': 'A guided night walk through the Kukrail reserve with the Sports Committee.',
  'Guest Lecture: Quantum Computing Basics': 'Qubits, superposition and what quantum computers can and cannot do yet.',
};

// Deterministic shuffle (mulberry32) so every reseed produces the same demo data.
const pick = (arr, n, seed) => {
  let a = seed >>> 0;
  const rand = () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [copy[i], copy[j]] = [copy[j], copy[i]]; }
  return copy.slice(0, Math.max(0, Math.min(n, copy.length)));
};

// Which team members attend which events: [event title, student, status]
const teamPlan = [
  ['Intro to Machine Learning Seminar', chaitanya, 'Attended'], ['Intro to Machine Learning Seminar', divyanshu, 'Attended'],
  ['Web Development Bootcamp', chaitanya, 'Attended'], ['Web Development Bootcamp', arijit, 'Attended'],
  ['Tech Quiz Championship', chaitanya, 'Attended'], ['Tech Quiz Championship', divyanshu, 'Not attended'], ['Tech Quiz Championship', arijit, 'Attended'],
  ['Placement Prep Bootcamp', chaitanya, 'Confirmed'], ['Placement Prep Bootcamp', divyanshu, 'Attended'], ['Placement Prep Bootcamp', arijit, 'Confirmed'],
  ['Research Paper Writing Workshop', chaitanya, 'Confirmed'], ['Research Paper Writing Workshop', arijit, 'Confirmed'],
  ['Future of AI: Student Innovation Summit', chaitanya, 'Confirmed'], ['Future of AI: Student Innovation Summit', divyanshu, 'Confirmed'], ['Future of AI: Student Innovation Summit', arijit, 'Confirmed'],
  ['Hackathon 2026: Build for Campus', chaitanya, 'Confirmed'], ['Hackathon 2026: Build for Campus', divyanshu, 'Confirmed'], ['Hackathon 2026: Build for Campus', arijit, 'Confirmed'],
  ['Inter-Department Cricket Cup', chaitanya, 'Waitlisted'], ['Inter-Department Cricket Cup', arijit, 'Confirmed'],
  ['Rang Utsav: Annual Cultural Night', divyanshu, 'Confirmed'],
];

let regCount = 0;
for (const [i, [title, cat, by, club, venue, startAt, hours, capacity, fill, status, x]] of E.entries()) {
  const endAt = new Date(startAt.getTime() + hours * HOUR);
  const submittedAt = new Date(Math.min(Date.now(), startAt.getTime()) - (10 + (i % 7)) * DAY);
  const ev = await Event.create({
    title, category: cats[cat], organizer: by._id, club: club ? clubs[club] : undefined, venue, startAt, endAt,
    summary: summaries[title] || 'Details to be confirmed by the organizer.',
    description: `Who can attend: all students of Babu Banarasi Das University. Entry is free; bring your college ID card.\n\nSeats are confirmed first come, first served. When the event is full you can join the waitlist, and you will be e-mailed the moment a seat opens. Show the QR ticket from My Tickets at the entrance.`,
    registrationOpensAt: new Date(submittedAt.getTime() + DAY),
    registrationDeadline: new Date(startAt.getTime() - (status === 'Ongoing' ? -2 * HOUR : 12 * HOUR)),
    capacity, status, featured: !!x.featured, waitlistEnabled: true, imageUrl: `/img/${x.img}.jpg`,
    reviewComment: x.review, rejectionReason: x.reject, cancelReason: x.cancel, changeRequestCount: x.review ? 1 : 0,
    submittedAt: status === 'Draft' ? undefined : submittedAt,
    reviewedAt: ['Approved', 'Ongoing', 'Completed', 'Rejected', 'Changes Requested', 'Cancelled'].includes(status) ? new Date(submittedAt.getTime() + DAY) : undefined,
    approvedBy: ['Approved', 'Ongoing', 'Completed', 'Cancelled'].includes(status) ? admin._id : undefined,
    statusHistory: [{ status: 'Draft', by: by._id, at: new Date(submittedAt.getTime() - DAY) }, ...(status === 'Draft' ? [] : [{ status: 'Pending', by: by._id, at: submittedAt }]), ...(['Draft', 'Pending'].includes(status) ? [] : [{ status, by: admin._id, at: new Date(submittedAt.getTime() + DAY), note: x.review || x.reject || x.cancel }])],
  });
  if (['Approved', 'Completed', 'Ongoing', 'Changes Requested', 'Rejected', 'Cancelled'].includes(status))
    await AuditLog.create({ user: admin._id, action: status === 'Changes Requested' ? 'request-changes' : status === 'Rejected' ? 'reject' : 'approve', targetType: 'Event', targetId: ev._id, details: { title }, createdAt: new Date(submittedAt.getTime() + DAY) });
  if (!fill) continue;

  // Registrations: team members first, then the crowd, spread over the weeks before the event.
  const past = status === 'Completed';
  const mine = teamPlan.filter((t) => t[0] === title);
  const target = Math.round(capacity * fill);
  const others = pick(crowd, target - mine.filter((t) => t[2] !== 'Waitlisted').length + (x.waitlist || 0), 97 + i * 13);
  const regEnd = Math.min(Date.now() - HOUR, startAt.getTime() - HOUR);
  const regStart = Math.max(regEnd - 28 * DAY, submittedAt.getTime() + DAY);
  const docs = [];
  const when = (k, n) => new Date(regStart + ((regEnd - regStart) * Math.pow((k + 1) / (n + 1), 0.7)));
  mine.forEach(([, s, st], k) => docs.push({ event: ev._id, student: s._id, status: st, registeredAt: when(k * 3, target) }));
  others.forEach((s, k) => {
    const waitlisted = k >= others.length - (x.waitlist || 0);
    let st = waitlisted ? 'Waitlisted' : 'Confirmed';
    if (past) st = (k * 37) % 100 < 84 ? 'Attended' : 'Not attended';
    if (status === 'Ongoing' && !waitlisted && (k * 37) % 100 < (x.checkins || 0) * 100) st = 'Attended';
    if (status === 'Cancelled') st = 'Cancelled';
    docs.push({ event: ev._id, student: s._id, status: st, registeredAt: when(k, others.length), waitlistPosition: waitlisted ? k - (others.length - (x.waitlist || 0)) + 1 + mine.filter((t) => t[2] === 'Waitlisted').length : undefined });
  });
  mine.filter((t) => t[2] === 'Waitlisted').forEach((t) => {
    const d = docs.find((r) => String(r.student) === String(t[1]._id));
    d.waitlistPosition = 2;
  });
  const created = await Registration.insertMany(docs.map((d) => ({ ...d, ticketCode: newTicketCode() })));
  regCount += created.length;
  const confirmed = created.filter((r) => ['Confirmed', 'Attended', 'Not attended'].includes(r.status)).length;
  await Event.updateOne({ _id: ev._id }, { registeredCount: Math.min(capacity, confirmed), waitlistCount: created.filter((r) => r.status === 'Waitlisted').length });
  const att = created.filter((r) => ['Attended', 'Not attended'].includes(r.status));
  if (att.length)
    await Attendance.insertMany(att.map((r) => ({ event: ev._id, registration: r._id, student: r.student, markedBy: by._id, status: r.status, markedAt: new Date(Math.min(Date.now(), startAt.getTime() + 20 * 6e4)) })));
}

// A few notifications so the bell has something real in it.
const ev = async (t) => (await Event.findOne({ title: t }))._id;
await Notification.insertMany([
  { recipient: chaitanya._id, event: await ev('Inter-Department Cricket Cup'), type: 'registration', title: 'Added to waitlist', message: 'You are #2 on the waitlist for the Inter-Department Cricket Cup.' },
  { recipient: chaitanya._id, event: await ev('Future of AI: Student Innovation Summit'), type: 'registration', title: 'Registration confirmed', message: 'Your seat for Future of AI: Student Innovation Summit is confirmed.', isRead: true },
  { recipient: chaitanya._id, type: 'announcement', isAnnouncement: true, createdBy: admin._id, title: 'Rang Utsav registrations are open', message: 'Seats for the Annual Cultural Night are filling fast.' },
  { recipient: faculty._id, event: await ev('Future of AI: Student Innovation Summit'), type: 'capacity', title: 'Registrations are climbing', message: 'Future of AI: Student Innovation Summit is 78% full.' },
  { recipient: faculty._id, event: await ev('Alumni Talk: Careers in Data'), type: 'approval', title: 'Waiting for review', message: 'Alumni Talk: Careers in Data is with the administrator.' },
  { recipient: clubLead._id, event: await ev('Kathak Workshop with a Guest Artist'), type: 'approval', title: 'Changes requested', message: 'Kathak Workshop with a Guest Artist: please add the guest artist’s name.' },
  { recipient: admin._id, type: 'approval', title: '3 events waiting for review', message: 'Blockchain 101 Seminar, Inter-Hostel Football League and Alumni Talk: Careers in Data.' },
]);

console.log(`Done: ${E.length} events, ${crowd.length + team.length} students, ${regCount} registrations.`);
console.log(`Demo accounts (password ${PASSWORD}): student@ (Chaitanya Chaurasia), divyanshu@, arijit@, faculty@ (Dr. Ramesh Vaishya), club@, admin@ — all @bbdu.ac.in`);
await mongoose.disconnect();
