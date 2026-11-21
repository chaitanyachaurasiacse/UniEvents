// Draws the UniEvents logo (the same gold mark used on the website) into the source images
// that `npx capacitor-assets generate` turns into the Android launcher icons and splash screens.
// Run: node scripts/make-app-assets.mjs
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const out = fileURLToPath(new URL('../assets/', import.meta.url));
mkdirSync(out, { recursive: true });

const gradient = `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
  <stop offset="0" stop-color="#f59e0b"/><stop offset="1" stop-color="#f97316"/></linearGradient>`;

// Graduation cap from the site's brand mark (24x24 grid), scaled and centred on (cx, cy).
const cap = (cx, cy, s) => `<g transform="translate(${cx - 12 * s} ${cy - 11.5 * s}) scale(${s})"
  fill="none" stroke="#1d1300" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M22 9v6"/></g>`;

const svg = (size, body) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><defs>${gradient}</defs>${body}</svg>`);

const files = {
  // Full icon for older launchers.
  'icon-only.png': svg(1024, `<rect width="1024" height="1024" fill="url(#g)"/>${cap(512, 512, 30)}`),
  // Adaptive icon layers (Android 8+): the launcher crops the outer third, so the cap stays small.
  'icon-foreground.png': svg(1024, cap(512, 512, 23)),
  'icon-background.png': svg(1024, `<rect width="1024" height="1024" fill="url(#g)"/>`),
  // Splash screens: the logo tile on the site's light and dark page colours.
  'splash.png': svg(2732, `<rect width="2732" height="2732" fill="#f5f4fa"/><rect x="1066" y="1066" width="600" height="600" rx="170" fill="url(#g)"/>${cap(1366, 1366, 17)}`),
  'splash-dark.png': svg(2732, `<rect width="2732" height="2732" fill="#0d0b21"/><rect x="1066" y="1066" width="600" height="600" rx="170" fill="url(#g)"/>${cap(1366, 1366, 17)}`),
};

for (const [name, data] of Object.entries(files)) {
  await sharp(data).png().toFile(out + name);
  console.log('wrote assets/' + name);
}
