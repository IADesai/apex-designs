# Apex Designs Site Revamp + Mini-CRM Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the WordPress site with a static Astro + Three.js site on GitHub Pages, with a Supabase-backed mini-CRM (tracked links, consented clickstream, quote leads, private admin dashboard).

**Architecture:** Astro builds every page to static HTML (SEO-first). A procedural low-poly Three.js mountain hero is lazy-loaded on the home page only. A small consent-aware tracker writes events straight to Supabase via REST (anon insert-only RLS); quote leads go through one Supabase Edge Function that validates, stores, and emails via Hostinger SMTP. `/admin/` is a client-side page using supabase-js with magic-link auth gated by an `admins` table.

**Tech Stack:** Node 24, Astro 7.4.2, TypeScript 6.0.3, three 0.186.1, gsap 3.15.0, lenis 1.3.27, @supabase/supabase-js 2.118.0, @astrojs/sitemap 3.7.4, @fontsource (Inter variable, Playfair Display), Vitest 5.0.5 + jsdom 30.1.3, Supabase (Postgres 15+, Auth, Edge Functions/Deno), GitHub Actions + Pages.

**Spec:** `docs/superpowers/specs/2026-10-27-apex-site-revamp-design.md`

## Global Constraints

- Static output only; `site: 'https://apexdesigns.org.uk'`; `trailingSlash: 'always'`; canonical URLs always end in `/`.
- Node `>=22.23.4` (Astro 7 requirement); CI uses Node 24.
- TypeScript must stay on `6.x` (`@astrojs/check@0.9.12` peer: `^5 || ^6`).
- Zod comes from `astro/zod` (not `astro:content`, deprecated). Content config lives at `src/content.config.ts` using `glob` from `astro/loaders`.
- Brand tokens: `--teal: #3E7D6E`, `--teal-glow: #5FD3B5`, `--charcoal: #2B3030`, `--ink: #0B0F0E`, `--mist: #E8EFEC`. Display font Playfair Display, body Inter.
- Tagline "Websites that click!" Founder "Ibrahim". Base "Romford". Areas: Romford, Havering, East London, Essex, London, United Kingdom.
- Prices: Standard £300; Premium £500 + £15/month; Custom price on quote. All prices only in `src/data/packages.ts`.
- Exactly one `<h1>` per page; every page has unique `<title>`, meta description (≤170 chars), canonical. `/admin/` and `/404` are `noindex`; `/admin/` never in sitemap.
- Tracking without consent: only an anonymous `ref_landing` event when `?ref=` is present; **nothing written to localStorage/sessionStorage except the consent choice itself**.
- Event types (identical in TS and SQL): `page_view`, `ref_landing`, `cta_click`, `whatsapp_click`, `scroll_depth`, `form_start`, `form_submit`.
- Ref slug format (identical in TS and SQL): `^[a-z0-9][a-z0-9_-]{0,63}$`.
- Lead notifications: Hostinger SMTP `smtp.hostinger.com:465` (SSL); secrets `SMTP_USER`, `SMTP_PASS`, `NOTIFY_TO`, `ALLOWED_ORIGINS`.
- Public env vars only: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`. Lead endpoint = `${PUBLIC_SUPABASE_URL}/functions/v1/submit-lead`. Missing env ⇒ tracker no-ops, quote form falls back to `mailto:`.
- Never render CRM data with `innerHTML`; admin DOM is built with `textContent` only.
- `public_html.zip` is never committed.

## Spec deltas (decided while planning)

1. **Ref persistence needs consent.** Spec §7 said `ref` goes to sessionStorage unconditionally; under PECR that's non-essential storage. Ref is held in memory for the current page, and written to sessionStorage only after consent.
2. **Spam timing uses client-measured elapsed time** (`elapsed` ms since form render), not a client timestamp compared to the server clock, so skewed client clocks can't silently drop real leads.
3. **Validation is not copied.** It lives in `supabase/functions/_shared/` (dependency-free TS) and is imported by both the site (Vite) and the Edge Function (Deno), so there is one source of truth.

## Review Focus

1. **Storage blocked or throwing** (Safari private mode, WhatsApp/Instagram in-app browsers, cookies disabled) → page, consent banner and tracker must work without exceptions. Pinned in Task 14 (throwing-storage test).
2. **Client clock skew on the quote form** → a real lead must never be classified as spam because the visitor's clock is wrong. Pinned in Task 15 (`validateLead` has no clock input; elapsed-based test).
3. **Garbage or hostile `?ref=` values** (HTML, emoji, 500 chars) → sanitised to a safe slug or dropped, and anything shown in `/admin/` is rendered as text. Pinned in Task 14 (`sanitizeRef` tests) and Task 17 (`h()` escaping test).
4. **WebGL unavailable / context lost / reduced motion** → hero shows the styled fallback with readable text, never a blank box. Pinned in Task 6 (`shouldRender3D` tests + audit rule that home HTML defaults to `data-hero="fallback"`).
5. **Double-clicked submit or slow network** → exactly one request and a clear UI state; failures show WhatsApp/email fallback. Pinned in Task 15 (`busy` test, network-error test) and quote-page audit rule requiring `mailto:` and `wa.me` links in the static HTML.

---

## File Structure

```
.github/workflows/deploy.yml          CI: test, build, deploy to Pages
astro.config.mjs                      Astro config (site, sitemap, trailing slash)
vitest.config.ts                      Unit test config
tsconfig.json                         Strict TS, allows .ts import extensions
package.json
.env.example
public/
  CNAME                               apexdesigns.org.uk
  robots.txt
  favicon.svg                         Peak mark
  logo.png                            Logo for JSON-LD
  og-default.png                      1200x630 share image (generated)
scripts/
  make-og.mjs                         One-off: builds og-default.png with sharp
  seo-audit.mjs                       Pure audit functions (tested)
  check-seo.mjs                       Runs audit over dist/ after build
src/
  env.d.ts                            import.meta.env typing
  config/site.ts                      Contact/brand/areas config (placeholders here)
  data/packages.ts                    Packages + prices
  data/reviews.ts                     Google reviews
  data/faqs.ts                        Services FAQ
  data/locations.ts                   Location page content
  content.config.ts                   work + learn collections
  content/work/*.md                   4 case studies
  content/learn/*.md                  3 articles
  assets/logo/apex-logo.png
  assets/work/*.png                   4 mockups
  styles/global.css                   Tokens + base styles
  lib/seo.ts                          Title/canonical/JSON-LD builders
  lib/storage.ts                      SafeStorage wrapper
  lib/consent.ts                      Consent read/write
  lib/tracker.ts                      Tracker core (pure, injected deps)
  lib/whatsapp.ts                     wa.me URL builder
  lib/lead-submit.ts                  Submitter with in-flight guard + mailto builder
  lib/admin-helpers.ts                Tracked URL, share text, journey labels
  scripts/analytics.ts                Browser wiring: tracker, banner, click/scroll listeners
  scripts/motion.ts                   Lenis + GSAP reveals, magnetic, spotlight
  scripts/quote-form.ts               Quote form behaviour
  scripts/hero/terrain.ts             Pure height/colour functions (tested)
  scripts/hero/capability.ts          WebGL/reduced-motion gate (tested)
  scripts/hero/scene.ts               Three.js scene
  scripts/admin/dom.ts                Safe element builder (tested)
  scripts/admin/api.ts                Supabase queries
  scripts/admin/main.ts               Dashboard UI
  layouts/BaseLayout.astro
  layouts/AdminLayout.astro
  layouts/ProseLayout.astro           Legal pages + articles
  components/Seo.astro, Header.astro, Footer.astro, WhatsAppButton.astro,
             ConsentBanner.astro, PageHero.astro, CtaBand.astro, Hero.astro,
             PackageCard.astro, ReviewCard.astro, WorkCard.astro, Faq.astro
  pages/index.astro, services.astro, about.astro, quote.astro, 404.astro,
        privacy.astro, cookies.astro, terms.astro, [location].astro,
        work/index.astro, work/[slug].astro, learn/index.astro, learn/[slug].astro,
        admin/index.astro
supabase/
  migrations/20261027000000_crm.sql
  migrations/20261027000100_retention.sql
  tests/rls_test.sql
  functions/_shared/ref.ts            sanitizeRef (shared)
  functions/_shared/lead.ts           validateLead, formatLeadEmail (shared)
  functions/submit-lead/index.ts      Edge Function
tests/*.test.ts                       Vitest unit tests
docs/SETUP.md, README.md
```

---

### Task 1: Project scaffold, config and CI deploy

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `vitest.config.ts`, `.env.example`, `src/env.d.ts`, `public/CNAME`, `public/robots.txt`, `src/pages/index.astro` (temporary), `.github/workflows/deploy.yml`, `tests/smoke.test.ts`

**Interfaces:**
- Produces: `npm run dev|build|test|preview`; `import.meta.env.PUBLIC_SUPABASE_URL` / `PUBLIC_SUPABASE_ANON_KEY` typed as `string | undefined`.

- [ ] **Step 1: Create package.json**

```json
{
  "name": "apex-designs",
  "type": "module",
  "version": "1.0.0",
  "private": true,
  "engines": { "node": ">=22.23.4" },
  "scripts": {
    "dev": "astro dev",
    "build": "astro check && astro build",
    "preview": "astro preview",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

- [ ] **Step 2: Install dependencies (exact versions)**

```bash
npm i astro@7.4.2 @astrojs/sitemap@3.7.4 three@0.186.1 gsap@3.15.0 lenis@1.3.27 @supabase/supabase-js@2.118.0 @fontsource-variable/inter@5.3.0 @fontsource/playfair-display@5.3.0 sharp@0.35.5
npm i -D @astrojs/check@0.9.12 typescript@6.0.3 vitest@5.0.5 jsdom@30.1.3 @types/three@0.186.0
```

Expected: installs without peer-dependency errors.

- [ ] **Step 3: Create astro.config.mjs**

```js
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://apexdesigns.org.uk',
  trailingSlash: 'always',
  build: { format: 'directory' },
  integrations: [sitemap({ filter: (page) => !page.includes('/admin/') })],
});
```

- [ ] **Step 4: Create tsconfig.json, vitest.config.ts, src/env.d.ts, .env.example**

`tsconfig.json`:
```json
{
  "extends": "astro/tsconfigs/strict",
  "include": [".astro/types.d.ts", "**/*"],
  "exclude": ["dist", "node_modules", "supabase/functions/submit-lead"],
  "compilerOptions": { "allowImportingTsExtensions": true }
}
```
(`allowImportingTsExtensions` needs `noEmit`, which Astro's base config sets. If `astro check` reports otherwise, add `"noEmit": true` here.)

`vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], environment: 'node' },
});
```

`src/env.d.ts`:
```ts
interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL?: string;
  readonly PUBLIC_SUPABASE_ANON_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
```

`.env.example`:
```
# Supabase → Project Settings → API. Both are safe to expose publicly (RLS protects data).
PUBLIC_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

- [ ] **Step 5: Create public/CNAME and public/robots.txt**

`public/CNAME`:
```
apexdesigns.org.uk
```

`public/robots.txt`:
```
User-agent: *
Disallow: /admin/

Sitemap: https://apexdesigns.org.uk/sitemap-index.xml
```

- [ ] **Step 6: Temporary home page**

`src/pages/index.astro`:
```astro
---
---
<html lang="en-GB"><head><meta charset="utf-8" /><title>Apex Designs</title></head><body><h1>Apex Designs</h1></body></html>
```

- [ ] **Step 7: Smoke test**

`tests/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest';

describe('toolchain', () => {
  it('runs vitest', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test` → Expected: 1 passed.
Run: `npm run build` → Expected: `dist/index.html` and `dist/sitemap-index.xml` exist, `dist/CNAME` exists.

- [ ] **Step 8: CI workflow**

`.github/workflows/deploy.yml`:
```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
      - uses: actions/setup-node@v5
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm test
      - run: npm run build
        env:
          PUBLIC_SUPABASE_URL: ${{ vars.PUBLIC_SUPABASE_URL }}
          PUBLIC_SUPABASE_ANON_KEY: ${{ vars.PUBLIC_SUPABASE_ANON_KEY }}
      - uses: actions/upload-pages-artifact@v4
        with:
          path: dist
  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json vitest.config.ts .env.example src public tests .github
git commit -m "chore: scaffold Astro site with CI deploy to GitHub Pages"
```

---

### Task 2: Brand assets and design tokens

**Files:**
- Create: `src/assets/logo/apex-logo.png`, `src/assets/work/{damal-restaurant,damal-banqueting,my-thermomix-my-way,whitebeard}.png`, `public/logo.png`, `public/favicon.svg`, `scripts/make-og.mjs`, `public/og-default.png`, `src/styles/global.css`

**Interfaces:**
- Produces: CSS custom properties listed in Global Constraints plus utility classes `.container .section .eyebrow .lead .accent .muted .btn .btn-primary .btn-ghost .card .grid-2 .grid-3 .visually-hidden .skip-link .grain .prose`; attribute hook `[data-spotlight]` (uses `--mx`/`--my`).

- [ ] **Step 1: Extract assets from the WordPress zip**

```bash
T="$(mktemp -d)"
unzip -oqj public_html.zip \
  "wp-content/uploads/2024/11/Logo-1-Green.png" \
  "wp-content/uploads/2025/03/Damal-Restaurant-Mockup.png" \
  "wp-content/uploads/2025/03/Damal-Banqueting-Mockup.png" \
  "wp-content/uploads/2025/03/MTMW-Mockup-R.png" \
  "wp-content/uploads/2025/03/Whitebeard-Mockup-R.png" -d "$T"
mkdir -p src/assets/logo src/assets/work
cp "$T/Logo-1-Green.png" src/assets/logo/apex-logo.png
cp "$T/Logo-1-Green.png" public/logo.png
cp "$T/Damal-Restaurant-Mockup.png" src/assets/work/damal-restaurant.png
cp "$T/Damal-Banqueting-Mockup.png" src/assets/work/damal-banqueting.png
cp "$T/MTMW-Mockup-R.png" src/assets/work/my-thermomix-my-way.png
cp "$T/Whitebeard-Mockup-R.png" src/assets/work/whitebeard.png
ls -la src/assets/work
```

Expected: four PNGs listed. Open one with the image viewer to confirm it is the mockup.

- [ ] **Step 2: Favicon peak mark**

`public/favicon.svg`:
```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <polygon points="32,4 54,42 10,42" fill="#4A5050"/>
  <polygon points="32,4 37,13 34,11.5 31,16 28.5,11" fill="#F4FAF7"/>
  <polygon points="15,28 31,58 0,58" fill="#3E7D6E"/>
  <polygon points="46,22 64,58 27,58" fill="#3E7D6E"/>
  <polygon points="31,36 47,58 15,58" fill="#4F9A87"/>
</svg>
```

- [ ] **Step 3: Generate the share image**

`scripts/make-og.mjs`:
```js
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
```

Run: `node scripts/make-og.mjs` → Expected: `wrote …/public/og-default.png`. View it: peak mark left, text right, dark background.

- [ ] **Step 4: Global styles**

`src/styles/global.css`:
```css
:root {
  --ink: #0b0f0e;
  --ink-2: #111816;
  --charcoal: #2b3030;
  --line: rgb(232 239 236 / 0.1);
  --mist: #e8efec;
  --mist-dim: #a9b8b2;
  --teal: #3e7d6e;
  --teal-glow: #5fd3b5;
  --snow: #f4faf7;
  --radius: 20px;
  --radius-sm: 12px;
  --max: 1200px;
  --gutter: clamp(16px, 4vw, 40px);
  --font-display: 'Playfair Display', Georgia, serif;
  --font-body: 'Inter Variable', system-ui, -apple-system, 'Segoe UI', sans-serif;
  --ease: cubic-bezier(0.2, 0.7, 0.2, 1);
  color-scheme: dark;
}

*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; }
body {
  margin: 0;
  background: var(--ink);
  color: var(--mist);
  font: 400 1.0625rem/1.65 var(--font-body);
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}
img, svg, canvas, picture { display: block; max-width: 100%; height: auto; }
a { color: inherit; }
h1, h2, h3 { font-family: var(--font-display); font-weight: 600; line-height: 1.08; letter-spacing: -0.01em; margin: 0 0 0.5em; text-wrap: balance; }
h1 { font-size: clamp(2.6rem, 7vw, 5.6rem); }
h2 { font-size: clamp(2rem, 4.5vw, 3.4rem); }
h3 { font-size: clamp(1.25rem, 2vw, 1.6rem); }
p { margin: 0 0 1em; text-wrap: pretty; }

.container { width: min(100% - 2 * var(--gutter), var(--max)); margin-inline: auto; }
.section { padding-block: clamp(72px, 12vw, 160px); }
.eyebrow { display: inline-block; font: 600 0.78rem/1 var(--font-body); letter-spacing: 0.18em; text-transform: uppercase; color: var(--teal-glow); margin-bottom: 1.2rem; }
.lead { font-size: clamp(1.1rem, 1.6vw, 1.3rem); color: var(--mist-dim); max-width: 60ch; }
.accent { font-style: italic; color: var(--teal-glow); }
.muted { color: var(--mist-dim); }

.btn {
  display: inline-flex; align-items: center; justify-content: center; gap: 0.6em;
  padding: 0.95em 1.5em; border-radius: 999px; border: 1px solid transparent;
  font: 600 1rem/1 var(--font-body); text-decoration: none; cursor: pointer;
  transition: transform 0.3s var(--ease), background 0.3s, box-shadow 0.3s, border-color 0.3s;
}
.btn-primary { background: var(--teal-glow); color: var(--ink); }
.btn-primary:hover { box-shadow: 0 0 40px -6px rgb(95 211 181 / 0.75); }
.btn-ghost { border-color: var(--line); background: rgb(255 255 255 / 0.03); backdrop-filter: blur(10px); color: var(--mist); }
.btn-ghost:hover { border-color: rgb(95 211 181 / 0.5); }
.btn[disabled] { opacity: 0.6; cursor: progress; }

.card {
  position: relative; overflow: hidden;
  border: 1px solid var(--line); border-radius: var(--radius);
  background: linear-gradient(180deg, rgb(255 255 255 / 0.045), rgb(255 255 255 / 0.015));
  backdrop-filter: blur(14px);
  padding: clamp(20px, 3vw, 32px);
}
[data-spotlight]::before {
  content: ''; position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity 0.3s;
  background: radial-gradient(420px circle at var(--mx, 50%) var(--my, 50%), rgb(95 211 181 / 0.13), transparent 60%);
}
[data-spotlight]:hover::before { opacity: 1; }

.grid-3 { display: grid; gap: clamp(16px, 2vw, 24px); grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr)); }
.grid-2 { display: grid; gap: clamp(16px, 2vw, 24px); grid-template-columns: repeat(auto-fit, minmax(min(100%, 420px), 1fr)); }

.grain {
  position: fixed; inset: -50%; z-index: 90; pointer-events: none; opacity: 0.05;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
  animation: grain 8s steps(10) infinite;
}
@keyframes grain {
  0%, 100% { transform: translate(0, 0); }
  20% { transform: translate(-5%, 3%); }
  40% { transform: translate(3%, -6%); }
  60% { transform: translate(-7%, 2%); }
  80% { transform: translate(4%, 5%); }
}

.prose { max-width: 70ch; }
.prose h2 { font-size: clamp(1.6rem, 3vw, 2.2rem); margin-top: 2em; }
.prose h3 { margin-top: 1.6em; }
.prose a { color: var(--teal-glow); }
.prose ul, .prose ol { padding-left: 1.2em; }
.prose li { margin-bottom: 0.4em; }
.prose table { width: 100%; border-collapse: collapse; margin: 1.5em 0; font-size: 0.95rem; display: block; overflow-x: auto; }
.prose th, .prose td { border-bottom: 1px solid var(--line); padding: 0.6em 0.8em; text-align: left; }

:focus-visible { outline: 2px solid var(--teal-glow); outline-offset: 3px; }
.skip-link { position: absolute; left: 1rem; top: -100px; z-index: 200; background: var(--teal-glow); color: var(--ink); padding: 0.6em 1em; border-radius: 8px; }
.skip-link:focus { top: 1rem; }
.visually-hidden { position: absolute !important; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

html.lenis, html.lenis body { height: auto; }
.lenis.lenis-smooth { scroll-behavior: auto !important; }
.lenis.lenis-stopped { overflow: hidden; }

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; scroll-behavior: auto !important; }
  .grain { display: none; }
}
```

- [ ] **Step 5: Commit**

```bash
git add src/assets public/logo.png public/favicon.svg public/og-default.png scripts/make-og.mjs src/styles/global.css
git commit -m "feat: add brand assets, share image and design tokens"
```

---

### Task 3: Site config, SEO helpers and Seo component

**Files:**
- Create: `src/config/site.ts`, `src/data/reviews.ts`, `src/lib/seo.ts`, `src/components/Seo.astro`
- Test: `tests/seo.test.ts`

**Interfaces:**
- Produces:
  - `site` object: `{ name, url, tagline, founder, email, whatsapp, base: { locality, borough, region, country }, areasServed: readonly string[], social: { instagram: string; linkedin: string } }`; `PLACEHOLDER_WHATSAPP: string`; `hasRealWhatsApp(): boolean`.
  - `Review { author: string; text: string; rating: 1|2|3|4|5; source: 'Google'; context?: string }`, `reviews: Review[]`.
  - `pageTitle(title?: string): string`, `canonicalUrl(pathname: string, base?: string): string`, `businessJsonLd(revs?: Review[]): Record<string, unknown>`, `breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown>`, `faqJsonLd(faqs: { q: string; a: string }[]): Record<string, unknown>`, `articleJsonLd(a: { title: string; description: string; path: string; published: Date; updated?: Date }): Record<string, unknown>`.
  - `<Seo title? description image? noindex? jsonLd? type? />`.

- [ ] **Step 1: Site config**

`src/config/site.ts`:
```ts
// The ONLY place for contact details. Replace the two values marked SET ME before launch.
export const PLACEHOLDER_WHATSAPP = '447000000000';

export const site = {
  name: 'Apex Designs',
  url: 'https://apexdesigns.org.uk',
  tagline: 'Websites that click!',
  founder: 'Ibrahim',
  email: 'hello@apexdesigns.org.uk', // SET ME: your Hostinger mailbox
  whatsapp: PLACEHOLDER_WHATSAPP as string, // SET ME: international format, digits only, e.g. 447912345678
  base: { locality: 'Romford', borough: 'Havering', region: 'Greater London', country: 'GB' },
  areasServed: ['Romford', 'Havering', 'East London', 'Essex', 'London', 'United Kingdom'],
  social: { instagram: '', linkedin: '' },
} as const;

export function hasRealWhatsApp(): boolean {
  return site.whatsapp !== PLACEHOLDER_WHATSAPP;
}
```

- [ ] **Step 2: Reviews data**

`src/data/reviews.ts`:
```ts
export interface Review {
  author: string;
  text: string;
  rating: 1 | 2 | 3 | 4 | 5;
  source: 'Google';
  context?: string;
}

// Verbatim from the Google profile shown on the old site. Ratings: confirm each is 5★ on Google.
export const reviews: Review[] = [
  { author: 'Ayub Desai', rating: 5, source: 'Google', text: 'Outstanding service from Ibrahim while building my website.' },
  { author: 'Imran A', rating: 5, source: 'Google', text: 'We worked with Apex to get our website revamped - excellent choice!! We are really happy with the end product.' },
  { author: 'Mohamoud Abdi', rating: 5, source: 'Google', context: 'Damal', text: 'On behalf of Damal, great work, great service would recommend good brother 24/7 service.' },
  { author: 'Talhah Chowdhury', rating: 5, source: 'Google', text: 'Very good service, tasks are completed quickly while maintaining a high standard' },
  { author: 'Aftab Hafiz', rating: 5, source: 'Google', text: 'Excellent knowledge and very quick' },
];
```

- [ ] **Step 3: Write the failing tests**

`tests/seo.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { pageTitle, canonicalUrl, businessJsonLd, faqJsonLd, breadcrumbJsonLd, articleJsonLd } from '../src/lib/seo';
import type { Review } from '../src/data/reviews';

describe('pageTitle', () => {
  it('appends the brand', () => {
    expect(pageTitle('Website Packages & Prices')).toBe('Website Packages & Prices | Apex Designs');
  });
  it('does not double the brand', () => {
    expect(pageTitle('About Apex Designs')).toBe('About Apex Designs');
  });
  it('has a default', () => {
    expect(pageTitle()).toBe('Apex Designs | Web Design Romford & East London');
  });
});

describe('canonicalUrl', () => {
  it('adds a trailing slash', () => {
    expect(canonicalUrl('/services')).toBe('https://apexdesigns.org.uk/services/');
  });
  it('keeps the root', () => {
    expect(canonicalUrl('/')).toBe('https://apexdesigns.org.uk/');
  });
  it('strips query and hash', () => {
    expect(canonicalUrl('/quote/?ref=abc#x')).toBe('https://apexdesigns.org.uk/quote/');
  });
  it('leaves file paths alone', () => {
    expect(canonicalUrl('/rss.xml')).toBe('https://apexdesigns.org.uk/rss.xml');
  });
  it('handles a missing leading slash', () => {
    expect(canonicalUrl('about')).toBe('https://apexdesigns.org.uk/about/');
  });
});

describe('businessJsonLd', () => {
  const revs: Review[] = [
    { author: 'A', text: 'Great', rating: 5, source: 'Google' },
    { author: 'B', text: 'Good', rating: 4, source: 'Google' },
  ];
  it('computes aggregate rating', () => {
    const ld = businessJsonLd(revs) as any;
    expect(ld['@type']).toBe('ProfessionalService');
    expect(ld.aggregateRating).toEqual({ '@type': 'AggregateRating', ratingValue: '4.5', reviewCount: 2, bestRating: 5 });
    expect(ld.review).toHaveLength(2);
    expect(ld.address.addressLocality).toBe('Romford');
  });
  it('omits rating with no reviews', () => {
    const ld = businessJsonLd([]) as any;
    expect(ld.aggregateRating).toBeUndefined();
    expect(ld.review).toBeUndefined();
  });
  it('omits telephone while the WhatsApp number is a placeholder', () => {
    const ld = businessJsonLd([]) as any;
    expect(ld.telephone).toBeUndefined();
  });
});

describe('other JSON-LD', () => {
  it('builds FAQPage', () => {
    const ld = faqJsonLd([{ q: 'How long?', a: 'Two weeks.' }]) as any;
    expect(ld['@type']).toBe('FAQPage');
    expect(ld.mainEntity[0]).toEqual({ '@type': 'Question', name: 'How long?', acceptedAnswer: { '@type': 'Answer', text: 'Two weeks.' } });
  });
  it('builds breadcrumbs with absolute URLs', () => {
    const ld = breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Work', path: '/work/' }]) as any;
    expect(ld.itemListElement[1]).toEqual({ '@type': 'ListItem', position: 2, name: 'Work', item: 'https://apexdesigns.org.uk/work/' });
  });
  it('builds Article with ISO dates', () => {
    const ld = articleJsonLd({ title: 'T', description: 'D', path: '/learn/t/', published: new Date('2026-10-27T00:00:00Z') }) as any;
    expect(ld.datePublished).toBe('2026-10-27T00:00:00.000Z');
    expect(ld.dateModified).toBe('2026-10-27T00:00:00.000Z');
    expect(ld.mainEntityOfPage).toBe('https://apexdesigns.org.uk/learn/t/');
  });
});
```

- [ ] **Step 4: Run to verify failure**

Run: `npx vitest run tests/seo.test.ts` → Expected: FAIL, cannot resolve `../src/lib/seo`.

- [ ] **Step 5: Implement src/lib/seo.ts**

```ts
import { site, hasRealWhatsApp } from '../config/site';
import { reviews as allReviews, type Review } from '../data/reviews';

export function pageTitle(title?: string): string {
  if (!title) return `${site.name} | Web Design Romford & East London`;
  return title.includes(site.name) ? title : `${title} | ${site.name}`;
}

export function canonicalUrl(pathname: string, base: string = site.url): string {
  let p = pathname.split(/[?#]/)[0] || '/';
  if (!p.startsWith('/')) p = `/${p}`;
  if (!p.endsWith('/') && !/\.[a-z0-9]+$/i.test(p)) p += '/';
  return new URL(p, base).toString();
}

export function businessJsonLd(revs: Review[] = allReviews): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': `${site.url}/#business`,
    name: site.name,
    url: `${site.url}/`,
    logo: `${site.url}/logo.png`,
    image: `${site.url}/og-default.png`,
    email: site.email,
    slogan: site.tagline,
    priceRange: '££',
    founder: { '@type': 'Person', name: site.founder },
    address: {
      '@type': 'PostalAddress',
      addressLocality: site.base.locality,
      addressRegion: site.base.region,
      addressCountry: site.base.country,
    },
    areaServed: site.areasServed.map((name) => ({ '@type': 'Place', name })),
  };
  if (hasRealWhatsApp()) ld.telephone = `+${site.whatsapp}`;
  const sameAs = [site.social.instagram, site.social.linkedin].filter(Boolean);
  if (sameAs.length) ld.sameAs = sameAs;
  if (revs.length) {
    const avg = revs.reduce((sum, r) => sum + r.rating, 0) / revs.length;
    ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: avg.toFixed(1), reviewCount: revs.length, bestRating: 5 };
    ld.review = revs.map((r) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.author },
      reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
      reviewBody: r.text,
    }));
  }
  return ld;
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: canonicalUrl(it.path) })),
  };
}

export function faqJsonLd(faqs: { q: string; a: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}

export function articleJsonLd(a: { title: string; description: string; path: string; published: Date; updated?: Date }): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.description,
    datePublished: a.published.toISOString(),
    dateModified: (a.updated ?? a.published).toISOString(),
    author: { '@type': 'Person', name: site.founder, url: `${site.url}/about/` },
    publisher: { '@id': `${site.url}/#business` },
    mainEntityOfPage: canonicalUrl(a.path),
  };
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/seo.test.ts` → Expected: all pass.

- [ ] **Step 7: Seo component**

`src/components/Seo.astro`:
```astro
---
import { pageTitle, canonicalUrl } from '../lib/seo';
import { site } from '../config/site';

interface Props {
  title?: string;
  description: string;
  image?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown>[];
  type?: 'website' | 'article';
}
const { title, description, image = '/og-default.png', noindex = false, jsonLd = [], type = 'website' } = Astro.props;
const fullTitle = pageTitle(title);
const canonical = canonicalUrl(Astro.url.pathname);
const ogImage = new URL(image, site.url).toString();
---
<title>{fullTitle}</title>
<meta name="description" content={description} />
<link rel="canonical" href={canonical} />
{noindex && <meta name="robots" content="noindex, nofollow" />}
<meta property="og:type" content={type} />
<meta property="og:site_name" content={site.name} />
<meta property="og:locale" content="en_GB" />
<meta property="og:title" content={fullTitle} />
<meta property="og:description" content={description} />
<meta property="og:url" content={canonical} />
<meta property="og:image" content={ogImage} />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
{jsonLd.map((d) => <script type="application/ld+json" set:html={JSON.stringify(d).replace(/</g, '\\u003c')} />)}
```

- [ ] **Step 8: Commit**

```bash
git add src/config src/data/reviews.ts src/lib/seo.ts src/components/Seo.astro tests/seo.test.ts
git commit -m "feat: add site config, reviews data and SEO helpers"
```

---

### Task 4: Layout shell

**Files:**
- Create: `src/layouts/BaseLayout.astro`, `src/layouts/ProseLayout.astro`, `src/components/Header.astro`, `src/components/Footer.astro`, `src/components/WhatsAppButton.astro`, `src/components/ConsentBanner.astro`, `src/components/PageHero.astro`, `src/components/CtaBand.astro`, `src/lib/whatsapp.ts`
- Test: `tests/whatsapp.test.ts`
- Modify: `src/pages/index.astro` (use layout)

**Interfaces:**
- Consumes: `site`, `businessJsonLd`, `<Seo>`.
- Produces:
  - `BaseLayout` props `{ title?: string; description: string; image?: string; noindex?: boolean; jsonLd?: Record<string, unknown>[]; type?: 'website'|'article' }`; always prepends `businessJsonLd()`.
  - `ProseLayout` props = BaseLayout props + `{ eyebrow?: string; heading: string; lead?: string }`.
  - `PageHero` props `{ eyebrow?: string; lead?: string }`; default slot = H1 content; named slot `after`.
  - `CtaBand` props `{ heading?: string; text?: string }`.
  - DOM hooks used by Task 14: `#consent-banner[hidden]`, `[data-consent="granted"|"denied"]`, `[data-consent-open]`, `a[data-wa]` (WhatsApp links), `[data-track="<id>"]` on CTAs.
  - `whatsappUrl(number: string, text?: string): string`, `DEFAULT_WA_TEXT: string`.

- [ ] **Step 1: Failing test for whatsappUrl**

`tests/whatsapp.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { whatsappUrl } from '../src/lib/whatsapp';

describe('whatsappUrl', () => {
  it('builds a wa.me link with encoded text', () => {
    expect(whatsappUrl('447912345678', 'Hi Ibrahim & team')).toBe('https://wa.me/447912345678?text=Hi%20Ibrahim%20%26%20team');
  });
  it('strips non-digits from the number', () => {
    expect(whatsappUrl('+44 7912 345678')).toBe('https://wa.me/447912345678');
  });
});
```

Run: `npx vitest run tests/whatsapp.test.ts` → Expected: FAIL (module missing).

- [ ] **Step 2: Implement src/lib/whatsapp.ts**

```ts
export function whatsappUrl(number: string, text?: string): string {
  const digits = number.replace(/\D/g, '');
  const base = `https://wa.me/${digits}`;
  return text ? `${base}?text=${encodeURIComponent(text)}` : base;
}

export const DEFAULT_WA_TEXT = "Hi Ibrahim, I'd like to chat about a website.";
```

Run: `npx vitest run tests/whatsapp.test.ts` → Expected: PASS.

- [ ] **Step 3: Header**

`src/components/Header.astro`:
```astro
---
const links = [
  { href: '/services/', label: 'Services' },
  { href: '/work/', label: 'Work' },
  { href: '/learn/', label: 'Learn' },
  { href: '/about/', label: 'About' },
];
const path = Astro.url.pathname;
---
<header class="site-header" data-header>
  <div class="container bar">
    <a class="brand" href="/" aria-label="Apex Designs home">
      <img src="/favicon.svg" width="34" height="34" alt="" />
      <span>Apex <em>Designs</em></span>
    </a>
    <button class="menu-toggle" aria-expanded="false" aria-controls="site-nav" data-menu-toggle>
      <span class="visually-hidden">Menu</span><span class="bars" aria-hidden="true"></span>
    </button>
    <nav id="site-nav" class="nav" aria-label="Main">
      {links.map((l) => (
        <a href={l.href} aria-current={path.startsWith(l.href) ? 'page' : undefined}>{l.label}</a>
      ))}
      <a class="btn btn-primary btn-sm" href="/quote/" data-track="nav-quote" data-magnetic>Get a quote</a>
    </nav>
  </div>
</header>

<style>
  .site-header { position: fixed; inset: 0 0 auto; z-index: 50; transition: background 0.4s, border-color 0.4s, backdrop-filter 0.4s; border-bottom: 1px solid transparent; }
  .site-header.is-scrolled { background: rgb(11 15 14 / 0.72); backdrop-filter: blur(16px); border-color: var(--line); }
  .bar { display: flex; align-items: center; justify-content: space-between; height: 76px; }
  .brand { display: flex; align-items: center; gap: 0.6rem; text-decoration: none; font: 600 1.15rem/1 var(--font-display); }
  .brand em { color: var(--teal-glow); }
  .nav { display: flex; align-items: center; gap: clamp(16px, 2.5vw, 32px); }
  .nav a:not(.btn) { text-decoration: none; color: var(--mist-dim); font-weight: 500; transition: color 0.2s; }
  .nav a:not(.btn):hover, .nav a[aria-current='page'] { color: var(--mist); }
  .btn-sm { padding: 0.7em 1.15em; font-size: 0.92rem; }
  .menu-toggle { display: none; background: none; border: 0; width: 44px; height: 44px; cursor: pointer; }
  .bars, .bars::before, .bars::after { display: block; width: 22px; height: 2px; background: var(--mist); position: relative; transition: transform 0.3s; }
  .bars::before, .bars::after { content: ''; position: absolute; left: 0; }
  .bars::before { top: -7px; }
  .bars::after { top: 7px; }
  .menu-toggle[aria-expanded='true'] .bars { background: transparent; }
  .menu-toggle[aria-expanded='true'] .bars::before { transform: translateY(7px) rotate(45deg); }
  .menu-toggle[aria-expanded='true'] .bars::after { transform: translateY(-7px) rotate(-45deg); }
  @media (max-width: 820px) {
    .menu-toggle { display: block; }
    .nav { position: fixed; inset: 76px 0 auto; flex-direction: column; align-items: stretch; gap: 0; padding: 12px var(--gutter) 24px; background: rgb(11 15 14 / 0.96); backdrop-filter: blur(16px); border-bottom: 1px solid var(--line); transform: translateY(-120%); visibility: hidden; transition: transform 0.4s var(--ease), visibility 0.4s; }
    .nav.is-open { transform: none; visibility: visible; }
    .nav a:not(.btn) { padding: 14px 0; border-bottom: 1px solid var(--line); font-size: 1.1rem; }
    .nav .btn { margin-top: 16px; }
  }
</style>

<script>
  const header = document.querySelector<HTMLElement>('[data-header]');
  const toggle = document.querySelector<HTMLButtonElement>('[data-menu-toggle]');
  const nav = document.getElementById('site-nav');
  const onScroll = () => header?.classList.toggle('is-scrolled', window.scrollY > 24);
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  toggle?.addEventListener('click', () => {
    const open = toggle.getAttribute('aria-expanded') !== 'true';
    toggle.setAttribute('aria-expanded', String(open));
    nav?.classList.toggle('is-open', open);
  });
</script>
```

- [ ] **Step 4: Footer**

`src/components/Footer.astro`:
```astro
---
import { site } from '../config/site';
import { whatsappUrl, DEFAULT_WA_TEXT } from '../lib/whatsapp';
const year = new Date().getFullYear();
const areas = [
  { href: '/web-design-romford/', label: 'Web design Romford' },
  { href: '/web-design-east-london/', label: 'Web design East London' },
  { href: '/web-design-essex/', label: 'Web design Essex' },
  { href: '/remote-web-design-uk/', label: 'Remote web design UK' },
];
---
<footer class="site-footer">
  <div class="container cols">
    <div>
      <a class="brand" href="/"><img src="/favicon.svg" width="40" height="40" alt="" /><span>Apex Designs</span></a>
      <p class="muted">Websites that click. A one-person web studio based in Romford, building for businesses across East London, Essex and the UK.</p>
    </div>
    <nav aria-label="Areas">
      <p class="fh">Areas</p>
      <ul>{areas.map((a) => <li><a href={a.href}>{a.label}</a></li>)}</ul>
    </nav>
    <nav aria-label="Site">
      <p class="fh">Explore</p>
      <ul>
        <li><a href="/services/">Packages &amp; prices</a></li>
        <li><a href="/work/">Work</a></li>
        <li><a href="/learn/">Learn</a></li>
        <li><a href="/about/">About</a></li>
        <li><a href="/quote/">Get a quote</a></li>
      </ul>
    </nav>
    <div>
      <p class="fh">Talk to Ibrahim</p>
      <ul>
        <li><a href={`mailto:${site.email}`}>{site.email}</a></li>
        <li><a href={whatsappUrl(site.whatsapp, DEFAULT_WA_TEXT)} data-wa rel="noopener" target="_blank">WhatsApp</a></li>
      </ul>
    </div>
  </div>
  <div class="container legal">
    <span>© {year} Apex Designs · Romford, Greater London</span>
    <span class="links">
      <a href="/privacy/">Privacy</a><a href="/cookies/">Cookies</a><a href="/terms/">Terms</a>
      <button type="button" class="linklike" data-consent-open>Cookie settings</button>
    </span>
  </div>
</footer>

<style>
  .site-footer { border-top: 1px solid var(--line); padding-block: 72px 32px; background: linear-gradient(180deg, transparent, rgb(62 125 110 / 0.06)); }
  .cols { display: grid; gap: 40px; grid-template-columns: 2fr repeat(3, 1fr); }
  @media (max-width: 900px) { .cols { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 560px) { .cols { grid-template-columns: 1fr; } }
  .brand { display: flex; align-items: center; gap: 0.6rem; text-decoration: none; font: 600 1.3rem/1 var(--font-display); margin-bottom: 1rem; }
  .fh { font: 600 0.78rem/1 var(--font-body); letter-spacing: 0.16em; text-transform: uppercase; color: var(--teal-glow); margin-bottom: 1rem; }
  ul { list-style: none; padding: 0; margin: 0; display: grid; gap: 0.55rem; }
  ul a { color: var(--mist-dim); text-decoration: none; }
  ul a:hover { color: var(--mist); }
  .legal { display: flex; flex-wrap: wrap; gap: 12px 24px; justify-content: space-between; margin-top: 56px; padding-top: 24px; border-top: 1px solid var(--line); color: var(--mist-dim); font-size: 0.88rem; }
  .links { display: flex; flex-wrap: wrap; gap: 18px; }
  .links a { color: inherit; }
  .linklike { background: none; border: 0; padding: 0; color: inherit; font: inherit; text-decoration: underline; cursor: pointer; }
</style>
```

Footer headings are `<p class="fh">`, not `<h2>`, so pages keep a clean heading outline.

- [ ] **Step 5: WhatsApp floating button and consent banner**

`src/components/WhatsAppButton.astro`:
```astro
---
import { site } from '../config/site';
import { whatsappUrl, DEFAULT_WA_TEXT } from '../lib/whatsapp';
---
<a class="wa-fab" href={whatsappUrl(site.whatsapp, DEFAULT_WA_TEXT)} data-wa target="_blank" rel="noopener" aria-label="Chat with Ibrahim on WhatsApp">
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.9 11.9 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.8 2.8 0 0 0 1.8-1.3 2.3 2.3 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3Z"/></svg>
</a>
<style>
  .wa-fab { position: fixed; right: 20px; bottom: 20px; z-index: 60; width: 56px; height: 56px; border-radius: 50%; display: grid; place-items: center; background: #25d366; color: #fff; box-shadow: 0 10px 30px -8px rgb(37 211 102 / 0.6); transition: transform 0.3s var(--ease); }
  .wa-fab:hover { transform: scale(1.08); }
</style>
```

`src/components/ConsentBanner.astro`:
```astro
<div id="consent-banner" class="consent card" role="region" aria-label="Cookie choices" hidden>
  <p><strong>Can I measure how you use this site?</strong> With your OK I store an anonymous ID so I can see which pages and links help people find me. No ads, no third-party trackers. <a href="/cookies/">Details</a></p>
  <div class="actions">
    <button type="button" class="btn btn-ghost" data-consent="denied">No thanks</button>
    <button type="button" class="btn btn-ghost" data-consent="granted">Accept analytics</button>
  </div>
</div>
<style>
  .consent { position: fixed; left: 20px; bottom: 20px; z-index: 70; max-width: min(440px, calc(100% - 100px)); padding: 20px; background: rgb(17 24 22 / 0.92); font-size: 0.92rem; }
  .consent p { margin-bottom: 14px; }
  .consent a { color: var(--teal-glow); }
  .actions { display: flex; gap: 10px; flex-wrap: wrap; }
  .actions .btn { padding: 0.7em 1.1em; font-size: 0.9rem; }
  @media (max-width: 560px) { .consent { left: 12px; right: 12px; bottom: 88px; max-width: none; } }
</style>
```

Both buttons share the `btn-ghost` style on purpose (equal prominence, per ICO guidance).

- [ ] **Step 6: PageHero and CtaBand**

`src/components/PageHero.astro`:
```astro
---
interface Props { eyebrow?: string; lead?: string }
const { eyebrow, lead } = Astro.props;
---
<section class="page-hero">
  <div class="mesh" aria-hidden="true"></div>
  <div class="container inner">
    {eyebrow && <span class="eyebrow">{eyebrow}</span>}
    <h1><slot /></h1>
    {lead && <p class="lead">{lead}</p>}
    <slot name="after" />
  </div>
</section>
<style>
  .page-hero { position: relative; padding: clamp(150px, 20vw, 220px) 0 clamp(56px, 8vw, 96px); overflow: hidden; }
  .inner { position: relative; }
  .mesh { position: absolute; inset: -20% -10% 0; background:
      radial-gradient(40% 50% at 20% 30%, rgb(62 125 110 / 0.35), transparent 70%),
      radial-gradient(30% 40% at 80% 20%, rgb(95 211 181 / 0.18), transparent 70%),
      radial-gradient(50% 50% at 60% 90%, rgb(43 48 48 / 0.8), transparent 70%);
    filter: blur(40px); animation: drift 18s ease-in-out infinite alternate; }
  @keyframes drift { to { transform: translate3d(4%, 3%, 0) scale(1.08); } }
  h1 { font-size: clamp(2.4rem, 6vw, 4.6rem); max-width: 18ch; }
</style>
```

`src/components/CtaBand.astro`:
```astro
---
import { site } from '../config/site';
import { whatsappUrl, DEFAULT_WA_TEXT } from '../lib/whatsapp';
interface Props { heading?: string; text?: string }
const { heading = 'Ready for a website that clicks?', text = 'Tell me about your business. You get a clear plan and price, no jargon, no pressure.' } = Astro.props;
---
<section class="section">
  <div class="container">
    <div class="band card" data-spotlight data-reveal>
      <h2>{heading}</h2>
      <p class="lead">{text}</p>
      <div class="ctas">
        <a class="btn btn-primary" href="/quote/" data-track="band-quote" data-magnetic>Get a free quote</a>
        <a class="btn btn-ghost" href={whatsappUrl(site.whatsapp, DEFAULT_WA_TEXT)} data-wa target="_blank" rel="noopener">Message on WhatsApp</a>
      </div>
    </div>
  </div>
</section>
<style>
  .band { text-align: center; padding: clamp(40px, 7vw, 88px) clamp(20px, 5vw, 64px); background: radial-gradient(80% 120% at 50% 0%, rgb(62 125 110 / 0.35), transparent 70%), rgb(255 255 255 / 0.02); }
  .band .lead { margin-inline: auto; }
  .ctas { display: flex; gap: 12px; justify-content: center; flex-wrap: wrap; margin-top: 28px; }
</style>
```

- [ ] **Step 7: BaseLayout and ProseLayout**

`src/layouts/BaseLayout.astro`:
```astro
---
import '@fontsource-variable/inter';
import '@fontsource/playfair-display/600.css';
import '@fontsource/playfair-display/600-italic.css';
import '../styles/global.css';
import Seo from '../components/Seo.astro';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';
import WhatsAppButton from '../components/WhatsAppButton.astro';
import ConsentBanner from '../components/ConsentBanner.astro';
import { businessJsonLd } from '../lib/seo';

interface Props {
  title?: string;
  description: string;
  image?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown>[];
  type?: 'website' | 'article';
}
const { jsonLd = [], ...seo } = Astro.props;
---
<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#0b0f0e" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <Seo {...seo} jsonLd={[businessJsonLd(), ...jsonLd]} />
  </head>
  <body>
    <a class="skip-link" href="#main">Skip to content</a>
    <div class="grain" aria-hidden="true"></div>
    <Header />
    <main id="main"><slot /></main>
    <Footer />
    <WhatsAppButton />
    <ConsentBanner />
  </body>
</html>
```

`src/layouts/ProseLayout.astro`:
```astro
---
import BaseLayout from './BaseLayout.astro';
import PageHero from '../components/PageHero.astro';
interface Props {
  title?: string;
  description: string;
  heading: string;
  eyebrow?: string;
  lead?: string;
  noindex?: boolean;
  jsonLd?: Record<string, unknown>[];
  type?: 'website' | 'article';
}
const { heading, eyebrow, lead, ...rest } = Astro.props;
---
<BaseLayout {...rest}>
  <PageHero eyebrow={eyebrow} lead={lead}>{heading}</PageHero>
  <section class="container prose-wrap">
    <article class="prose"><slot /></article>
  </section>
</BaseLayout>
<style>
  .prose-wrap { padding-bottom: clamp(72px, 10vw, 140px); }
</style>
```

- [ ] **Step 8: Use the layout on the temporary home page**

`src/pages/index.astro`:
```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
---
<BaseLayout title="Web Design Romford & East London" description="Fast, custom websites for local businesses in Romford, East London and Essex. Clear prices from £300.">
  <section class="container section"><h1>Apex Designs</h1></section>
</BaseLayout>
```

Run: `npm run build` → Expected: success. Run `npm run preview`, open `http://localhost:4321/`: header, footer, WhatsApp button visible; banner hidden (wired in Task 14); mobile menu toggles at 375px width.

- [ ] **Step 9: Commit**

```bash
git add src tests/whatsapp.test.ts
git commit -m "feat: add layout shell, header, footer, WhatsApp and consent markup"
```

---

### Task 5: Build-time SEO audit

**Files:**
- Create: `scripts/seo-audit.mjs`, `scripts/seo-audit.d.mts`, `scripts/check-seo.mjs`
- Modify: `package.json` (`build` script)
- Test: `tests/seo-audit.test.ts`

**Interfaces:**
- Produces: `auditPage(html: string, relPath: string): { title: string | undefined; errors: string[] }`, `auditSitemap(xml: string): string[]`, `findDuplicateTitles(pages: { path: string; title?: string }[]): string[]`, `PLACEHOLDER_MARKERS: string[]`. Later tasks add page-specific rules inside `auditPage` (Task 6 home hero, Task 15 quote page).

- [ ] **Step 1: Failing tests**

`tests/seo-audit.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { auditPage, auditSitemap, findDuplicateTitles } from '../scripts/seo-audit.mjs';

const good = (extra = '') => `<html><head><title>Services | Apex Designs</title>
<meta name="description" content="Packages and prices.">
<link rel="canonical" href="https://apexdesigns.org.uk/services/">${extra}</head><body><h1>Services</h1></body></html>`;

describe('auditPage', () => {
  it('passes a good page', () => {
    expect(auditPage(good(), 'services/index.html').errors).toEqual([]);
  });
  it('flags missing or multiple h1', () => {
    expect(auditPage(good().replace('<h1>Services</h1>', ''), 'services/index.html').errors).toContain('expected 1 <h1>, found 0');
    expect(auditPage(good().replace('</body>', '<h1>Two</h1></body>'), 'services/index.html').errors).toContain('expected 1 <h1>, found 2');
  });
  it('flags missing title, description and canonical', () => {
    const html = '<html><head></head><body><h1>x</h1></body></html>';
    const { errors } = auditPage(html, 'x/index.html');
    expect(errors).toEqual(expect.arrayContaining(['missing <title>', 'missing meta description', 'missing canonical']));
  });
  it('flags an over-long description', () => {
    const html = good().replace('Packages and prices.', 'a'.repeat(171));
    expect(auditPage(html, 'services/index.html').errors[0]).toMatch(/too long/);
  });
  it('requires noindex on admin and 404', () => {
    expect(auditPage(good(), 'admin/index.html').errors).toContain('must be noindex');
    expect(auditPage(good(), '404.html').errors).toContain('must be noindex');
    expect(auditPage(good('<meta name="robots" content="noindex, nofollow">'), 'admin/index.html').errors).toEqual([]);
  });
  it('rejects noindex on public pages', () => {
    expect(auditPage(good('<meta name="robots" content="noindex, nofollow">'), 'services/index.html').errors).toContain('unexpected noindex');
  });
});

describe('auditSitemap', () => {
  it('rejects admin URLs', () => {
    expect(auditSitemap('<loc>https://apexdesigns.org.uk/admin/</loc>')).toHaveLength(1);
    expect(auditSitemap('<loc>https://apexdesigns.org.uk/services/</loc>')).toEqual([]);
  });
});

describe('findDuplicateTitles', () => {
  it('reports duplicates', () => {
    const errs = findDuplicateTitles([{ path: 'a', title: 'X' }, { path: 'b', title: 'X' }, { path: 'c', title: 'Y' }]);
    expect(errs).toEqual(['duplicate title "X": a, b']);
  });
});
```

Run: `npx vitest run tests/seo-audit.test.ts` → Expected: FAIL (module missing).

- [ ] **Step 2: Implement scripts/seo-audit.mjs and its type declaration**

`scripts/seo-audit.mjs`:
```js
export const PLACEHOLDER_MARKERS = ['447000000000'];

export function auditPage(html, relPath) {
  const errors = [];
  const isAdmin = relPath.startsWith('admin/');
  const is404 = relPath === '404.html' || relPath === '404/index.html';

  const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;
  if (h1Count !== 1) errors.push(`expected 1 <h1>, found ${h1Count}`);

  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
  if (!title) errors.push('missing <title>');

  const desc = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1]?.trim();
  if (!desc) errors.push('missing meta description');
  else if (desc.length > 170) errors.push(`meta description too long (${desc.length})`);

  if (!/<link\s+rel="canonical"\s+href="https:\/\/apexdesigns\.org\.uk\/[^"]*"/i.test(html)) errors.push('missing canonical');

  const noindex = /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);
  if ((isAdmin || is404) && !noindex) errors.push('must be noindex');
  if (!isAdmin && !is404 && noindex) errors.push('unexpected noindex');

  return { title, errors };
}

export function auditSitemap(xml) {
  return /\/admin\//.test(xml) ? ['sitemap must not include /admin/'] : [];
}

export function findDuplicateTitles(pages) {
  const byTitle = new Map();
  for (const p of pages) {
    if (!p.title) continue;
    byTitle.set(p.title, [...(byTitle.get(p.title) ?? []), p.path]);
  }
  return [...byTitle].filter(([, paths]) => paths.length > 1).map(([t, paths]) => `duplicate title "${t}": ${paths.join(', ')}`);
}
```

`scripts/seo-audit.d.mts`:
```ts
export declare const PLACEHOLDER_MARKERS: string[];
export declare function auditPage(html: string, relPath: string): { title: string | undefined; errors: string[] };
export declare function auditSitemap(xml: string): string[];
export declare function findDuplicateTitles(pages: { path: string; title?: string }[]): string[];
```

Run: `npx vitest run tests/seo-audit.test.ts` → Expected: PASS.

- [ ] **Step 3: Implement scripts/check-seo.mjs**

```js
import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditPage, auditSitemap, findDuplicateTitles, PLACEHOLDER_MARKERS } from './seo-audit.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

let failed = false;
let placeholder = false;
const pages = [];

for await (const file of walk(dist)) {
  if (!file.endsWith('.html')) continue;
  const rel = relative(dist, file).split(sep).join('/');
  const html = await readFile(file, 'utf8');
  const { title, errors } = auditPage(html, rel);
  pages.push({ path: rel, title });
  for (const e of errors) { console.error(`✗ ${rel}: ${e}`); failed = true; }
  if (PLACEHOLDER_MARKERS.some((m) => html.includes(m))) placeholder = true;
}

for (const name of await readdir(dist)) {
  if (!/^sitemap-\d+\.xml$/.test(name)) continue;
  for (const e of auditSitemap(await readFile(join(dist, name), 'utf8'))) { console.error(`✗ ${name}: ${e}`); failed = true; }
}

for (const e of findDuplicateTitles(pages)) { console.error(`✗ ${e}`); failed = true; }

if (placeholder) console.warn('⚠ Placeholder WhatsApp number still in use: set it in src/config/site.ts before launch.');
if (failed) process.exit(1);
console.log(`✓ SEO audit passed for ${pages.length} pages`);
```

- [ ] **Step 4: Wire into build**

In `package.json` set: `"build": "astro check && astro build && node scripts/check-seo.mjs"`

Run: `npm run build` → Expected: `✓ SEO audit passed for 1 pages` (plus placeholder warning).

- [ ] **Step 5: Commit**

```bash
git add scripts/seo-audit.mjs scripts/seo-audit.d.mts scripts/check-seo.mjs tests/seo-audit.test.ts package.json
git commit -m "feat: add post-build SEO audit"
```

---

### Task 6: 3D low-poly peak hero

**Files:**
- Create: `src/scripts/hero/terrain.ts`, `src/scripts/hero/capability.ts`, `src/scripts/hero/scene.ts`, `src/components/Hero.astro`
- Modify: `scripts/seo-audit.mjs` (home rule), `tests/seo-audit.test.ts`, `src/pages/index.astro`
- Test: `tests/terrain.test.ts`, `tests/capability.test.ts`

**Interfaces:**
- Produces:
  - `TERRAIN = { size: 48, segments: 96 }`; `heightAt(x: number, z: number, seed?: number): number`; `colorForHeight(h: number, maxH: number): [number, number, number]` (0–1 floats).
  - `RenderEnv { webgl: boolean; reducedMotion: boolean; saveData: boolean }`; `shouldRender3D(env: RenderEnv): boolean`; `readRenderEnv(win: Window): RenderEnv`.
  - `initHero(root: HTMLElement): (() => void) | null`: sets `root.dataset.hero = 'live'` after the first frame, `'fallback'` on context loss.
  - `<Hero />` renders `<section data-hero="fallback">` containing the page's only H1.

- [ ] **Step 1: Failing terrain and capability tests**

`tests/terrain.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { heightAt, colorForHeight, TERRAIN } from '../src/scripts/hero/terrain';

describe('heightAt', () => {
  it('is deterministic', () => {
    expect(heightAt(3.3, -2.1)).toBe(heightAt(3.3, -2.1));
  });
  it('is never negative', () => {
    for (let x = -24; x <= 24; x += 1.5) for (let z = -24; z <= 24; z += 1.5) expect(heightAt(x, z)).toBeGreaterThanOrEqual(0);
  });
  it('puts the highest point (the apex) near the centre', () => {
    let best = { h: -1, x: 0, z: 0 };
    const half = TERRAIN.size / 2;
    for (let x = -half; x <= half; x += 0.5) for (let z = -half; z <= half; z += 0.5) {
      const h = heightAt(x, z);
      if (h > best.h) best = { h, x, z };
    }
    expect(Math.hypot(best.x, best.z)).toBeLessThan(2);
  });
});

describe('colorForHeight', () => {
  it('is charcoal at the base and snow at the apex', () => {
    const [r0, g0, b0] = colorForHeight(0, 10);
    expect(Math.max(r0, g0, b0)).toBeLessThan(0.2);
    const [r1, g1, b1] = colorForHeight(10, 10);
    expect(Math.min(r1, g1, b1)).toBeGreaterThan(0.85);
  });
  it('is teal in the middle', () => {
    const [r, g, b] = colorForHeight(6, 10);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThanOrEqual(b);
  });
});
```

`tests/capability.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { shouldRender3D } from '../src/scripts/hero/capability';

describe('shouldRender3D', () => {
  it('renders when everything is available', () => {
    expect(shouldRender3D({ webgl: true, reducedMotion: false, saveData: false })).toBe(true);
  });
  it('falls back without WebGL', () => {
    expect(shouldRender3D({ webgl: false, reducedMotion: false, saveData: false })).toBe(false);
  });
  it('falls back for reduced motion', () => {
    expect(shouldRender3D({ webgl: true, reducedMotion: true, saveData: false })).toBe(false);
  });
  it('falls back for data saver', () => {
    expect(shouldRender3D({ webgl: true, reducedMotion: false, saveData: true })).toBe(false);
  });
});
```

Run: `npx vitest run tests/terrain.test.ts tests/capability.test.ts` → Expected: FAIL (modules missing).

- [ ] **Step 2: Implement terrain.ts**

`src/scripts/hero/terrain.ts`:
```ts
export const TERRAIN = { size: 48, segments: 96 } as const;

function hash(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = smooth(x - ix), fz = smooth(z - iz);
  const a = hash(ix, iz, seed), b = hash(ix + 1, iz, seed);
  const c = hash(ix, iz + 1, seed), d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

function fbm(x: number, z: number, seed: number): number {
  let sum = 0, amp = 0.5, freq = 1;
  for (let o = 0; o < 4; o++) { sum += amp * valueNoise(x * freq, z * freq, seed + o); amp *= 0.5; freq *= 2; }
  return sum / 0.9375; // normalise to ~0..1
}

const gauss = (dx: number, dz: number, s: number) => Math.exp(-(dx * dx + dz * dz) / (2 * s * s));

/** Height of the low-poly range: one dominant central apex (like the logo) plus two flanking peaks. */
export function heightAt(x: number, z: number, seed = 7): number {
  const r = Math.hypot(x, z);
  const apex = 9 * gauss(x, z, 3.2);
  const left = 5 * gauss(x + 7, z + 1, 2.8);
  const right = 5.5 * gauss(x - 6.5, z + 2, 3);
  const falloff = Math.max(0, 1 - r / (TERRAIN.size / 2));
  const noise = (fbm(x * 0.18, z * 0.18, seed) - 0.5) * 1.6 * (0.4 + 0.6 * falloff);
  return Math.max(0, apex + left + right + noise);
}

type RGB = [number, number, number];
const hex = (n: number): RGB => [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
const STOPS: { at: number; c: RGB }[] = [
  { at: 0, c: hex(0x141a19) },
  { at: 0.3, c: hex(0x2b3030) },
  { at: 0.55, c: hex(0x3e7d6e) },
  { at: 0.78, c: hex(0x5fd3b5) },
  { at: 0.9, c: hex(0xf4faf7) },
];

export function colorForHeight(h: number, maxH: number): RGB {
  const t = Math.min(1, Math.max(0, maxH > 0 ? h / maxH : 0));
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i].at) {
      const a = STOPS[i - 1], b = STOPS[i];
      const k = (t - a.at) / (b.at - a.at);
      return [a.c[0] + (b.c[0] - a.c[0]) * k, a.c[1] + (b.c[1] - a.c[1]) * k, a.c[2] + (b.c[2] - a.c[2]) * k];
    }
  }
  return STOPS[STOPS.length - 1].c;
}
```

- [ ] **Step 3: Implement capability.ts**

`src/scripts/hero/capability.ts`:
```ts
export interface RenderEnv { webgl: boolean; reducedMotion: boolean; saveData: boolean }

export function shouldRender3D(env: RenderEnv): boolean {
  return env.webgl && !env.reducedMotion && !env.saveData;
}

export function readRenderEnv(win: Window): RenderEnv {
  let webgl = false;
  try {
    const c = win.document.createElement('canvas');
    webgl = Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    webgl = false;
  }
  const conn = (win.navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return {
    webgl,
    reducedMotion: win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    saveData: Boolean(conn?.saveData),
  };
}
```

Run: `npx vitest run tests/terrain.test.ts tests/capability.test.ts` → Expected: PASS. If the apex test fails, lower the flanking peak heights (5 → 4.5, 5.5 → 5) until it passes; do not loosen the test.

- [ ] **Step 4: Implement the Three.js scene**

`src/scripts/hero/scene.ts`:
```ts
import * as THREE from 'three';
import { heightAt, colorForHeight, TERRAIN } from './terrain';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

export function initHero(root: HTMLElement): (() => void) | null {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas[data-hero-canvas]');
  if (!canvas) return null;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0b0f0e, 0.032);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);

  // Terrain: displaced plane, made non-indexed so each triangle gets one flat colour.
  const base = new THREE.PlaneGeometry(TERRAIN.size, TERRAIN.size, TERRAIN.segments, TERRAIN.segments);
  base.rotateX(-Math.PI / 2);
  const bp = base.attributes.position;
  let maxH = 0;
  for (let i = 0; i < bp.count; i++) {
    const h = heightAt(bp.getX(i), bp.getZ(i));
    bp.setY(i, h);
    if (h > maxH) maxH = h;
  }
  const geo = base.toNonIndexed();
  base.dispose();
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 3) {
    const avg = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const [r, g, b] = colorForHeight(avg, maxH);
    for (let k = 0; k < 3; k++) colors.set([r, g, b], (i + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0.05 });
  const wireGeo = new THREE.WireframeGeometry(geo);
  const wireMat = new THREE.LineBasicMaterial({ color: 0x5fd3b5, transparent: true, opacity: 0.05 });
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, terrainMat), new THREE.LineSegments(wireGeo, wireMat));
  scene.add(group);

  // Drifting particles (snow / dust) for depth.
  const pCount = 600;
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 40;
    pPos[i * 3 + 1] = Math.random() * 18;
    pPos[i * 3 + 2] = (Math.random() - 0.5) * 40;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0xcfe9e1, size: 0.06, transparent: true, opacity: 0.7, depthWrite: false });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  scene.add(new THREE.HemisphereLight(0xcfe9e1, 0x0b0f0e, 0.7));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-10, 16, 8);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x5fd3b5, 1.4);
  rim.position.set(12, 6, -12);
  scene.add(rim);

  // Camera climbs from the valley to just above the apex as the hero scrolls away.
  const camStart = new THREE.Vector3(0, 4.2, 24);
  const camEnd = new THREE.Vector3(0, maxH + 3.5, 7);
  const lookStart = new THREE.Vector3(0, 4, 0);
  const lookEnd = new THREE.Vector3(0, maxH - 0.5, 0);
  const look = new THREE.Vector3();

  const pointer = { x: 0, y: 0 };
  const eased = { x: 0, y: 0, p: 0 };
  let progress = 0;

  const resize = () => {
    const w = root.clientWidth, h = root.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.fov = w < 700 ? 55 : 42;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(root);
  resize();

  const onPointer = (e: PointerEvent) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  const onScroll = () => {
    const rect = root.getBoundingClientRect();
    progress = clamp01(-rect.top / Math.max(1, rect.height));
  };
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  let raf = 0;
  let visible = true;
  let first = true;
  const clock = new THREE.Clock();

  const frame = () => {
    raf = 0;
    if (!visible || document.hidden) return;
    const t = clock.getElapsedTime();
    eased.x += (pointer.x - eased.x) * 0.05;
    eased.y += (pointer.y - eased.y) * 0.05;
    eased.p += (progress - eased.p) * 0.08;
    const k = easeInOut(eased.p);

    camera.position.lerpVectors(camStart, camEnd, k);
    camera.position.x += eased.x * 1.6;
    camera.position.y += -eased.y * 0.8;
    look.lerpVectors(lookStart, lookEnd, k);
    camera.lookAt(look);

    group.rotation.y = Math.sin(t * 0.05) * 0.08 + eased.x * 0.05;
    particles.rotation.y = t * 0.01;
    const pp = pGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pCount; i++) {
      let y = pp.getY(i) - 0.004;
      if (y < 0) y = 18;
      pp.setY(i, y);
    }
    pp.needsUpdate = true;

    renderer.render(scene, camera);
    if (first) { first = false; root.dataset.hero = 'live'; }
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (!raf) raf = requestAnimationFrame(frame); };

  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) start(); });
  io.observe(root);
  const onVisibility = () => { if (!document.hidden) start(); };
  document.addEventListener('visibilitychange', onVisibility);

  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', onVisibility);
    geo.dispose(); wireGeo.dispose(); pGeo.dispose();
    terrainMat.dispose(); wireMat.dispose(); pMat.dispose();
    renderer.dispose();
  };

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    root.dataset.hero = 'fallback';
    dispose();
  });

  start();
  return dispose;
}
```

- [ ] **Step 5: Hero component**

`src/components/Hero.astro`:
```astro
<section class="hero" data-hero="fallback" aria-labelledby="hero-title">
  <div class="fallback" aria-hidden="true">
    <svg viewBox="0 0 1200 600" preserveAspectRatio="xMidYMax slice">
      <polygon points="600,90 900,600 300,600" fill="#2B3030"/>
      <polygon points="600,90 640,170 615,158 590,205 570,150" fill="#F4FAF7" opacity=".9"/>
      <polygon points="300,300 520,600 60,600" fill="#3E7D6E" opacity=".85"/>
      <polygon points="880,250 1150,600 640,600" fill="#3E7D6E" opacity=".75"/>
      <polygon points="560,360 760,600 380,600" fill="#4F9A87" opacity=".9"/>
    </svg>
  </div>
  <canvas data-hero-canvas aria-hidden="true"></canvas>
  <div class="veil" aria-hidden="true"></div>
  <div class="container content">
    <span class="eyebrow">Romford · East London · Essex · UK-wide</span>
    <h1 id="hero-title">Websites that <span class="accent">click.</span><span class="sub">Web design in Romford &amp; East London</span></h1>
    <p class="lead">I'm Ibrahim, a one-person web studio building fast, custom websites for local businesses. Clear prices from £300, and you deal with me from the first call to launch day.</p>
    <div class="ctas">
      <a class="btn btn-primary" href="/quote/" data-track="hero-quote" data-magnetic>Get a free quote</a>
      <a class="btn btn-ghost" href="/services/" data-track="hero-packages">See packages</a>
    </div>
    <p class="proof"><span aria-hidden="true">★★★★★</span> Rated Excellent on Google</p>
  </div>
  <div class="scroll-cue" aria-hidden="true"><span></span></div>
</section>

<style>
  .hero { position: relative; min-height: 100svh; display: grid; align-items: end; overflow: hidden; isolation: isolate; }
  .fallback, canvas, .veil { position: absolute; inset: 0; width: 100%; height: 100%; }
  .fallback { z-index: -3; background: radial-gradient(60% 60% at 50% 20%, rgb(62 125 110 / 0.35), transparent 70%), var(--ink); transition: opacity 1.2s; }
  .fallback svg { position: absolute; inset: auto 0 0; width: 100%; height: 75%; opacity: 0.55; }
  canvas { z-index: -2; opacity: 0; transition: opacity 1.4s var(--ease); }
  .hero[data-hero='live'] canvas { opacity: 1; }
  .hero[data-hero='live'] .fallback { opacity: 0; }
  .veil { z-index: -1; background: linear-gradient(180deg, rgb(11 15 14 / 0.1) 0%, rgb(11 15 14 / 0.2) 45%, var(--ink) 100%); pointer-events: none; }
  .content { padding-block: 140px clamp(80px, 12vh, 140px); }
  h1 { max-width: 12ch; }
  .sub { display: block; margin-top: 0.6em; font: 500 clamp(1rem, 1.6vw, 1.25rem)/1.3 var(--font-body); letter-spacing: 0.02em; color: var(--mist-dim); }
  .ctas { display: flex; flex-wrap: wrap; gap: 12px; margin: 28px 0 22px; }
  .proof { font-size: 0.92rem; color: var(--mist-dim); }
  .proof span { color: #f5c451; letter-spacing: 2px; margin-right: 6px; }
  .scroll-cue { position: absolute; left: 50%; bottom: 24px; width: 22px; height: 36px; border: 1.5px solid var(--line); border-radius: 12px; transform: translateX(-50%); }
  .scroll-cue span { position: absolute; left: 50%; top: 7px; width: 3px; height: 7px; border-radius: 2px; background: var(--teal-glow); transform: translateX(-50%); animation: cue 1.8s ease-in-out infinite; }
  @keyframes cue { 0% { opacity: 0; transform: translate(-50%, 0); } 40% { opacity: 1; } 100% { opacity: 0; transform: translate(-50%, 12px); } }
</style>

<script>
  import { readRenderEnv, shouldRender3D } from '../scripts/hero/capability';
  const root = document.querySelector<HTMLElement>('[data-hero]');
  if (root && shouldRender3D(readRenderEnv(window))) {
    import('../scripts/hero/scene')
      .then(({ initHero }) => initHero(root))
      .catch(() => { root.dataset.hero = 'fallback'; });
  }
</script>
```

- [ ] **Step 6: Audit rule: home must default to fallback (Review Focus 4)**

Add to `tests/seo-audit.test.ts` inside `describe('auditPage')`:
```ts
  it('requires the home hero to default to the fallback state', () => {
    expect(auditPage(good(), 'index.html').errors).toContain('home hero must default to data-hero="fallback"');
    expect(auditPage(good('<section data-hero="fallback"></section>'), 'index.html').errors).toEqual([]);
  });
```

Run: `npx vitest run tests/seo-audit.test.ts` → Expected: FAIL on the new test.

In `scripts/seo-audit.mjs`, before `return { title, errors };` add:
```js
  if (relPath === 'index.html' && !/data-hero="fallback"/.test(html)) errors.push('home hero must default to data-hero="fallback"');
```

Run: `npx vitest run tests/seo-audit.test.ts` → Expected: PASS.

- [ ] **Step 7: Put the hero on the home page and check in a browser**

`src/pages/index.astro`:
```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import Hero from '../components/Hero.astro';
---
<BaseLayout title="Web Design Romford & East London" description="Fast, custom websites for local businesses in Romford, East London and Essex. Clear prices from £300.">
  <Hero />
</BaseLayout>
```

Run: `npm run build` → Expected: audit passes. Run `npm run dev`, open `/`: the low-poly peak fades in, tilts with the mouse, and the camera rises toward the apex while scrolling. With DevTools → Rendering → "Emulate CSS prefers-reduced-motion: reduce", reload: the SVG fallback shows, no canvas animation, text readable. Console has no errors.

- [ ] **Step 8: Commit**

```bash
git add src/scripts/hero src/components/Hero.astro src/pages/index.astro scripts/seo-audit.mjs tests/terrain.test.ts tests/capability.test.ts tests/seo-audit.test.ts
git commit -m "feat: add procedural low-poly peak hero with fallback"
```

---

### Task 7: Motion system

**Files:**
- Create: `src/scripts/motion.ts`
- Modify: `src/layouts/BaseLayout.astro` (add script)

**Interfaces:**
- Consumes: DOM hooks `[data-reveal]`, `[data-reveal-stagger]` (children animate in sequence), `[data-magnetic]`, `[data-spotlight]`.
- Produces: `initMotion(): void`.

- [ ] **Step 1: Implement motion.ts**

`src/scripts/motion.ts`:
```ts
import Lenis from 'lenis';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

export function initMotion(): void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = window.matchMedia('(pointer: fine)').matches;

  // Spotlight has no movement, so it stays on under reduced motion.
  document.addEventListener('pointermove', (e) => {
    const card = (e.target as Element | null)?.closest?.<HTMLElement>('[data-spotlight]');
    if (!card) return;
    const r = card.getBoundingClientRect();
    card.style.setProperty('--mx', `${e.clientX - r.left}px`);
    card.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });

  // Content is visible by default; nothing is hidden unless this script runs.
  if (reduce) return;

  gsap.registerPlugin(ScrollTrigger);
  const lenis = new Lenis({ lerp: 0.1, anchors: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);

  gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
    gsap.from(el, { y: 48, autoAlpha: 0, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 88%', once: true } });
  });
  gsap.utils.toArray<HTMLElement>('[data-reveal-stagger]').forEach((el) => {
    gsap.from(el.children, { y: 36, autoAlpha: 0, duration: 0.9, stagger: 0.09, ease: 'power3.out', scrollTrigger: { trigger: el, start: 'top 85%', once: true } });
  });

  if (fine) {
    document.querySelectorAll<HTMLElement>('[data-magnetic]').forEach((el) => {
      const xTo = gsap.quickTo(el, 'x', { duration: 0.5, ease: 'power3.out' });
      const yTo = gsap.quickTo(el, 'y', { duration: 0.5, ease: 'power3.out' });
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        xTo((e.clientX - (r.left + r.width / 2)) * 0.25);
        yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
      });
      el.addEventListener('pointerleave', () => { xTo(0); yTo(0); });
    });
  }
}
```

- [ ] **Step 2: Load it in BaseLayout**

In `src/layouts/BaseLayout.astro`, add directly before `</body>`:
```astro
    <script>
      import { initMotion } from '../scripts/motion';
      initMotion();
    </script>
```

- [ ] **Step 3: Verify**

Run: `npm run build` → Expected: success. In `npm run dev`: smooth scrolling works and the header "Get a quote" button leans toward the cursor. With reduced motion emulated: native scrolling, no animations, all content visible.

- [ ] **Step 4: Commit**

```bash
git add src/scripts/motion.ts src/layouts/BaseLayout.astro
git commit -m "feat: add Lenis smooth scroll, GSAP reveals and magnetic buttons"
```

---

### Task 8: Content data and collections

**Files:**
- Create: `src/data/packages.ts`, `src/data/faqs.ts`, `src/data/locations.ts`, `src/content.config.ts`, `src/content/work/{damal-restaurant,damal-banqueting,my-thermomix-my-way,whitebeard}.md`, `src/components/PackageCard.astro`, `src/components/ReviewCard.astro`, `src/components/WorkCard.astro`, `src/components/Faq.astro`
- Test: `tests/data.test.ts`

**Interfaces:**
- Produces:
  - `PackageId = 'standard' | 'premium' | 'custom'`; `Package { id: PackageId; name: string; price: string; priceNote?: string; blurb: string; includesFrom?: string; features: string[]; featured?: boolean }`; `packages: Package[]`.
  - `Faq { q: string; a: string }`; `serviceFaqs: Faq[]`.
  - `Location { slug: string; place: string; title: string; description: string; eyebrow: string; h1: string; intro: string[]; nearby: string[]; points: { title: string; text: string }[]; faqs: Faq[]; work: string[] }`; `locations: Location[]`.
  - Collections: `work` (fields `title, client, sector, location?, summary, image, order, services: string[]`; entry ids = file names), `learn` (fields `title, description, published: Date, updated?: Date, tags: string[]`).
  - Components: `<PackageCard pkg={Package} />`, `<ReviewCard review={Review} />`, `<WorkCard entry={CollectionEntry<'work'>} />`, `<Faq items={Faq[]} />`.

- [ ] **Step 1: Failing data integrity test**

`tests/data.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { packages } from '../src/data/packages';
import { locations } from '../src/data/locations';
import { serviceFaqs } from '../src/data/faqs';

describe('packages', () => {
  it('has the three packages with the agreed prices', () => {
    expect(packages.map((p) => [p.id, p.price])).toEqual([
      ['standard', '£300'],
      ['premium', '£500'],
      ['custom', 'On quote'],
    ]);
    expect(packages.find((p) => p.id === 'premium')?.priceNote).toBe('+ £15/month');
  });
});

describe('locations', () => {
  it('has the four agreed slugs', () => {
    expect(locations.map((l) => l.slug)).toEqual(['web-design-romford', 'web-design-east-london', 'web-design-essex', 'remote-web-design-uk']);
  });
  it('has unique titles, descriptions, H1s and intros (no duplicate content)', () => {
    for (const key of ['title', 'description', 'h1'] as const) {
      expect(new Set(locations.map((l) => l[key])).size).toBe(locations.length);
    }
    expect(new Set(locations.map((l) => l.intro[0])).size).toBe(locations.length);
  });
  it('keeps descriptions within 170 chars', () => {
    for (const l of locations) expect(l.description.length).toBeLessThanOrEqual(170);
  });
  it('only references existing work entries', () => {
    const work = readdirSync(join(process.cwd(), 'src/content/work')).map((f) => f.replace(/\.md$/, ''));
    for (const l of locations) for (const w of l.work) expect(work).toContain(w);
  });
});

describe('faqs', () => {
  it('has answers for every question', () => {
    expect(serviceFaqs.length).toBeGreaterThanOrEqual(6);
    for (const f of serviceFaqs) expect(f.a.length).toBeGreaterThan(20);
  });
});
```

Run: `npx vitest run tests/data.test.ts` → Expected: FAIL (modules missing).

- [ ] **Step 2: packages.ts and faqs.ts**

`src/data/packages.ts`:
```ts
export type PackageId = 'standard' | 'premium' | 'custom';

export interface Package {
  id: PackageId;
  name: string;
  price: string;
  priceNote?: string;
  blurb: string;
  includesFrom?: string;
  features: string[];
  featured?: boolean;
}

export const packages: Package[] = [
  {
    id: 'standard',
    name: 'Standard',
    price: '£300',
    priceNote: 'one-off',
    blurb: 'A sharp, custom single-page site to get your business online properly.',
    features: ['Custom single page website', 'Consultation call', 'Scheduled development plan', 'Free hosting', 'Custom email & logo'],
  },
  {
    id: 'premium',
    name: 'Premium',
    price: '£500',
    priceNote: '+ £15/month',
    blurb: 'A full multi-page site that gets found on Google and keeps improving.',
    includesFrom: 'Everything in Standard, plus',
    features: ['Custom multi-page website', 'Google Business Profile setup', 'Google Analytics', 'Continuous support'],
    featured: true,
  },
  {
    id: 'custom',
    name: 'Custom',
    price: 'On quote',
    blurb: 'Bespoke systems and brand-led design for businesses that need more.',
    includesFrom: 'Everything in Premium, plus',
    features: ['Custom coded systems', 'Tailored brand-specific designs', 'On-call maintenance', 'Continuous page updates'],
  },
];
```

`src/data/faqs.ts`:
```ts
export interface Faq { q: string; a: string }

export const serviceFaqs: Faq[] = [
  { q: 'How long does a website take?', a: 'It depends on the package and how quickly content comes together. After our consultation call you get a scheduled development plan with dates, so you always know when each stage lands.' },
  { q: 'What does the £15 a month on Premium cover?', a: 'Continuous support: keeping your site running, small changes when you need them, and help with your Google Business Profile and analytics.' },
  { q: 'Do I own my website?', a: 'Yes. The site, the content and the domain are yours. If you ever want to move it elsewhere, I will help you do that.' },
  { q: 'Can you redesign my existing WordPress or Wix site?', a: 'Yes. Most of my projects are revamps. I keep what works, rebuild what does not, and set up redirects so you do not lose the Google rankings you already have.' },
  { q: 'Do you only work in Romford?', a: 'No. I am based in Romford and work with businesses across East London and Essex, and I have clients further afield, including Oxford. Calls happen over video or WhatsApp.' },
  { q: 'Will my website show up on Google?', a: 'Every site is built with search basics done properly: fast pages, clear headings, location keywords and structured data. Premium adds your Google Business Profile and analytics so you can see what is working.' },
  { q: 'How do I get started?', a: 'Send a quote request or a WhatsApp message. We will have a short call about your business, then you get a clear plan and price before anything starts.' },
];
```

- [ ] **Step 3: locations.ts**

`src/data/locations.ts`:
```ts
import type { Faq } from './faqs';

export interface Location {
  slug: string;
  place: string;
  title: string;
  description: string;
  eyebrow: string;
  h1: string;
  intro: string[];
  nearby: string[];
  points: { title: string; text: string }[];
  faqs: Faq[];
  work: string[];
}

export const locations: Location[] = [
  {
    slug: 'web-design-romford',
    place: 'Romford',
    title: 'Web Design Romford',
    description: 'Romford web designer building fast, custom websites for local businesses. Clear prices from £300, one-to-one service, launched on a scheduled plan.',
    eyebrow: 'Based in Romford',
    h1: 'Web design in Romford, from someone down the road',
    intro: [
      'Apex Designs is based in Romford, so when you work with me you are working with a local. I build custom websites for shops, trades, restaurants and professional services across Havering, from the Market Place and South Street to Gidea Park and Harold Wood.',
      'You deal with me directly from the first conversation to launch day. No account managers, no outsourcing, and no templates dressed up as custom work.',
    ],
    nearby: ['Hornchurch', 'Upminster', 'Gidea Park', 'Harold Wood', 'Collier Row', 'Rainham', 'Elm Park', 'Chadwell Heath'],
    points: [
      { title: 'Meet locally', text: 'Happy to meet in Romford, or keep it to WhatsApp and video calls if that suits you better.' },
      { title: 'Found on local searches', text: 'Pages are built around how Romford customers search, with your Google Business Profile set up on Premium.' },
      { title: 'Clear, local pricing', text: 'Packages from £300, so a professional site is realistic for small Romford businesses.' },
    ],
    faqs: [
      { q: 'Do you meet clients in person in Romford?', a: 'Yes. I am Romford-based and happy to meet locally, though most of the process works well over WhatsApp and video calls.' },
      { q: 'Can you help my Romford business show up on Google Maps?', a: 'Yes. The Premium package includes setting up and optimising your Google Business Profile, which is what powers the map results.' },
    ],
    work: ['whitebeard', 'my-thermomix-my-way'],
  },
  {
    slug: 'web-design-east-london',
    place: 'East London',
    title: 'Web Design East London',
    description: 'Custom websites for East London businesses, from Whitechapel to Stratford and Ilford. Affordable packages, fast sites, and one person who answers the phone.',
    eyebrow: 'Across East London',
    h1: 'Web design for East London businesses that want to stand out',
    intro: [
      'East London moves fast and competition is everywhere. Whether you run a restaurant in Whitechapel, a salon in Stratford or a firm in Ilford, your website is often the first impression, and it has to look the part on a phone in seconds.',
      'I have built sites for East London businesses like Damal in Whitechapel, matching their identity and making it simple for customers to find what they need.',
    ],
    nearby: ['Whitechapel', 'Stratford', 'Ilford', 'Barking', 'Dagenham', 'Bethnal Green', 'Walthamstow', 'East Ham', 'Leytonstone'],
    points: [
      { title: 'Built for mobile', text: 'Most of your visitors are on their phone. Every page is designed and tested mobile-first.' },
      { title: 'Personal service', text: 'One person from brief to launch, so nothing gets lost between a sales team and a developer.' },
      { title: 'Proven locally', text: 'Restaurant, banqueting and professional-service sites already live for East London clients.' },
    ],
    faqs: [
      { q: 'Which parts of East London do you cover?', a: 'All of it, from Tower Hamlets and Newham to Redbridge, Barking & Dagenham and Waltham Forest. I am based in Romford, just up the road.' },
      { q: 'Do you build restaurant websites?', a: 'Yes. Damal Restaurant and Damal Banqueting are both East London hospitality sites I designed and built.' },
    ],
    work: ['damal-restaurant', 'damal-banqueting'],
  },
  {
    slug: 'web-design-essex',
    place: 'Essex',
    title: 'Web Design Essex',
    description: 'Web design for Essex businesses in Brentwood, Basildon, Chelmsford and beyond. Custom sites from £300, built by a Romford web designer on the Essex border.',
    eyebrow: 'On the Essex border',
    h1: 'Web design for Essex businesses, from the edge of Romford',
    intro: [
      'Romford sits right on the Essex border, so Brentwood, Basildon, Chelmsford and Thurrock are all close to home. I work with Essex businesses that want a modern website without agency prices.',
      'Whether you are a trade covering half the county or a shop on the high street, I will build a site that explains what you do clearly and makes it easy to get in touch.',
    ],
    nearby: ['Brentwood', 'Basildon', 'Chelmsford', 'Billericay', 'Grays', 'Thurrock', 'Southend-on-Sea', 'Epping'],
    points: [
      { title: 'Service-area pages', text: 'Cover the towns you actually work in, so customers searching there can find you.' },
      { title: 'Easy to contact', text: 'Click-to-call, WhatsApp and quote forms placed where customers expect them.' },
      { title: 'Room to grow', text: 'Start with Standard and move up to Premium or Custom as your business grows.' },
    ],
    faqs: [
      { q: 'Do you work with trades and service businesses in Essex?', a: 'Yes. Trades are a great fit: clear services, the areas you cover, reviews and a fast way to request a quote.' },
      { q: 'Is it a problem that you are not in my town?', a: 'Not at all. Most of the process happens over WhatsApp and video calls, and Romford is close enough to meet if needed.' },
    ],
    work: ['whitebeard', 'damal-banqueting'],
  },
  {
    slug: 'remote-web-design-uk',
    place: 'the UK',
    title: 'Remote Web Design UK',
    description: 'A UK web designer who works remotely with businesses anywhere, with clients from East London to Oxford. Clear packages, video calls and WhatsApp updates.',
    eyebrow: 'Anywhere in the UK',
    h1: 'Remote web design for businesses anywhere in the UK',
    intro: [
      'You do not need a local web designer to get a great website. I work with clients well beyond London, including a business in Oxford, and the process is designed to work entirely remotely.',
      'We start with a video call, you get a scheduled plan with dates, and you see progress as it happens, with updates over WhatsApp or email, whichever you prefer.',
    ],
    nearby: ['London', 'Oxford', 'Kent', 'Hertfordshire', 'Surrey', 'Cambridge', 'Birmingham', 'Manchester'],
    points: [
      { title: 'Simple remote process', text: 'Video consultation, shared plan, regular progress links, and launch without leaving your desk.' },
      { title: 'Fast responses', text: 'WhatsApp means quick answers, not tickets waiting in a queue.' },
      { title: 'UK hours, UK pricing', text: 'Same clear packages wherever you are, priced in pounds, no surprises.' },
    ],
    faqs: [
      { q: 'How does working remotely actually work?', a: 'A video call to understand your business, a written plan with dates, then progress links you can open on any device. Feedback goes over WhatsApp or email.' },
      { q: 'Do you have clients outside London?', a: 'Yes, including a client in Oxford. Location makes no difference to how the project runs.' },
    ],
    work: ['my-thermomix-my-way', 'whitebeard'],
  },
];
```

- [ ] **Step 4: Content collections config**

`src/content.config.ts`:
```ts
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const work = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/work' }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      client: z.string(),
      sector: z.string(),
      location: z.string().optional(),
      summary: z.string().max(170),
      image: image(),
      order: z.number(),
      services: z.array(z.string()),
    }),
});

const learn = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/learn' }),
  schema: z.object({
    title: z.string(),
    description: z.string().max(170),
    published: z.coerce.date(),
    updated: z.coerce.date().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

export const collections = { work, learn };
```

Create an empty `src/content/learn/.gitkeep` so the loader's base directory exists until Task 12.

- [ ] **Step 5: Case studies**

`src/content/work/damal-restaurant.md`:
```md
---
title: Damal Restaurant
client: Damal
sector: Restaurant
location: Whitechapel, East London
summary: A vibrant website for a Somali restaurant in Whitechapel, built around the Damal green and inspired by the marbling of Mecca.
image: ../../assets/work/damal-restaurant.png
order: 1
services: [Custom design, Multi-page website, Brand colour system]
---

## The brief

Damal is a Somali restaurant in Whitechapel, and this was one of the most important sites for the client to get right. It needed to feel like Damal, warm and welcoming, and make it easy for customers to see what is on offer.

## The approach

The colours were vibrant and stayed true to the Damal green. For texture and character I drew on the marbling of Mecca, giving the site a sense of place that a template could never match.

## The result

A site that looks and feels like the restaurant, and a client who came back for more, including the website for Damal Banqueting.

> "On behalf of Damal, great work, great service would recommend good brother 24/7 service." — Mohamoud Abdi, Damal
```

`src/content/work/damal-banqueting.md`:
```md
---
title: Damal Banqueting
client: Damal
sector: Banqueting & events
location: East London
summary: A modern, contemporary website for a newly opened banqueting suite that needed to match an established visual identity.
image: ../../assets/work/damal-banqueting.png
order: 2
services: [Custom design, Multi-page website, Event enquiries]
---

## The brief

Damal opened a new banqueting suite, and it deserved a site that fit its established aesthetic. The challenge was to give the venue its own presence while clearly belonging to the Damal family.

## The approach

I went modern and contemporary, drawing on the style of Meet Bros, with large imagery of the space and a clear path for people planning weddings and events to get in touch.

## The result

A polished, contemporary site that sits naturally alongside the Damal restaurant site and gives the banqueting suite room to grow its own bookings.
```

`src/content/work/my-thermomix-my-way.md`:
```md
---
title: My Thermomix My Way
client: My Thermomix My Way
sector: Sales funnel
summary: A simple, streamlined sales funnel whose job is to route every visitor to the right salesperson, quickly.
image: ../../assets/work/my-thermomix-my-way.png
order: 3
services: [Funnel design, Lead routing, Single-page website]
---

## The brief

This site takes on the important role of directing customers to the right salesperson. It had to be simple enough that nobody gets lost, and fast enough that nobody gives up.

## The approach

Everything was built around the customer journey: a short, clear path with one decision at a time, so each visitor ends up with the person best placed to help them.

## The result

A focused funnel with no distractions, doing exactly one job well.
```

`src/content/work/whitebeard.md`:
```md
---
title: Whitebeard Accounting & Bookkeeping
client: Whitebeard
sector: Accounting & bookkeeping
summary: A modern take on professional, clean design that makes accounting feel approachable and gives customers confidence.
image: ../../assets/work/whitebeard.png
order: 4
services: [Custom design, Multi-page website, Brand refresh]
---

## The brief

Accounting websites often feel cold. Whitebeard wanted to look professional and trustworthy while still being approachable for small businesses and sole traders.

## The approach

This site is a modern take on professional, clean design: generous spacing, calm colours and plain-English copy that explains services without jargon.

## The result

A site that gives customers confidence before they have even picked up the phone.
```

- [ ] **Step 6: Card components and FAQ**

`src/components/PackageCard.astro`:
```astro
---
import type { Package } from '../data/packages';
interface Props { pkg: Package }
const { pkg } = Astro.props;
---
<article class:list={['card', 'pkg', { featured: pkg.featured }]} data-spotlight>
  {pkg.featured && <span class="tag">Most popular</span>}
  <h3>{pkg.name}</h3>
  <p class="price"><span class="amount">{pkg.price}</span>{pkg.priceNote && <span class="note">{pkg.priceNote}</span>}</p>
  <p class="muted">{pkg.blurb}</p>
  {pkg.includesFrom && <p class="from">{pkg.includesFrom}</p>}
  <ul>{pkg.features.map((f) => <li>{f}</li>)}</ul>
  <a class:list={['btn', pkg.featured ? 'btn-primary' : 'btn-ghost']} href={`/quote/?package=${pkg.id}`} data-track={`package-${pkg.id}`}>Get a quote</a>
</article>
<style>
  .pkg { display: flex; flex-direction: column; gap: 6px; }
  .featured { border-color: rgb(95 211 181 / 0.45); box-shadow: 0 30px 80px -40px rgb(95 211 181 / 0.5); }
  .tag { align-self: flex-start; font-size: 0.75rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink); background: var(--teal-glow); padding: 0.35em 0.8em; border-radius: 999px; margin-bottom: 8px; }
  .price { display: flex; align-items: baseline; gap: 10px; margin: 4px 0 8px; }
  .amount { font: 600 clamp(2.4rem, 4vw, 3.2rem)/1 var(--font-display); }
  .note { color: var(--mist-dim); }
  .from { font-size: 0.85rem; font-weight: 600; color: var(--teal-glow); margin: 8px 0 0; }
  ul { list-style: none; padding: 0; margin: 8px 0 24px; display: grid; gap: 10px; flex: 1; }
  li { padding-left: 26px; position: relative; }
  li::before { content: ''; position: absolute; left: 0; top: 0.45em; width: 14px; height: 8px; border-left: 2px solid var(--teal-glow); border-bottom: 2px solid var(--teal-glow); transform: rotate(-45deg); }
</style>
```

`src/components/ReviewCard.astro`:
```astro
---
import type { Review } from '../data/reviews';
interface Props { review: Review }
const { review } = Astro.props;
---
<figure class="card review" data-spotlight>
  <div class="stars" role="img" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}</div>
  <blockquote>“{review.text}”</blockquote>
  <figcaption><strong>{review.author}</strong>{review.context && <span> · {review.context}</span>}<span class="src"> · {review.source}</span></figcaption>
</figure>
<style>
  .review { margin: 0; display: flex; flex-direction: column; gap: 14px; }
  .stars { color: #f5c451; letter-spacing: 3px; }
  blockquote { margin: 0; font: italic 500 1.15rem/1.5 var(--font-display); flex: 1; }
  figcaption { font-size: 0.9rem; color: var(--mist-dim); }
  figcaption strong { color: var(--mist); }
</style>
```

`src/components/WorkCard.astro`:
```astro
---
import { Picture } from 'astro:assets';
import type { CollectionEntry } from 'astro:content';
interface Props { entry: CollectionEntry<'work'> }
const { entry } = Astro.props;
const { title, sector, summary, image } = entry.data;
---
<a class="work card" href={`/work/${entry.id}/`} data-spotlight data-track={`work-${entry.id}`}>
  <div class="media">
    <Picture src={image} formats={['avif', 'webp']} widths={[480, 800, 1200]} sizes="(max-width: 700px) 100vw, 50vw" alt={`${title} website shown on devices`} />
  </div>
  <div class="meta">
    <span class="eyebrow">{sector}</span>
    <h3>{title}</h3>
    <p class="muted">{summary}</p>
  </div>
</a>
<style>
  .work { display: flex; flex-direction: column; gap: 20px; text-decoration: none; padding: 16px; }
  .media { border-radius: var(--radius-sm); overflow: hidden; background: radial-gradient(70% 70% at 50% 40%, rgb(62 125 110 / 0.35), rgb(255 255 255 / 0.02)); aspect-ratio: 16 / 10; display: grid; place-items: center; }
  .media :global(img) { width: 100%; height: 100%; object-fit: contain; transition: transform 0.8s var(--ease); }
  .work:hover .media :global(img) { transform: scale(1.04) translateY(-4px); }
  .meta { padding: 0 8px 8px; }
  .eyebrow { margin-bottom: 0.6rem; }
</style>
```

`src/components/Faq.astro`:
```astro
---
import type { Faq } from '../data/faqs';
interface Props { items: Faq[] }
const { items } = Astro.props;
---
<div class="faq">
  {items.map((f) => (
    <details class="card">
      <summary><h3>{f.q}</h3></summary>
      <p class="muted">{f.a}</p>
    </details>
  ))}
</div>
<style>
  .faq { display: grid; gap: 12px; }
  details { padding: 0; }
  summary { cursor: pointer; list-style: none; padding: 22px 56px 22px 24px; position: relative; }
  summary::-webkit-details-marker { display: none; }
  summary::after { content: '+'; position: absolute; right: 24px; top: 50%; transform: translateY(-50%); font-size: 1.6rem; color: var(--teal-glow); transition: transform 0.3s; }
  details[open] summary::after { transform: translateY(-50%) rotate(45deg); }
  summary h3 { margin: 0; font-size: 1.15rem; }
  details p { padding: 0 24px 22px; margin: 0; }
</style>
```

- [ ] **Step 7: Verify and commit**

Run: `npm test && npm run build` → Expected: all tests pass; build succeeds (collections sync without schema errors).

```bash
git add src/data src/content.config.ts src/content src/components tests/data.test.ts
git commit -m "feat: add packages, FAQs, locations, work collection and cards"
```

---

### Task 9: Home page

**Files:**
- Modify: `src/pages/index.astro`

**Interfaces:**
- Consumes: `Hero`, `PackageCard`, `ReviewCard`, `WorkCard`, `CtaBand`, `packages`, `reviews`, `locations`, `getCollection('work')`.

- [ ] **Step 1: Write the home page**

`src/pages/index.astro`:
```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';
import Hero from '../components/Hero.astro';
import PackageCard from '../components/PackageCard.astro';
import ReviewCard from '../components/ReviewCard.astro';
import WorkCard from '../components/WorkCard.astro';
import CtaBand from '../components/CtaBand.astro';
import { packages } from '../data/packages';
import { reviews } from '../data/reviews';
import { locations } from '../data/locations';

const work = (await getCollection('work')).sort((a, b) => a.data.order - b.data.order);
const why = [
  { n: '01', title: 'Built around your customers', text: 'Every page is planned around what your customers need to see and do, not around a template.' },
  { n: '02', title: 'Fast by default', text: 'Lightweight, modern builds that load quickly on phones and give Google what it looks for.' },
  { n: '03', title: 'One person, start to finish', text: 'You talk to the person designing and building your site. Quick answers, no hand-offs.' },
];
const steps = [
  { title: 'Chat', text: 'A free consultation call or WhatsApp chat about your business and goals.' },
  { title: 'Plan', text: 'A scheduled development plan with clear dates and a fixed price.' },
  { title: 'Build', text: 'I design and build your site, and you see progress along the way.' },
  { title: 'Launch & grow', text: 'We go live, connect Google, and keep improving with ongoing support.' },
];
---
<BaseLayout
  title="Web Design Romford & East London"
  description="Romford web designer building fast, custom websites for local businesses across East London and Essex. Clear packages from £300. Rated Excellent on Google."
>
  <Hero />

  <section class="section">
    <div class="container">
      <span class="eyebrow">Why Apex</span>
      <h2 class="narrow">A website should bring you customers, <span class="accent">not headaches.</span></h2>
      <div class="grid-3 why" data-reveal-stagger>
        {why.map((w) => (
          <article class="card" data-spotlight>
            <span class="num">{w.n}</span>
            <h3>{w.title}</h3>
            <p class="muted">{w.text}</p>
          </article>
        ))}
      </div>
    </div>
  </section>

  <section class="section work-sec">
    <div class="container">
      <div class="head">
        <div><span class="eyebrow">Selected work</span><h2>Sites that do the job</h2></div>
        <a class="btn btn-ghost" href="/work/" data-track="home-all-work">All work</a>
      </div>
      <div class="grid-2" data-reveal-stagger>{work.map((entry) => <WorkCard entry={entry} />)}</div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <span class="eyebrow">Packages</span>
      <h2>Clear prices, <span class="accent">no surprises.</span></h2>
      <p class="lead">Pick a starting point. Every package is custom-built, and you will know the price before any work begins.</p>
      <div class="grid-3 pk" data-reveal-stagger>{packages.map((p) => <PackageCard pkg={p} />)}</div>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <span class="eyebrow">How it works</span>
      <h2>From first chat to launch</h2>
      <ol class="steps" data-reveal-stagger>
        {steps.map((s, i) => (
          <li class="card"><span class="num">{String(i + 1).padStart(2, '0')}</span><h3>{s.title}</h3><p class="muted">{s.text}</p></li>
        ))}
      </ol>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <span class="eyebrow">Reviews</span>
      <h2>Rated <span class="accent">Excellent</span> on Google</h2>
      <div class="grid-3 reviews" data-reveal-stagger>{reviews.map((r) => <ReviewCard review={r} />)}</div>
    </div>
  </section>

  <section class="section">
    <div class="container grid-2 areas">
      <div data-reveal>
        <span class="eyebrow">Where I work</span>
        <h2>Romford-based, working UK-wide</h2>
        <p class="lead">Based in Romford, building for businesses across Havering, East London and Essex, with clients as far as Oxford.</p>
      </div>
      <ul class="area-list" data-reveal-stagger>
        {locations.map((l) => (
          <li><a class="card" href={`/${l.slug}/`} data-spotlight><span>{l.title}</span><span aria-hidden="true">→</span></a></li>
        ))}
      </ul>
    </div>
  </section>

  <CtaBand />
</BaseLayout>

<style>
  .narrow { max-width: 20ch; }
  .why { margin-top: 48px; }
  .num { font: 600 0.85rem/1 var(--font-body); color: var(--teal-glow); letter-spacing: 0.1em; display: block; margin-bottom: 18px; }
  .head { display: flex; justify-content: space-between; align-items: end; gap: 24px; flex-wrap: wrap; margin-bottom: 40px; }
  .work-sec { background: linear-gradient(180deg, transparent, rgb(62 125 110 / 0.07), transparent); }
  .pk, .reviews { margin-top: 40px; }
  .steps { list-style: none; padding: 0; margin: 40px 0 0; display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); }
  .areas { align-items: center; }
  .area-list { list-style: none; padding: 0; margin: 0; display: grid; gap: 12px; }
  .area-list a { display: flex; justify-content: space-between; align-items: center; padding: 22px 24px; text-decoration: none; font: 600 1.2rem/1.2 var(--font-display); }
  .area-list a:hover { border-color: rgb(95 211 181 / 0.45); }
</style>
```

- [ ] **Step 2: Verify**

Run: `npm run build` → Expected: audit passes. In `npm run dev`, check `/` on desktop and at 375px: no horizontal scroll, sections reveal on scroll, cards highlight on hover. (Links to pages from later tasks 404 for now.)

- [ ] **Step 3: Commit**

```bash
git add src/pages/index.astro
git commit -m "feat: build home page sections"
```

---

### Task 10: Services, Work and About pages

**Files:**
- Create: `src/pages/services.astro`, `src/pages/work/index.astro`, `src/pages/work/[slug].astro`, `src/pages/about.astro`

**Interfaces:**
- Consumes: `PageHero`, `PackageCard`, `Faq`, `WorkCard`, `CtaBand`, `faqJsonLd`, `breadcrumbJsonLd`, `getCollection`, `render`.

- [ ] **Step 1: Services page**

`src/pages/services.astro`:
```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import PageHero from '../components/PageHero.astro';
import PackageCard from '../components/PackageCard.astro';
import Faq from '../components/Faq.astro';
import CtaBand from '../components/CtaBand.astro';
import { packages } from '../data/packages';
import { serviceFaqs } from '../data/faqs';
import { faqJsonLd, breadcrumbJsonLd } from '../lib/seo';
const extras = [
  { title: 'Website revamps', text: 'Already have a WordPress, Wix or Squarespace site that is not working? I rebuild it properly and protect your Google rankings with redirects.' },
  { title: 'Google Business Profile', text: 'Set up and optimised so you show up on Google Maps when local customers search.' },
  { title: 'Custom systems', text: 'Booking flows, lead routing, dashboards and integrations built specifically for how your business works.' },
];
---
<BaseLayout
  title="Website Packages & Prices"
  description="Website packages from £300 for Romford, East London and Essex businesses. Standard, Premium (£500 + £15/month) and Custom builds, with clear prices up front."
  jsonLd={[faqJsonLd(serviceFaqs), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Services', path: '/services/' }])]}
>
  <PageHero eyebrow="Services" lead="Custom websites for small businesses, with prices you can see before you pick up the phone.">
    Website packages &amp; prices for Romford businesses
  </PageHero>

  <section class="container">
    <div class="grid-3" data-reveal-stagger>{packages.map((p) => <PackageCard pkg={p} />)}</div>
    <p class="muted note">Not sure which fits? <a href="/quote/?package=unsure">Ask me</a> and I will recommend one honestly, even if it is the cheapest.</p>
  </section>

  <section class="section">
    <div class="container">
      <span class="eyebrow">Also available</span>
      <h2>More than a homepage</h2>
      <div class="grid-3" data-reveal-stagger>
        {extras.map((e) => <article class="card" data-spotlight><h3>{e.title}</h3><p class="muted">{e.text}</p></article>)}
      </div>
    </div>
  </section>

  <section class="section">
    <div class="container narrow">
      <span class="eyebrow">FAQ</span>
      <h2>Questions people ask</h2>
      <Faq items={serviceFaqs} />
    </div>
  </section>

  <CtaBand />
</BaseLayout>
<style>
  .note { margin-top: 24px; }
  .note a { color: var(--teal-glow); }
  .narrow { max-width: 860px; }
</style>
```

- [ ] **Step 2: Work index and case study pages**

`src/pages/work/index.astro`:
```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import PageHero from '../../components/PageHero.astro';
import WorkCard from '../../components/WorkCard.astro';
import CtaBand from '../../components/CtaBand.astro';
import { breadcrumbJsonLd } from '../../lib/seo';
const work = (await getCollection('work')).sort((a, b) => a.data.order - b.data.order);
---
<BaseLayout
  title="Web Design Portfolio"
  description="Websites built by Apex Designs for restaurants, venues, sales funnels and professional services across East London and beyond."
  jsonLd={[breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Work', path: '/work/' }])]}
>
  <PageHero eyebrow="Work" lead="Real sites for real local businesses, each one designed around its customers.">Web design portfolio</PageHero>
  <section class="container tight">
    <div class="grid-2" data-reveal-stagger>{work.map((entry) => <WorkCard entry={entry} />)}</div>
  </section>
  <CtaBand heading="Want yours here next?" />
</BaseLayout>
<style>.tight { padding-bottom: 40px; }</style>
```

`src/pages/work/[slug].astro`:
```astro
---
import { getCollection, render, type CollectionEntry } from 'astro:content';
import { Picture } from 'astro:assets';
import BaseLayout from '../../layouts/BaseLayout.astro';
import PageHero from '../../components/PageHero.astro';
import CtaBand from '../../components/CtaBand.astro';
import { breadcrumbJsonLd } from '../../lib/seo';

export async function getStaticPaths() {
  const work = await getCollection('work');
  return work.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}
interface Props { entry: CollectionEntry<'work'> }
const { entry } = Astro.props;
const { Content } = await render(entry);
const d = entry.data;
---
<BaseLayout
  title={`${d.title}: ${d.sector} Website`}
  description={d.summary}
  jsonLd={[breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Work', path: '/work/' }, { name: d.title, path: `/work/${entry.id}/` }])]}
>
  <PageHero eyebrow={d.location ? `${d.sector} · ${d.location}` : d.sector} lead={d.summary}>{d.title}</PageHero>
  <section class="container">
    <div class="shot card" data-reveal>
      <Picture src={d.image} formats={['avif', 'webp']} widths={[800, 1200, 1800]} sizes="(max-width: 1200px) 100vw, 1200px" alt={`${d.title} website on laptop and phone`} loading="eager" />
    </div>
    <ul class="services">{d.services.map((s) => <li>{s}</li>)}</ul>
  </section>
  <section class="container section">
    <div class="prose"><Content /></div>
    <p><a class="btn btn-ghost" href="/work/">← All work</a></p>
  </section>
  <CtaBand />
</BaseLayout>
<style>
  .shot { padding: clamp(12px, 3vw, 40px); background: radial-gradient(70% 70% at 50% 40%, rgb(62 125 110 / 0.4), rgb(255 255 255 / 0.02)); }
  .services { list-style: none; padding: 0; display: flex; flex-wrap: wrap; gap: 10px; margin-top: 24px; }
  .services li { border: 1px solid var(--line); border-radius: 999px; padding: 0.45em 1em; font-size: 0.9rem; color: var(--mist-dim); }
  .prose :global(blockquote) { margin: 2em 0; padding-left: 1.2em; border-left: 3px solid var(--teal-glow); font: italic 500 1.25rem/1.5 var(--font-display); }
</style>
```

- [ ] **Step 3: About page**

`src/pages/about.astro`:
```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import PageHero from '../components/PageHero.astro';
import CtaBand from '../components/CtaBand.astro';
import { breadcrumbJsonLd } from '../lib/seo';
const values = [
  { title: 'Commitment to quality', text: 'Quality and user experience come first in every project, however small.' },
  { title: 'Passion for design', text: 'Creativity and precision in every site, so it looks like your business, not a template.' },
  { title: 'Personalised service', text: 'Apex is a one-person studio. You get one-to-one attention from the person doing the work.' },
];
---
<BaseLayout
  title="About Ibrahim, Romford Web Designer"
  description="Apex Designs is a one-person web studio in Romford run by Ibrahim, building custom websites for local businesses across East London, Essex and the UK."
  jsonLd={[breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'About', path: '/about/' }])]}
>
  <PageHero eyebrow="About" lead="Apex Designs was born out of a love for design and a desire to help businesses shine online.">
    Hi, I'm Ibrahim, a web designer in Romford
  </PageHero>
  <section class="container prose about" data-reveal>
    <p>I started Apex Designs to give small businesses the kind of website usually reserved for companies with big budgets. Each project starts with understanding your business, your audience and what you want the site to achieve. Then I design and build something that fits.</p>
    <p>Because Apex is just me, you get one-to-one attention from start to finish. You will never be passed to an account manager or wait days for a reply. My portfolio includes clients like Damal, a Somali restaurant in Whitechapel, and businesses well outside London, including Oxford.</p>
    <p>I am based in Romford and work with businesses across Havering, East London and Essex, and remotely anywhere in the UK.</p>
  </section>
  <section class="section">
    <div class="container">
      <span class="eyebrow">What I care about</span>
      <h2>How I work</h2>
      <div class="grid-3" data-reveal-stagger>{values.map((v) => <article class="card" data-spotlight><h3>{v.title}</h3><p class="muted">{v.text}</p></article>)}</div>
    </div>
  </section>
  <CtaBand heading="Let's talk about your website" />
</BaseLayout>
<style>.about { padding-bottom: 20px; }</style>
```

- [ ] **Step 4: Verify and commit**

Run: `npm run build` → Expected: audit passes for home, services, about, the work index and 4 case studies (unique titles, one H1 each). Open `/work/damal-restaurant/` in dev and confirm the mockup image loads as AVIF/WebP.

```bash
git add src/pages
git commit -m "feat: add services, work and about pages"
```

---

### Task 11: Location pages

**Files:**
- Create: `src/pages/[location].astro`

**Interfaces:**
- Consumes: `locations`, `getEntry('work', id)`, `WorkCard`, `Faq`, `CtaBand`, `faqJsonLd`, `breadcrumbJsonLd`, `packages`.

- [ ] **Step 1: Implement the route**

`src/pages/[location].astro`:
```astro
---
import { getEntry } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';
import PageHero from '../components/PageHero.astro';
import WorkCard from '../components/WorkCard.astro';
import Faq from '../components/Faq.astro';
import CtaBand from '../components/CtaBand.astro';
import { locations, type Location } from '../data/locations';
import { packages } from '../data/packages';
import { faqJsonLd, breadcrumbJsonLd } from '../lib/seo';

export function getStaticPaths() {
  return locations.map((loc) => ({ params: { location: loc.slug }, props: { loc } }));
}
interface Props { loc: Location }
const { loc } = Astro.props;
const work = (await Promise.all(loc.work.map((id) => getEntry('work', id)))).filter((e) => e !== undefined);
const others = locations.filter((l) => l.slug !== loc.slug);
---
<BaseLayout
  title={loc.title}
  description={loc.description}
  jsonLd={[faqJsonLd(loc.faqs), breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: loc.title, path: `/${loc.slug}/` }])]}
>
  <PageHero eyebrow={loc.eyebrow}>
    {loc.h1}
    <div slot="after" class="ctas">
      <a class="btn btn-primary" href="/quote/" data-track={`loc-${loc.slug}-quote`} data-magnetic>Get a free quote</a>
      <a class="btn btn-ghost" href="/services/">Packages from {packages[0].price}</a>
    </div>
  </PageHero>

  <section class="container grid-2 intro">
    <div class="prose" data-reveal>{loc.intro.map((p) => <p>{p}</p>)}</div>
    <div class="card" data-reveal>
      <h2 class="h3">Areas I cover near {loc.place}</h2>
      <ul class="chips">{loc.nearby.map((n) => <li>{n}</li>)}</ul>
    </div>
  </section>

  <section class="section">
    <div class="container">
      <div class="grid-3" data-reveal-stagger>{loc.points.map((p) => <article class="card" data-spotlight><h3>{p.title}</h3><p class="muted">{p.text}</p></article>)}</div>
    </div>
  </section>

  {work.length > 0 && (
    <section class="section">
      <div class="container">
        <span class="eyebrow">Recent work</span>
        <h2>Websites I have built</h2>
        <div class="grid-2" data-reveal-stagger>{work.map((entry) => <WorkCard entry={entry} />)}</div>
      </div>
    </section>
  )}

  <section class="section">
    <div class="container narrow">
      <h2>Web design in {loc.place}: FAQs</h2>
      <Faq items={loc.faqs} />
      <p class="muted others">Also working in: {others.map((o, i) => <>{i > 0 && ' · '}<a href={`/${o.slug}/`}>{o.title}</a></>)}</p>
    </div>
  </section>

  <CtaBand heading={`Need a website in ${loc.place}?`} />
</BaseLayout>
<style>
  .ctas { display: flex; gap: 12px; flex-wrap: wrap; margin-top: 28px; }
  .intro { align-items: start; }
  .h3 { font-size: 1.3rem; }
  .chips { list-style: none; padding: 0; margin: 0; display: flex; flex-wrap: wrap; gap: 8px; }
  .chips li { border: 1px solid var(--line); border-radius: 999px; padding: 0.4em 0.9em; font-size: 0.9rem; color: var(--mist-dim); }
  .narrow { max-width: 860px; }
  .others { margin-top: 28px; }
  .others a { color: var(--teal-glow); }
</style>
```

- [ ] **Step 2: Verify and commit**

Run: `npm run build` → Expected: `dist/web-design-romford/index.html` and the other three exist; audit passes; `dist/sitemap-0.xml` lists all four location URLs.

```bash
git add "src/pages/[location].astro"
git commit -m "feat: add data-driven location landing pages"
```

---

### Task 12: Learn blog with three articles

**Files:**
- Create: `src/pages/learn/index.astro`, `src/pages/learn/[slug].astro`, `src/content/learn/website-cost-romford-east-london.md`, `src/content/learn/wordpress-vs-custom-website.md`, `src/content/learn/google-business-profile-local-shops.md`
- Delete: `src/content/learn/.gitkeep`
- Test: `tests/learn-content.test.ts`

**Interfaces:**
- Consumes: `learn` collection, `ProseLayout`, `articleJsonLd`, `breadcrumbJsonLd`.

- [ ] **Step 1: Failing content test**

`tests/learn-content.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'src/content/learn');
const files = readdirSync(dir).filter((f) => f.endsWith('.md'));

describe('learn articles', () => {
  it('has the three starter articles', () => {
    expect(files.sort()).toEqual(['google-business-profile-local-shops.md', 'website-cost-romford-east-london.md', 'wordpress-vs-custom-website.md']);
  });
  for (const f of files) {
    const body = readFileSync(join(dir, f), 'utf8').split('---').slice(2).join('---');
    it(`${f} is substantial, links internally and has no H1`, () => {
      expect(body.split(/\s+/).filter(Boolean).length).toBeGreaterThanOrEqual(700);
      expect(body).toMatch(/\]\(\/(services|quote|web-design-[a-z-]+)\/\)/);
      expect(body).not.toMatch(/^# /m);
    });
  }
});
```

Run: `npx vitest run tests/learn-content.test.ts` → Expected: FAIL (no articles).

- [ ] **Step 2: Write the three articles**

Rules for all three: first person as Ibrahim, plain English, UK spelling, 800–1,200 words, only `##` and `###` headings (the layout renders the H1). Every Apex price must match `src/data/packages.ts`. Market prices are given as typical ranges, never as claims about named competitors. No invented statistics or client results.

`src/content/learn/website-cost-romford-east-london.md`, frontmatter:
```md
---
title: How Much Does a Website Cost in Romford & East London? (2026 Guide)
description: What small businesses in Romford and East London typically pay for a website in 2026, what drives the price, and how to avoid paying for things you don't need.
published: 2026-10-27
tags: [pricing, small business, romford, east london]
---
```
Sections, in order:
- `## The short answer`: typical UK ranges in 2026: DIY builders (around £10–£40 a month), freelancers (roughly £300–£3,000), agencies (roughly £3,000–£15,000+). Then Apex's own prices: Standard £300, Premium £500 + £15/month, Custom on quote.
- `## What actually drives the price`, with `###` subsections: number of pages; custom design vs template; copywriting and photos; features (bookings, shop, integrations); SEO and Google Business Profile; ongoing support.
- `## One-off cost vs monthly cost`: hosting, domain, email, maintenance; what Premium's £15/month covers.
- `## Red flags when comparing quotes`: you don't own the site or domain; no plan or dates; locked-in contracts; "guaranteed #1 on Google".
- `## What I'd recommend for most local businesses`: start with a Standard single-page site, move to Premium when you want to be found on Google.
- `## Get a price for your business`: link to [get a quote](/quote/), [packages](/services/) and [web design in Romford](/web-design-romford/).

`src/content/learn/wordpress-vs-custom-website.md`, frontmatter:
```md
---
title: WordPress vs a Custom-Coded Website for Small Businesses
description: Plugins, page builders and updates, or a lean custom build? An honest comparison of WordPress and custom-coded websites for small UK businesses.
published: 2026-10-27
tags: [wordpress, performance, small business]
---
```
Sections, in order:
- `## Why this question comes up`: many local sites are WordPress plus a page builder plus a stack of plugins.
- `## Where WordPress is great`: huge ecosystem, editing content yourself, blogging.
- `## Where it hurts small businesses`: plugin and security updates, page-builder bloat slowing mobile load times, hosting costs, things breaking after updates.
- `## What "custom-coded" means`: hand-built static pages, nothing to patch, very fast, cheap hosting. Trade-off: content edits go through your developer (covered by support).
- `## Speed, Google and Core Web Vitals`: why page speed affects rankings and enquiries, in plain English.
- `## Which should you choose?`: a markdown table of needs → recommendation.
- `## Moving from WordPress without losing rankings`: keep URLs or add redirects, keep content, resubmit the sitemap. Link to [packages](/services/) and [get a quote](/quote/).

`src/content/learn/google-business-profile-local-shops.md`, frontmatter:
```md
---
title: "Google Business Profile for Local Shops: A Step-by-Step Setup Guide"
description: How local shops and trades in Romford, East London and Essex can set up and optimise a Google Business Profile to show up on Google Maps.
published: 2026-10-27
tags: [google business profile, local seo, google maps]
---
```
Sections, in order:
- `## Why it matters more than you think`: map results appear above normal results for "near me" searches.
- `## Setting it up`: numbered steps: sign in, add the business, choose the primary category carefully, address or service area, verification, hours, phone, website link.
- `## Optimising your profile`, with `###` subsections: photos; services and products; description; posts; Q&A.
- `## Reviews: getting more and replying well`: ask at the right moment, use a short review link, reply to every review.
- `## Connecting it to your website`: consistent name, address and phone; location pages; linking back to the site.
- `## Common mistakes`: keyword-stuffing the name, wrong category, PO boxes, duplicate listings.
- `## Want it done for you?`: Premium includes Google Business Profile setup. Link to [packages](/services/), [web design in East London](/web-design-east-london/) and [get a quote](/quote/).

Delete `src/content/learn/.gitkeep`.

Run: `npx vitest run tests/learn-content.test.ts` → Expected: PASS.

- [ ] **Step 3: Learn index and article route**

`src/pages/learn/index.astro`:
```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import PageHero from '../../components/PageHero.astro';
import { breadcrumbJsonLd } from '../../lib/seo';
const posts = (await getCollection('learn')).sort((a, b) => b.data.published.getTime() - a.data.published.getTime());
const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
---
<BaseLayout
  title="Learn: Website Advice for Small Businesses"
  description="Plain-English guides on website costs, WordPress, Google Business Profile and getting found online, for small businesses in Romford, East London and Essex."
  jsonLd={[breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Learn', path: '/learn/' }])]}
>
  <PageHero eyebrow="Learn" lead="Straight answers to the questions small business owners ask me most.">Website advice for small businesses</PageHero>
  <section class="container list">
    {posts.map((p) => (
      <a class="card post" href={`/learn/${p.id}/`} data-spotlight data-reveal>
        <time datetime={p.data.published.toISOString()}>{fmt.format(p.data.published)}</time>
        <h2>{p.data.title}</h2>
        <p class="muted">{p.data.description}</p>
        <span class="more">Read guide →</span>
      </a>
    ))}
  </section>
</BaseLayout>
<style>
  .list { display: grid; gap: 16px; padding-bottom: clamp(72px, 10vw, 140px); }
  .post { text-decoration: none; display: block; }
  .post h2 { font-size: clamp(1.4rem, 2.6vw, 2rem); margin: 10px 0; }
  time { font-size: 0.85rem; color: var(--teal-glow); }
  .more { font-weight: 600; color: var(--teal-glow); }
</style>
```

`src/pages/learn/[slug].astro`:
```astro
---
import { getCollection, render, type CollectionEntry } from 'astro:content';
import ProseLayout from '../../layouts/ProseLayout.astro';
import { articleJsonLd, breadcrumbJsonLd } from '../../lib/seo';

export async function getStaticPaths() {
  const posts = await getCollection('learn');
  return posts.map((entry) => ({ params: { slug: entry.id }, props: { entry } }));
}
interface Props { entry: CollectionEntry<'learn'> }
const { entry } = Astro.props;
const { Content } = await render(entry);
const d = entry.data;
const path = `/learn/${entry.id}/`;
const fmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
---
<ProseLayout
  title={d.title}
  description={d.description}
  heading={d.title}
  eyebrow={`Learn · ${fmt.format(d.published)}`}
  lead={d.description}
  type="article"
  jsonLd={[
    articleJsonLd({ title: d.title, description: d.description, path, published: d.published, updated: d.updated }),
    breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Learn', path: '/learn/' }, { name: d.title, path }]),
  ]}
>
  <Content />
  <p class="byline">Written by Ibrahim, founder of Apex Designs in Romford. <a href="/quote/">Get a free quote</a>.</p>
</ProseLayout>
<style>
  .byline { margin-top: 3em; padding-top: 1.5em; border-top: 1px solid var(--line); color: var(--mist-dim); }
</style>
```

- [ ] **Step 4: Verify and commit**

Run: `npm test && npm run build` → Expected: all pass; three article pages built; audit passes.

```bash
git add src/pages/learn src/content/learn tests/learn-content.test.ts
git commit -m "feat: add Learn blog with three starter articles"
```

---

### Task 13: Supabase schema, RLS and retention

**Files:**
- Create: `supabase/migrations/20261027000000_crm.sql`, `supabase/migrations/20261027000100_retention.sql`, `supabase/tests/rls_test.sql`

**Interfaces:**
- Produces: tables `links`, `visitors`, `events`, `leads`, `admins`; view `link_stats(id, slug, label, channel, destination, created_at, landings, visitors, leads)`; function `is_admin(): boolean`. Column names here are what Tasks 14, 15 and 17 read and write.

- [ ] **Step 1: CRM migration**

`supabase/migrations/20261027000000_crm.sql`:
```sql
-- Apex Designs mini-CRM: schema, row level security, dashboard view.
create extension if not exists pgcrypto;

create table public.links (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  label text not null check (char_length(label) between 1 and 120),
  channel text not null default 'whatsapp' check (channel in ('whatsapp', 'instagram', 'facebook', 'email', 'print', 'other')),
  destination text not null default '/' check (destination ~ '^/[^\s]*$' and char_length(destination) <= 200),
  created_at timestamptz not null default now()
);

create table public.visitors (
  id uuid primary key,
  first_seen timestamptz not null default now(),
  first_ref text check (first_ref is null or first_ref ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  first_utm jsonb check (first_utm is null or pg_column_size(first_utm) <= 1024),
  user_agent text check (user_agent is null or char_length(user_agent) <= 400)
);

create table public.events (
  id bigint generated always as identity primary key,
  visitor_id uuid,
  session_id uuid,
  type text not null check (type in ('page_view', 'ref_landing', 'cta_click', 'whatsapp_click', 'scroll_depth', 'form_start', 'form_submit')),
  path text not null check (char_length(path) between 1 and 300),
  ref text check (ref is null or ref ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  props jsonb check (props is null or pg_column_size(props) <= 2048),
  created_at timestamptz not null default now()
);
create index events_visitor_idx on public.events (visitor_id, created_at);
create index events_ref_idx on public.events (ref) where ref is not null;
create index events_created_idx on public.events (created_at);

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  visitor_id uuid,
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) between 3 and 200),
  phone text check (phone is null or char_length(phone) <= 30),
  business text check (business is null or char_length(business) <= 120),
  package text check (package is null or package in ('standard', 'premium', 'custom', 'unsure')),
  message text not null check (char_length(message) between 1 and 2000),
  ref text check (ref is null or ref ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  first_ref text check (first_ref is null or first_ref ~ '^[a-z0-9][a-z0-9_-]{0,63}$'),
  status text not null default 'new' check (status in ('new', 'warm', 'quoted', 'won', 'lost')),
  notes text check (notes is null or char_length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index leads_created_idx on public.leads (created_at desc);

create table public.admins (
  email text primary key check (email = lower(email))
);

create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end $$;
create trigger leads_touch before update on public.leads
  for each row execute function public.touch_updated_at();

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.admins
    where email = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.links enable row level security;
alter table public.visitors enable row level security;
alter table public.events enable row level security;
alter table public.leads enable row level security;
alter table public.admins enable row level security;

-- Public site (anon): insert-only on events and visitors. Nothing else, ever.
revoke all on public.links, public.visitors, public.events, public.leads, public.admins from anon;
grant insert on public.events, public.visitors to anon;
create policy events_anon_insert on public.events for insert to anon with check (true);
create policy visitors_anon_insert on public.visitors for insert to anon with check (true);

-- Signed-in users: full access only if their email is in admins.
grant select, insert, update, delete on public.links, public.visitors, public.events, public.leads to authenticated;
grant select on public.admins to authenticated;
create policy links_admin on public.links for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy visitors_admin on public.visitors for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy events_admin on public.events for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy leads_admin on public.leads for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy admins_admin_read on public.admins for select to authenticated using (public.is_admin());

-- Dashboard view; security_invoker makes the caller's RLS apply.
create view public.link_stats with (security_invoker = true) as
select
  l.id, l.slug, l.label, l.channel, l.destination, l.created_at,
  coalesce(e.landings, 0)::int as landings,
  coalesce(e.visitors, 0)::int as visitors,
  coalesce(ld.leads, 0)::int as leads
from public.links l
left join (
  select ref, count(*) as landings, count(distinct visitor_id) as visitors
  from public.events where type = 'ref_landing' group by ref
) e on e.ref = l.slug
left join (
  select coalesce(first_ref, ref) as r, count(*) as leads
  from public.leads group by 1
) ld on ld.r = l.slug;

revoke all on public.link_stats from anon;
grant select on public.link_stats to authenticated;
```

- [ ] **Step 2: Retention migration**

`supabase/migrations/20261027000100_retention.sql`:
```sql
-- Enforces the retention periods stated in the privacy policy. Runs daily at 03:15 UTC.
-- (Equivalent to enabling Cron under Dashboard → Integrations.)
create extension if not exists pg_cron with schema pg_catalog;
grant usage on schema cron to postgres;

select cron.schedule('apex-retention', '15 3 * * *', $$
  delete from public.events where created_at < now() - interval '13 months';
  delete from public.visitors v
    where v.first_seen < now() - interval '13 months'
      and not exists (select 1 from public.leads l where l.visitor_id = v.id);
  delete from public.leads where updated_at < now() - interval '24 months';
$$);
```

- [ ] **Step 3: RLS test script**

`supabase/tests/rls_test.sql`:
```sql
-- Run in the Supabase SQL editor (as postgres). Everything is rolled back.
-- Success: the final notice "RLS OK" and no FAIL exception.
begin;

insert into public.leads (name, email, message) values ('Test Lead', 'lead@example.com', 'Hello there, testing');
insert into public.admins (email) values ('admin@example.com');

-- 1. anon: cannot read anything; can insert valid events only.
set local role anon;
do $$
begin
  begin perform * from public.leads; raise exception 'FAIL: anon can read leads'; exception when insufficient_privilege then null; end;
  begin perform * from public.events; raise exception 'FAIL: anon can read events'; exception when insufficient_privilege then null; end;
  begin perform * from public.visitors; raise exception 'FAIL: anon can read visitors'; exception when insufficient_privilege then null; end;
  begin perform * from public.links; raise exception 'FAIL: anon can read links'; exception when insufficient_privilege then null; end;
  begin perform * from public.admins; raise exception 'FAIL: anon can read admins'; exception when insufficient_privilege then null; end;
  begin perform * from public.link_stats; raise exception 'FAIL: anon can read link_stats'; exception when insufficient_privilege then null; end;
  begin
    insert into public.leads (name, email, message) values ('x', 'x@x.com', 'xxxxxxxxxxxx');
    raise exception 'FAIL: anon can insert leads';
  exception when insufficient_privilege then null; end;
  insert into public.events (type, path, ref) values ('ref_landing', '/', 'romford-traders');
  begin insert into public.events (type, path) values ('evil', '/'); raise exception 'FAIL: bad event type accepted'; exception when check_violation then null; end;
  begin insert into public.events (type, path, ref) values ('ref_landing', '/', '<script>'); raise exception 'FAIL: bad ref accepted'; exception when check_violation then null; end;
end $$;
reset role;

-- 2. signed-in non-admin sees nothing.
set local role authenticated;
select set_config('request.jwt.claims', '{"email":"stranger@example.com","role":"authenticated"}', true);
do $$
begin
  if public.is_admin() then raise exception 'FAIL: stranger is admin'; end if;
  if (select count(*) from public.leads) <> 0 then raise exception 'FAIL: non-admin can read leads'; end if;
  if (select count(*) from public.events) <> 0 then raise exception 'FAIL: non-admin can read events'; end if;
end $$;
reset role;

-- 3. admin can read and update.
set local role authenticated;
select set_config('request.jwt.claims', '{"email":"Admin@Example.com","role":"authenticated"}', true);
do $$
begin
  if not public.is_admin() then raise exception 'FAIL: admin not recognised (email case)'; end if;
  if (select count(*) from public.leads where email = 'lead@example.com') <> 1 then raise exception 'FAIL: admin cannot read leads'; end if;
  if (select count(*) from public.events where ref = 'romford-traders') < 1 then raise exception 'FAIL: admin cannot read events'; end if;
  update public.leads set status = 'warm' where email = 'lead@example.com';
  if (select status from public.leads where email = 'lead@example.com') <> 'warm' then raise exception 'FAIL: admin cannot update leads'; end if;
end $$;
reset role;

do $$ begin raise notice 'RLS OK'; end $$;
rollback;
```

- [ ] **Step 4: Verify the SQL**

If Docker is running: `npx supabase@latest init` (accept defaults; keep the generated `supabase/config.toml`), `npx supabase@latest start`, `npx supabase@latest db reset`, then `psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 -f supabase/tests/rls_test.sql` → Expected: `NOTICE: RLS OK`, exit code 0. Run `npx supabase@latest stop` afterwards.

If Docker isn't available, mark this step as pending and run `rls_test.sql` in the SQL editor once the Supabase project exists (Task 18). Do not claim RLS is verified until it has run.

- [ ] **Step 5: Commit**

```bash
git add supabase
git commit -m "feat: add CRM schema, row level security, retention job and RLS test"
```

---

### Task 14: Consent-aware tracker

**Files:**
- Create: `supabase/functions/_shared/ref.ts`, `src/lib/storage.ts`, `src/lib/consent.ts`, `src/lib/tracker.ts`, `src/scripts/analytics.ts`
- Modify: `src/layouts/BaseLayout.astro` (load analytics)
- Test: `tests/ref.test.ts`, `tests/tracker.test.ts`

**Interfaces:**
- Produces:
  - `REF_PATTERN: RegExp`, `sanitizeRef(raw: unknown): string | null`.
  - `SafeStorage { get(k: string): string | null; set(k: string, v: string): void; remove(k: string): void }`, `safeStorage(getStore: () => Storage | null | undefined): SafeStorage`, `memoryStorage(): SafeStorage`.
  - `Consent = 'granted' | 'denied' | null`, `CONSENT_KEY = 'apex-consent'`, `readConsent(s: SafeStorage): Consent`, `writeConsent(s: SafeStorage, c: 'granted' | 'denied'): void`.
  - `EVENT_TYPES`, `EventType`, `KEYS = { visitor: 'apex-vid', firstRef: 'apex-first-ref', session: 'apex-sid', ref: 'apex-ref' }`, `parseAttribution(search: string): { ref: string | null; utm: Record<string, string> }`, `LeadContext { ref: string | null; first_ref: string | null; visitor_id: string | null }`, `TrackerDeps`, `Tracker { enabled; init(); track(type, props?); flush(): Promise<void>; onConsentChange(c: 'granted' | 'denied'); leadContext(): LeadContext }`, `createTracker(d: TrackerDeps): Tracker`.
  - `src/scripts/analytics.ts` exports the page singleton `tracker: Tracker` (used by Task 15).
- Contract: callers `writeConsent()` first, then call `tracker.onConsentChange()`.

- [ ] **Step 1: Failing ref tests**

`tests/ref.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { sanitizeRef, REF_PATTERN } from '../supabase/functions/_shared/ref.ts';

describe('sanitizeRef', () => {
  it('normalises human labels to slugs', () => {
    expect(sanitizeRef('Romford Traders!')).toBe('romford-traders');
    expect(sanitizeRef('  WA_Group-2 ')).toBe('wa_group-2');
  });
  it('neutralises HTML', () => {
    const s = sanitizeRef('<script>alert(1)</script>');
    expect(s).toBe('script-alert-1-script');
    expect(s).toMatch(REF_PATTERN);
  });
  it('drops values with nothing usable', () => {
    expect(sanitizeRef('🔥🔥')).toBeNull();
    expect(sanitizeRef('---')).toBeNull();
    expect(sanitizeRef('')).toBeNull();
    expect(sanitizeRef(null)).toBeNull();
    expect(sanitizeRef(42)).toBeNull();
  });
  it('truncates long values to 64 chars', () => {
    const s = sanitizeRef('a'.repeat(500));
    expect(s).toHaveLength(64);
    expect(s).toMatch(REF_PATTERN);
  });
});
```

Run: `npx vitest run tests/ref.test.ts` → Expected: FAIL (module missing).

- [ ] **Step 2: Implement ref.ts**

`supabase/functions/_shared/ref.ts`:
```ts
// Shared by the website (Vite) and the Edge Function (Deno). No imports allowed.
export const REF_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export function sanitizeRef(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const s = raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^[-_]+/, '')
    .slice(0, 64)
    .replace(/[-_]+$/, '');
  return REF_PATTERN.test(s) ? s : null;
}
```

Run: `npx vitest run tests/ref.test.ts` → Expected: PASS.

- [ ] **Step 3: Failing tracker tests**

`tests/tracker.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { createTracker, parseAttribution, KEYS, type TrackerDeps } from '../src/lib/tracker';
import { memoryStorage, safeStorage, type SafeStorage } from '../src/lib/storage';
import { writeConsent } from '../src/lib/consent';

type Call = { url: string; headers: Record<string, string>; body: any };

function setup(over: Partial<TrackerDeps> = {}, consent?: 'granted' | 'denied', storage?: { local: SafeStorage; session: SafeStorage }) {
  const local = storage?.local ?? memoryStorage();
  const session = storage?.session ?? memoryStorage();
  if (consent) writeConsent(local, consent);
  const calls: Call[] = [];
  const fetchFn = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), headers: init?.headers as Record<string, string>, body: JSON.parse(String(init?.body)) });
    return new Response(null, { status: 201 });
  });
  let n = 0;
  const deps: TrackerDeps = {
    supabaseUrl: 'https://x.supabase.co',
    supabaseKey: 'sb_publishable_test',
    fetch: fetchFn as unknown as typeof fetch,
    local,
    session,
    location: { pathname: '/', search: '' },
    userAgent: 'test-agent',
    uuid: () => `00000000-0000-4000-8000-${String(++n).padStart(12, '0')}`,
    flushDelayMs: 60_000,
    ...over,
  };
  return { tracker: createTracker(deps), calls, fetchFn, local, session };
}
const events = (calls: Call[]) => calls.filter((c) => c.url.endsWith('/rest/v1/events')).flatMap((c) => c.body);
const visitors = (calls: Call[]) => calls.filter((c) => c.url.endsWith('/rest/v1/visitors')).map((c) => c.body);

describe('parseAttribution', () => {
  it('sanitises ref and keeps utm params', () => {
    expect(parseAttribution('?ref=Romford%20Traders!&utm_source=whatsapp&x=1')).toEqual({ ref: 'romford-traders', utm: { utm_source: 'whatsapp' } });
  });
});

describe('tracker', () => {
  it('does nothing over the network when Supabase is not configured', async () => {
    const { tracker, fetchFn } = setup({ supabaseUrl: undefined, location: { pathname: '/', search: '?ref=abc' } });
    tracker.init();
    await tracker.flush();
    expect(fetchFn).not.toHaveBeenCalled();
    expect(tracker.leadContext().ref).toBe('abc');
  });

  it('without consent sends one anonymous ref_landing and stores nothing', async () => {
    const { tracker, calls, local, session } = setup({ location: { pathname: '/services/', search: '?ref=romford-traders' } });
    tracker.init();
    tracker.track('cta_click', { id: 'x' });
    await tracker.flush();
    expect(events(calls)).toEqual([{ type: 'ref_landing', path: '/services/', ref: 'romford-traders', visitor_id: null, session_id: null, props: null }]);
    expect(visitors(calls)).toEqual([]);
    expect(session.get(KEYS.ref)).toBeNull();
    expect(local.get(KEYS.visitor)).toBeNull();
  });

  it('without consent and without ref sends nothing', async () => {
    const { tracker, fetchFn } = setup();
    tracker.init();
    await tracker.flush();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('with consent creates a visitor and records the journey', async () => {
    const { tracker, calls, local } = setup({ location: { pathname: '/', search: '?ref=wa-group&utm_medium=social' } }, 'granted');
    tracker.init();
    tracker.track('cta_click', { id: 'hero-quote' });
    await tracker.flush();
    expect(visitors(calls)).toEqual([{ id: '00000000-0000-4000-8000-000000000001', first_ref: 'wa-group', first_utm: { utm_medium: 'social' }, user_agent: 'test-agent' }]);
    const ev = events(calls);
    expect(ev.map((e: any) => e.type)).toEqual(['ref_landing', 'page_view', 'cta_click']);
    expect(ev.every((e: any) => e.visitor_id === '00000000-0000-4000-8000-000000000001' && e.session_id)).toBe(true);
    expect(local.get(KEYS.firstRef)).toBe('wa-group');
  });

  it('does not double-count a landing already recorded this session', async () => {
    const session = memoryStorage();
    session.set(KEYS.ref, 'wa-group');
    const { tracker, calls } = setup({ location: { pathname: '/', search: '?ref=wa-group' } }, 'granted', { local: memoryStorage(), session });
    tracker.init();
    await tracker.flush();
    expect(events(calls).map((e: any) => e.type)).toEqual(['page_view']);
  });

  it('starts tracking after consent is granted and stops after it is withdrawn', async () => {
    const { tracker, calls, local } = setup({ location: { pathname: '/', search: '?ref=abc' } });
    tracker.init();
    tracker.track('cta_click');
    writeConsent(local, 'granted');
    tracker.onConsentChange('granted');
    tracker.track('cta_click', { id: 'after' });
    await tracker.flush();
    expect(events(calls).map((e: any) => e.type)).toEqual(['ref_landing', 'page_view', 'cta_click']);
    expect(tracker.leadContext().visitor_id).not.toBeNull();

    writeConsent(local, 'denied');
    tracker.onConsentChange('denied');
    expect(local.get(KEYS.visitor)).toBeNull();
    expect(tracker.leadContext().visitor_id).toBeNull();
  });

  it('survives storage that throws (Review Focus 1)', async () => {
    const broken = safeStorage(() => { throw new Error('SecurityError'); });
    const { tracker, calls } = setup({ location: { pathname: '/', search: '?ref=abc' } }, undefined, { local: broken, session: broken });
    expect(() => tracker.init()).not.toThrow();
    expect(() => tracker.track('page_view')).not.toThrow();
    expect(tracker.leadContext()).toEqual({ ref: 'abc', first_ref: null, visitor_id: null });
    await tracker.flush();
    expect(events(calls).map((e: any) => e.type)).toEqual(['ref_landing']);
  });

  it('never throws when the network fails', async () => {
    const { tracker } = setup({ fetch: vi.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch, location: { pathname: '/', search: '?ref=abc' } });
    tracker.init();
    await expect(tracker.flush()).resolves.toBeUndefined();
  });

  it('sends Authorization only for legacy JWT keys', async () => {
    const a = setup({ location: { pathname: '/', search: '?ref=abc' } });
    a.tracker.init();
    await a.tracker.flush();
    expect(a.calls[0].headers.apikey).toBe('sb_publishable_test');
    expect(a.calls[0].headers.Authorization).toBeUndefined();

    const b = setup({ supabaseKey: 'eyJhbGciOi.test', location: { pathname: '/', search: '?ref=abc' } });
    b.tracker.init();
    await b.tracker.flush();
    expect(b.calls[0].headers.Authorization).toBe('Bearer eyJhbGciOi.test');
  });
});
```

Run: `npx vitest run tests/tracker.test.ts` → Expected: FAIL (modules missing).

- [ ] **Step 4: Implement storage.ts and consent.ts**

`src/lib/storage.ts`:
```ts
export interface SafeStorage {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

/** Wraps Web Storage so blocked or throwing storage (private mode, in-app browsers) never breaks the page. */
export function safeStorage(getStore: () => Storage | null | undefined): SafeStorage {
  const store = (): Storage | null => {
    try { return getStore() ?? null; } catch { return null; }
  };
  return {
    get: (k) => { try { return store()?.getItem(k) ?? null; } catch { return null; } },
    set: (k, v) => { try { store()?.setItem(k, v); } catch { /* storage unavailable */ } },
    remove: (k) => { try { store()?.removeItem(k); } catch { /* storage unavailable */ } },
  };
}

export function memoryStorage(): SafeStorage {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => { m.set(k, v); }, remove: (k) => { m.delete(k); } };
}
```

`src/lib/consent.ts`:
```ts
import type { SafeStorage } from './storage';

export type Consent = 'granted' | 'denied' | null;
export const CONSENT_KEY = 'apex-consent';

export function readConsent(s: SafeStorage): Consent {
  const v = s.get(CONSENT_KEY);
  return v === 'granted' || v === 'denied' ? v : null;
}

export function writeConsent(s: SafeStorage, c: 'granted' | 'denied'): void {
  s.set(CONSENT_KEY, c);
}
```

- [ ] **Step 5: Implement tracker.ts**

`src/lib/tracker.ts`:
```ts
import { sanitizeRef } from '../../supabase/functions/_shared/ref.ts';
import { readConsent } from './consent';
import type { SafeStorage } from './storage';

export const EVENT_TYPES = ['page_view', 'ref_landing', 'cta_click', 'whatsapp_click', 'scroll_depth', 'form_start', 'form_submit'] as const;
export type EventType = (typeof EVENT_TYPES)[number];
export const KEYS = { visitor: 'apex-vid', firstRef: 'apex-first-ref', session: 'apex-sid', ref: 'apex-ref' } as const;
const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

export interface Attribution { ref: string | null; utm: Record<string, string> }
export interface LeadContext { ref: string | null; first_ref: string | null; visitor_id: string | null }
interface EventRow {
  type: EventType;
  path: string;
  ref: string | null;
  visitor_id: string | null;
  session_id: string | null;
  props: Record<string, unknown> | null;
}

export interface TrackerDeps {
  supabaseUrl?: string;
  supabaseKey?: string;
  fetch: typeof fetch;
  local: SafeStorage;
  session: SafeStorage;
  location: { pathname: string; search: string };
  userAgent: string;
  uuid: () => string;
  flushDelayMs?: number;
}

export interface Tracker {
  readonly enabled: boolean;
  init(): void;
  track(type: EventType, props?: Record<string, unknown>): void;
  flush(): Promise<void>;
  onConsentChange(c: 'granted' | 'denied'): void;
  leadContext(): LeadContext;
}

export function parseAttribution(search: string): Attribution {
  const p = new URLSearchParams(search);
  const utm: Record<string, string> = {};
  for (const k of UTM_KEYS) {
    const v = p.get(k);
    if (v) utm[k] = v.slice(0, 100);
  }
  return { ref: sanitizeRef(p.get('ref')), utm };
}

export function createTracker(d: TrackerDeps): Tracker {
  const enabled = Boolean(d.supabaseUrl && d.supabaseKey);
  const delay = d.flushDelayMs ?? 1500;
  let queue: EventRow[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let attribution: Attribution = { ref: null, utm: {} };
  let currentRef: string | null = null; // in memory only, unless consented

  const consented = () => readConsent(d.local) === 'granted';
  const path = () => d.location.pathname.slice(0, 300) || '/';

  const headers = (): Record<string, string> => {
    const key = d.supabaseKey as string;
    const h: Record<string, string> = { 'Content-Type': 'application/json', apikey: key, Prefer: 'return=minimal' };
    if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`; // legacy anon JWT keys
    return h;
  };

  async function post(table: 'events' | 'visitors', body: unknown): Promise<void> {
    try {
      await d.fetch(`${d.supabaseUrl}/rest/v1/${table}`, { method: 'POST', keepalive: true, headers: headers(), body: JSON.stringify(body) });
    } catch {
      // Tracking must never break the page.
    }
  }

  function ids(): { visitor_id: string | null; session_id: string | null } {
    if (!consented()) return { visitor_id: null, session_id: null };
    let sid = d.session.get(KEYS.session);
    if (!sid) { sid = d.uuid(); d.session.set(KEYS.session, sid); }
    return { visitor_id: d.local.get(KEYS.visitor), session_id: sid };
  }

  function ensureVisitor(): void {
    if (!consented() || d.local.get(KEYS.visitor)) return;
    const id = d.uuid();
    d.local.set(KEYS.visitor, id);
    if (currentRef) d.local.set(KEYS.firstRef, currentRef);
    if (enabled) {
      const utm = Object.keys(attribution.utm).length ? attribution.utm : null;
      void post('visitors', { id, first_ref: currentRef, first_utm: utm, user_agent: d.userAgent.slice(0, 400) });
    }
  }

  function enqueue(row: EventRow): void {
    if (!enabled) return;
    queue.push(row);
    if (!timer) timer = setTimeout(() => { void flush(); }, delay);
  }

  async function flush(): Promise<void> {
    if (timer) { clearTimeout(timer); timer = null; }
    if (!queue.length) return;
    const batch = queue;
    queue = [];
    await post('events', batch);
  }

  function track(type: EventType, props?: Record<string, unknown>): void {
    if (!enabled || !consented()) return;
    enqueue({ type, path: path(), ref: null, ...ids(), props: props ?? null });
  }

  function init(): void {
    attribution = parseAttribution(d.location.search);
    const stored = consented() ? d.session.get(KEYS.ref) : null;
    const isNewLanding = attribution.ref !== null && attribution.ref !== stored;
    currentRef = attribution.ref ?? stored;
    if (consented() && attribution.ref) d.session.set(KEYS.ref, attribution.ref);
    ensureVisitor();
    if (isNewLanding) {
      const props = Object.keys(attribution.utm).length ? { utm: attribution.utm } : null;
      enqueue({ type: 'ref_landing', path: path(), ref: attribution.ref, ...ids(), props });
    }
    track('page_view');
  }

  function onConsentChange(c: 'granted' | 'denied'): void {
    if (c === 'granted') {
      if (currentRef) d.session.set(KEYS.ref, currentRef);
      ensureVisitor();
      track('page_view');
      return;
    }
    d.local.remove(KEYS.visitor);
    d.local.remove(KEYS.firstRef);
    d.session.remove(KEYS.session);
    d.session.remove(KEYS.ref);
    queue = queue.filter((r) => r.visitor_id === null && r.session_id === null);
  }

  function leadContext(): LeadContext {
    const ok = consented();
    return { ref: currentRef, first_ref: ok ? d.local.get(KEYS.firstRef) : null, visitor_id: ok ? d.local.get(KEYS.visitor) : null };
  }

  return { enabled, init, track, flush, onConsentChange, leadContext };
}
```

Run: `npx vitest run tests/tracker.test.ts tests/ref.test.ts` → Expected: PASS.

- [ ] **Step 6: Browser wiring**

`src/scripts/analytics.ts`:
```ts
import { createTracker } from '../lib/tracker';
import { safeStorage } from '../lib/storage';
import { readConsent, writeConsent } from '../lib/consent';
import { whatsappUrl } from '../lib/whatsapp';
import { site } from '../config/site';

const local = safeStorage(() => window.localStorage);
const session = safeStorage(() => window.sessionStorage);

const uuid = (): string =>
  typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
      });

export const tracker = createTracker({
  supabaseUrl: import.meta.env.PUBLIC_SUPABASE_URL,
  supabaseKey: import.meta.env.PUBLIC_SUPABASE_ANON_KEY,
  fetch: (input, init) => fetch(input, init),
  local,
  session,
  location: window.location,
  userAgent: navigator.userAgent,
  uuid,
});

tracker.init();

// Consent banner
const banner = document.getElementById('consent-banner');
const showBanner = (show: boolean) => { if (banner) banner.hidden = !show; };
if (readConsent(local) === null) showBanner(true);

document.addEventListener('click', (e) => {
  const target = e.target instanceof Element ? e.target : null;
  if (!target) return;
  const choice = target.closest<HTMLElement>('[data-consent]')?.dataset.consent;
  if (choice === 'granted' || choice === 'denied') {
    writeConsent(local, choice);
    tracker.onConsentChange(choice);
    showBanner(false);
    return;
  }
  if (target.closest('[data-consent-open]')) { showBanner(true); return; }
  const wa = target.closest<HTMLElement>('a[data-wa]');
  if (wa) { tracker.track('whatsapp_click', { from: wa.dataset.track ?? null }); return; }
  const cta = target.closest<HTMLElement>('[data-track]');
  if (cta) tracker.track('cta_click', { id: cta.dataset.track });
});

// Tell Ibrahim which link someone came from when they open WhatsApp.
const ref = tracker.leadContext().ref;
if (ref) {
  const text = `Hi Ibrahim, I found Apex Designs via ${ref}. I'd like to chat about a website.`;
  document.querySelectorAll<HTMLAnchorElement>('a[data-wa]').forEach((a) => { a.href = whatsappUrl(site.whatsapp, text); });
}

// Scroll depth
const marks = [25, 50, 75, 100];
const hit = new Set<number>();
let ticking = false;
window.addEventListener('scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max <= 0 ? 100 : (window.scrollY / max) * 100;
    for (const m of marks) if (pct >= m - 1 && !hit.has(m)) { hit.add(m); tracker.track('scroll_depth', { depth: m }); }
  });
}, { passive: true });

window.addEventListener('pagehide', () => { void tracker.flush(); });
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') void tracker.flush(); });
```

In `src/layouts/BaseLayout.astro`, extend the existing script before `</body>`:
```astro
    <script>
      import '../scripts/analytics';
      import { initMotion } from '../scripts/motion';
      initMotion();
    </script>
```

- [ ] **Step 7: Verify in the browser**

Run: `npm run build` → Expected: success. In `npm run dev` (no `.env` yet): the banner appears on first visit; "No thanks" hides it and it stays hidden on reload; footer "Cookie settings" reopens it. In DevTools → Application, storage contains only `apex-consent`. Console has no errors. Visit `/?ref=test` with consent denied: sessionStorage stays empty and the WhatsApp button link text includes "via test".

- [ ] **Step 8: Commit**

```bash
git add supabase/functions/_shared/ref.ts src/lib/storage.ts src/lib/consent.ts src/lib/tracker.ts src/scripts/analytics.ts src/layouts/BaseLayout.astro tests/ref.test.ts tests/tracker.test.ts
git commit -m "feat: add consent-aware tracker with link attribution"
```

---

### Task 15: Lead validation, Edge Function and quote page

**Files:**
- Create: `supabase/functions/_shared/lead.ts`, `supabase/functions/submit-lead/index.ts`, `src/lib/lead-submit.ts`, `src/scripts/quote-form.ts`, `src/pages/quote.astro`
- Modify: `scripts/seo-audit.mjs` (quote rule), `tests/seo-audit.test.ts`
- Test: `tests/lead.test.ts`, `tests/lead-submit.test.ts`

**Interfaces:**
- Consumes: `sanitizeRef`, `tracker` (from `src/scripts/analytics.ts`), `packages`, `site`, `whatsappUrl`.
- Produces:
  - `PACKAGE_CHOICES = ['standard','premium','custom','unsure']`, `MIN_FILL_MS = 3000`, `CleanLead { name; email; phone: string|null; business: string|null; package: PackageChoice|null; message; ref: string|null; first_ref: string|null; visitor_id: string|null }`, `LeadResult`, `validateLead(raw: unknown): LeadResult`, `formatLeadEmail(lead: CleanLead, id: string, siteUrl?: string): { subject: string; text: string }`.
  - `SubmitOutcome`, `leadEndpoint(supabaseUrl?: string): string | undefined`, `createLeadSubmitter(endpoint: string | undefined, fetchFn: typeof fetch): (payload: Record<string, unknown>) => Promise<SubmitOutcome>`, `buildMailto(to: string, fields: Record<string, string>): string`.
  - Edge Function HTTP contract: `POST` JSON → `200 {ok:true}` (saved, or silently dropped spam) | `422 {errors}` | `500 {error}`.

- [ ] **Step 1: Failing validation tests**

`tests/lead.test.ts`:
```ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import { validateLead, formatLeadEmail, MIN_FILL_MS } from '../supabase/functions/_shared/lead.ts';

const valid = {
  name: 'Sam Patel',
  email: 'Sam@Example.com ',
  phone: '07912 345678',
  business: 'Patel Plumbing',
  package: 'premium',
  message: 'I need a website for my plumbing business in Romford.',
  ref: 'Romford Traders',
  first_ref: 'wa-group',
  visitor_id: '00000000-0000-4000-8000-000000000001',
  hp: '',
  elapsed: 12_000,
};

afterEach(() => { vi.useRealTimers(); });

describe('validateLead', () => {
  it('accepts and cleans a valid lead', () => {
    const r = validateLead(valid);
    expect(r).toEqual({ ok: true, lead: {
      name: 'Sam Patel', email: 'sam@example.com', phone: '07912 345678', business: 'Patel Plumbing', package: 'premium',
      message: 'I need a website for my plumbing business in Romford.', ref: 'romford-traders', first_ref: 'wa-group',
      visitor_id: '00000000-0000-4000-8000-000000000001',
    } });
  });
  it('treats a filled honeypot as spam', () => {
    expect(validateLead({ ...valid, hp: 'http://spam' })).toEqual({ ok: false, spam: true });
  });
  it('treats very fast or missing timing as spam', () => {
    expect(validateLead({ ...valid, elapsed: MIN_FILL_MS - 1 })).toEqual({ ok: false, spam: true });
    const { elapsed: _e, ...noTiming } = valid;
    expect(validateLead(noTiming)).toEqual({ ok: false, spam: true });
  });
  it('ignores the server clock entirely (Review Focus 2)', () => {
    expect(validateLead.length).toBe(1);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2001-01-01T00:00:00Z'));
    expect(validateLead(valid).ok).toBe(true);
    vi.setSystemTime(new Date('2099-01-01T00:00:00Z'));
    expect(validateLead(valid).ok).toBe(true);
  });
  it('returns field errors', () => {
    const r = validateLead({ ...valid, name: '', email: 'nope', phone: 'abc', package: 'gold', message: 'hi' });
    expect(r.ok).toBe(false);
    if (r.ok || r.spam) throw new Error('expected field errors');
    expect(Object.keys(r.errors).sort()).toEqual(['email', 'message', 'name', 'package', 'phone']);
  });
  it('rejects control characters in the name (email header safety)', () => {
    const r = validateLead({ ...valid, name: 'Sam\r\nBcc: x@y.z' });
    expect(r.ok).toBe(false);
  });
  it('drops malformed visitor ids and refs instead of failing', () => {
    const r = validateLead({ ...valid, visitor_id: 'not-a-uuid', ref: '🔥' });
    expect(r.ok && r.lead.visitor_id).toBeNull();
    expect(r.ok && r.lead.ref).toBeNull();
  });
  it('rejects non-objects', () => {
    expect(validateLead(null).ok).toBe(false);
    expect(validateLead('x').ok).toBe(false);
  });
});

describe('formatLeadEmail', () => {
  it('includes the source and a dashboard link', () => {
    const r = validateLead(valid);
    if (!r.ok) throw new Error('fixture invalid');
    const { subject, text } = formatLeadEmail(r.lead, 'abc-123');
    expect(subject).toBe('New quote request: Sam Patel (Patel Plumbing)');
    expect(text).toContain('Source link: wa-group');
    expect(text).toContain('https://apexdesigns.org.uk/admin/#lead=abc-123');
  });
});
```

Run: `npx vitest run tests/lead.test.ts` → Expected: FAIL (module missing).

- [ ] **Step 2: Implement lead.ts**

`supabase/functions/_shared/lead.ts`:
```ts
// Shared by the website (Vite) and the Edge Function (Deno). Only relative .ts imports allowed.
import { sanitizeRef } from './ref.ts';

export const PACKAGE_CHOICES = ['standard', 'premium', 'custom', 'unsure'] as const;
export type PackageChoice = (typeof PACKAGE_CHOICES)[number];
export const MIN_FILL_MS = 3000;

export interface CleanLead {
  name: string;
  email: string;
  phone: string | null;
  business: string | null;
  package: PackageChoice | null;
  message: string;
  ref: string | null;
  first_ref: string | null;
  visitor_id: string | null;
}

export type LeadResult =
  | { ok: true; lead: CleanLead }
  | { ok: false; spam: true }
  | { ok: false; spam: false; errors: Record<string, string> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[0-9+()\s-]{6,30}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTROL = /[\u0000-\u001f\u007f]/;
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Validates a quote request. Spam timing uses `elapsed` (ms the visitor spent on the form,
 * measured in their browser) so a wrong client clock can never drop a real lead.
 */
export function validateLead(raw: unknown): LeadResult {
  if (!raw || typeof raw !== 'object') return { ok: false, spam: false, errors: { form: 'Something went wrong. Please try again.' } };
  const r = raw as Record<string, unknown>;

  if (text(r.hp) !== '') return { ok: false, spam: true };
  const elapsed = Number(r.elapsed);
  if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) return { ok: false, spam: true };

  const name = text(r.name);
  const email = text(r.email).toLowerCase();
  const phone = text(r.phone);
  const business = text(r.business);
  const pkg = text(r.package);
  const message = text(r.message);

  const errors: Record<string, string> = {};
  if (!name) errors.name = 'Please tell me your name.';
  else if (name.length > 100 || CONTROL.test(name)) errors.name = 'Please enter your name without special characters (max 100).';
  if (email.length > 200 || !EMAIL.test(email)) errors.email = 'Please enter a valid email address.';
  if (phone && !PHONE.test(phone)) errors.phone = 'Please enter a valid phone number.';
  if (business.length > 120 || CONTROL.test(business)) errors.business = 'Please use a shorter business name.';
  if (pkg && !(PACKAGE_CHOICES as readonly string[]).includes(pkg)) errors.package = 'Please choose a package from the list.';
  if (message.length < 10) errors.message = 'Please tell me a little more (at least 10 characters).';
  else if (message.length > 2000) errors.message = 'Please keep your message under 2,000 characters.';
  if (Object.keys(errors).length) return { ok: false, spam: false, errors };

  const vid = text(r.visitor_id);
  return {
    ok: true,
    lead: {
      name,
      email,
      phone: phone || null,
      business: business || null,
      package: (pkg || null) as PackageChoice | null,
      message,
      ref: sanitizeRef(r.ref),
      first_ref: sanitizeRef(r.first_ref),
      visitor_id: UUID.test(vid) ? vid : null,
    },
  };
}

export function formatLeadEmail(lead: CleanLead, id: string, siteUrl = 'https://apexdesigns.org.uk'): { subject: string; text: string } {
  const subject = `New quote request: ${lead.name}${lead.business ? ` (${lead.business})` : ''}`;
  const body = [
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone ?? '-'}`,
    `Business: ${lead.business ?? '-'}`,
    `Package: ${lead.package ?? '-'}`,
    `Source link: ${lead.first_ref ?? lead.ref ?? 'none'}`,
    '',
    lead.message,
    '',
    `View in dashboard: ${siteUrl}/admin/#lead=${id}`,
  ];
  return { subject, text: body.join('\n') };
}
```

Run: `npx vitest run tests/lead.test.ts` → Expected: PASS.

- [ ] **Step 3: Failing submitter tests**

`tests/lead-submit.test.ts`:
```ts
import { describe, it, expect, vi } from 'vitest';
import { createLeadSubmitter, leadEndpoint, buildMailto } from '../src/lib/lead-submit';

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('leadEndpoint', () => {
  it('derives the function URL', () => {
    expect(leadEndpoint('https://x.supabase.co/')).toBe('https://x.supabase.co/functions/v1/submit-lead');
    expect(leadEndpoint(undefined)).toBeUndefined();
  });
});

describe('createLeadSubmitter', () => {
  it('reports unconfigured without calling fetch', async () => {
    const f = vi.fn();
    expect(await createLeadSubmitter(undefined, f as any)({})).toEqual({ ok: false, kind: 'unconfigured' });
    expect(f).not.toHaveBeenCalled();
  });
  it('returns ok on 200', async () => {
    const f = vi.fn().mockResolvedValue(json(200, { ok: true }));
    expect(await createLeadSubmitter('https://e', f)({ a: 1 })).toEqual({ ok: true });
    expect(f).toHaveBeenCalledWith('https://e', expect.objectContaining({ method: 'POST', body: '{"a":1}' }));
  });
  it('returns field errors on 422', async () => {
    const f = vi.fn().mockResolvedValue(json(422, { errors: { email: 'bad' } }));
    expect(await createLeadSubmitter('https://e', f)({})).toEqual({ ok: false, kind: 'invalid', errors: { email: 'bad' } });
  });
  it('returns server on 500', async () => {
    const f = vi.fn().mockResolvedValue(json(500, {}));
    expect(await createLeadSubmitter('https://e', f)({})).toEqual({ ok: false, kind: 'server' });
  });
  it('returns network when fetch rejects (Review Focus 5)', async () => {
    const f = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    expect(await createLeadSubmitter('https://e', f)({})).toEqual({ ok: false, kind: 'network' });
  });
  it('sends exactly one request when submitted twice quickly (Review Focus 5)', async () => {
    let resolve!: (r: Response) => void;
    const f = vi.fn().mockReturnValue(new Promise<Response>((r) => { resolve = r; }));
    const submit = createLeadSubmitter('https://e', f);
    const first = submit({});
    expect(await submit({})).toEqual({ ok: false, kind: 'busy' });
    resolve(json(200, { ok: true }));
    expect(await first).toEqual({ ok: true });
    expect(f).toHaveBeenCalledTimes(1);
  });
});

describe('buildMailto', () => {
  it('encodes subject and body', () => {
    const url = buildMailto('hi@x.uk', { name: 'Sam & Co', message: 'Line 1' });
    expect(url).toBe('mailto:hi@x.uk?subject=Website%20quote%20request%20from%20Sam%20%26%20Co&body=name%3A%20Sam%20%26%20Co%0Amessage%3A%20Line%201');
  });
});
```

Run: `npx vitest run tests/lead-submit.test.ts` → Expected: FAIL (module missing).

- [ ] **Step 4: Implement lead-submit.ts**

`src/lib/lead-submit.ts`:
```ts
export type SubmitOutcome =
  | { ok: true }
  | { ok: false; kind: 'invalid'; errors: Record<string, string> }
  | { ok: false; kind: 'network' | 'server' | 'unconfigured' | 'busy' };

export function leadEndpoint(supabaseUrl: string | undefined): string | undefined {
  return supabaseUrl ? `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/submit-lead` : undefined;
}

export function createLeadSubmitter(endpoint: string | undefined, fetchFn: typeof fetch) {
  let inFlight = false;
  return async function submit(payload: Record<string, unknown>): Promise<SubmitOutcome> {
    if (!endpoint) return { ok: false, kind: 'unconfigured' };
    if (inFlight) return { ok: false, kind: 'busy' };
    inFlight = true;
    try {
      const res = await fetchFn(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (res.status === 422) {
        const body = (await res.json().catch(() => ({}))) as { errors?: Record<string, string> };
        return { ok: false, kind: 'invalid', errors: body.errors ?? {} };
      }
      if (!res.ok) return { ok: false, kind: 'server' };
      return { ok: true };
    } catch {
      return { ok: false, kind: 'network' };
    } finally {
      inFlight = false;
    }
  };
}

export function buildMailto(to: string, fields: Record<string, string>): string {
  const subject = `Website quote request${fields.name ? ` from ${fields.name}` : ''}`;
  const body = Object.entries(fields).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
```

Run: `npx vitest run tests/lead-submit.test.ts` → Expected: PASS.

- [ ] **Step 5: Edge Function**

`supabase/functions/submit-lead/index.ts`:
```ts
// Supabase Edge Function (Deno).
// Deploy: npx supabase@latest functions deploy submit-lead --no-verify-jwt
// Secrets: SMTP_USER, SMTP_PASS, NOTIFY_TO, ALLOWED_ORIGINS (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are provided automatically)
import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6';
import { validateLead, formatLeadEmail, type CleanLead } from '../_shared/lead.ts';

const ALLOWED = (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://apexdesigns.org.uk,https://www.apexdesigns.org.uk')
  .split(',').map((s) => s.trim()).filter(Boolean);

function corsHeaders(origin: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': origin && ALLOWED.includes(origin) ? origin : ALLOWED[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
}

const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json' } });

async function notify(lead: CleanLead, id: string): Promise<void> {
  const user = Deno.env.get('SMTP_USER');
  const pass = Deno.env.get('SMTP_PASS');
  const to = Deno.env.get('NOTIFY_TO') ?? user;
  if (!user || !pass || !to) { console.warn('SMTP not configured; skipping notification'); return; }
  // Port 465 (implicit TLS): Supabase blocks outbound 25 and 587.
  const transport = nodemailer.createTransport({ host: Deno.env.get('SMTP_HOST') ?? 'smtp.hostinger.com', port: 465, secure: true, auth: { user, pass } });
  const { subject, text } = formatLeadEmail(lead, id);
  await transport.sendMail({ from: `"Apex Designs website" <${user}>`, to, replyTo: lead.email, subject, text });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = corsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);
  if (origin && !ALLOWED.includes(origin)) return json({ error: 'Forbidden' }, 403, cors);

  let raw: unknown;
  try { raw = await req.json(); } catch { return json({ errors: { form: 'Invalid request' } }, 422, cors); }

  const result = validateLead(raw);
  if (!result.ok && result.spam) return json({ ok: true }, 200, cors); // don't tell bots they were caught
  if (!result.ok) return json({ errors: result.errors }, 422, cors);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const lead = result.lead;
  const { data, error } = await db.from('leads').insert(lead).select('id').single();
  if (error || !data) {
    console.error('lead insert failed', error);
    return json({ error: 'Could not save your request' }, 500, cors);
  }

  const { error: evErr } = await db.from('events').insert({ type: 'form_submit', path: '/quote/', visitor_id: lead.visitor_id, ref: lead.ref, props: { lead_id: data.id } });
  if (evErr) console.error('form_submit event failed', evErr);

  try { await notify(lead, data.id); } catch (e) { console.error('notification email failed', e); }
  return json({ ok: true }, 200, cors);
});
```

This file is excluded from `astro check` (Deno globals). It is verified by deploying and calling it in Task 18.

- [ ] **Step 6: Quote page audit rule (Review Focus 5)**

Add to `tests/seo-audit.test.ts` inside `describe('auditPage')`:
```ts
  it('requires no-JS contact fallbacks on the quote page', () => {
    const errs = auditPage(good(), 'quote/index.html').errors;
    expect(errs).toContain('quote page needs a mailto: link');
    expect(errs).toContain('quote page needs a wa.me link');
    expect(auditPage(good('<a href="mailto:a@b.uk"></a><a href="https://wa.me/44"></a>'), 'quote/index.html').errors).toEqual([]);
  });
```

Run: `npx vitest run tests/seo-audit.test.ts` → Expected: FAIL on the new test.

In `scripts/seo-audit.mjs`, before `return { title, errors };` add:
```js
  if (relPath === 'quote/index.html') {
    if (!/href="mailto:/i.test(html)) errors.push('quote page needs a mailto: link');
    if (!/href="https:\/\/wa\.me\//i.test(html)) errors.push('quote page needs a wa.me link');
  }
```

Run: `npx vitest run tests/seo-audit.test.ts` → Expected: PASS.

- [ ] **Step 7: Quote page**

`src/pages/quote.astro`:
```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import PageHero from '../components/PageHero.astro';
import { packages } from '../data/packages';
import { site } from '../config/site';
import { whatsappUrl, DEFAULT_WA_TEXT } from '../lib/whatsapp';
import { breadcrumbJsonLd } from '../lib/seo';
---
<BaseLayout
  title="Get a Free Website Quote"
  description="Tell me about your business and get a clear plan and price for your new website. Romford-based, working across East London, Essex and the UK."
  jsonLd={[breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Get a quote', path: '/quote/' }])]}
>
  <PageHero eyebrow="Free quote" lead="A few details and I will come back to you with a clear plan and price. No pressure, no jargon.">Get a free website quote</PageHero>

  <section class="container quote">
    <form id="quote-form" class="card form" novalidate data-state="idle">
      <div class="row">
        <label>Name<input name="name" autocomplete="name" required maxlength="100" /><span class="err" data-error-for="name"></span></label>
        <label>Email<input name="email" type="email" autocomplete="email" required maxlength="200" /><span class="err" data-error-for="email"></span></label>
      </div>
      <div class="row">
        <label>Phone <span class="opt">(optional)</span><input name="phone" type="tel" autocomplete="tel" maxlength="30" /><span class="err" data-error-for="phone"></span></label>
        <label>Business <span class="opt">(optional)</span><input name="business" autocomplete="organization" maxlength="120" /><span class="err" data-error-for="business"></span></label>
      </div>
      <label>Package
        <select name="package">
          <option value="unsure">Not sure yet</option>
          {packages.map((p) => <option value={p.id}>{p.name}: {p.price}{p.priceNote ? ` ${p.priceNote}` : ''}</option>)}
        </select>
        <span class="err" data-error-for="package"></span>
      </label>
      <label>About your project
        <textarea name="message" rows="6" required minlength="10" maxlength="2000" placeholder="What does your business do, and what do you need the website to do?"></textarea>
        <span class="err" data-error-for="message"></span>
      </label>
      <div class="hp" aria-hidden="true"><label>Leave this empty<input name="hp" tabindex="-1" autocomplete="off" /></label></div>
      <button class="btn btn-primary" type="submit" data-track="quote-submit">Send my request</button>
      <p class="status" data-status role="status" aria-live="polite"></p>
      <p class="muted small">I only use your details to reply to your enquiry. See the <a href="/privacy/">privacy policy</a>.</p>
    </form>

    <aside class="card side">
      <h2 class="h3">Prefer to chat?</h2>
      <p class="muted">Message me directly on WhatsApp or by email.</p>
      <a class="btn btn-ghost" href={whatsappUrl(site.whatsapp, DEFAULT_WA_TEXT)} data-wa target="_blank" rel="noopener">WhatsApp Ibrahim</a>
      <a class="btn btn-ghost" href={`mailto:${site.email}`}>{site.email}</a>
      <noscript><p class="muted">JavaScript is turned off, so the form cannot send. Please use WhatsApp or email instead.</p></noscript>
    </aside>
  </section>
</BaseLayout>

<style>
  .quote { display: grid; gap: 24px; grid-template-columns: 2fr 1fr; align-items: start; padding-bottom: clamp(72px, 10vw, 140px); }
  @media (max-width: 900px) { .quote { grid-template-columns: 1fr; } }
  .form { display: grid; gap: 18px; }
  .row { display: grid; gap: 18px; grid-template-columns: 1fr 1fr; }
  @media (max-width: 600px) { .row { grid-template-columns: 1fr; } }
  label { display: grid; gap: 8px; font-weight: 600; font-size: 0.95rem; }
  .opt { font-weight: 400; color: var(--mist-dim); }
  input, select, textarea { font: inherit; font-weight: 400; color: var(--mist); background: rgb(255 255 255 / 0.04); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 0.8em 1em; width: 100%; }
  input:focus, select:focus, textarea:focus { outline: none; border-color: var(--teal-glow); box-shadow: 0 0 0 3px rgb(95 211 181 / 0.2); }
  [aria-invalid='true'] { border-color: #ff8a80; }
  .err { color: #ff8a80; font-weight: 500; font-size: 0.85rem; min-height: 1em; }
  .hp { position: absolute; left: -9999px; width: 1px; height: 1px; overflow: hidden; }
  .status { min-height: 1.4em; margin: 0; font-weight: 600; }
  .form[data-state='sent'] .status { color: var(--teal-glow); }
  .form[data-state='error'] .status { color: #ff8a80; }
  .small { font-size: 0.85rem; margin: 0; }
  .small a { color: var(--teal-glow); }
  .side { display: grid; gap: 12px; }
  .h3 { font-size: 1.4rem; margin: 0; }
</style>

<script>
  import '../scripts/quote-form';
</script>
```

- [ ] **Step 8: Quote form behaviour**

`src/scripts/quote-form.ts`:
```ts
import { tracker } from './analytics';
import { createLeadSubmitter, leadEndpoint, buildMailto } from '../lib/lead-submit';
import { validateLead, PACKAGE_CHOICES } from '../../supabase/functions/_shared/lead.ts';
import { site } from '../config/site';

const form = document.querySelector<HTMLFormElement>('#quote-form');

if (form) {
  const renderedAt = performance.now();
  const status = form.querySelector<HTMLElement>('[data-status]');
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]');
  const submit = createLeadSubmitter(leadEndpoint(import.meta.env.PUBLIC_SUPABASE_URL), (input, init) => fetch(input, init));

  const pre = new URLSearchParams(window.location.search).get('package');
  const select = form.elements.namedItem('package');
  if (select instanceof HTMLSelectElement && pre && (PACKAGE_CHOICES as readonly string[]).includes(pre)) select.value = pre;

  let started = false;
  form.addEventListener('input', () => {
    if (!started) { started = true; tracker.track('form_start'); }
  });

  const showErrors = (errors: Record<string, string>) => {
    form.querySelectorAll<HTMLElement>('[data-error-for]').forEach((el) => {
      const field = el.dataset.errorFor ?? '';
      const msg = errors[field] ?? '';
      el.textContent = msg;
      const input = form.elements.namedItem(field);
      if (input instanceof HTMLElement) input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    });
    const first = Object.keys(errors)[0];
    const firstInput = first ? form.elements.namedItem(first) : null;
    if (firstInput instanceof HTMLElement) firstInput.focus();
  };

  const setState = (state: 'idle' | 'sending' | 'sent' | 'error', msg = '') => {
    form.dataset.state = state;
    if (status) status.textContent = msg;
    if (button) button.disabled = state === 'sending' || state === 'sent';
  };

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (form.dataset.state === 'sending' || form.dataset.state === 'sent') return;

    const fields = Object.fromEntries(new FormData(form)) as Record<string, string>;
    const check = validateLead({ ...fields, hp: '', elapsed: Number.MAX_SAFE_INTEGER });
    if (!check.ok && !check.spam) { showErrors(check.errors); return; }
    showErrors({});

    setState('sending', 'Sending…');
    const elapsed = Math.round(performance.now() - renderedAt);
    const out = await submit({ ...fields, elapsed, ...tracker.leadContext() });

    if (out.ok) { setState('sent', 'Thanks! Your message is with me and I will get back to you soon.'); form.reset(); return; }
    if (out.kind === 'busy') return;
    if (out.kind === 'invalid') { setState('idle'); showErrors(out.errors); return; }
    if (out.kind === 'unconfigured') {
      const { hp: _hp, ...visible } = fields;
      setState('idle', 'Opening your email app…');
      window.location.href = buildMailto(site.email, visible);
      return;
    }
    setState('error', 'Sorry, that did not send. Please message me on WhatsApp or by email using the links alongside.');
  });
}
```

- [ ] **Step 9: Verify and commit**

Run: `npm test && npm run build` → Expected: all pass; audit passes for `quote/index.html`. In `npm run dev` without `.env`: submitting empty shows field errors and focuses the first; a valid submission opens a `mailto:` link. `/quote/?package=premium` preselects Premium.

```bash
git add supabase/functions src/lib/lead-submit.ts src/scripts/quote-form.ts src/pages/quote.astro scripts/seo-audit.mjs tests/lead.test.ts tests/lead-submit.test.ts tests/seo-audit.test.ts
git commit -m "feat: add quote form, shared lead validation and submit-lead edge function"
```

---

### Task 16: Legal pages, 404 and old-URL redirects

**Files:**
- Create: `src/pages/privacy.astro`, `src/pages/cookies.astro`, `src/pages/terms.astro`, `src/pages/404.astro`
- Modify: `astro.config.mjs` (redirects), `scripts/seo-audit.mjs` (skip redirect stubs), `tests/seo-audit.test.ts`

**Interfaces:**
- Consumes: `ProseLayout`, `BaseLayout`, `PageHero`, `site`, `KEYS`/`CONSENT_KEY` names (documented in the cookie table).

- [ ] **Step 1: Audit skips redirect stubs (failing test first)**

Add to `tests/seo-audit.test.ts` inside `describe('auditPage')`:
```ts
  it('skips meta-refresh redirect stubs', () => {
    const stub = '<!doctype html><title>Redirecting to: /work/</title><meta http-equiv="refresh" content="0;url=/work/"><meta name="robots" content="noindex">';
    expect(auditPage(stub, 'portfolio/index.html')).toEqual({ title: undefined, errors: [] });
  });
```

Run: `npx vitest run tests/seo-audit.test.ts` → Expected: FAIL.

At the top of `auditPage` in `scripts/seo-audit.mjs` add:
```js
  if (/<meta\s+http-equiv="refresh"/i.test(html)) return { title: undefined, errors: [] };
```

Run: `npx vitest run tests/seo-audit.test.ts` → Expected: PASS.

- [ ] **Step 2: Redirect old WordPress URLs**

In `astro.config.mjs` add a `redirects` key to `defineConfig`:
```js
  // Old WordPress URLs → new pages. Check Search Console after launch for any others.
  redirects: {
    '/portfolio': '/work/',
    '/contact': '/quote/',
    '/cookie-policy-uk': '/cookies/',
    '/privacy-policy': '/privacy/',
    '/terms-and-conditions': '/terms/',
  },
```

- [ ] **Step 3: Privacy policy**

`src/pages/privacy.astro`:
```astro
---
import ProseLayout from '../layouts/ProseLayout.astro';
import { site } from '../config/site';
---
<ProseLayout title="Privacy Policy" heading="Privacy policy" eyebrow="Legal" description="How Apex Designs collects, uses and protects your personal data when you use this website or contact me about a project.">
  <p><em>Last updated: 27 October 2026</em></p>
  <h2>Who I am</h2>
  <p>Apex Designs is a web design studio run by {site.founder} in Romford, Greater London. I am the controller of the personal data described here. Contact: <a href={`mailto:${site.email}`}>{site.email}</a>.</p>
  <h2>What I collect</h2>
  <ul>
    <li><strong>Quote requests:</strong> your name, email, and optionally phone, business name, package and message, plus which tracked link (if any) brought you to the site.</li>
    <li><strong>Analytics, only if you accept:</strong> a random visitor ID, the pages you view, buttons you click, how far you scroll, and your browser type. No ads and no third-party trackers.</li>
    <li><strong>Without your consent:</strong> if you arrive through one of my tracked links, I record one anonymous visit for that link, with no ID and nothing stored on your device.</li>
    <li><strong>Messages you send me</strong> by email or WhatsApp.</li>
  </ul>
  <h2>Why, and the legal basis</h2>
  <ul>
    <li>Replying to your enquiry and preparing a quote: steps you ask for before entering a contract, and my legitimate interest in responding to business enquiries.</li>
    <li>Analytics: your consent, which you can withdraw at any time via "Cookie settings" in the footer.</li>
    <li>Anonymous link counts: my legitimate interest in knowing which of my posts and groups bring visitors.</li>
  </ul>
  <h2>Who processes it for me</h2>
  <ul>
    <li><strong>Supabase</strong> stores enquiries and analytics in a database hosted in the UK/EU region.</li>
    <li><strong>Hostinger</strong> provides my email, so enquiry notifications pass through their mail servers.</li>
    <li><strong>GitHub Pages</strong> hosts the website and may log IP addresses for security.</li>
  </ul>
  <p>I do not sell your data or share it with anyone else.</p>
  <h2>How long I keep it</h2>
  <p>Enquiries: up to 24 months after our last contact. Analytics events: up to 13 months. These limits are enforced by an automatic daily clean-up.</p>
  <h2>Your rights</h2>
  <p>You can ask to access, correct or delete your data, object to processing, or withdraw consent. Email <a href={`mailto:${site.email}`}>{site.email}</a>. You can also complain to the Information Commissioner's Office at <a href="https://ico.org.uk/">ico.org.uk</a>.</p>
</ProseLayout>
```

- [ ] **Step 4: Cookie policy**

`src/pages/cookies.astro`:
```astro
---
import ProseLayout from '../layouts/ProseLayout.astro';
---
<ProseLayout title="Cookie Policy" heading="Cookies and storage" eyebrow="Legal" description="Exactly what Apex Designs stores in your browser, why, and how to change your choice. No advertising or third-party cookies.">
  <p><em>Last updated: 27 October 2026</em></p>
  <p>This site does not use advertising or third-party cookies. It uses your browser's local and session storage as follows.</p>
  <table>
    <thead><tr><th>Name</th><th>Type</th><th>Purpose</th><th>When</th><th>Lasts</th></tr></thead>
    <tbody>
      <tr><td><code>apex-consent</code></td><td>Local storage</td><td>Remembers your cookie choice</td><td>Always (strictly necessary)</td><td>Until you clear it</td></tr>
      <tr><td><code>apex-vid</code></td><td>Local storage</td><td>Random visitor ID for analytics</td><td>Only if you accept</td><td>Until you clear it or withdraw consent</td></tr>
      <tr><td><code>apex-first-ref</code></td><td>Local storage</td><td>Which tracked link first brought you here</td><td>Only if you accept</td><td>Until you clear it or withdraw consent</td></tr>
      <tr><td><code>apex-sid</code></td><td>Session storage</td><td>Groups page views into one visit</td><td>Only if you accept</td><td>Until you close the tab</td></tr>
      <tr><td><code>apex-ref</code></td><td>Session storage</td><td>Remembers the tracked link for your enquiry</td><td>Only if you accept</td><td>Until you close the tab</td></tr>
    </tbody>
  </table>
  <p>If you arrive through a tracked link and have not accepted analytics, the site records one anonymous visit for that link and stores nothing on your device.</p>
  <h2>Changing your choice</h2>
  <p>Use <strong>Cookie settings</strong> in the footer at any time. Choosing "No thanks" deletes the analytics items above.</p>
</ProseLayout>
```

- [ ] **Step 5: Terms**

`src/pages/terms.astro`:
```astro
---
import ProseLayout from '../layouts/ProseLayout.astro';
import { site } from '../config/site';
---
<ProseLayout title="Terms and Conditions" heading="Terms and conditions" eyebrow="Legal" description="Terms for using the Apex Designs website. Project terms are agreed separately in writing before any work starts.">
  <p><em>Last updated: 27 October 2026</em></p>
  <h2>Using this website</h2>
  <p>This website is run by Apex Designs, Romford. By using it you agree to these terms. The content is for general information only and may change without notice.</p>
  <h2>Prices and quotes</h2>
  <p>Prices shown are starting points. A quote is only binding once we have agreed the scope, price and timeline in writing. Project-specific terms, including payment and ownership, are set out in that agreement.</p>
  <h2>Intellectual property</h2>
  <p>The design, text and images on this site belong to Apex Designs or are used with permission. Portfolio work is shown with the agreement of the clients concerned.</p>
  <h2>Liability</h2>
  <p>I take care to keep this site accurate and available, but I cannot guarantee it will always be error-free or uninterrupted. Nothing in these terms limits liability that cannot be limited by law.</p>
  <h2>Law</h2>
  <p>These terms are governed by the laws of England and Wales.</p>
  <h2>Contact</h2>
  <p><a href={`mailto:${site.email}`}>{site.email}</a></p>
</ProseLayout>
```

- [ ] **Step 6: 404 page**

`src/pages/404.astro`:
```astro
---
import BaseLayout from '../layouts/BaseLayout.astro';
import PageHero from '../components/PageHero.astro';
---
<BaseLayout title="Page Not Found" description="Sorry, that page does not exist. Head back to the Apex Designs home page or get a free website quote." noindex>
  <PageHero eyebrow="404" lead="That page has wandered off the trail. Let's get you back to base camp.">
    Page not found
    <div slot="after" class="ctas">
      <a class="btn btn-primary" href="/">Back home</a>
      <a class="btn btn-ghost" href="/quote/">Get a quote</a>
    </div>
  </PageHero>
</BaseLayout>
<style>.ctas { display: flex; gap: 12px; flex-wrap: wrap; margin: 28px 0 80px; }</style>
```

- [ ] **Step 7: Verify and commit**

Run: `npm test && npm run build` → Expected: all pass; `dist/404.html`, `dist/portfolio/index.html` (meta-refresh to `/work/`), legal pages built; audit passes.

```bash
git add src/pages/privacy.astro src/pages/cookies.astro src/pages/terms.astro src/pages/404.astro astro.config.mjs scripts/seo-audit.mjs tests/seo-audit.test.ts
git commit -m "feat: add legal pages, 404 and redirects from old WordPress URLs"
```

---

### Task 17: Admin dashboard

**Files:**
- Create: `src/lib/admin-helpers.ts`, `src/scripts/admin/dom.ts`, `src/scripts/admin/api.ts`, `src/scripts/admin/main.ts`, `src/layouts/AdminLayout.astro`, `src/pages/admin/index.astro`
- Test: `tests/admin-helpers.test.ts`, `tests/dom.test.ts`

**Interfaces:**
- Consumes: Task 13 tables/view/RPC, `sanitizeRef`, `site`, `packages`.
- Produces:
  - `LEAD_STATUSES`, `LeadStatus`, `CHANNELS`, `slugFromLabel(label: string): string | null`, `trackedUrl(siteUrl: string, destination: string, slug: string): string`, `shareText(url: string): string`, `conversionRate(leads: number, landings: number): string`, `JourneyEvent { type: string; path: string; ref: string | null; props: Record<string, unknown> | null; created_at: string }`, `eventLabel(e: JourneyEvent): string`, `sortJourney(events: JourneyEvent[]): JourneyEvent[]`, `leadIdFromHash(hash: string): string | null`.
  - `h(tag, attrs?, ...children)`: safe DOM builder (text only, blocks `javascript:` URLs and string `on*` attributes).
  - `createApi(url: string, key: string)` → `{ db, session(), sendMagicLink(email), signOut(), isAdmin(), leads(status?), lead(id), updateLead(id, patch), journey(visitorId), linkStats(), createLink(input), overview(days?) }`; types `Lead`, `LinkStat`, `Api`.

- [ ] **Step 1: Failing helper tests**

`tests/admin-helpers.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { slugFromLabel, trackedUrl, shareText, conversionRate, eventLabel, sortJourney, leadIdFromHash } from '../src/lib/admin-helpers';

describe('admin helpers', () => {
  it('makes slugs from labels', () => {
    expect(slugFromLabel('Romford Traders WhatsApp')).toBe('romford-traders-whatsapp');
    expect(slugFromLabel('🔥')).toBeNull();
  });
  it('builds tracked URLs', () => {
    expect(trackedUrl('https://apexdesigns.org.uk', '/', 'wa-group')).toBe('https://apexdesigns.org.uk/?ref=wa-group');
    expect(trackedUrl('https://apexdesigns.org.uk', 'services/', 'x')).toBe('https://apexdesigns.org.uk/services/?ref=x');
  });
  it('builds share text containing the URL and the starting price', () => {
    const t = shareText('https://apexdesigns.org.uk/?ref=x');
    expect(t).toContain('https://apexdesigns.org.uk/?ref=x');
    expect(t).toContain('£300');
  });
  it('formats conversion', () => {
    expect(conversionRate(1, 8)).toBe('12.5%');
    expect(conversionRate(0, 0)).toBe('–');
  });
  it('labels and sorts journey events', () => {
    const evs = [
      { type: 'cta_click', path: '/', ref: null, props: { id: 'hero-quote' }, created_at: '2026-10-27T10:02:00Z' },
      { type: 'ref_landing', path: '/', ref: 'wa-group', props: null, created_at: '2026-10-27T10:00:00Z' },
    ];
    expect(sortJourney(evs).map(eventLabel)).toEqual(['Arrived via link "wa-group" on /', 'Clicked "hero-quote" on /']);
  });
  it('reads a lead id from the hash', () => {
    expect(leadIdFromHash('#lead=00000000-0000-4000-8000-000000000001')).toBe('00000000-0000-4000-8000-000000000001');
    expect(leadIdFromHash('#tab=links')).toBeNull();
    expect(leadIdFromHash('#lead=<script>')).toBeNull();
  });
});
```

`tests/dom.test.ts`:
```ts
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { h } from '../src/scripts/admin/dom';

describe('h()', () => {
  it('renders strings as text, never HTML (Review Focus 3)', () => {
    const el = h('td', {}, '<img src=x onerror=alert(1)>');
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toBe('<img src=x onerror=alert(1)>');
  });
  it('blocks javascript: URLs and string event handlers', () => {
    const a = h('a', { href: 'javascript:alert(1)', onclick: 'alert(1)' as unknown as string }, 'x');
    expect(a.getAttribute('href')).toBeNull();
    expect(a.getAttribute('onclick')).toBeNull();
  });
  it('attaches function handlers', () => {
    const fn = vi.fn();
    const b = h('button', { onclick: fn }, 'Go');
    b.click();
    expect(fn).toHaveBeenCalledOnce();
  });
  it('skips null, false and undefined children and attributes', () => {
    const el = h('p', { title: undefined, hidden: false }, null, false, 'ok', 3);
    expect(el.textContent).toBe('ok3');
    expect(el.hasAttribute('hidden')).toBe(false);
  });
});
```

Run: `npx vitest run tests/admin-helpers.test.ts tests/dom.test.ts` → Expected: FAIL (modules missing).

- [ ] **Step 2: Implement admin-helpers.ts and dom.ts**

`src/lib/admin-helpers.ts`:
```ts
import { sanitizeRef } from '../../supabase/functions/_shared/ref.ts';
import { packages } from '../data/packages';

export const LEAD_STATUSES = ['new', 'warm', 'quoted', 'won', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const CHANNELS = ['whatsapp', 'instagram', 'facebook', 'email', 'print', 'other'] as const;

export interface JourneyEvent {
  type: string;
  path: string;
  ref: string | null;
  props: Record<string, unknown> | null;
  created_at: string;
}

export function slugFromLabel(label: string): string | null {
  return sanitizeRef(label);
}

export function trackedUrl(siteUrl: string, destination: string, slug: string): string {
  const u = new URL(destination.startsWith('/') ? destination : `/${destination}`, siteUrl);
  u.searchParams.set('ref', slug);
  return u.toString();
}

export function shareText(url: string): string {
  return `Need a website for your business? I'm Ibrahim from Apex Designs in Romford. Custom sites from ${packages[0].price}, built by one person from start to finish. Have a look: ${url}`;
}

export function conversionRate(leads: number, landings: number): string {
  return landings ? `${((leads / landings) * 100).toFixed(1)}%` : '–';
}

export function eventLabel(e: JourneyEvent): string {
  switch (e.type) {
    case 'ref_landing': return `Arrived via link "${e.ref ?? 'unknown'}" on ${e.path}`;
    case 'page_view': return `Viewed ${e.path}`;
    case 'cta_click': return `Clicked "${String(e.props?.id ?? 'button')}" on ${e.path}`;
    case 'whatsapp_click': return `Opened WhatsApp from ${e.path}`;
    case 'scroll_depth': return `Scrolled ${String(e.props?.depth ?? '?')}% of ${e.path}`;
    case 'form_start': return 'Started the quote form';
    case 'form_submit': return 'Submitted the quote form';
    default: return `${e.type} on ${e.path}`;
  }
}

export function sortJourney(events: JourneyEvent[]): JourneyEvent[] {
  return [...events].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

export function leadIdFromHash(hash: string): string | null {
  const m = /(?:^#|&)lead=([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i.exec(hash);
  return m ? m[1] : null;
}
```

`src/scripts/admin/dom.ts`:
```ts
type Child = Node | string | number | null | undefined | false;
type Attr = string | boolean | ((e: Event) => void) | undefined;

/** Builds elements with text-only children. CRM data must never go through innerHTML. */
export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Record<string, Attr> = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (typeof value === 'function') {
      el.addEventListener(name.replace(/^on/, '').toLowerCase(), value);
      continue;
    }
    if (/^on/i.test(name)) continue; // no inline handlers from strings
    if (value === true) { el.setAttribute(name, ''); continue; }
    if ((name === 'href' || name === 'src') && /^\s*javascript:/i.test(value)) continue;
    el.setAttribute(name, value);
  }
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.append(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
  return el;
}
```

Run: `npx vitest run tests/admin-helpers.test.ts tests/dom.test.ts` → Expected: PASS.

- [ ] **Step 3: Supabase API wrapper**

`src/scripts/admin/api.ts`:
```ts
import { createClient } from '@supabase/supabase-js';
import type { JourneyEvent, LeadStatus } from '../../lib/admin-helpers';

export interface Lead {
  id: string;
  created_at: string;
  updated_at: string;
  name: string;
  email: string;
  phone: string | null;
  business: string | null;
  package: string | null;
  message: string;
  ref: string | null;
  first_ref: string | null;
  visitor_id: string | null;
  status: LeadStatus;
  notes: string | null;
}

export interface LinkStat {
  id: string;
  slug: string;
  label: string;
  channel: string;
  destination: string;
  created_at: string;
  landings: number;
  visitors: number;
  leads: number;
}

export function createApi(url: string, key: string) {
  const db = createClient(url, key, { auth: { persistSession: true, detectSessionInUrl: true } });

  const fail = (error: { message: string } | null) => { if (error) throw new Error(error.message); };

  return {
    db,
    async session() {
      const { data } = await db.auth.getSession();
      return data.session;
    },
    async sendMagicLink(email: string) {
      const { error } = await db.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/admin/`, shouldCreateUser: false } });
      fail(error);
    },
    async signOut() {
      await db.auth.signOut();
    },
    async isAdmin(): Promise<boolean> {
      const { data, error } = await db.rpc('is_admin');
      fail(error);
      return data === true;
    },
    async leads(status?: LeadStatus): Promise<Lead[]> {
      let q = db.from('leads').select('*');
      if (status) q = q.eq('status', status);
      const { data, error } = await q.order('created_at', { ascending: false }).limit(500);
      fail(error);
      return (data ?? []) as Lead[];
    },
    async lead(id: string): Promise<Lead | null> {
      const { data, error } = await db.from('leads').select('*').eq('id', id).maybeSingle();
      fail(error);
      return data as Lead | null;
    },
    async updateLead(id: string, patch: Partial<Pick<Lead, 'status' | 'notes'>>) {
      const { error } = await db.from('leads').update(patch).eq('id', id);
      fail(error);
    },
    async journey(visitorId: string): Promise<JourneyEvent[]> {
      const { data, error } = await db.from('events').select('type,path,ref,props,created_at').eq('visitor_id', visitorId).order('created_at').limit(1000);
      fail(error);
      return (data ?? []) as JourneyEvent[];
    },
    async linkStats(): Promise<LinkStat[]> {
      const { data, error } = await db.from('link_stats').select('*').order('created_at', { ascending: false });
      fail(error);
      return (data ?? []) as LinkStat[];
    },
    async createLink(input: { slug: string; label: string; channel: string; destination: string }) {
      const { error } = await db.from('links').insert(input);
      fail(error);
    },
    async overview(days = 30) {
      const since = new Date(Date.now() - days * 86_400_000).toISOString();
      const countEvents = async (type: string) => {
        const { count, error } = await db.from('events').select('id', { count: 'exact', head: true }).gte('created_at', since).eq('type', type);
        fail(error);
        return count ?? 0;
      };
      const countLeads = async () => {
        const { count, error } = await db.from('leads').select('id', { count: 'exact', head: true }).gte('created_at', since);
        fail(error);
        return count ?? 0;
      };
      const [landings, views, leads] = await Promise.all([countEvents('ref_landing'), countEvents('page_view'), countLeads()]);
      return { landings, views, leads };
    },
  };
}

export type Api = ReturnType<typeof createApi>;
```

- [ ] **Step 4: Dashboard UI**

`src/scripts/admin/main.ts`:
```ts
import { createApi, type Api, type Lead } from './api';
import { h } from './dom';
import { LEAD_STATUSES, CHANNELS, trackedUrl, shareText, conversionRate, eventLabel, sortJourney, leadIdFromHash, slugFromLabel, type LeadStatus } from '../../lib/admin-helpers';
import { site } from '../../config/site';

const root = document.getElementById('admin');
const fmt = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));
const show = (...nodes: Node[]) => root?.replaceChildren(...nodes);
const view = () => document.getElementById('view');
const errorBox = (text: string) => h('p', { class: 'error', role: 'alert' }, text);

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  show(errorBox('Supabase is not configured. Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY, then rebuild.'));
} else {
  const api = createApi(url, key);
  api.db.auth.onAuthStateChange((event) => {
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'SIGNED_OUT') void route(api);
  });
  window.addEventListener('hashchange', () => { void route(api); });
}

async function route(api: Api): Promise<void> {
  const session = await api.session();
  if (!session) { show(loginView(api)); return; }

  let admin = false;
  try { admin = await api.isAdmin(); } catch (e) { show(errorBox(`Could not check access: ${msg(e)}`)); return; }
  if (!admin) {
    show(h('div', { class: 'card' },
      h('h2', {}, 'Not authorised'),
      h('p', {}, `${session.user.email ?? 'This account'} is not on the admin list.`),
      h('button', { class: 'btn btn-ghost', onclick: () => { void api.signOut(); } }, 'Sign out')));
    return;
  }

  const leadId = leadIdFromHash(window.location.hash);
  const tab = leadId ? 'leads' : new URLSearchParams(window.location.hash.slice(1)).get('tab') ?? 'leads';
  show(nav(api, tab), h('div', { id: 'view' }, h('p', { class: 'muted' }, 'Loading…')));
  try {
    const content = leadId ? await leadDetail(api, leadId)
      : tab === 'links' ? await linksView(api)
      : tab === 'overview' ? await overviewView(api)
      : await leadsView(api);
    view()?.replaceChildren(content);
  } catch (e) {
    view()?.replaceChildren(errorBox(`Could not load data: ${msg(e)}`));
  }
}

function loginView(api: Api): HTMLElement {
  const input = h('input', { type: 'email', name: 'email', required: true, autocomplete: 'email' });
  const status = h('p', { class: 'muted', role: 'status' });
  return h('form', {
    class: 'card login',
    onsubmit: async (e: Event) => {
      e.preventDefault();
      status.textContent = 'Sending…';
      try { await api.sendMagicLink(input.value.trim()); status.textContent = 'Check your inbox for a sign-in link.'; }
      catch (err) { status.textContent = `Could not send link: ${msg(err)}`; }
    },
  }, h('h2', {}, 'Sign in'), h('label', {}, 'Email', input), h('button', { class: 'btn btn-primary', type: 'submit' }, 'Email me a sign-in link'), status);
}

function nav(api: Api, tab: string): HTMLElement {
  const link = (id: string, label: string) => h('a', { href: `#tab=${id}`, class: tab === id ? 'active' : undefined }, label);
  return h('nav', { class: 'admin-nav', 'aria-label': 'Dashboard' },
    link('leads', 'Leads'), link('links', 'Tracked links'), link('overview', 'Overview'),
    h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => { void api.signOut(); } }, 'Sign out'));
}

function statusSelect(api: Api, lead: Lead): HTMLSelectElement {
  const sel: HTMLSelectElement = h('select', {
    'aria-label': `Status for ${lead.name}`,
    onchange: async () => {
      const next = sel.value as LeadStatus;
      sel.disabled = true;
      try { await api.updateLead(lead.id, { status: next }); lead.status = next; sel.title = ''; }
      catch (e) { sel.value = lead.status; sel.title = `Not saved: ${msg(e)}`; sel.classList.add('failed'); }
      finally { sel.disabled = false; }
    },
  }, ...LEAD_STATUSES.map((s) => h('option', { value: s, selected: s === lead.status }, s)));
  return sel;
}

async function leadsView(api: Api, status?: LeadStatus): Promise<HTMLElement> {
  const leads = await api.leads(status);
  const filter = h('select', {
    'aria-label': 'Filter by status',
    onchange: async (e: Event) => {
      const v = (e.target as HTMLSelectElement).value as LeadStatus | '';
      try { view()?.replaceChildren(await leadsView(api, v || undefined)); } catch (err) { view()?.replaceChildren(errorBox(msg(err))); }
    },
  }, h('option', { value: '' }, 'All statuses'), ...LEAD_STATUSES.map((s) => h('option', { value: s, selected: s === status }, s)));

  const head = h('div', { class: 'toolbar' }, h('h2', {}, `Leads (${leads.length})`), filter);
  if (!leads.length) return h('section', {}, head, h('p', { class: 'muted' }, 'No leads yet. Share a tracked link to get started.'));

  const rows = leads.map((l) => h('tr', {},
    h('td', {}, fmt.format(new Date(l.created_at))),
    h('td', {}, h('a', { href: `#lead=${l.id}` }, l.name)),
    h('td', {}, l.business ?? '–'),
    h('td', {}, l.first_ref ?? l.ref ?? '–'),
    h('td', {}, statusSelect(api, l))));
  return h('section', {}, head, h('div', { class: 'table-wrap' }, h('table', {},
    h('thead', {}, h('tr', {}, ...['Received', 'Name', 'Business', 'Source', 'Status'].map((t) => h('th', {}, t)))),
    h('tbody', {}, ...rows))));
}

async function leadDetail(api: Api, id: string): Promise<HTMLElement> {
  const lead = await api.lead(id);
  if (!lead) return h('section', {}, h('a', { href: '#tab=leads' }, '← All leads'), h('p', {}, 'Lead not found.'));
  const journey = lead.visitor_id ? sortJourney(await api.journey(lead.visitor_id)) : [];

  const pair = (k: string, v: Node | string) => [h('dt', {}, k), h('dd', {}, v)];
  const facts = h('dl', { class: 'facts' },
    ...pair('Email', h('a', { href: `mailto:${lead.email}` }, lead.email)),
    ...pair('Phone', lead.phone ? h('a', { href: `tel:${lead.phone.replace(/[^0-9+]/g, '')}` }, lead.phone) : '–'),
    ...pair('Business', lead.business ?? '–'),
    ...pair('Package', lead.package ?? '–'),
    ...pair('Source link', lead.first_ref ?? lead.ref ?? 'Direct / unknown'),
    ...pair('Received', fmt.format(new Date(lead.created_at))),
    ...pair('Status', statusSelect(api, lead)));

  const notes = h('textarea', { rows: '5', 'aria-label': 'Notes' });
  notes.value = lead.notes ?? '';
  const saved = h('span', { class: 'muted', role: 'status' });
  const save = h('button', {
    class: 'btn btn-ghost', type: 'button',
    onclick: async () => {
      saved.textContent = 'Saving…';
      try { await api.updateLead(lead.id, { notes: notes.value }); saved.textContent = 'Saved'; }
      catch (e) { saved.textContent = `Not saved: ${msg(e)}`; }
    },
  }, 'Save notes');

  const timeline = journey.length
    ? h('ol', { class: 'timeline' }, ...journey.map((e) => h('li', {}, h('time', {}, fmt.format(new Date(e.created_at))), ' ', eventLabel(e))))
    : h('p', { class: 'muted' }, 'No journey recorded. This visitor did not accept analytics, so only the source link (if any) is known.');

  return h('section', { class: 'detail' },
    h('a', { href: '#tab=leads' }, '← All leads'),
    h('h2', {}, lead.name),
    h('div', { class: 'grid-2' },
      h('div', { class: 'card' }, facts, h('h3', {}, 'Message'), h('p', { class: 'pre' }, lead.message), h('h3', {}, 'Notes'), notes, h('div', { class: 'row' }, save, saved)),
      h('div', { class: 'card' }, h('h3', {}, 'Journey'), timeline)));
}

async function linksView(api: Api): Promise<HTMLElement> {
  const stats = await api.linkStats();
  const label = h('input', { name: 'label', required: true, maxlength: '120', placeholder: 'Romford Traders WhatsApp group' });
  const slug = h('input', { name: 'slug', required: true, maxlength: '64', placeholder: 'romford-traders-wa' });
  label.addEventListener('input', () => { if (!slug.dataset.touched) slug.value = slugFromLabel(label.value) ?? ''; });
  slug.addEventListener('input', () => { slug.dataset.touched = '1'; });
  const channel = h('select', { name: 'channel' }, ...CHANNELS.map((c) => h('option', { value: c }, c)));
  const destination = h('input', { name: 'destination', value: '/', placeholder: '/services/' });
  const status = h('p', { class: 'muted', role: 'status' });

  const form = h('form', {
    class: 'card',
    onsubmit: async (e: Event) => {
      e.preventDefault();
      const s = slugFromLabel(slug.value);
      const dest = destination.value.trim() || '/';
      if (!s) { status.textContent = 'The slug can only use a–z, 0–9, - and _.'; return; }
      if (!dest.startsWith('/')) { status.textContent = 'The destination must be a page on your site, starting with /.'; return; }
      status.textContent = 'Creating…';
      try {
        await api.createLink({ slug: s, label: label.value.trim(), channel: channel.value, destination: dest });
        view()?.replaceChildren(await linksView(api));
      } catch (err) { status.textContent = `Could not create link: ${msg(err)}`; }
    },
  },
    h('h2', {}, 'New tracked link'),
    h('div', { class: 'row' }, h('label', {}, 'Label', label), h('label', {}, 'Slug', slug)),
    h('div', { class: 'row' }, h('label', {}, 'Channel', channel), h('label', {}, 'Lands on', destination)),
    h('button', { class: 'btn btn-primary', type: 'submit' }, 'Create link'),
    status);

  const copyButton = (text: string, labelText: string) => {
    const b = h('button', { class: 'btn btn-ghost', type: 'button' }, labelText);
    b.addEventListener('click', () => {
      if (!navigator.clipboard) { b.textContent = 'Copy not supported'; return; }
      navigator.clipboard.writeText(text).then(() => { b.textContent = 'Copied'; }, () => { b.textContent = 'Copy failed'; });
    });
    return b;
  };

  const cards = stats.map((l) => {
    const u = trackedUrl(site.url, l.destination, l.slug);
    return h('article', { class: 'card link' },
      h('h3', {}, l.label),
      h('p', { class: 'mono' }, u),
      h('p', { class: 'muted' }, `${l.channel} · ${l.landings} visits · ${l.visitors} consented visitors · ${l.leads} leads · ${conversionRate(l.leads, l.landings)} conversion`),
      h('div', { class: 'row' }, copyButton(u, 'Copy link'), copyButton(shareText(u), 'Copy WhatsApp message')));
  });

  return h('section', {}, form, h('h2', {}, `Your links (${stats.length})`), ...(cards.length ? cards : [h('p', { class: 'muted' }, 'No links yet.')]));
}

async function overviewView(api: Api): Promise<HTMLElement> {
  const [o, stats] = await Promise.all([api.overview(30), api.linkStats()]);
  const top = [...stats].sort((a, b) => b.landings - a.landings).slice(0, 5);
  const tile = (n: number, label: string) => h('div', { class: 'card tile' }, h('strong', {}, String(n)), h('span', { class: 'muted' }, label));
  return h('section', {},
    h('h2', {}, 'Last 30 days'),
    h('div', { class: 'grid-3' }, tile(o.landings, 'tracked-link visits'), tile(o.views, 'page views (consented)'), tile(o.leads, 'leads')),
    h('h2', {}, 'Top links'),
    top.length ? h('ol', {}, ...top.map((l) => h('li', {}, `${l.label}: ${l.landings} visits, ${l.leads} leads`))) : h('p', { class: 'muted' }, 'No tracked links yet.'));
}
```

- [ ] **Step 5: Admin layout and page**

`src/layouts/AdminLayout.astro`:
```astro
---
import '@fontsource-variable/inter';
import '@fontsource/playfair-display/600.css';
import '../styles/global.css';
import Seo from '../components/Seo.astro';
---
<!doctype html>
<html lang="en-GB">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
    <Seo title="CRM Dashboard" description="Private Apex Designs lead dashboard." noindex />
  </head>
  <body>
    <main class="container admin-shell"><slot /></main>
  </body>
</html>
<style is:global>
  .admin-shell { padding-block: 40px 80px; }
  .admin-shell h1 { font-size: 2rem; display: flex; align-items: center; gap: 12px; }
  .admin-nav { display: flex; flex-wrap: wrap; gap: 8px 20px; align-items: center; margin: 16px 0 32px; }
  .admin-nav a { color: var(--mist-dim); text-decoration: none; font-weight: 600; }
  .admin-nav a.active { color: var(--teal-glow); }
  .admin-nav .btn { margin-left: auto; padding: 0.6em 1em; }
  .admin-shell .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 16px; flex-wrap: wrap; }
  .admin-shell .table-wrap { overflow-x: auto; }
  .admin-shell table { width: 100%; border-collapse: collapse; }
  .admin-shell th, .admin-shell td { text-align: left; padding: 12px 10px; border-bottom: 1px solid var(--line); }
  .admin-shell td a { color: var(--teal-glow); }
  .admin-shell input, .admin-shell select, .admin-shell textarea { font: inherit; color: var(--mist); background: rgb(255 255 255 / 0.04); border: 1px solid var(--line); border-radius: 10px; padding: 0.6em 0.8em; width: 100%; }
  .admin-shell td select { width: auto; }
  .admin-shell select.failed { border-color: #ff8a80; }
  .admin-shell label { display: grid; gap: 6px; font-weight: 600; }
  .admin-shell form { display: grid; gap: 14px; margin-bottom: 32px; }
  .admin-shell .row { display: flex; flex-wrap: wrap; gap: 12px; align-items: end; }
  .admin-shell .row > label { flex: 1 1 220px; }
  .admin-shell .login { max-width: 420px; }
  .admin-shell .facts { display: grid; grid-template-columns: max-content 1fr; gap: 8px 16px; }
  .admin-shell dt { color: var(--mist-dim); }
  .admin-shell dd { margin: 0; }
  .admin-shell .pre { white-space: pre-wrap; }
  .admin-shell .timeline { padding-left: 1.2em; display: grid; gap: 10px; }
  .admin-shell .timeline time { color: var(--mist-dim); font-size: 0.85rem; }
  .admin-shell .mono { font-family: ui-monospace, monospace; word-break: break-all; }
  .admin-shell .link { margin-bottom: 16px; }
  .admin-shell .tile strong { display: block; font: 600 2.4rem/1 var(--font-display); }
  .admin-shell .error { color: #ff8a80; }
</style>
```

`src/pages/admin/index.astro`:
```astro
---
import AdminLayout from '../../layouts/AdminLayout.astro';
---
<AdminLayout>
  <h1><img src="/favicon.svg" width="32" height="32" alt="" /> Apex CRM</h1>
  <div id="admin"><p class="muted">Loading…</p></div>
</AdminLayout>
<script>
  import '../../scripts/admin/main';
</script>
```

- [ ] **Step 6: Verify and commit**

Run: `npm test && npm run build` → Expected: all pass; `dist/admin/index.html` has `noindex`; `dist/sitemap-0.xml` has no `/admin/`. Check that supabase-js isn't loaded on public pages: `grep -l "supabase" dist/_astro/*.js` should list only chunks imported by the admin page (confirm by opening `/` in dev and checking the Network tab).

```bash
git add src/lib/admin-helpers.ts src/scripts/admin src/layouts/AdminLayout.astro src/pages/admin tests/admin-helpers.test.ts tests/dom.test.ts
git commit -m "feat: add private CRM dashboard for leads and tracked links"
```

---

### Task 18: Setup guide, README and end-to-end verification

**Files:**
- Create: `docs/SETUP.md`, `README.md`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write docs/SETUP.md**

`docs/SETUP.md` must contain these sections with these exact commands and values:

1. **Contact details**: edit `src/config/site.ts` (`email`, `whatsapp`). The build warns until the WhatsApp placeholder is replaced.
2. **Supabase project**: create a project (region: London `eu-west-2`). Copy the Project URL and the anon (or publishable) key from Project Settings → API into `.env` (see `.env.example`).
3. **Database**: either paste `supabase/migrations/20261027000000_crm.sql` and then `20261027000100_retention.sql` into the SQL editor, or run:
   ```bash
   npx supabase@latest login
   npx supabase@latest init
   npx supabase@latest link --project-ref YOUR-PROJECT-REF
   npx supabase@latest db push
   ```
   Then run `supabase/tests/rls_test.sql` in the SQL editor and confirm `RLS OK`.
4. **Admin login**: Authentication → Sign In / Providers → turn off "Allow new users to sign up". Authentication → URL Configuration → Site URL `https://apexdesigns.org.uk`, Redirect URLs `https://apexdesigns.org.uk/admin/` and `http://localhost:4321/admin/`. Authentication → Users → Invite user (your email). Then in the SQL editor: `insert into public.admins (email) values ('you@yourdomain');` (lowercase). Optional: Authentication → SMTP Settings → use Hostinger (`smtp.hostinger.com`, port 465) so sign-in emails come from your domain and avoid Supabase's low default email rate limit.
5. **Lead function**:
   ```bash
   npx supabase@latest secrets set SMTP_USER=you@yourdomain SMTP_PASS='your-mailbox-password' NOTIFY_TO=you@yourdomain ALLOWED_ORIGINS=https://apexdesigns.org.uk,https://www.apexdesigns.org.uk,http://localhost:4321
   npx supabase@latest functions deploy submit-lead --no-verify-jwt
   ```
   Test it:
   ```bash
   curl -i -X POST "https://YOUR-PROJECT-REF.supabase.co/functions/v1/submit-lead" -H "Content-Type: application/json" -H "Origin: http://localhost:4321" -d '{"name":"Setup Test","email":"you@yourdomain","message":"Testing the lead function","elapsed":5000}'
   ```
   Expected: `200 {"ok":true}`, a row in `leads`, and an email in your Hostinger inbox.
6. **GitHub**: create a repository, push `main`. Settings → Pages → Source: **GitHub Actions**. Settings → Secrets and variables → Actions → **Variables**: `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`. Settings → Pages → Custom domain `apexdesigns.org.uk`. Recommended: verify the domain under your GitHub account (Settings → Pages → Verified domains) to prevent takeover.
7. **Hostinger DNS** (hPanel → Domains → DNS / Nameservers):
   - Delete the existing `A` (and any `AAAA`) records for `@` that point at Hostinger web hosting.
   - Add `A` records for `@`: `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153`.
   - Optional `AAAA` for `@`: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.
   - Set `CNAME` `www` → `YOUR-GITHUB-USERNAME.github.io`.
   - **Do not touch** `MX`, the `TXT` records for SPF/DKIM/DMARC, or mail-related `CNAME`s (`autodiscover`, `autoconfig`, etc.). These keep your Hostinger email working.
   - After DNS propagates, tick **Enforce HTTPS** in GitHub Pages settings.
   - Before cancelling any Hostinger plan, check whether your email is bundled with the web hosting plan. If it is, keep the plan (or move email to a standalone Hostinger email plan) or your mailboxes will stop working.
8. **After launch**: add the site to Google Search Console (domain property), submit `https://apexdesigns.org.uk/sitemap-index.xml`, and check Pages → "Not found (404)" for old WordPress URLs to add to `redirects` in `astro.config.mjs`. Keep `public_html.zip` as your WordPress backup.
9. **Using the CRM**: open `/admin/`, sign in, Tracked links → create e.g. label "Romford Traders WhatsApp" → "Copy WhatsApp message" → paste into the group. Visits, consented journeys and leads appear against that link.

- [ ] **Step 2: Write README.md**

`README.md`: project summary (one paragraph); stack list; `npm install`, `npm run dev`, `npm test`, `npm run build`, `npm run preview`; where to edit things (contact details `src/config/site.ts`, prices `src/data/packages.ts`, reviews `src/data/reviews.ts`, areas `src/data/locations.ts`, case studies `src/content/work/`, articles `src/content/learn/`); link to `docs/SETUP.md` and to the spec and this plan.

- [ ] **Step 3: Full local verification**

Run: `npm test` → Expected: all test files pass.
Run: `npm run build` → Expected: `astro check` with 0 errors, build succeeds, `✓ SEO audit passed for N pages` (N ≈ 24).
Run: `npm run preview`, then in Chrome (DevTools MCP or manual) check:
- `/`: 3D hero renders, mouse tilt and scroll climb work, no console errors; at 375px no horizontal scroll; reduced-motion shows the fallback.
- Every nav and footer link resolves (no 404s), including `/portfolio/` → `/work/`.
- Consent banner: Accept / No thanks / Cookie settings behave as in Task 14.
- `/quote/`: field errors, `?package=premium` preselect, `mailto:` fallback without `.env`.
- Lighthouse (mobile) on `/` and `/services/`: Performance, Accessibility, Best Practices, SEO each ≥ 90. Run: `npx -y lighthouse http://localhost:4321/ --only-categories=performance,accessibility,best-practices,seo --chrome-flags="--headless=new" --output=json --output-path=./lighthouse-home.json` and read the four scores (delete the JSON afterwards; don't commit it). If Performance is under 90, first check the hero chunk is lazily loaded and the largest image is AVIF/WebP.

- [ ] **Step 4: Live verification (needs the Supabase project from SETUP steps 2–5)**

With `.env` filled in, `npm run dev`:
- Visit `/?ref=setup-test` with consent declined → in Supabase, `events` has one `ref_landing` with null `visitor_id`.
- Accept analytics, browse two pages, submit the quote form → `visitors` row, `page_view` events with that `visitor_id`, a `leads` row with `first_ref = 'setup-test'`, and a notification email.
- `/admin/` → sign in with the magic link → the lead shows its journey; create a tracked link `setup-test` and confirm its stats count the landing and the lead.
- Sign in with a non-admin invited account (optional) → "Not authorised".
- Run `supabase/tests/rls_test.sql` → `RLS OK` (if not already done in Task 13).
Delete the test rows afterwards (`delete from leads where email = 'you@yourdomain' and name = 'Setup Test';` etc.).

- [ ] **Step 5: Commit**

```bash
git add docs/SETUP.md README.md
git commit -m "docs: add setup guide and README"
```
