import { Router } from "express";
import auth from "./auth.js";
import events from "./events.js";
import registrations from "./registrations.js";
import admin from "./admin.js";
import notifications from "./notifications.js";
import profile from "./profile.js";
import reports from "./reports.js";
import tickets from "./tickets.js";

const api = Router();
api.use(auth);
api.use(events);
api.use(registrations);
api.use(admin);
api.use(notifications);
api.use(profile);
api.use(reports);
api.use(tickets);

export default api;
