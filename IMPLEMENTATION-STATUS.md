# Implementation status against the FRS

## Implemented
- MERN structure, REST API under `/api`, JWT auth, bcrypt, role guards, failed-login lock-out.
- Sign-in, student registration, forgot/reset password (token based; link shown on screen in demo mode).
- Four roles plus workspace switching for users holding more than one role.
- Event lifecycle: draft → pending → approved / changes requested / rejected → ongoing → completed / cancelled.
- Student: discover, search/filter, details, register, cancel, waitlist with automatic promotion, My Events.
- Organizer: create/edit/submit, participants, attendance, close/cancel event, participant CSV.
- Admin: approvals with reasons, users and staff creation, clubs, categories, announcements, reports, audit log.
- Notifications (bell, unread count, mark read), notification preferences, scheduled reminders and status changes.
- Reports: events, registrations, attendance, trends and organizers views, date range, CSV export.
- Atomic seat reservation (conditional update) so simultaneous registrations cannot exceed capacity.
- Deployment files: `.env.example` files, `client/vercel.json`, `render.yaml`, step-by-step README.

## Not implemented (needs outside services or is out of scope)
- University SSO (needs institutional OIDC/SAML credentials).
- E-mail verification and real e-mail delivery (needs an SMTP/e-mail provider).
- Refresh-token rotation, session inventory, sign-out of all devices.
- XLSX/PDF report export, saved report views, profile photo upload, quiet hours.
- Automated tests.
