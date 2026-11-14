// Transactional e-mail through the Brevo HTTP API (works on hosts that block SMTP ports).
// If BREVO_API_KEY is not set, mails are logged instead of sent, so local development still works.

const BRAND = '#5b4fe0';
const client = () => (process.env.CLIENT_URL || 'http://localhost:5173').split(',')[0].trim().replace(/\/$/, '');
const escapeHtml = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const fmtDate = (d) =>
  new Date(d).toLocaleString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  });

export const ticketCode = (registrationId) => 'UE-' + String(registrationId).slice(-8).toUpperCase();

function layout({ heading, body, cta, ctaUrl, event }) {
  const eventBox = event
    ? `<tr><td style="padding:0 28px 8px"><table width="100%" style="border:1px solid #e4e1f1;border-radius:12px"><tr><td style="padding:14px 16px;font:14px/1.5 Arial,sans-serif;color:#48456e">
        <b style="color:#17153a;font-size:15px">${escapeHtml(event.title)}</b><br>${fmtDate(event.startAt)}<br>${escapeHtml(event.venue)}
        ${event.code ? `<br><span style="font-family:Consolas,monospace;color:#8f8cba">Ticket ${event.code}</span>` : ''}
      </td></tr></table></td></tr>`
    : '';
  return `<!doctype html><html><body style="margin:0;background:#f5f4fa;padding:24px 0">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border-radius:14px;overflow:hidden">
    <tr><td style="background:#120f2e;padding:18px 28px;font:bold 18px Arial,sans-serif;color:#fff">UniEvents</td></tr>
    <tr><td style="padding:26px 28px 10px;font:bold 22px Arial,sans-serif;color:#17153a">${escapeHtml(heading)}</td></tr>
    <tr><td style="padding:0 28px 16px;font:15px/1.6 Arial,sans-serif;color:#48456e">${body}</td></tr>
    ${eventBox}
    ${cta ? `<tr><td style="padding:12px 28px 26px"><a href="${ctaUrl}" style="display:inline-block;background:${BRAND};color:#fff;text-decoration:none;font:bold 14px Arial,sans-serif;padding:12px 20px;border-radius:10px">${escapeHtml(cta)}</a></td></tr>` : ''}
    <tr><td style="padding:14px 28px;border-top:1px solid #efedf8;font:12px Arial,sans-serif;color:#8f8cba">You are receiving this because you have an account on UniEvents. Manage e-mail preferences in your profile.</td></tr>
  </table></td></tr></table></body></html>`;
}

export const templates = {
  resetPassword: (user, url) => ({
    subject: 'Reset your UniEvents password',
    html: layout({
      heading: `Reset your password, ${user.name.split(' ')[0]}`,
      body: 'Someone asked to reset the password for your account. The link works for 30 minutes. If it was not you, ignore this e-mail and your password stays the same.',
      cta: 'Choose a new password',
      ctaUrl: url,
    }),
  }),
  registered: (user, event, reg) => ({
    subject: `Seat confirmed: ${event.title}`,
    html: layout({
      heading: `You're in, ${user.name.split(' ')[0]}.`,
      body: 'Your seat is confirmed. Show your QR ticket from <b>My tickets</b> at the entrance; the organizer scans it to mark your attendance.',
      event: { ...event.toObject?.() ?? event, code: reg.ticketCode || ticketCode(reg._id) },
      cta: 'View my ticket',
      ctaUrl: `${client()}/my-events`,
    }),
  }),
  waitlisted: (user, event, position) => ({
    subject: `You're on the waitlist: ${event.title}`,
    html: layout({
      heading: `You are #${position} on the waitlist`,
      body: 'The event is full right now. If someone cancels, you move up automatically and we e-mail you straight away.',
      event,
      cta: 'See the event',
      ctaUrl: `${client()}/events/${event._id}`,
    }),
  }),
  promoted: (user, event, reg) => ({
    subject: `A seat opened up: ${event.title}`,
    html: layout({
      heading: 'Good news. A seat opened up.',
      body: 'Someone cancelled, so you moved from the waitlist to a confirmed seat. No action needed.',
      event: { ...event.toObject?.() ?? event, code: reg.ticketCode || ticketCode(reg._id) },
      cta: 'View my ticket',
      ctaUrl: `${client()}/my-events`,
    }),
  }),
  reminder: (user, event, reg) => ({
    subject: `Starts tomorrow: ${event.title}`,
    html: layout({
      heading: 'See you tomorrow',
      body: 'A quick reminder about the event you registered for.',
      event: { ...event.toObject?.() ?? event, code: reg.ticketCode || ticketCode(reg._id) },
      cta: 'Open my ticket',
      ctaUrl: `${client()}/my-events`,
    }),
  }),
  decision: (user, event, decision, note) => ({
    subject: `${decision}: ${event.title}`,
    html: layout({
      heading: `Your event was ${decision.toLowerCase()}`,
      body:
        decision === 'Approved'
          ? 'It is now live and students can register.'
          : `Note from the administrator:<br><i>${escapeHtml(note)}</i>`,
      event,
      cta: 'Open my events',
      ctaUrl: `${client()}/organizer`,
    }),
  }),
  cancelled: (user, event, reason) => ({
    subject: `Cancelled: ${event.title}`,
    html: layout({
      heading: 'This event has been cancelled',
      body: `Reason given by the organizer: <i>${escapeHtml(reason)}</i>`,
      event,
    }),
  }),
};

/** Sends one e-mail. Never throws: a failed e-mail must not fail the request that triggered it. */
export async function sendMail(to, { subject, html }) {
  if (!to?.email) return false;
  // Local testing: send every mail to one inbox so demo addresses never receive real e-mail.
  // Seeded demo accounts use made-up university addresses: send their mail to MAIL_DEMO_INBOX, or skip it.
  let redirect = process.env.MAIL_REDIRECT_TO;
  if (!redirect && to.isDemo) {
    redirect = process.env.MAIL_DEMO_INBOX;
    if (!redirect) return false;
  }
  if (redirect) {
    subject = `[to ${to.email}] ${subject}`;
    to = { email: redirect, name: to.name };
  }
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    console.log(`[mail:dev] to=${to.email} subject="${subject}"`);
    return false;
  }
  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: process.env.MAIL_FROM_EMAIL, name: process.env.MAIL_FROM_NAME || 'UniEvents' },
        to: [{ email: to.email, name: to.name }],
        subject,
        htmlContent: html,
      }),
    });
    if (!res.ok) console.error('[mail] Brevo rejected the message', res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error('[mail] send failed', e.message);
    return false;
  }
}
