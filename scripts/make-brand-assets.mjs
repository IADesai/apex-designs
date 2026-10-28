// One-off: node scripts/make-brand-assets.mjs → favicon, apple-touch-icon and share image from the real logo.
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const root = new URL('..', import.meta.url);
const p = (rel) => fileURLToPath(new URL(rel, root));
const LOGO = p('src/assets/logo/apex-logo.png');
const CREAM = { r: 255, g: 255, b: 242, alpha: 1 };

// The mountain mark is the top part of the logo (the wordmark sits below it).
const meta = await sharp(LOGO).metadata();
const top = await sharp(LOGO).extract({ left: 0, top: 0, width: meta.width, height: Math.round(meta.height * 0.6) }).png().toBuffer();
const mark = await sharp(top).trim().png().toBuffer();

await sharp(mark).resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toFile(p('public/favicon.png'));
await sharp({ create: { width: 180, height: 180, channels: 4, background: CREAM } })
  .composite([{ input: await sharp(mark).resize(140, 140, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer(), gravity: 'center' }])
  .png().toFile(p('public/apple-touch-icon.png'));

const logo = await sharp(LOGO).resize(440, 440, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
const bg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <rect width="1200" height="630" fill="#FFFFF2"/>
  <rect x="0" y="600" width="1200" height="30" fill="#3E7D6E"/>
  <text x="600" y="290" font-family="Georgia, serif" font-weight="800" font-size="78" fill="#54595F">Websites</text>
  <text x="600" y="380" font-family="Georgia, serif" font-weight="700" font-style="italic" font-size="78" fill="#3E7D6E">that click.</text>
  <text x="600" y="450" font-family="Arial, sans-serif" font-size="28" fill="#534A45">Web design · Romford &amp; East London</text>
</svg>`);
await sharp(bg).composite([{ input: logo, left: 90, top: 90 }]).png().toFile(p('public/og-default.png'));
console.log('wrote favicon.png, apple-touch-icon.png, og-default.png');
