// Cover photos. Organizers can set event.imageUrl; otherwise a stock photo (Unsplash licence) is chosen by category.
const byCategory = {
  technology: 'hackathon',
  technical: 'hackathon',
  academic: 'paper-writing',
  cultural: 'rang-utsav',
  sports: 'cricket-cup',
  workshop: 'robotics-sprint',
  entrepreneurship: 'pitch-day',
};
const pool = ['ai-summit', 'hackathon', 'placement-prep', 'pitch-day', 'open-mic', 'tech-quiz', 'web-bootcamp'];

export const STOCK_COVERS = [
  'ai-summit', 'hackathon', 'rang-utsav', 'cricket-cup', 'paper-writing', 'robotics-sprint',
  'pitch-day', 'open-mic', 'placement-prep', 'tech-quiz', 'web-bootcamp', 'p1', 'p2', 'p3', 'p4',
].map((n) => `/img/${n}.jpg`);

const hash = (s) => [...String(s)].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export function coverFor(event) {
  if (!event) return '/img/ai-summit.jpg';
  if (event.imageUrl) return event.imageUrl;
  const t = (event.title || '').toLowerCase();
  if (/\bai\b|summit|keynote/.test(t)) return '/img/ai-summit.jpg';
  if (/hack|code|web|dev/.test(t)) return '/img/hackathon.jpg';
  const cat = (event.category?.name || '').toLowerCase();
  if (byCategory[cat]) return `/img/${byCategory[cat]}.jpg`;
  return `/img/${pool[hash(event._id || event.title) % pool.length]}.jpg`;
}

export const bgStyle = (url) => ({ backgroundImage: `url("${url}")` });
