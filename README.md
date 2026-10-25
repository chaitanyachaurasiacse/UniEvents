# UniEvents – University Event Management System

MERN implementation of the UniEvents Functional Requirement Specification (B.Tech CSE (AI) Major Project 2026–2027, BBD University).

**Stack:** React + Vite + React Router · Node.js + Express · MongoDB + Mongoose · JWT + bcrypt · role-based access control

```
UniEvents/
├── client/      React app (deploy to Vercel)      client/src/main.jsx = all screens
├── server/      Express API (deploy to Render)    server/src/routes/api.js = all endpoints
├── render.yaml  optional Render blueprint
└── README.md
```

---
## 1. Run on your computer

Requirements: Node.js 20+, and a MongoDB database (local, or a free MongoDB Atlas cluster – see step 2).

```bash
npm run install:all                       # installs root, server and client packages
cp server/.env.example server/.env        # then edit server/.env  (set MONGO_URI and JWT_SECRET)
cp client/.env.example client/.env        # default API URL is http://localhost:5000/api
npm run seed                              # creates demo users, categories, club and sample events
npm run dev                               # starts API (5000) and website (5173)
```
Open http://localhost:5173. API health check: http://localhost:5000/api/health

(On Windows PowerShell use `copy` instead of `cp`.)

### Demo accounts (password for all: `UniEvents@123`)
| Role | Email | Notes |
|---|---|---|
| Student | student@bbdu.ac.in | already registered for one event, has one attended event |
| Faculty | faculty@bbdu.ac.in | owns approved, pending and completed events |
| Club organizer | club@bbdu.ac.in | owns a club event waiting for approval |
| Administrator | admin@bbdu.ac.in | also holds Faculty and Student workspaces – use the **workspace switcher** in the top bar |

`npm run seed` is safe to run again: it never duplicates users, and it only adds sample events when the database has no events.

---
## 2. Put it online (GitHub → MongoDB Atlas → Render → Vercel)

Do the steps in this order because each one needs the address from the previous one.

**A. GitHub** – push this whole folder to a repository (the `.gitignore` already keeps `.env` and `node_modules` out).

**B. MongoDB Atlas (database)**
1. Create a free account and a free **M0** cluster at mongodb.com/atlas.
2. *Database Access* → add a database user (username + password).
3. *Network Access* → add IP address `0.0.0.0/0` (allow from anywhere – needed for Render).
4. *Connect → Drivers* → copy the connection string, replace `<password>`, and add the database name before the `?`:
   `mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/unievents?retryWrites=true&w=majority`

**C. Render (backend)** – *New → Web Service* → pick your repo.
- Root Directory: `server`  ·  Build Command: `npm install`  ·  Start Command: `npm start`
- Health Check Path: `/api/health`
- Environment variables:
  | Key | Value |
  |---|---|
  | `MONGO_URI` | the Atlas string from step B |
  | `JWT_SECRET` | any long random text |
  | `NODE_ENV` | `production` |
  | `CLIENT_URL` | leave a placeholder now, fix after Vercel (step E) |
  | `UNIVERSITY_DOMAINS` | `bbdu.ac.in,gmail.com` |
  | `DEMO_RESET_LINKS` | `true` |
- After it deploys, open `https://YOUR-SERVICE.onrender.com/api/health` – you should see `{"success":true,...}`.

**D. Vercel (frontend)** – *Add New → Project* → pick your repo.
- Root Directory: `client`  ·  Framework: Vite (auto)  ·  Build `npm run build`  ·  Output `dist`
- Environment variable: `VITE_API_URL` = `https://YOUR-SERVICE.onrender.com/api`  (must end with `/api`)
- Deploy. `client/vercel.json` makes page refreshes work.

**E. Connect them** – in Render set `CLIENT_URL` to your Vercel address exactly (e.g. `https://unievents.vercel.app`, no trailing slash) and save; Render redeploys. To also allow Vercel preview links use `https://unievents.vercel.app,https://*.vercel.app`.

**F. Load the demo data** – on your own computer put the Atlas string in `server/.env` as `MONGO_URI` and run `npm run seed` once. (The seed talks directly to the database, so it does not need Render.)

### Before the examiner demo
- Render's free plan **sleeps after ~15 minutes**. The first request then takes up to a minute. Open `https://YOUR-SERVICE.onrender.com/api/health` a few minutes before the demo and wait for it to answer.
- Do a full run-through on the live site once (see the checklist below).
- If you change an environment variable on Vercel you must **redeploy** the frontend (the value is baked in at build time).

### Troubleshooting
| Symptom | Fix |
|---|---|
| "Cannot reach the server" on the live site | `VITE_API_URL` wrong/missing (must end in `/api`), or Render is still waking up |
| Browser console shows a CORS error | `CLIENT_URL` on Render does not exactly match the Vercel address |
| Render logs say `JWT_SECRET is not set` | add the `JWT_SECRET` variable |
| Render logs say `MongoDB connection failed` | Atlas password wrong, or Network Access does not allow `0.0.0.0/0` |
| Login says credentials incorrect | you have not run `npm run seed` against that database |
| Blank page after refresh on Vercel | make sure Root Directory is `client` so `vercel.json` is used |

---
## 3. Demo checklist (about 10 minutes)
1. **Student** – sign in, search/filter on *Discover*, open an event, **Register**, see it in *My Events*, open the bell for the notification, **Cancel**.
   Also show **Create an account** and **Forgot password** on the sign-in page.
2. **Faculty** – *Create Event* → **Submit for approval**. Open *My Events → Manage* to see participants and mark attendance.
3. **Admin** – *Pending Approvals*: approve one, request changes on another, reject one (reason ≥ 20 characters). Show *Users*, *Clubs*, *Categories*, *Announcements*, *Reports* (with CSV export) and *Audit Log*.
4. **Workspace switcher** – as admin use the dropdown in the top bar to switch to Faculty/Student.
5. Back as the student: the approved event is now visible and a notification arrived.
6. Show a full event with waitlist: the *Inter-Department Cricket Tournament* has a waitlist enabled.

---
## 4. Features by FRS module
- **Authentication:** sign-in, student self-registration (university e-mail domain check, strong password rule), forgot/reset password (token, 30 min expiry), lock-out after 5 failed attempts, role-based API guards, session-expiry handling, workspace switching for multi-role users.
- **Student:** discover with search/category filter, featured event, event details, register / cancel / waitlist (auto-promotion when a seat frees up), My Events, notifications, profile, password change, notification preferences.
- **Faculty & Club:** create / edit / submit events, change-request and rejection feedback, manage participants, mark attendance, close or cancel events, export participant CSV, owner-scoped reports.
- **Administrator:** pending approvals (approve / request changes / reject with reason), all events, user management and staff creation, clubs, categories, announcements, university-wide reports with CSV export, audit log.
- **System:** atomic seat reservation (no over-booking under simultaneous requests), five-minute job for reminders and event status changes (Approved → Ongoing → Completed), consistent JSON errors, rate-limited auth routes.

## 5. Known limits (documented, not hidden)
- **University SSO** is not connected – it needs real institutional credentials. The sign-in screen uses e-mail + password.
- **E-mail delivery:** no mail server is configured. Registration signs the student in immediately, and password reset shows the reset link on screen when `DEMO_RESET_LINKS=true`. Set it to `false` on a real deployment and add an e-mail provider.
- Sessions are a single access token (1 day) kept in the browser tab; there is no refresh-token rotation or "sign out of all devices".
- Report exports are CSV only (no XLSX/PDF). QR attendance, payments, calendar sync and certificates are future enhancements, as stated in the FRS.
- The scheduled job runs inside the API process, so it pauses while Render's free instance is asleep.
- No automated test suite is included; use the checklist above.

## 6. API overview
`/api/auth/*` · `/api/events/*` · `/api/registrations/me` · `/api/notifications/*` · `/api/announcements` · `/api/users` · `/api/clubs` · `/api/categories` · `/api/profile` · `/api/reports/:type` (+ `/export`) · `/api/admin/overview` · `/api/admin/audit`.
Protected routes use `Authorization: Bearer <JWT>`; an optional `X-Active-Role` header selects the workspace for multi-role users.
