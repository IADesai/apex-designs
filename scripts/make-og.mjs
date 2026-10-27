// One-off: node scripts/make-og.mjs → public/og-default.png (1200x630)
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const out = fileURLToPath(new URL('public/og-default.png', root));
// The PNG logo has a white background, so the SVG mark is used on the dark card.
const mark = await sharp(fileURLToPath(new URL('public/favicon.svg', root)), { density: 600 })
  .resize(380, 380)
  .png()
  .toBuffer();

const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs><radialGradient id="g" cx="30%" cy="40%" r="80%">
    <stop offset="0" stop-color="#16302A"/><stop offset="1" stop-color="#0B0F0E"/></radialGradient></defs>
  <rect width="1200" height="630" fill="url(#g)"/>
  <text x="560" y="250" font-family="Georgia, serif" font-size="44" fill="#A9B8B2">Apex Designs</text>
  <text x="560" y="340" font-family="Georgia, serif" font-size="76" fill="#E8EFEC">Websites</text>
  <text x="560" y="425" font-family="Georgia, serif" font-size="76" font-style="italic" fill="#5FD3B5">that click.</text>
  <text x="560" y="490" font-family="Arial, sans-serif" font-size="28" fill="#A9B8B2">Web design · Romford &amp; East London</text>
</svg>`);

await sharp(bg).composite([{ input: mark, left: 110, top: 125 }]).png().toFile(out);
console.log('wrote', out);
