// Instagram posts for Apex Designs, built as HTML and screenshotted with headless Chrome.
//
//   node social/make-posts.mjs            → every post
//   node social/make-posts.mjs black      → only posts whose folder name contains "black"
//
// Output: social/posts/<post>/<nn>.png (1080×1350 feed slides, 1080×1920 for stories).
// Offer wording and dates live in OFFER below so they are easy to change.
import sharp from 'sharp';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = path.join(ROOT, 'social', 'posts');
const BUILD = path.join(tmpdir(), 'apex-social-build');
const f = (rel) => pathToFileURL(path.join(ROOT, rel)).href;

const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
].find((p) => existsSync(p));

const OFFER = {
  ends: '27 November',
  endsLong: 'Black Friday, 27 November 2026',
  url: 'apexdesigns.org.uk/quote',
};
const SITE = 'apexdesigns.org.uk';
const WHATSAPP = '07486 600030';

// ---------- assets ----------
const RENDER = {
  alAnsaar: f('src/assets/work/al-ansaar.png'),
  whitebeard: f('src/assets/work/whitebeard.png'),
  palestinu: f('src/assets/work/palestinu.png'),
  topLooks: f('src/assets/work/top-looks.png'),
  damalR: f('src/assets/work/damal-restaurant.png'),
  damalB: f('src/assets/work/damal-banqueting.png'),
  thermomix: f('src/assets/work/my-thermomix-my-way.png'),
};
const SCREEN = (id, kind) => f(`scripts/mockups/screens/${id}-${kind}.jpg`);
// Status-bar colours, sampled from the top of each phone screenshot.
const BAR = { 'al-ansaar': '#091513', palestinu: '#000', 'top-looks': '#fff', whitebeard: '#090d18' };
const LOGO = f('src/assets/logo/apex-logo.png');
const MARK_PATH = path.join(BUILD, 'mark.png'); // the mountain without the wordmark, made in main()
const MARK = pathToFileURL(MARK_PATH).href;

// ---------- fonts ----------
const fs = (fam, file, weight, style = 'normal') =>
  `@font-face{font-family:'${fam}';src:url('${f(`node_modules/@fontsource/${file}`)}') format('woff2');font-weight:${weight};font-style:${style};}`;
const LOCAL_FONTS = [
  fs('Playfair Display', 'playfair-display/files/playfair-display-latin-400-normal.woff2', 400),
  fs('Playfair Display', 'playfair-display/files/playfair-display-latin-700-normal.woff2', 700),
  fs('Playfair Display', 'playfair-display/files/playfair-display-latin-800-normal.woff2', 800),
  fs('Playfair Display', 'playfair-display/files/playfair-display-latin-700-italic.woff2', 700, 'italic'),
  fs('Playfair Display', 'playfair-display/files/playfair-display-latin-800-italic.woff2', 800, 'italic'),
  fs('Poppins', 'poppins/files/poppins-latin-400-normal.woff2', 400),
  fs('Poppins', 'poppins/files/poppins-latin-500-normal.woff2', 500),
  fs('Poppins', 'poppins/files/poppins-latin-600-normal.woff2', 600),
  fs('Poppins', 'poppins/files/poppins-latin-700-normal.woff2', 700),
].join('\n');
const GOOGLE_FONTS =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Inter:wght@400;500;600;700;800&family=Montserrat:wght@300;400;500;600;700;800&family=Marcellus&display=block';

// ---------- icons (Feather-style strokes) ----------
const ICON = {
  code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  bag: '<path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  refresh: '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  arrow: '<line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>',
  chat: '<path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>',
  globe: '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
  pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>',
  user: '<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  done: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  box: '<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>',
  database: '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/>',
  mail: '<path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
  server: '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>',
  layout: '<rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  gift: '<polyline points="20 12 20 22 4 22 4 12"/><rect x="2" y="7" width="20" height="5"/><line x1="12" y1="22" x2="12" y2="7"/><path d="M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7z"/><path d="M12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
};
const icon = (name, size = 40, sw = 1.8) =>
  `<svg class="ic" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${ICON[name]}</svg>`;
const STAR = '<svg width="34" height="34" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';

// ---------- building blocks ----------
// A square window onto part of an image: (cx, cy) is the centre and d the width, in source pixels.
const crop = (src, srcW, cx, cy, d, size, cls = '') => {
  const k = size / d;
  return `<div class="crop ${cls}" style="width:${size}px;height:${size}px;background-image:url('${src}');background-size:${srcW * k}px auto;background-position:${-(cx * k - size / 2)}px ${-(cy * k - size / 2)}px"></div>`;
};
// Fill the slide with part of an image (scaled by k), for blurred atmospheric backgrounds.
const backdrop = (src, srcW, cx, cy, k, w = 1080, h = 1350) =>
  `<div class="backdrop" style="background-image:url('${src}');background-size:${srcW * k}px auto;background-position:${-(cx * k - w / 2)}px ${-(cy * k - h / 2)}px"></div>`;
// A phone showing a project's mobile screenshot under a status bar, so the notch never covers the site.
const phone = (id, w, style = '') => {
  const h = Math.round((w * 844) / 390);
  const bar = BAR[id] ?? '#000';
  const ink = bar === '#fff' ? '#111' : '#fff';
  const barH = Math.round(w * 0.13);
  return `<div class="phone" style="width:${w + 28}px;height:${h + 28}px;${style}"><div class="scr" style="width:${w}px;height:${h}px;background:${bar}">
    <div class="bar" style="height:${barH}px;color:${ink};font-size:${Math.round(w * 0.042)}px"><span>9:41</span><span class="sig"><b></b><b></b><b></b><b></b></span></div>
    <img src="${SCREEN(id, 'mobile')}" style="width:${w}px;height:${h - barH}px"></div><i></i></div>`;
};
const foot = (n, total, style = '') =>
  `<div class="foot" style="${style}"><span class="by"><span class="badge"><img src="${MARK}"></span>Designed &amp; built by <b>Apex Designs</b></span><span class="count">${n} / ${total}</span></div>`;
const swipe = (cls = 'top') => `<div class="swipe ${cls}">Swipe ${icon('arrow', 30, 2)}</div>`;
const down = () => icon('arrow', 40).replace('<svg', '<svg style="transform:rotate(90deg)"');

const BASE_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html,body{width:var(--w);height:var(--h);overflow:hidden}
body{-webkit-font-smoothing:antialiased;text-rendering:geometricPrecision}
.slide{position:relative;width:var(--w);height:var(--h);overflow:hidden}
img{display:block}
.crop{background-repeat:no-repeat}
.backdrop{position:absolute;inset:-40px;background-repeat:no-repeat;filter:blur(16px) saturate(1.1)}
.phone{position:absolute;padding:14px;border-radius:70px;background:#0b0b0c;box-shadow:0 0 0 3px #3b3f43,0 50px 90px -30px rgba(0,0,0,.65)}
.phone .scr{border-radius:56px;overflow:hidden}
.phone .bar{display:flex;justify-content:space-between;align-items:center;padding:0 9% 0 12%;font-family:'Inter',sans-serif;font-weight:600}
.phone .sig{display:flex;gap:3px;align-items:flex-end}.phone .sig b{width:4px;background:currentColor;border-radius:1px}
.phone .sig b:nth-child(1){height:6px}.phone .sig b:nth-child(2){height:9px}.phone .sig b:nth-child(3){height:12px}.phone .sig b:nth-child(4){height:15px}
.phone img{object-fit:cover;object-position:top}
.phone i{position:absolute;top:30px;left:50%;width:118px;height:34px;margin-left:-59px;background:#000;border-radius:20px}
.foot{position:absolute;left:70px;right:70px;bottom:52px;display:flex;justify-content:space-between;align-items:center;font:500 22px/1 'Poppins',sans-serif;color:var(--muted);letter-spacing:.01em}
.foot .by{display:flex;align-items:center;gap:14px}
.foot b{font-weight:600;color:var(--fg)}
.foot .badge{width:46px;height:46px;border-radius:50%;background:#fffff2;display:grid;place-items:center;box-shadow:0 2px 8px rgba(0,0,0,.18)}
.foot .badge img{width:32px}
.foot .count{font-variant-numeric:tabular-nums;opacity:.8}
.swipe.top{top:74px;bottom:auto}
.swipe{position:absolute;right:70px;bottom:44px;display:flex;align-items:center;gap:12px;font:600 24px/1 'Poppins',sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--fg)}
.eyebrow{font:600 22px/1.2 'Poppins',sans-serif;letter-spacing:.2em;text-transform:uppercase;color:var(--accent)}
`;

const page = ({ css = '', body, w = 1080, h = 1350, fg = '#534a45', muted = '#7c726b', accent = '#3e7d6e' }) => ({
  w, h,
  html: `<!doctype html>
<html><head><meta charset="utf-8">
<link rel="stylesheet" href="${GOOGLE_FONTS}">
<style>${LOCAL_FONTS}
:root{--w:${w}px;--h:${h}px;--fg:${fg};--muted:${muted};--accent:${accent}}
${BASE_CSS}
${css}</style></head>
<body>${body}</body></html>`,
});

// =====================================================================
// 1. Studio carousel: Apex Designs theme (cream, slate, teal, mustard)
// =====================================================================
const APEX_CSS = `
body{background:#fffff2;color:#534a45;font-family:'Poppins',sans-serif}
h1,h2,h3{font-family:'Playfair Display',serif;color:#54595f;font-weight:800;line-height:1.02}
em{font-style:italic;color:#3e7d6e}
.peaks{position:absolute;inset:0;opacity:.07;pointer-events:none}
.band{position:absolute;left:0;right:0;bottom:0;background:#3e7d6e}
.pill{display:inline-flex;align-items:center;gap:14px;background:#f3d97a;color:#54595f;font:700 30px/1 'Playfair Display',serif;letter-spacing:.04em;text-transform:uppercase;padding:28px 44px;border-radius:14px;box-shadow:0 0 14px rgba(0,0,0,.18)}
.head{position:absolute;left:70px;right:70px;top:80px}
.head h2{font-size:84px;margin-top:18px}
`;
const peaksSvg = (color = '#3e7d6e') =>
  `<svg class="peaks" viewBox="0 0 1080 1350" preserveAspectRatio="none"><path fill="${color}" d="M0 1350 L250 900 L420 1080 L640 700 L860 1020 L960 900 L1080 1060 L1080 1350Z"/></svg>`;
const apexTotal = 6;
const apex = [
  // 1 cover
  page({
    css: APEX_CSS + `
      .logo{position:absolute;left:62px;top:56px;width:150px}
      .tag{position:absolute;right:70px;top:84px;text-align:right;font:600 21px/1.6 'Poppins';letter-spacing:.18em;text-transform:uppercase;color:#3e7d6e}
      h1{position:absolute;left:70px;top:258px;font-size:156px;letter-spacing:-.01em}
      .lead{position:absolute;left:74px;top:600px;width:820px;font-size:33px;line-height:1.45;color:#534a45}
      .band{height:330px}
      .hero{position:absolute;left:50%;top:722px;width:940px;margin-left:-470px;filter:drop-shadow(0 30px 40px rgba(0,0,0,.25))}
      .swipe{color:#fffff2;left:70px;right:auto}`,
    body: `<div class="slide">${peaksSvg()}
      <img class="logo" src="${LOGO}">
      <div class="tag">Web design studio<br>${SITE}</div>
      <h1>Websites<br><em>that click.</em></h1>
      <p class="lead">Custom websites, booking systems and online shops, designed and built by our team.</p>
      <div class="band"></div>
      <img class="hero" src="${RENDER.whitebeard}">
      ${swipe('')}
    </div>`,
  }),
  // 2 recent work
  page({
    css: APEX_CSS + `
      .grid{position:absolute;left:60px;right:60px;top:345px;display:grid;grid-template-columns:1fr 1fr;gap:24px}
      .card{position:relative;height:410px;border-radius:24px;overflow:hidden;box-shadow:0 18px 40px -24px rgba(83,74,69,.6)}
      .card img{position:absolute;left:50%;top:26px;width:450px;margin-left:-225px}
      .card.c4 .meta{color:#1b1b1b}
      .card .meta{position:absolute;left:28px;right:28px;bottom:24px;color:#fff}
      .card h3{font:700 36px/1.1 'Playfair Display';color:inherit}
      .card p{font:500 20px/1.4 'Poppins';opacity:.8;margin-top:6px}
      .c1{background:linear-gradient(160deg,#1c3a30,#0d1b16)} .c1 h3{color:#d8b56c}
      .c2{background:linear-gradient(160deg,#1b2540,#0a0f1c)} .c2 h3{color:#e3c26c}
      .c3{background:linear-gradient(160deg,#1d1d1d,#000)}
      .c4{background:linear-gradient(160deg,#f2f2f2,#d9dbde);color:#1b1b1b}
      .more{position:absolute;left:70px;right:70px;top:1215px;font:500 25px/1.4 'Poppins';color:#7c726b}
      .more b{color:#3e7d6e;font-weight:600}`,
    body: `<div class="slide">
      <div class="head"><div class="eyebrow">Recent work</div><h2>Built for real <em>businesses.</em></h2></div>
      <div class="grid">
        <div class="card c1"><img src="${RENDER.alAnsaar}"><div class="meta"><h3>Al Ansaar</h3><p>Charity · Oxford</p></div></div>
        <div class="card c2"><img src="${RENDER.whitebeard}"><div class="meta"><h3>Whitebeard</h3><p>Accounting · London</p></div></div>
        <div class="card c3"><img src="${RENDER.palestinu}"><div class="meta"><h3>Palestinu</h3><p>Chocolate shop · Oxford</p></div></div>
        <div class="card c4"><img src="${RENDER.topLooks}"><div class="meta"><h3>Top Looks Barbers</h3><p>Barbershop · Romford</p></div></div>
      </div>
      <p class="more">Plus <b>Damal Restaurant</b>, <b>Damal Banqueting</b> and <b>My Thermomix My Way</b>.</p>
    </div>`,
  }),
  // 3 what we build
  page({
    css: APEX_CSS + `
      ul{position:absolute;left:70px;right:70px;top:330px;list-style:none;display:grid;gap:22px}
      li{display:flex;gap:30px;align-items:center;background:#fff;border:1px solid rgba(84,89,95,.14);border-radius:20px;padding:24px 30px;box-shadow:0 6px 18px -12px rgba(83,74,69,.4)}
      .i{flex:none;width:76px;height:76px;border-radius:18px;background:#3e7d6e;color:#fffff2;display:grid;place-items:center}
      li h3{font:700 32px/1.15 'Playfair Display';color:#54595f}
      li p{font:400 22px/1.4 'Poppins';color:#7c726b;margin-top:4px}`,
    body: `<div class="slide">
      <div class="head"><div class="eyebrow">What we build</div><h2>More than a <em>pretty page.</em></h2></div>
      <ul>
        <li><div class="i">${icon('code')}</div><div><h3>Custom-coded websites</h3><p>Fast, unique sites, built from scratch for your brand</p></div></li>
        <li><div class="i">${icon('calendar')}</div><div><h3>Online booking systems</h3><p>Customers book themselves in, day or night</p></div></li>
        <li><div class="i">${icon('bag')}</div><div><h3>Online shops</h3><p>Products, orders and dispatch in one place</p></div></li>
        <li><div class="i">${icon('refresh')}</div><div><h3>Revamps &amp; migrations</h3><p>New design, with hosting, email and data moved safely</p></div></li>
        <li><div class="i">${icon('pin')}</div><div><h3>Get found on Google</h3><p>Google Business Profile and Analytics set up for you</p></div></li>
      </ul>
      ${foot(3, apexTotal)}
    </div>`,
  }),
  // 4 packages
  page({
    css: APEX_CSS + `
      .pks{position:absolute;left:60px;right:60px;top:345px;display:grid;gap:30px}
      .pk{position:relative;display:grid;grid-template-columns:330px 1fr;gap:26px;border-radius:24px;padding:34px 36px;background:#fff;border:1px solid rgba(84,89,95,.14);box-shadow:0 10px 24px -16px rgba(83,74,69,.5)}
      .pk h3{font:800 44px/1 'Playfair Display';color:#54595f}
      .price{font:800 62px/1 'Playfair Display';color:#3e7d6e;margin-top:18px}
      .note{font:500 21px/1.3 'Poppins';color:#7c726b;margin-top:10px}
      .pk ul{list-style:none;display:grid;gap:10px;align-content:center}
      .pk li{display:flex;gap:12px;align-items:center;font:400 23px/1.3 'Poppins'}
      .pk li .ic{flex:none;color:#3e7d6e}
      .pk .plus{font:600 19px/1.2 'Poppins';letter-spacing:.12em;text-transform:uppercase;color:#7c726b}
      .p2{background:#3e7d6e;border:0;color:#fffff2}
      .p2 h3,.p2 .price{color:#fffff2}.p2 .note,.p2 .plus{color:#cfe3dc}.p2 li .ic{color:#f3d97a}
      .p2 .flag{position:absolute;right:30px;top:-18px;background:#f3d97a;color:#54595f;font:700 18px/1 'Poppins';letter-spacing:.14em;text-transform:uppercase;padding:12px 18px;border-radius:8px}`,
    body: `<div class="slide">
      <div class="head"><div class="eyebrow">Packages</div><h2>Clear prices, <em>no surprises.</em></h2></div>
      <div class="pks"><div class="pk p1"><div><h3>Standard</h3><div class="price">£300</div><div class="note">one-off</div></div>
        <ul><li>${icon('check', 26, 2.6)}Custom single-page website</li><li>${icon('check', 26, 2.6)}Consultation call</li><li>${icon('check', 26, 2.6)}Free hosting</li><li>${icon('check', 26, 2.6)}Custom email &amp; logo</li></ul></div>
      <div class="pk p2"><span class="flag">Recommended</span><div><h3>Premium</h3><div class="price">£500</div><div class="note">+ £15/month</div></div>
        <ul><li class="plus">Standard, plus</li><li>${icon('check', 26, 2.6)}Multi-page website</li><li>${icon('check', 26, 2.6)}Google Business Profile setup</li><li>${icon('check', 26, 2.6)}Google Analytics</li><li>${icon('check', 26, 2.6)}Continuous support</li></ul></div>
      <div class="pk p3"><div><h3>Custom</h3><div class="price" style="font-size:52px">On quote</div><div class="note">for bigger projects</div></div>
        <ul><li class="plus">Premium, plus</li><li>${icon('check', 26, 2.6)}Custom-coded systems</li><li>${icon('check', 26, 2.6)}Tailored brand designs</li><li>${icon('check', 26, 2.6)}On-call maintenance</li></ul></div></div>
    </div>`,
  }),
  // 5 reviews
  page({
    css: APEX_CSS + `
      .list{position:absolute;left:60px;right:60px;top:310px;display:grid;gap:22px}
      .rv{border-radius:22px;background:#fff;border:1px solid rgba(84,89,95,.14);padding:28px 36px;box-shadow:0 8px 22px -16px rgba(83,74,69,.5)}
      .stars{display:flex;gap:4px;color:#e9c95a}
      .rv q{display:block;font:italic 700 32px/1.3 'Playfair Display';color:#54595f;margin-top:12px;quotes:'“' '”'}
      .rv .who{font:500 22px/1 'Poppins';color:#7c726b;margin-top:14px}
      .rv.hl{background:#3e7d6e;border:0}.rv.hl q{color:#fffff2}.rv.hl .who{color:#cfe3dc}`,
    body: `<div class="slide">
      <div class="head"><div class="eyebrow">Google reviews</div><h2>In our clients’ <em>words.</em></h2></div>
      <div class="list">
        <div class="rv"><div class="stars">${STAR.repeat(5)}</div><q>We worked with Apex to get our website revamped - excellent choice!! We are really happy with the end product.</q><div class="who">Imran A</div></div>
        <div class="rv"><div class="stars">${STAR.repeat(5)}</div><q>Very good service, tasks are completed quickly while maintaining a high standard</q><div class="who">Talhah Chowdhury</div></div>
        <div class="rv"><div class="stars">${STAR.repeat(5)}</div><q>Outstanding service from Apex Designs while building my website.</q><div class="who">Ayub Desai</div></div>
        <div class="rv hl"><div class="stars">${STAR.repeat(5)}</div><q>On behalf of Damal, great work, great service would recommend</q><div class="who">Mohamoud Abdi, Damal</div></div>
      </div>
    </div>`,
  }),
  // 6 contact
  page({
    css: APEX_CSS + `
      .logo{position:absolute;left:50%;top:100px;width:330px;margin-left:-165px}
      h2{position:absolute;left:0;right:0;top:490px;text-align:center;font-size:104px}
      .sub{position:absolute;left:120px;right:120px;top:640px;text-align:center;font-size:30px;line-height:1.5}
      .cta{position:absolute;left:0;right:0;top:820px;text-align:center}
      .band{height:250px}
      .ways{position:absolute;left:70px;right:70px;bottom:70px;display:flex;justify-content:space-between;color:#fffff2}
      .ways div{display:flex;align-items:center;gap:16px;font:600 28px/1.2 'Poppins'}
      .ways small{display:block;font:500 18px/1 'Poppins';letter-spacing:.16em;text-transform:uppercase;opacity:.75;margin-bottom:8px}`,
    body: `<div class="slide">${peaksSvg()}
      <img class="logo" src="${LOGO}">
      <h2>Let’s build <em>yours.</em></h2>
      <p class="sub">Tell us about your business and we’ll come back with a clear plan and price. No pressure, no jargon.</p>
      <div class="cta"><span class="pill">Get a free quote ${icon('arrow', 32, 2.4)}</span></div>
      <div class="band"></div>
      <div class="ways">
        <div>${icon('globe', 44)}<span><small>Link in bio</small>${OFFER.url}</span></div>
        <div>${icon('chat', 44)}<span><small>WhatsApp</small>${WHATSAPP}</span></div>
      </div>
    </div>`,
  }),
];

// =====================================================================
// 2. Al Ansaar: deep green, gold, Cormorant
// =====================================================================
const AA_CSS = `
body{background:#0e1c17;color:#e8e1cd;font-family:'Inter',sans-serif}
.slide{background:radial-gradient(120% 80% at 50% 30%,#18342b 0%,#0e1c17 60%,#09130f 100%)}
.v{position:absolute;inset:0;pointer-events:none}
h1,h2{font-family:'Cormorant Garamond',serif;font-weight:500;color:#f1e9d2;line-height:1}
h1 em,h2 em{font-style:italic;color:#d2ab62}
.rule{width:90px;height:2px;background:#c9a25d}
.eyebrow{color:#c9a25d;font-family:'Inter'}
.crop{border-radius:50%;box-shadow:0 0 0 2px #c9a25d55,0 30px 60px rgba(0,0,0,.5)}
`;
// The site's gold diagonal lines meeting at the emblem.
const aaLines = (cy) =>
  `<svg class="v" viewBox="0 0 1080 1350"><g stroke="#c9a25d" stroke-opacity=".3" stroke-width="1.5" fill="none"><line x1="0" y1="${cy - 420}" x2="540" y2="${cy}"/><line x1="1080" y1="${cy - 420}" x2="540" y2="${cy}"/><line x1="540" y1="${cy}" x2="540" y2="1350"/></g></svg>`;
const AA_MOBILE = SCREEN('al-ansaar', 'mobile');
const al = [
  page({
    fg: '#f1e9d2', muted: '#a9b5ab', accent: '#c9a25d',
    css: AA_CSS + `
      .top{position:absolute;left:0;right:0;top:90px;text-align:center}
      h1{font-size:150px;margin-top:26px}
      .rule{margin:34px auto 0}
      .lead{width:800px;margin:34px auto 0;font:400 30px/1.5 'Inter';color:#cdd3c8}
      .hero{position:absolute;left:50%;top:640px;width:1000px;margin-left:-500px;filter:drop-shadow(0 40px 50px rgba(0,0,0,.55))}`,
    body: `<div class="slide">${aaLines(560)}
      <div class="top"><div class="eyebrow">Case study · Charity · Oxford</div><h1>Al Ansaar</h1><div class="rule"></div>
      <p class="lead">A complete WordPress revamp for an Oxford charity, with its database, email and hosting moved to a new home.</p></div>
      <img class="hero" src="${RENDER.alAnsaar}">
      ${swipe()}
    </div>`,
  }),
  page({
    fg: '#f1e9d2', muted: '#a9b5ab', accent: '#c9a25d',
    css: AA_CSS + `
      .em{position:absolute;left:70px;top:100px}
      h2{position:absolute;left:70px;top:350px;width:520px;font-size:86px}
      .pillars{position:absolute;left:70px;top:720px;width:520px;list-style:none}
      .pillars li{display:flex;align-items:baseline;gap:22px;padding:24px 0;border-top:1px solid #c9a25d44;font:500 40px/1.1 'Cormorant Garamond';color:#f1e9d2}
      .pillars li:last-child{border-bottom:1px solid #c9a25d44}
      .pillars span{font:600 18px/1 'Inter';letter-spacing:.2em;color:#c9a25d}`,
    body: `<div class="slide">
      <div class="em">${crop(AA_MOBILE, 1170, 585, 1250, 670, 200)}</div>
      <h2>Three areas of work, <em>one clear entrance.</em></h2>
      <ul class="pillars"><li><span>01</span>Funeral Care</li><li><span>02</span>Sunnah Sports Academy</li><li><span>03</span>Community</li></ul>
      ${phone('al-ansaar', 392, 'right:70px;top:110px')}
      ${foot(2, 3)}
    </div>`,
  }),
  page({
    fg: '#f1e9d2', muted: '#a9b5ab', accent: '#c9a25d',
    css: AA_CSS + `
      .head{position:absolute;left:70px;top:90px;right:70px}
      h2{font-size:96px;margin-top:22px}
      .lead{margin-top:28px;width:860px;font:400 29px/1.5 'Inter';color:#cdd3c8}
      .grid{position:absolute;left:70px;right:70px;top:610px;display:grid;grid-template-columns:1fr 1fr;gap:22px}
      .grid div{border:1px solid #c9a25d55;border-radius:18px;padding:30px;background:#ffffff06}
      .grid .ic{color:#d2ab62}
      .grid h3{font:600 36px/1.1 'Cormorant Garamond';color:#f1e9d2;margin-top:16px}
      .launch{position:absolute;left:70px;right:70px;top:1110px;display:flex;align-items:center;gap:18px;font:500 26px/1.3 'Inter';color:#cdd3c8}
      .launch b{color:#d2ab62;font-weight:600}`,
    body: `<div class="slide">
      <div class="head"><div class="eyebrow">Behind the scenes</div><h2>A full move, <em>done carefully.</em></h2>
      <p class="lead">Each step was planned around a service that families rely on at any hour.</p></div>
      <div class="grid">
        <div>${icon('layout', 44)}<h3>WordPress revamp</h3></div>
        <div>${icon('database', 44)}<h3>Database migration</h3></div>
        <div>${icon('mail', 44)}<h3>Email migration</h3></div>
        <div>${icon('server', 44)}<h3>New hosting</h3></div>
      </div>
      <div class="launch">${icon('globe', 36)}<span>Launching at <b>alansaar.co.uk</b></span></div>
      ${foot(3, 3)}
    </div>`,
  }),
];

// =====================================================================
// 3. Whitebeard: navy, gold, Cormorant, London skyline
// =====================================================================
const WB_CSS = `
body{background:#0b1120;color:#dfe3ec;font-family:'Inter',sans-serif}
.slide{background:linear-gradient(180deg,#0f172b 0%,#0a0f1d 100%)}
.sky{position:absolute;inset:0;background:url('${SCREEN('whitebeard', 'desktop')}') no-repeat;background-size:auto 1700px;background-position:-1400px -260px;opacity:.4;-webkit-mask-image:linear-gradient(90deg,transparent 25%,#000 75%)}
.sky::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,#0f172b 0%,transparent 35%,transparent 75%,#0a0f1d 100%)}
h1,h2{font-family:'Cormorant Garamond',serif;font-weight:500;color:#fff;line-height:1.02}
h1 em,h2 em{color:#d6b25e;font-style:italic}
.eyebrow{font-family:'Inter';color:#8b95ab;letter-spacing:.24em}
.rule{width:80px;height:2px;background:#d6b25e}
.btn{display:inline-flex;align-items:center;gap:14px;background:#d6b25e;color:#0b1120;font:600 26px/1 'Inter';padding:24px 32px;border-radius:8px}
`;
const wb = [
  page({
    fg: '#fff', muted: '#8b95ab', accent: '#d6b25e',
    css: WB_CSS + `
      .head{position:absolute;left:70px;top:96px;width:900px}
      .brand{font:600 40px/1 'Cormorant Garamond';color:#fff}
      .eyebrow{margin-top:60px}
      h1{font-size:118px;margin-top:22px}
      .rule{margin-top:36px}
      .hero{position:absolute;left:50%;top:700px;width:1000px;margin-left:-500px;filter:drop-shadow(0 40px 50px rgba(0,0,0,.6))}`,
    body: `<div class="slide"><div class="sky"></div>
      <div class="head"><div class="brand">Whitebeard.</div><div class="eyebrow">Case study · Accounting · London</div>
      <h1>A premium rebuild, <em>second time round.</em></h1><div class="rule"></div></div>
      <img class="hero" src="${RENDER.whitebeard}">
      ${swipe()}
    </div>`,
  }),
  page({
    fg: '#fff', muted: '#8b95ab', accent: '#d6b25e',
    css: WB_CSS + `
      .copy{position:absolute;left:70px;top:110px;width:520px}
      h2{font-size:84px;margin-top:24px}
      .rule{margin:34px 0}
      p{font:400 27px/1.55 'Inter';color:#c3c9d6}
      .facts{position:absolute;left:70px;top:880px;width:500px;list-style:none;display:grid;gap:20px}
      .facts li{display:flex;gap:18px;align-items:center;font:500 26px/1.3 'Inter';color:#fff}
      .facts .ic{color:#d6b25e;flex:none}`,
    body: `<div class="slide"><div class="sky" style="opacity:.2"></div>
      <div class="copy"><div class="eyebrow">The design</div><h2>Navy, gold &amp; <em>calm confidence.</em></h2><div class="rule"></div>
      <p>Elegant serif headlines and plenty of space, set against the London skyline the firm works across.</p></div>
      <ul class="facts">
        <li>${icon('done', 34)}AAT licensed since 2009</li>
        <li>${icon('calendar', 34)}Free consultation in two clicks</li>
        <li>${icon('zap', 34)}Fast on every device</li>
      </ul>
      ${phone('whitebeard', 392, 'right:70px;top:110px')}
      ${foot(2, 3)}
    </div>`,
  }),
  page({
    fg: '#fff', muted: '#8b95ab', accent: '#d6b25e',
    css: WB_CSS + `
      .head{position:absolute;left:70px;right:70px;top:100px}
      h2{font-size:100px;margin-top:24px}
      .row{position:absolute;left:70px;right:70px;top:470px;display:grid;grid-template-columns:1fr 70px 1fr;align-items:center}
      .box{border:1px solid #2a3552;border-radius:16px;padding:30px;background:#ffffff05}
      .box small{font:600 18px/1 'Inter';letter-spacing:.2em;text-transform:uppercase;color:#8b95ab}
      .box div{font:500 40px/1.1 'Cormorant Garamond';color:#fff;margin-top:14px}
      .box.after{border-color:#d6b25e88}.box.after div{color:#d6b25e}
      .row .ic{color:#d6b25e;justify-self:center}
      ul{position:absolute;left:70px;right:70px;top:720px;list-style:none;display:grid;grid-template-columns:1fr 1fr;gap:22px 30px}
      li{display:flex;gap:16px;align-items:center;font:500 27px/1.3 'Inter';color:#fff;padding:22px 0;border-bottom:1px solid #22304d}
      li .ic{color:#d6b25e;flex:none}
      .soon{position:absolute;left:70px;top:960px}`,
    body: `<div class="slide">
      <div class="head"><div class="eyebrow">The result</div><h2>From brochure site to <em>full website.</em></h2></div>
      <div class="row"><div class="box"><small>Before</small><div>Simple brochure site</div></div>${icon('arrow', 44)}<div class="box after"><small>Now</small><div>Premium, full website</div></div></div>
      <ul>
        <li>${icon('pen', 32)}Full redesign</li><li>${icon('code', 32)}Custom-coded build</li>
        <li>${icon('book', 32)}Blog &amp; guides</li><li>${icon('calendar', 32)}Consultation booking</li>
      </ul>
      <div class="soon"><span class="btn">${icon('clock', 30, 2.2)} Launching soon</span></div>
      ${foot(3, 3)}
    </div>`,
  }),
];

// =====================================================================
// 4. Palestinu: black, keffiyeh pattern, red / green / white
// =====================================================================
const PA_CSS = `
body{background:#000;color:#fff;font-family:'Inter',sans-serif}
.slide{background:radial-gradient(90% 60% at 50% 35%,#1b1b1b 0%,#000 70%)}
.kef{position:absolute;inset:0;opacity:.06;background:
  repeating-linear-gradient(45deg,#fff 0 3px,transparent 3px 46px),
  repeating-linear-gradient(-45deg,#fff 0 3px,transparent 3px 46px)}
.word{font:300 64px/1 'Montserrat';letter-spacing:.12em;color:#fff}
h1,h2{font:800 96px/1.02 'Inter';letter-spacing:-.02em;color:#fff}
.red{color:#e4313c}.green{color:#1fa45a}
.flag{position:absolute;left:0;right:0;bottom:0;display:flex;height:12px}.flag i{flex:1}.flag i:nth-child(1){background:#1a1a1a}.flag i:nth-child(2){background:#fff}.flag i:nth-child(3){background:#149954}.flag i:nth-child(4){background:#e4313c}
.eyebrow{color:#e4313c;font-family:'Inter'}
`;
const pa = [
  page({
    fg: '#fff', muted: '#9a9a9a', accent: '#e4313c',
    css: PA_CSS + `
      .bird{position:absolute;left:62px;top:70px;mix-blend-mode:lighten}
      .word{position:absolute;left:240px;top:120px}
      .head{position:absolute;left:70px;top:310px;width:940px}
      h1{margin-top:22px}
      .lead{margin-top:28px;font:400 29px/1.5 'Inter';color:#c9c9c9;width:860px}
      .hero{position:absolute;left:50%;top:790px;width:900px;margin-left:-450px}`,
    body: `<div class="slide"><div class="kef"></div>
      <div class="bird">${crop(SCREEN('palestinu', 'mobile'), 1170, 214, 214, 300, 160)}</div><div class="word">PALESTINU</div>
      <div class="head"><div class="eyebrow">Case study · Chocolate brand · Oxford</div>
      <h1>Every bar tells a story. <span class="red">Now</span> it <span class="green">sells</span> online.</h1>
      <p class="lead">A brand site and online shop for a Palestinian-owned chocolate brand, with bars designed in Gaza.</p></div>
      <img class="hero" src="${RENDER.palestinu}">
      ${swipe()}
      <div class="flag"><i></i><i></i><i></i><i></i></div>
    </div>`,
  }),
  page({
    fg: '#fff', muted: '#9a9a9a', accent: '#e4313c',
    css: PA_CSS + `
      .copy{position:absolute;left:70px;top:110px;width:520px}
      h2{font-size:80px;margin-top:22px}
      .lead{margin-top:28px;font:400 27px/1.5 'Inter';color:#c9c9c9}
      ul{position:absolute;left:70px;top:790px;width:500px;list-style:none;display:grid;gap:22px}
      li{display:flex;gap:18px;align-items:center;font:500 27px/1.3 'Inter'}
      li .ic{flex:none;color:#1fa45a}
      .price{position:absolute;left:70px;top:1090px;display:inline-flex;gap:14px;align-items:center;background:#149954;color:#fff;font:700 26px/1 'Inter';padding:20px 28px;border-radius:40px}`,
    body: `<div class="slide"><div class="kef"></div>
      <div class="copy"><div class="eyebrow">The shop</div><h2>From one bar to <span class="red">the whole box.</span></h2>
      <p class="lead">Every chocolate gets its own page, with size and quantity options.</p></div>
      <ul><li>${icon('bag', 34)}Product pages &amp; variants</li><li>${icon('box', 34)}Order fulfilment built in</li><li>${icon('done', 34)}Checkout on any device</li></ul>
      <div class="price">Bars from £4.99</div>
      ${phone('palestinu', 392, 'right:70px;top:110px')}
      ${foot(2, 3)}
    </div>`,
  }),
  page({
    fg: '#fff', muted: '#9a9a9a', accent: '#e4313c',
    css: PA_CSS + `
      .head{position:absolute;left:70px;right:70px;top:110px}
      h2{font-size:92px;margin-top:22px}
      .steps{position:absolute;left:70px;right:70px;top:580px;display:grid;grid-template-columns:repeat(3,1fr);gap:20px}
      .steps div{border-radius:20px;padding:34px 28px;background:#141414;border:1px solid #262626;min-height:330px}
      .steps b{display:block;font:800 74px/1 'Inter';letter-spacing:-.03em}
      .steps h3{font:700 32px/1.15 'Inter';margin-top:22px}
      .steps p{font:400 22px/1.45 'Inter';color:#a8a8a8;margin-top:10px}
      .s1 b{color:#fff}.s2 b{color:#1fa45a}.s3 b{color:#e4313c}
      .note{position:absolute;left:70px;right:70px;top:970px;font:400 28px/1.5 'Inter';color:#c9c9c9}`,
    body: `<div class="slide"><div class="kef"></div>
      <div class="head"><div class="eyebrow">Behind the shop</div><h2>Orders, payments &amp; dispatch. <span class="green">One place.</span></h2></div>
      <div class="steps">
        <div class="s1"><b>01</b><h3>Order</h3><p>Customers buy straight from the brand</p></div>
        <div class="s2"><b>02</b><h3>Pack</h3><p>The team sees what needs packing at a glance</p></div>
        <div class="s3"><b>03</b><h3>Send</h3><p>Every order out of the door, across the UK</p></div>
      </div>
      <p class="note">A brand story and a shop in one, so people who want to learn and people who want to buy both find their way in one click.</p>
      ${foot(3, 3, 'bottom:66px')}
      <div class="flag"><i></i><i></i><i></i><i></i></div>
    </div>`,
  }),
];

// =====================================================================
// 5. Top Looks Barbers: clean white, black, barber-pole stripes, Montserrat
// =====================================================================
const TL_CSS = `
body{background:#fff;color:#1b1b1b;font-family:'Montserrat',sans-serif}
.pole{position:absolute;top:0;bottom:0;left:0;width:26px;background:repeating-linear-gradient(-45deg,#c8202f 0 22px,#fff 22px 44px,#1d3f8f 44px 66px,#fff 66px 88px)}
h1,h2{font:700 96px/1.05 'Montserrat';letter-spacing:-.02em;color:#111}
.eyebrow{font-family:'Montserrat';color:#c8202f}
`;
const TL_MOBILE = SCREEN('top-looks', 'mobile');
const tl = [
  page({
    fg: '#111', muted: '#777', accent: '#c8202f',
    css: TL_CSS + `
      .logo{position:absolute;left:84px;top:60px}
      .head{position:absolute;left:96px;top:300px;width:900px}
      h1{margin-top:20px;font-size:88px}
      .lead{margin-top:24px;font:400 28px/1.5 'Montserrat';color:#555;width:840px}
      .stage{position:absolute;left:0;right:0;top:960px;bottom:0;background:#111}
      .hero{position:absolute;left:50%;top:790px;width:900px;margin-left:-450px;filter:drop-shadow(0 30px 40px rgba(0,0,0,.35))}`,
    body: `<div class="slide"><div class="pole"></div>
      <div class="logo">${crop(TL_MOBILE, 1170, 254, 214, 330, 210)}</div>
      <div class="head"><div class="eyebrow">Case study · Barbershop · Romford</div><h1>Your chair, booked in a minute.</h1>
      <p class="lead">Customers book a cut with the barber they want, and every barber runs their own diary.</p></div>
      <div class="stage"></div>
      <img class="hero" src="${RENDER.topLooks}">
      ${swipe()}
    </div>`,
  }),
  page({
    fg: '#111', muted: '#777', accent: '#c8202f',
    css: TL_CSS + `
      .copy{position:absolute;left:96px;top:110px;width:500px}
      h2{font-size:76px;margin-top:20px}
      ol{position:absolute;left:96px;top:480px;width:480px;list-style:none;display:grid;gap:18px}
      li{display:flex;gap:22px;align-items:center;padding:22px 24px;border-radius:18px;background:#f4f4f4}
      li .n{flex:none;width:64px;height:64px;border-radius:50%;display:grid;place-items:center;background:#111;color:#fff}
      li:nth-child(1) .n{background:#c8202f}li:nth-child(3) .n{background:#1d3f8f}
      li h3{font:700 28px/1.1 'Montserrat'}
      li p{font:400 20px/1.3 'Montserrat';color:#666;margin-top:4px}`,
    body: `<div class="slide"><div class="pole"></div>
      <div class="copy"><div class="eyebrow">How booking works</div><h2>Four taps to a fresh cut.</h2></div>
      <ol>
        <li><span class="n">${icon('user', 32, 2)}</span><div><h3>Pick your barber</h3><p>Photos and intros for each</p></div></li>
        <li><span class="n">${icon('scissors', 32, 2)}</span><div><h3>Choose a service</h3><p>Pick what you’re in for</p></div></li>
        <li><span class="n">${icon('clock', 32, 2)}</span><div><h3>Pick a time</h3><p>Only real availability</p></div></li>
        <li><span class="n">${icon('check', 32, 2.4)}</span><div><h3>Confirm</h3><p>Pay in the shop after your cut</p></div></li>
      </ol>
      ${phone('top-looks', 392, 'right:70px;top:110px')}
      ${foot(2, 3, 'left:96px')}
    </div>`,
  }),
  page({
    fg: '#fff', muted: '#999', accent: '#e04a56',
    css: TL_CSS + `
      .slide{background:#111}
      .head{position:absolute;left:96px;right:70px;top:110px}
      h2{color:#fff;font-size:100px;margin-top:20px}
      h2 span{color:#e04a56}
      .eyebrow{color:#e04a56}
      .lead{margin-top:30px;font:400 29px/1.5 'Montserrat';color:#bbb;width:860px}
      .stats{position:absolute;left:96px;right:70px;top:640px;display:grid;gap:22px}
      .stats div{display:flex;align-items:center;gap:28px;padding:40px 36px;font-size:38px !important;border-radius:18px;background:#1c1c1c;border:1px solid #2a2a2a;color:#fff;font:600 34px/1.2 'Montserrat'}
      .stats .ic{flex:none;color:#e04a56}
      .stats div:nth-child(2) .ic{color:#5b82e0}`,
    body: `<div class="slide"><div class="pole"></div>
      <div class="head"><div class="eyebrow">For the barbers</div><h2>Every barber runs <span>their own diary.</span></h2>
      <p class="lead">Each barber sets their own hours and availability, so the calendar stays accurate without anyone at the front desk.</p></div>
      <div class="stats">
        <div>${icon('chat', 44)}Fewer phone calls</div>
        <div>${icon('calendar', 44)}Fewer double bookings</div>
        <div>${icon('users', 44)}More chairs filled</div>
      </div>
      ${foot(3, 3, 'left:96px')}
    </div>`,
  }),
];

// =====================================================================
// 6. Damal Restaurant: green marble & gold, Playfair
// =====================================================================
const DR_CSS = `
body{background:#0c2a1c;color:#f3ecd8;font-family:'Poppins',sans-serif}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,24,15,.55),rgba(6,24,15,.85))}
h1,h2{font-family:'Playfair Display',serif;font-weight:700;color:#fff;line-height:1.05}
.eyebrow{color:#e3ae4a}
.frame{position:absolute;border-radius:26px;overflow:hidden;background:#fffff0;box-shadow:0 40px 70px -20px rgba(0,0,0,.6)}
`;
const dr = [
  page({
    fg: '#fff', muted: '#bcd0c2', accent: '#e3ae4a',
    css: DR_CSS + `
      .head{position:absolute;left:0;right:0;top:100px;text-align:center}
      .welcome{font:italic 700 40px/1 'Playfair Display';color:#e3ae4a;margin-top:34px}
      h1{font-size:150px;margin-top:14px}
      .lead{width:820px;margin:24px auto 0;font:400 29px/1.5 'Poppins';color:#e2e8dc}
      .frame{left:60px;right:60px;top:700px;height:540px}
      .frame img{width:100%;height:100%;object-fit:cover}`,
    body: `<div class="slide">${backdrop(RENDER.damalR, 1237, 370, 390, 5.5)}<div class="shade"></div>
      <div class="head"><div class="eyebrow">Case study · Restaurant · Whitechapel</div>
      <div class="welcome">Ku Soo Dhawoow</div><h1>Damal</h1>
      <p class="lead">A vibrant site for a Somali restaurant, true to the Damal green and inspired by the marbling of Mecca.</p></div>
      <div class="frame"><img src="${RENDER.damalR}"></div>
      ${swipe('')}
    </div>`,
  }),
  page({
    fg: '#fff', muted: '#bcd0c2', accent: '#e3ae4a',
    css: DR_CSS + `
      .mark{position:absolute;left:62px;top:110px;font:700 300px/1 'Playfair Display';color:#e3ae4a}
      blockquote{position:absolute;left:70px;right:70px;top:400px;font:italic 700 86px/1.14 'Playfair Display';color:#fff}
      .who{position:absolute;left:70px;top:740px;display:flex;align-items:center;gap:20px;font:500 28px/1.3 'Poppins';color:#e2e8dc}
      .who b{color:#e3ae4a;font-weight:600}
      .stars{display:flex;gap:4px;color:#e3ae4a}
      .back{position:absolute;left:70px;right:70px;top:880px;padding:30px 34px;border:1px solid #e3ae4a66;border-radius:20px;background:rgba(6,24,15,.5);font:400 27px/1.5 'Poppins';color:#e2e8dc}
      .back b{color:#fff;font-weight:600}`,
    body: `<div class="slide">${backdrop(RENDER.damalR, 1237, 370, 390, 5.5)}<div class="shade" style="background:rgba(6,24,15,.8)"></div>
      <div class="mark">“</div>
      <blockquote>Great work, great service, would recommend.</blockquote>
      <div class="who"><div class="stars">${STAR.repeat(5)}</div><span><b>Mohamoud Abdi</b>, Damal</span></div>
      <div class="back">The client came back for more, including the website for <b>Damal Banqueting</b>.</div>
      ${foot(2, 2)}
    </div>`,
  }),
];

// =====================================================================
// 7. Damal Banqueting: dark venue, gold, Poppins
// =====================================================================
const DB_CSS = `
body{background:#120d16;color:#f1e6d4;font-family:'Poppins',sans-serif}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(14,9,18,.6),rgba(14,9,18,.9))}
h1,h2{font:600 108px/1.04 'Poppins';letter-spacing:-.02em;color:#fff}
.gold{color:#e3a33b}
.eyebrow{color:#e3a33b}
.frame{position:absolute;border-radius:26px;overflow:hidden;background:#fffff0;box-shadow:0 40px 70px -20px rgba(0,0,0,.7)}
`;
const db = [
  page({
    fg: '#fff', muted: '#b9aec4', accent: '#e3a33b',
    css: DB_CSS + `
      .head{position:absolute;left:70px;right:70px;top:110px}
      h1{margin-top:24px}
      .lead{margin-top:28px;width:880px;font:400 29px/1.5 'Poppins';color:#ddd2e2}
      .frame{left:60px;right:60px;top:700px;height:540px}
      .frame img{width:100%;height:100%;object-fit:cover}`,
    body: `<div class="slide">${backdrop(RENDER.damalB, 1303, 405, 390, 3.6)}<div class="shade"></div>
      <div class="head"><div class="eyebrow">Case study · Banqueting · East London</div><h1>Damal <span class="gold">Banqueting</span></h1>
      <p class="lead">A modern, contemporary site for a newly opened banqueting suite, built to belong to the Damal family.</p></div>
      <div class="frame"><img src="${RENDER.damalB}"></div>
      ${swipe()}
    </div>`,
  }),
  page({
    fg: '#fff', muted: '#b9aec4', accent: '#e3a33b',
    css: DB_CSS + `
      .head{position:absolute;left:70px;right:70px;top:110px}
      h2{font-size:92px;margin-top:24px}
      .lead{margin-top:28px;font:400 29px/1.5 'Poppins';color:#ddd2e2;width:900px}
      ul{position:absolute;left:70px;right:70px;top:700px;list-style:none;display:grid;gap:20px}
      li{display:flex;align-items:center;gap:24px;padding:28px 32px;border-radius:18px;background:rgba(255,255,255,.06);border:1px solid rgba(227,163,59,.35);font:500 31px/1.25 'Poppins';color:#fff}
      li .ic{color:#e3a33b;flex:none}`,
    body: `<div class="slide">${backdrop(RENDER.damalB, 1303, 405, 390, 3.6)}<div class="shade" style="background:rgba(14,9,18,.84)"></div>
      <div class="head"><div class="eyebrow">The approach</div><h2>Same family. <span class="gold">Its own stage.</span></h2>
      <p class="lead">Large imagery of the space and a clear path for anyone planning a wedding or event.</p></div>
      <ul>
        <li>${icon('pen', 40)}Custom design to match the Damal brand</li>
        <li>${icon('layout', 40)}Multi-page website</li>
        <li>${icon('calendar', 40)}Event &amp; reservation enquiries</li>
      </ul>
      ${foot(2, 2)}
    </div>`,
  }),
];

// =====================================================================
// 8. My Thermomix My Way: white, bright green, Marcellus
// =====================================================================
const TM_CSS = `
body{background:#fff;color:#1d2a22;font-family:'Inter',sans-serif}
.slide{background:linear-gradient(180deg,#ffffff 0%,#effaf3 100%)}
h1,h2{font:400 96px/1.08 'Marcellus',serif;color:#14211a}
.green{color:#00a650}
.eyebrow{font-family:'Inter';color:#00a650}
.brand{font:400 34px/1.05 'Marcellus';color:#3b3b3b}.brand span{color:#00b956;font-size:48px}
`;
const tm = [
  page({
    fg: '#14211a', muted: '#6b7a70', accent: '#00a650',
    css: TM_CSS + `
      .brand{position:absolute;left:70px;top:80px}
      .head{position:absolute;left:70px;right:70px;top:270px}
      h1{margin-top:22px}
      .lead{margin-top:28px;font:400 29px/1.5 'Inter';color:#4a5a50;width:880px}
      .frame{position:absolute;left:60px;right:60px;top:700px;height:540px;border-radius:26px;overflow:hidden;background:#fffff0;border:1px solid #d7ece0;box-shadow:0 30px 60px -30px rgba(0,80,40,.35)}
      .frame img{width:100%;height:100%;object-fit:cover}
      .swipe{top:96px}`,
    body: `<div class="slide">
      <div class="brand">My <span>Thermomix</span><br><span style="font-size:34px;color:#3b3b3b;padding-left:70px">My Way</span></div>
      <div class="head"><div class="eyebrow">Case study · Sales funnel</div><h1>One job, <span class="green">done well.</span></h1>
      <p class="lead">A simple, streamlined funnel that routes every visitor to the right salesperson, quickly.</p></div>
      <div class="frame"><img src="${RENDER.thermomix}"></div>
      ${swipe()}
    </div>`,
  }),
  page({
    fg: '#14211a', muted: '#6b7a70', accent: '#00a650',
    css: TM_CSS + `
      .head{position:absolute;left:70px;right:70px;top:110px}
      h2{font-size:84px;margin-top:22px}
      .flow{position:absolute;left:70px;right:70px;top:500px}
      .step{display:flex;align-items:center;gap:28px;padding:30px 34px;border-radius:22px;background:#fff;border:1px solid #d7ece0;box-shadow:0 10px 26px -18px rgba(0,80,40,.35)}
      .step .n{flex:none;width:76px;height:76px;border-radius:50%;background:#00b956;color:#fff;display:grid;place-items:center}
      .step h3{font:400 40px/1.1 'Marcellus';color:#14211a}
      .step p{font:400 22px/1.4 'Inter';color:#6b7a70;margin-top:4px}
      .down{height:56px;display:grid;place-items:center;color:#00b956}
      .step.last{background:#00b956;border:0}.step.last .n{background:#fff;color:#00a650}.step.last h3,.step.last p{color:#fff}`,
    body: `<div class="slide">
      <div class="head"><div class="eyebrow">The customer journey</div><h2>Nobody gets lost. <span class="green">Nobody gives up.</span></h2></div>
      <div class="flow">
        <div class="step"><span class="n">${icon('users', 38)}</span><div><h3>A visitor arrives</h3><p>Curious about Thermomix</p></div></div>
        <div class="down">${down()}</div>
        <div class="step"><span class="n">${icon('done', 38)}</span><div><h3>One clear choice at a time</h3><p>A short path with no distractions</p></div></div>
        <div class="down">${down()}</div>
        <div class="step last"><span class="n">${icon('user', 38)}</span><div><h3>The right salesperson</h3><p>Matched quickly to the best person to help</p></div></div>
      </div>
      ${foot(2, 2)}
    </div>`,
  }),
];

// =====================================================================
// 9. Early Black Friday: a free sample site with every quote request
// =====================================================================
const BF_CSS = `
body{background:#0b0b0b;color:#f4f1e6;font-family:'Poppins',sans-serif}
.slide{background:radial-gradient(90% 60% at 50% 20%,#1f2a26 0%,#0b0b0b 65%)}
h1,h2{font-family:'Playfair Display',serif;font-weight:800;color:#fff;line-height:1}
em{font-style:italic;color:#f3d97a}
.eyebrow{color:#f3d97a}
.outline{font:800 150px/.9 'Playfair Display';color:transparent;-webkit-text-stroke:2px #f3d97a;letter-spacing:.01em}
.tag{display:inline-flex;align-items:center;gap:12px;background:#3e7d6e;color:#fffff2;font:700 22px/1 'Poppins';letter-spacing:.18em;text-transform:uppercase;padding:16px 22px;border-radius:10px}
.pill{display:inline-flex;align-items:center;gap:14px;background:#f3d97a;color:#262626;font:700 30px/1 'Playfair Display';letter-spacing:.04em;text-transform:uppercase;padding:28px 44px;border-radius:14px;box-shadow:0 0 30px rgba(243,217,122,.25)}
.sticker{position:absolute;width:250px;height:250px;border-radius:50%;background:#f3d97a;color:#1b1b1b;display:grid;place-items:center;text-align:center;transform:rotate(-12deg);box-shadow:0 20px 40px rgba(0,0,0,.5)}
.sticker b{display:block;font:800 80px/.9 'Playfair Display'}
.sticker span{display:block;font:700 20px/1.25 'Poppins';letter-spacing:.14em;text-transform:uppercase;margin-top:8px}
.logo{border-radius:50%;background:#fffff2;display:grid;place-items:center}
.head{position:absolute;left:70px;right:70px;top:90px}
`;
const bfTotal = 4;
const bfPhones = (top, w) => `
  ${phone('al-ansaar', w, `left:${540 - w * 1.62}px;top:${top + 60}px;transform:rotate(-8deg)`)}
  ${phone('top-looks', w, `left:${540 + w * 0.6}px;top:${top + 60}px;transform:rotate(8deg)`)}
  ${phone('whitebeard', w + 20, `left:${540 - (w + 48) / 2}px;top:${top}px;z-index:2`)}`;
const bf = [
  page({
    fg: '#fff', muted: '#a7a59c', accent: '#f3d97a',
    css: BF_CSS + `
      .top{position:absolute;left:70px;right:70px;top:80px;display:flex;justify-content:space-between;align-items:center}
      .logo{width:68px;height:68px}.logo img{width:48px}
      .outline{position:absolute;left:66px;top:195px}
      h1{position:absolute;left:70px;top:510px;font-size:94px;width:960px}
      .lead{position:absolute;left:72px;top:750px;width:600px;font:400 28px/1.5 'Poppins';color:#d6d3c8}
      .sticker{right:80px;top:150px;z-index:3}`,
    body: `<div class="slide">
      <div class="top"><span class="tag">${icon('zap', 26, 2.2)} Early Black Friday</span></div>
      <div class="outline">BLACK<br>FRIDAY</div>
      <div class="sticker"><div><b>FREE</b><span>Sample<br>website</span></div></div>
      <h1>A <em>free</em> sample website for your business.</h1>
      <p class="lead">Fill in our quote form and we’ll design a sample site for you. No cost, no commitment.</p>
      ${bfPhones(990, 270)}
    </div>`,
  }),
  page({
    fg: '#fff', muted: '#a7a59c', accent: '#f3d97a',
    css: BF_CSS + `
      h2{font-size:96px;margin-top:22px}
      .steps{position:absolute;left:70px;right:70px;top:380px;display:grid;gap:26px}
      .st{display:grid;grid-template-columns:110px 1fr;gap:30px;align-items:center;padding:34px 36px;border-radius:24px;background:#161616;border:1px solid #2a2a2a}
      .st b{font:800 96px/1 'Playfair Display';color:#f3d97a;text-align:center}
      .st h3{font:700 40px/1.1 'Playfair Display';color:#fff}
      .st p{font:400 25px/1.45 'Poppins';color:#bdbab0;margin-top:10px}
      .st.hl{background:#3e7d6e;border:0}.st.hl b{color:#fffff2}.st.hl p{color:#dcefe8}
      .ends{position:absolute;left:70px;right:70px;top:1110px;display:flex;align-items:center;justify-content:center;gap:16px;padding:26px;border:2px dashed #f3d97a88;border-radius:18px;font:500 28px/1.2 'Poppins';color:#d6d3c8}
      .ends b{color:#f3d97a;font-weight:600}.ends .ic{color:#f3d97a}`,
    body: `<div class="slide">
      <div class="head"><div class="eyebrow">How it works</div><h2>Three steps. <em>Zero risk.</em></h2></div>
      <div class="steps">
        <div class="st"><b>1</b><div><h3>Fill in our quote form</h3><p>Tell us about your business and what you need. It takes two minutes.</p></div></div>
        <div class="st"><b>2</b><div><h3>We design your sample site</h3><p>A custom sample, built around your brand, for free.</p></div></div>
        <div class="st hl"><b>3</b><div><h3>Love it? Let’s build it.</h3><p>Go ahead with the full website, or walk away. No charge either way.</p></div></div>
      </div>
      <div class="ends">${icon('clock', 34)}<span>Offer ends <b>${OFFER.endsLong.replace(' 2026', '')}</b></span></div>
      ${foot(2, bfTotal)}
    </div>`,
  }),
  page({
    fg: '#fff', muted: '#a7a59c', accent: '#f3d97a',
    css: BF_CSS + `
      h2{font-size:88px;margin-top:22px}
      .grid{position:absolute;left:60px;right:60px;top:380px;display:grid;grid-template-columns:1fr 1fr;gap:22px}
      .card{position:relative;height:385px;border-radius:22px;overflow:hidden;border:1px solid #262626}
      .card img{position:absolute;left:50%;top:26px;width:440px;margin-left:-220px}
      .card span{position:absolute;left:24px;bottom:22px;font:600 24px/1 'Poppins';color:#fff}
      .card small{display:block;font:500 17px/1 'Poppins';color:#a7a59c;margin-top:8px;letter-spacing:.04em}
      .c1{background:linear-gradient(160deg,#1c3a30,#0d1b16)}.c2{background:linear-gradient(160deg,#1b2540,#0a0f1c)}
      .c3{background:linear-gradient(160deg,#232323,#050505)}.c4{background:linear-gradient(160deg,#f2f2f2,#cfd2d6)}.c4 span{color:#111}.c4 small{color:#555}`,
    body: `<div class="slide">
      <div class="head"><div class="eyebrow">The standard you’ll get</div><h2>Real sites for <em>real businesses.</em></h2></div>
      <div class="grid">
        <div class="card c1"><img src="${RENDER.alAnsaar}"><span>Al Ansaar<small>Charity · Oxford</small></span></div>
        <div class="card c2"><img src="${RENDER.whitebeard}"><span>Whitebeard<small>Accounting · London</small></span></div>
        <div class="card c3"><img src="${RENDER.palestinu}"><span>Palestinu<small>Online shop · Oxford</small></span></div>
        <div class="card c4"><img src="${RENDER.topLooks}"><span>Top Looks Barbers<small>Booking system · Romford</small></span></div>
      </div>
      ${foot(3, bfTotal)}
    </div>`,
  }),
  page({
    fg: '#fff', muted: '#a7a59c', accent: '#f3d97a',
    css: BF_CSS + `
      .center{position:absolute;left:70px;right:70px;top:140px;text-align:center}
      .gift{width:130px;height:130px;margin:0 auto;border-radius:50%;background:#f3d97a;color:#1b1b1b;display:grid;place-items:center}
      h2{font-size:104px;margin-top:50px}
      .lead{margin:30px auto 0;width:820px;font:400 29px/1.5 'Poppins';color:#d6d3c8}
      .cta{margin-top:56px}
      .url{margin-top:34px;font:600 34px/1 'Poppins';color:#fff;letter-spacing:.01em}
      .bio{margin-top:14px;font:500 22px/1 'Poppins';letter-spacing:.16em;text-transform:uppercase;color:#a7a59c}
      .wa{display:inline-flex;align-items:center;gap:14px;margin-top:40px;font:500 26px/1 'Poppins';color:#d6d3c8}
      .fine{position:absolute;left:90px;right:90px;bottom:60px;text-align:center;font:400 20px/1.5 'Poppins';color:#8a887f}`,
    body: `<div class="slide">
      <div class="center">
        <div class="gift">${icon('gift', 64, 1.8)}</div>
        <h2>Claim your <em>free</em> sample site.</h2>
        <p class="lead">For quote requests made before Black Friday. See your new website before you spend a penny.</p>
        <div class="cta"><span class="pill">Get my free sample ${icon('arrow', 32, 2.4)}</span></div>
        <div class="url">${OFFER.url}</div>
        <div class="bio">Link in bio</div>
        <div class="wa">${icon('chat', 34)}Or WhatsApp us on ${WHATSAPP}</div>
      </div>
      <p class="fine">Offer ends ${OFFER.endsLong}. One free sample per business. Full websites from £300.</p>
    </div>`,
  }),
];
// Story version (1080×1920)
const bfStory = page({
  w: 1080, h: 1920, fg: '#fff', muted: '#a7a59c', accent: '#f3d97a',
  css: BF_CSS + `
    .top{position:absolute;left:70px;right:70px;top:250px;display:flex;justify-content:space-between;align-items:center}
    .outline{position:absolute;left:66px;top:350px;font-size:170px}
    h1{position:absolute;left:70px;top:700px;font-size:100px;width:950px}
    .lead{position:absolute;left:72px;top:1040px;width:900px;font:400 32px/1.5 'Poppins';color:#d6d3c8}
    .sticker{right:80px;top:330px;z-index:3}
    .cta{position:absolute;left:0;right:0;bottom:250px;text-align:center;z-index:5}
    .cta .ends{margin-top:26px;font:500 28px/1.4 'Poppins';color:#fff}
    .fade{position:absolute;left:0;right:0;bottom:0;height:720px;background:linear-gradient(180deg,transparent,#0b0b0b 45%);z-index:4}`,
  body: `<div class="slide">
    <div class="top"><span class="tag">${icon('zap', 26, 2.2)} Early Black Friday</span></div>
    <div class="outline">BLACK<br>FRIDAY</div>
    <div class="sticker"><div><b>FREE</b><span>Sample<br>website</span></div></div>
    <h1>A <em>free</em> sample website for your business.</h1>
    <p class="lead">Fill in our quote form and we’ll design a sample site for you. No cost, no commitment.</p>
    ${bfPhones(1220, 300)}
    <div class="fade"></div>
    <div class="cta"><span class="pill">Get my free sample ${icon('arrow', 32, 2.4)}</span><div class="ends">${OFFER.url} · ends ${OFFER.ends}</div></div>
  </div>`,
});

// ---------- render ----------
const POSTS = [
  ['01-apex-studio', apex],
  ['02-al-ansaar', al],
  ['03-whitebeard', wb],
  ['04-palestinu', pa],
  ['05-top-looks', tl],
  ['06-damal-restaurant', dr],
  ['07-damal-banqueting', db],
  ['08-my-thermomix-my-way', tm],
  ['09-black-friday', bf],
  ['10-black-friday-story', [bfStory]],
];

function shoot(html, png, w, h, n) {
  return new Promise((resolve, reject) => {
    const args = [
      '--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
      '--allow-file-access-from-files', '--run-all-compositor-stages-before-draw',
      `--window-size=${w},${h}`, '--virtual-time-budget=15000',
      `--user-data-dir=${path.join(BUILD, `profile-${n}`)}`,
      `--screenshot=${png}`, pathToFileURL(html).href,
    ];
    const p = spawn(CHROME, args, { stdio: 'ignore' });
    p.on('error', reject);
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`chrome exited ${code} for ${png}`))));
  });
}

async function main() {
  if (!CHROME) throw new Error('Chrome or Edge not found');
  const only = process.argv[2];
  await mkdir(BUILD, { recursive: true });

  // The mountain mark: the top 60% of the logo, trimmed.
  const logoFile = fileURLToPath(LOGO);
  const meta = await sharp(logoFile).metadata();
  const top = await sharp(logoFile).extract({ left: 0, top: 0, width: meta.width, height: Math.round(meta.height * 0.6) }).png().toBuffer();
  await sharp(top).trim().png().toFile(MARK_PATH);

  const jobs = [];
  for (const [name, slides] of POSTS) {
    if (only && !name.includes(only)) continue;
    const dir = path.join(OUT, name);
    await rm(dir, { recursive: true, force: true });
    await mkdir(dir, { recursive: true });
    slides.forEach(({ html, w, h }, i) => {
      jobs.push({ file: path.join(BUILD, `${name}-${i + 1}.html`), html, png: path.join(dir, `${String(i + 1).padStart(2, '0')}.png`), w, h });
    });
  }
  let next = 0;
  const worker = async (n) => {
    while (next < jobs.length) {
      const j = jobs[next++];
      await writeFile(j.file, j.html);
      await shoot(j.file, j.png, j.w, j.h, n);
      console.log('wrote', path.relative(ROOT, j.png));
    }
  };
  await Promise.all([0, 1, 2, 3].map(worker));
}

main().catch((e) => { console.error(e); process.exit(1); });
