// Express application without the network listener, so tests can import it.
import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import api from './routes/index.js';
if (!process.env.JWT_SECRET) {
  console.error('JWT_SECRET is not set. Add it to server/.env (or the Render environment) and restart.');
  process.exit(1);
}
const app = express();
app.set('trust proxy', 1);
app.use(helmet());
const allowed = (process.env.CLIENT_URL || 'http://localhost:5173')
  .split(',')
  .map((s) => s.trim().replace(/\/$/, ''))
  .filter(Boolean);
const originOk = (o) =>
  !o ||
  allowed.some(
    (a) =>
      a === o ||
      (a.includes('*') &&
        new RegExp('^' + a.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]+') + '$').test(o)),
  );
app.use(cors({ origin: (o, cb) => cb(null, originOk(o)), credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(morgan('dev'));
const limit = (max, message) =>
  rateLimit({ windowMs: 15 * 60 * 1000, max: process.env.NODE_ENV === 'test' ? 1e6 : max, standardHeaders: true, legacyHeaders: false, message: { success: false, error: { code: 'RATE_LIMITED', message } } });
app.use('/api/auth/login', limit(20, 'Too many sign-in attempts. Wait 15 minutes and try again.'));
app.use(['/api/auth/forgot-password', '/api/auth/register'], limit(8, 'Too many requests. Wait 15 minutes and try again.'));
app.use('/api', limit(600, 'Too many requests. Slow down and try again shortly.'));
app.get('/api/health', (req, res) =>
  res.json({ success: true, service: 'UniEvents API', time: new Date().toISOString() }),
);
app.use('/api', api);
app.use((req, res) =>
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route not found' } }),
);
app.use((err, req, res, next) => {
  console.error(err);
  let status = err.status || 500,
    code = 'SERVER_ERROR',
    message =
      process.env.NODE_ENV === 'production'
        ? 'Something went wrong on our side. Please try again.'
        : err.message;
  if (err.code === 11000) {
    status = 409;
    code = 'DUPLICATE';
    message = 'A record with these details already exists.';
  } else if (err.name === 'ValidationError') {
    status = 422;
    code = 'VALIDATION';
    message =
      Object.values(err.errors || {})
        .map((x) => x.message)
        .join(' ') || 'Please correct the highlighted fields.';
  } else if (err.name === 'CastError') {
    status = err.path === '_id' ? 404 : 400;
    code = status === 404 ? 'NOT_FOUND' : 'BAD_REQUEST';
    message =
      status === 404 ? 'The requested item was not found.' : 'One of the values supplied is not valid.';
  } else if (err.type === 'entity.parse.failed') {
    status = 400;
    code = 'BAD_REQUEST';
    message = 'The request could not be read.';
  }
  res.status(status).json({ success: false, error: { code, message } });
});

export default app;
