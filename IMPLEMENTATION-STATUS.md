# Implementation status against the FRS

## Implemented
- MERN structure, REST API under `/api` split into feature routers, JWT auth, bcrypt, role guards, failed-login lock-out, rate limiting and request validation.
- Public landing page with live upcoming events; sign-in with one-click demo workspaces; student registration; forgot/reset password by e-mail.
- Four roles plus workspace switching for users holding more than one role.
- Event lifecycle: draft → pending → approved / changes requested / rejected → ongoing → completed / cancelled, with venue clash detection on submit and approval.
- Student: discover with photo covers, search and category filters, event details, register, cancel, waitlist with automatic promotion, QR tickets in My Events, certificates.
- Organizer: create/edit/submit, participants, attendance, door check-in by QR camera or ticket code, close/cancel event, participant CSV, overview charts.
- Admin: approvals with reasons, users and staff creation, clubs, categories, announcements, reports, audit log, campus overview charts.
- Real e-mail through Brevo: seat confirmations, waitlist and promotions, day-before reminders, admin decisions, cancellations, password resets.
- Public, printable certificates of participation with a verification page.
- Notifications (bell, unread count, mark read), notification preferences, scheduled reminders and status changes.
- Reports: events, registrations, attendance, trends and organizers views, date range, CSV export.
- Atomic seat reservation (conditional update) so simultaneous registrations cannot exceed capacity.
- 24 automated API tests (Vitest + Supertest, in-memory MongoDB).
- Seed script that builds a realistic semester with the project team's names.

## Not implemented (needs outside services or is out of scope)
- University SSO (needs institutional OIDC/SAML credentials).
- E-mail verification at sign-up.
- Refresh-token rotation, session inventory, sign-out of all devices.
- XLSX report export, saved report views, cover photo and profile photo upload, quiet hours.
- Front-end component and end-to-end tests.
