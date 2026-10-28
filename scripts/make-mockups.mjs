// Builds the laptop + phone portfolio renders from real screenshots, all in one consistent frame.
//
//   node scripts/make-mockups.mjs              → every project below
//   node scripts/make-mockups.mjs al-ansaar    → just one
//
// Screenshots live in scripts/mockups/screens/: <id>-desktop.jpg at 1440×900 and <id>-mobile.jpg at 390×844 @3x.
// Output: src/assets/work/<id>.png (transparent, 1600×1000, 16:10 to match the portfolio cards).
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const p = (rel) => fileURLToPath(new URL(rel, root));

// Projects without fresh screenshots keep their older render until they get some.
const PROJECTS = ['al-ansaar', 'whitebeard'];

const W = 1600, H = 1000;

// Laptop
const lid = { x: 100, y: 60, w: 1160, h: 752, r: 26 };
const scr = { x: 120, y: 80, w: 1120, h: 700 }; // 16:10, same as a 1440×900 screenshot
const deck = { top: 818, bottom: 848, left: 30, right: 1330 };
// Phone (sits beside the laptop, overlapping only its frame, never its screen)
const ph = { x: 1250, y: 268, w: 328, h: 677, r: 55 };
const phIn = { x: ph.x + 7, y: ph.y + 7, w: ph.w - 14, h: ph.h - 14, r: 48 };
const phScr = { x: ph.x + 14, y: ph.y + 14, w: 300, h: 649, r: 41 }; // 390:844

const svg = (body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${body}</svg>`);

const behind = svg(`
  <defs>
    <filter id="blur10" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="10"/></filter>
    <filter id="blur7" x="-30%" y="-200%" width="160%" height="500%"><feGaussianBlur stdDeviation="7"/></filter>
    <linearGradient id="lidG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c3032"/><stop offset="1" stop-color="#1b1d1f"/></linearGradient>
    <linearGradient id="deckG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d7dadc"/><stop offset="0.35" stop-color="#b9bdc0"/><stop offset="1" stop-color="#6f7477"/>
    </linearGradient>
  </defs>
  <ellipse cx="680" cy="${deck.bottom + 4}" rx="650" ry="16" fill="#000" opacity="0.22" filter="url(#blur10)"/>
  <rect x="${lid.x}" y="${lid.y}" width="${lid.w}" height="${lid.h}" rx="${lid.r}" fill="url(#lidG)" stroke="#44494c" stroke-width="1.5"/>
  <rect x="${lid.x + 6}" y="${lid.y + 6}" width="${lid.w - 12}" height="${lid.h - 12}" rx="${lid.r - 4}" fill="#0c0d0e"/>
  <circle cx="${lid.x + lid.w / 2}" cy="${lid.y + 11}" r="3.5" fill="#25292b"/><circle cx="${lid.x + lid.w / 2 - 1}" cy="${lid.y + 10}" r="1.2" fill="#4a5a66"/>
  <rect x="${lid.x + 10}" y="${lid.y + lid.h}" width="${lid.w - 20}" height="6" fill="#2a2d2f"/>
  <path d="M ${deck.left} ${deck.top} H ${deck.right} Q ${deck.right + 6} ${deck.top} ${deck.right + 2} ${deck.top + 8} L ${deck.right - 26} ${deck.bottom} H ${deck.left + 26} L ${deck.left - 2} ${deck.top + 8} Q ${deck.left - 6} ${deck.top} ${deck.left} ${deck.top} Z" fill="url(#deckG)"/>
  <rect x="${deck.left + 4}" y="${deck.top}" width="${deck.right - deck.left - 8}" height="1.5" fill="#f4f6f7" opacity="0.8"/>
  <rect x="${680 - 92}" y="${deck.top}" width="184" height="9" rx="4.5" fill="#9ea2a5"/>
  <ellipse cx="${ph.x + ph.w / 2}" cy="${ph.y + ph.h + 6}" rx="${ph.w / 2 + 10}" ry="11" fill="#000" opacity="0.28" filter="url(#blur7)"/>
`);

const phoneBody = svg(`
  <defs>
    <linearGradient id="edgeG" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#4a4e52"/><stop offset="0.5" stop-color="#2a2d30"/><stop offset="1" stop-color="#474b4f"/></linearGradient>
  </defs>
  <rect x="${ph.x - 4}" y="${ph.y + 150}" width="6" height="56" rx="2" fill="#3a3e41"/>
  <rect x="${ph.x - 4}" y="${ph.y + 222}" width="6" height="56" rx="2" fill="#3a3e41"/>
  <rect x="${ph.x + ph.w - 2}" y="${ph.y + 190}" width="6" height="92" rx="2" fill="#3a3e41"/>
  <rect x="${ph.x}" y="${ph.y}" width="${ph.w}" height="${ph.h}" rx="${ph.r}" fill="url(#edgeG)"/>
  <rect x="${phIn.x}" y="${phIn.y}" width="${phIn.w}" height="${phIn.h}" rx="${phIn.r}" fill="#0a0a0b"/>
`);

const onTop = svg(`
  <defs>
    <linearGradient id="glare" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0.10"/><stop offset="0.45" stop-color="#fff" stop-opacity="0.02"/><stop offset="0.46" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <clipPath id="scrClip"><rect x="${scr.x}" y="${scr.y}" width="${scr.w}" height="${scr.h}" rx="4"/></clipPath>
    <clipPath id="phClip"><rect x="${phScr.x}" y="${phScr.y}" width="${phScr.w}" height="${phScr.h}" rx="${phScr.r}"/></clipPath>
  </defs>
  <rect x="${scr.x}" y="${scr.y}" width="${scr.w}" height="${scr.h}" fill="url(#glare)" clip-path="url(#scrClip)"/>
  <rect x="${phScr.x}" y="${phScr.y}" width="${phScr.w}" height="${phScr.h}" fill="url(#glare)" clip-path="url(#phClip)"/>
  <rect x="${phScr.x + phScr.w / 2 - 46}" y="${phScr.y + 11}" width="92" height="27" rx="13.5" fill="#000"/>
`);

const mask = (w, h, r) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" rx="${r}" fill="#fff"/></svg>`);

async function screen(file, box) {
  return sharp(file)
    .resize(box.w, box.h, { fit: 'cover', position: 'top' })
    .composite([{ input: mask(box.w, box.h, box.r ?? 4), blend: 'dest-in' }])
    .png()
    .toBuffer();
}

// A real phone shows a status bar above the page, so the camera cut-out never sits on the site's header.
const STATUS_H = 40;
async function phoneScreen(file) {
  const { data } = await sharp(file).extract({ left: 0, top: 0, width: 4, height: 4 }).raw().toBuffer({ resolveWithObject: true });
  const [r, g, b] = data;
  const light = 0.299 * r + 0.587 * g + 0.114 * b > 150;
  const ink = light ? '#111' : '#fff';
  const page = await sharp(file).resize(phScr.w, phScr.h - STATUS_H, { fit: 'cover', position: 'top' }).png().toBuffer();
  const bar = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${phScr.w}" height="${STATUS_H}">
    <rect width="100%" height="100%" fill="rgb(${r},${g},${b})"/>
    <text x="34" y="29" font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="14" font-weight="600" fill="${ink}">9:41</text>
    <g fill="${ink}" transform="translate(${phScr.w - 74} 18)">
      <rect x="0" y="7" width="3" height="5" rx="1"/><rect x="5" y="5" width="3" height="7" rx="1"/><rect x="10" y="2.5" width="3" height="9.5" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/>
      <rect x="26" y="0.5" width="22" height="11" rx="3" fill="none" stroke="${ink}" stroke-width="1.2" opacity="0.6"/><rect x="28" y="2.5" width="16" height="7" rx="1.5"/><rect x="49" y="4" width="1.6" height="4" rx="0.8" opacity="0.6"/>
    </g></svg>`);
  return sharp({ create: { width: phScr.w, height: phScr.h, channels: 4, background: { r, g, b, alpha: 1 } } })
    .composite([{ input: bar, left: 0, top: 0 }, { input: page, left: 0, top: STATUS_H }, { input: mask(phScr.w, phScr.h, phScr.r), blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function build(id) {
  const desktop = await screen(p(`scripts/mockups/screens/${id}-desktop.jpg`), scr);
  const mobile = await phoneScreen(p(`scripts/mockups/screens/${id}-mobile.jpg`));
  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: behind, left: 0, top: 0 },
      { input: desktop, left: scr.x, top: scr.y },
      { input: phoneBody, left: 0, top: 0 },
      { input: mobile, left: phScr.x, top: phScr.y },
      { input: onTop, left: 0, top: 0 },
    ])
    .png({ compressionLevel: 9, palette: false })
    .toFile(p(`src/assets/work/${id}.png`));
  console.log(`wrote src/assets/work/${id}.png`);
}

const wanted = process.argv.slice(2);
for (const id of wanted.length ? wanted : PROJECTS) await build(id);
