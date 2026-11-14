import 'dotenv/config';
import mongoose from 'mongoose';
import cron from 'node-cron';
import app from './app.js';
import { Event, Registration, Notification, User } from './models/index.js';
import { sendMail, templates } from './utils/mailer.js';

cron.schedule('*/5 * * * *', async () => {
  try {
    const now = new Date();
    const events = await Event.find({
      status: 'Approved',
      startAt: { $lte: new Date(now.getTime() + 24 * 60 * 60 * 1000), $gte: now },
    });
    for (const e of events) {
      const regs = await Registration.find({ event: e._id, status: 'Confirmed' });
      for (const reg of regs) {
        const diff = e.startAt - now;
        const window = diff <= 60 * 60 * 1000 ? '1h' : diff <= 24 * 60 * 60 * 1000 ? '24h' : null;
        if (window) {
          const type = `reminder-${window}`;
          const exists = await Notification.exists({ recipient: reg.student, event: e._id, type });
          if (!exists && window === '24h')
            User.findById(reg.student).then((s) => sendMail(s, templates.reminder(s, e, reg)));
          if (!exists)
            await Notification.create({
              recipient: reg.student,
              event: e._id,
              type,
              title: `${e.title} starts ${window === '1h' ? 'in 1 hour' : 'tomorrow'}`,
              message: `${e.title} at ${e.venue}`,
            });
        }
      }
    }
    await Event.updateMany(
      { status: 'Approved', startAt: { $lte: now }, endAt: { $gt: now } },
      { $set: { status: 'Ongoing' } },
    );
    await Event.updateMany(
      { status: { $in: ['Approved', 'Ongoing'] }, endAt: { $lt: now } },
      { $set: { status: 'Completed' } },
    );
  } catch (e) {
    console.error('Scheduled job failed', e.message);
  }
});
const port = process.env.PORT || 5000;
mongoose
  .connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/unievents')
  .then(() => app.listen(port, () => console.log(`UniEvents API running on http://localhost:${port}`)))
  .catch((e) => {
    console.error('MongoDB connection failed:', e.message);
    process.exit(1);
  });
