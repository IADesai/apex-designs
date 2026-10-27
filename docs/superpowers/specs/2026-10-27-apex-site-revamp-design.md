# Apex Designs — Site Revamp + Mini-CRM — Design Spec

Date: 2026-10-27
Status: Approved in chat, awaiting written-spec review

## 1. Goal

Replace the WordPress site at apexdesigns.org.uk with a fast, static, Node-built site that:

- looks current (WebGL/Three.js-led, dark, premium) while keeping the Apex brand,
- outranks local competitors (notably danielemanca.co.uk, Leyton) for Romford / East London / Essex web design searches,
- tracks where warm leads come from (especially links posted in WhatsApp community groups) and shows their journey in a private dashboard.

Success criteria:

- Site deploys to GitHub Pages from `main` via GitHub Actions and serves on `apexdesigns.org.uk` (Hostinger DNS).
- Lighthouse (mobile) ≥ 90 for Performance, SEO, Accessibility, Best Practices on Home and Services.
- Every page is pre-rendered HTML with unique title, meta description, canonical, OG tags; sitemap + robots present; LocalBusiness JSON-LD validates.
- A visitor arriving via `?ref=<slug>` is attributed to that tracked link; a quote submission from that visitor shows the link and their page journey in `/admin`.
- Public (anon) clients cannot read any CRM data.

## 2. Known facts (from existing site)

- Brand: mountain-peak logo, teal-green + charcoal; headings Playfair Display; tagline "Websites that click!".
- Founder: Ibrahim. One-person studio. Based in **Romford**, works across East London, Essex, and UK-wide (has an Oxford client).
- Packages (keep visible, affordable):
  - Standard — £300: custom single page website, consultation call, scheduled development plan, free hosting, custom email & logo.
  - Premium — £500 + £15/month: everything in Standard + custom multi-page website, Google Business Profile, Google Analytics, continuous support.
  - Custom — price on quote: everything in Premium + custom coded systems, tailored brand-specific designs, on-call maintenance, continuous page updates.
- Portfolio: Damal Restaurant (Whitechapel, Somali restaurant, Damal green + Mecca marbling), Damal Banqueting (modern/contemporary, matched existing identity), My Thermomix My Way (sales funnel routing customers to the right salesperson), Whitebeard Accounting & Bookkeeping (modern professional/clean). Mockups exist in the WP uploads.
- Google reviews (5, "Excellent"): Aftab Hafiz, Mohamoud Abdi (Damal), Imran A, Talhah Chowdhury, Ayub Desai — verbatim text recorded in `src/data/reviews.ts`.

## 3. Architecture

```
GitHub repo ──(push main)──> GitHub Actions: npm ci && astro build ──> GitHub Pages (static dist/)
                                                                        │
Browser ── static HTML/CSS + small JS islands ─────────────────────────┘
   │  tracker.ts (consent-aware)  ── insert ──> Supabase Postgres (events, visitors)   [RLS: anon insert-only]
   │  quote form                  ── POST  ──> Supabase Edge Function submit-lead ──> leads table + email (Resend)
   └  /admin (supabase-js, magic link) ── select/update ──> all CRM tables            [RLS: admin emails only]
```

- **Framework:** Astro (latest stable 5.x), TypeScript, static output, `site: 'https://apexdesigns.org.uk'`.
- **3D:** vanilla `three` in a single hero script, dynamically imported so it never blocks first paint. No React.
- **Motion:** Lenis (smooth scroll) + GSAP ScrollTrigger for section reveals and hero camera scroll-scrub.
- **Content:** Astro content collections — `learn` (Markdown articles), `work` (case studies). Site-wide facts (contact, prices, areas) in `src/config/site.ts`.
- **Backend:** Supabase (Postgres + Auth + one Edge Function). No other server.
- **Hosting/DNS:** `public/CNAME` = `apexdesigns.org.uk`. Hostinger DNS: apex A records → 185.199.108.153 / .109 / .110 / .111; `www` CNAME → `<github-user>.github.io`. MX/email records untouched.

## 4. Visual design

- Tokens: `--teal: #3E7D6E` (from logo), `--teal-glow: #5FD3B5` (accent/glow), `--charcoal: #2B3030`, `--ink: #0B0F0E` (dark background), `--mist: #E8EFEC` (text on dark). Final values tuned against the logo during build.
- Type: Playfair Display (display headings), Inter (body/UI), self-hosted via `@fontsource` for performance.
- Style: dark-first, film grain overlay, soft teal glow, glassmorphism cards, large editorial type, magnetic buttons, cursor-follow highlight on cards. Respect `prefers-reduced-motion` (disables Lenis, GSAP scrubs, hero animation).
- **Hero:** low-poly mountain range built procedurally (displaced plane + flat shading) with a dominant central peak echoing the logo; teal/charcoal faceted materials, fog, subtle snow cap on the apex. Mouse parallax tilts the scene; scroll moves the camera up and toward the peak, ending above it as the hero fades out. Pixel ratio capped at 2; render loop pauses when off-screen or tab hidden. Fallback: static gradient + logo-peak SVG when WebGL is unavailable, reduced motion is set, or `navigator.connection.saveData` is on.

## 5. Pages & SEO

| Route | Purpose / primary keyword |
|---|---|
| `/` | Web design Romford & East London — hero, proof (reviews), packages teaser, work, process, areas, CTA |
| `/services/` | Website packages & prices (from config), FAQ (FAQPage schema) |
| `/work/` + `/work/<slug>/` | Portfolio index + 4 case studies |
| `/about/` | Ibrahim, one-person studio story, values |
| `/quote/` | Quote form (lead capture) + WhatsApp + email |
| `/web-design-romford/` | Location page (primary) |
| `/web-design-east-london/` | Location page |
| `/web-design-essex/` | Location page |
| `/remote-web-design-uk/` | Location page (Oxford client proof) |
| `/learn/` + `/learn/<slug>/` | Blog; 3 starter articles (cost guide Romford/East London 2026; WordPress vs custom code; Google Business Profile for local shops) |
| `/privacy/`, `/cookies/`, `/terms/` | Legal |
| `/admin/` | CRM dashboard (`noindex`, excluded from sitemap) |
| `/404` | Not found |

SEO mechanics: a `<Seo>` component per page (title, description, canonical, OG/Twitter, image); `@astrojs/sitemap`; `robots.txt` (disallow `/admin/`); JSON-LD: `ProfessionalService` (name, url, logo, areaServed: Romford, Havering, East London, Essex, United Kingdom; founder; sameAs), `Review`/`AggregateRating` from reviews data, `FAQPage` on Services, `BreadcrumbList` on inner pages, `Article` on Learn posts. One H1 per page containing service + location. Internal links between location pages, services and relevant articles. Location pages have distinct copy (not spun duplicates).

## 6. CRM data model (Supabase / Postgres)

```sql
links     (id uuid pk, slug text unique, label text, channel text  -- e.g. 'whatsapp'
           , destination text default '/', created_at timestamptz)
visitors  (id uuid pk  -- generated client-side, stored only after consent
           , first_seen timestamptz, first_ref text, first_utm jsonb, user_agent text)
events    (id bigint identity pk, visitor_id uuid null, session_id uuid null,
           type text  -- page_view | ref_landing | cta_click | whatsapp_click | scroll_depth | form_start | form_submit
           , path text, ref text null, props jsonb, created_at timestamptz default now())
leads     (id uuid pk, visitor_id uuid null, name text, email text, phone text, business text,
           package text, message text, ref text null, first_ref text null,
           status text default 'new' check in ('new','warm','quoted','won','lost'),
           notes text, created_at timestamptz, updated_at timestamptz)
admins    (email text pk)
```

RLS:

- `events`, `visitors`: `anon` may INSERT only (check constraints: `type` in allowed list, text lengths bounded, `props` size bounded); no SELECT/UPDATE/DELETE for anon. Inserts use `Prefer: return=minimal` so no read policy is needed.
- `leads`, `links`, `admins`: no anon access at all. Leads are inserted only by the Edge Function (service role). The tracker sends the raw `ref` string; the dashboard joins `events.ref = links.slug`.
- All CRM tables: full access for `authenticated` users whose `auth.jwt()->>'email'` exists in `admins` (checked via a `security definer` function `is_admin()`).

Views for the dashboard (`security_invoker = true` so RLS applies): `link_stats` (per slug: landings, unique visitors, leads, conversion %).

## 7. Tracking behaviour (`src/lib/tracker.ts`)

- On load: parse `ref` and `utm_*` from the URL; persist `ref` in `sessionStorage` (session-scoped, functional) so the quote form can submit it.
- **No consent (default):** send one `ref_landing` event (no visitor/session ID) only when a `ref` is present. Nothing else.
- **Consent granted** (banner "Accept analytics"): create/read `visitor_id` + first-touch data in `localStorage`, `session_id` in `sessionStorage`; insert visitor on first creation; send `page_view`, `cta_click` (elements with `data-track`), `whatsapp_click`, `scroll_depth` (25/50/75/100), `form_start`, `form_submit`.
- Events are batched and sent with `fetch(..., {keepalive:true})` to the Supabase REST endpoint; failures are swallowed (tracking must never break the page) but logged to console in dev.
- Consent banner: Accept / Reject equal prominence; choice stored in `localStorage` (`apex-consent`); "Cookie settings" link in footer reopens it. Cookie policy page documents exactly the above.
- WhatsApp button: `wa.me/<number>?text=` prefilled with "Hi Ibrahim, I found you via <ref or page>…".

## 8. Lead submission (`supabase/functions/submit-lead`)

- Accepts JSON `{name, email, phone?, business?, package?, message, ref?, first_ref?, visitor_id?, hp, t}`.
- Validates (shared module `src/lib/lead-validation.ts`, copied into the function at deploy): required fields, email format, length limits; rejects if honeypot `hp` filled or submitted < 3s after form render (`t`). CORS restricted to the site origin (+ localhost in dev).
- Inserts into `leads` with service role; inserts `form_submit` event; sends notification email via Resend (API key in function secrets) to the owner. If email fails, the lead is still saved and the function returns 200 (email failure logged).
- Client shows success state; on network/server error shows a message with WhatsApp/email fallback — the user is never left with a silent failure.

## 9. Admin dashboard (`/admin/`)

- Supabase Auth magic link; after login, if the email isn't in `admins`, RLS returns nothing and the UI shows "Not authorised".
- Sections: **Leads** (table, filter by status, edit status + notes inline), **Lead detail** (contact info, source link, event timeline by `visitor_id`), **Links** (create slug/label/channel → copyable tracked URL + WhatsApp-ready share text; stats from `link_stats`), **Overview** (landings & leads last 30 days, top links).
- Astro page with a vanilla-TS client module; `noindex`.

## 10. Config & setup

- `src/config/site.ts`: name, founder, email, WhatsApp number, base area, areas served, prices/packages, social links. Email/WhatsApp are clearly marked placeholders — the only intended placeholders.
- `.env` (build-time, public): `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`. Lead endpoint derived as `${PUBLIC_SUPABASE_URL}/functions/v1/submit-lead`. Provided to Actions as repo variables. If unset, tracker no-ops and the form falls back to a `mailto:` link.
- `supabase/migrations/*.sql` for schema + RLS + views; `docs/SETUP.md` covering Supabase project creation, running migrations, deploying the function, setting Resend key, adding your email to `admins`, GitHub Pages + Hostinger DNS steps.

## 11. Assets

Copied from the WordPress zip into `src/assets/`: the green logo, the 4 portfolio mockups (optimised to WebP via Astro `<Image>`). An SVG redraw of the peak mark for nav/favicon. The 930 MB `public_html.zip` is git-ignored.

## 12. Testing

- **Unit (Vitest):** tracker (consent gating, ref/utm parsing, batching, no-op without env), lead validation, SEO helper (canonical/title formatting).
- **SQL/RLS:** `supabase/tests/rls.sql` asserting anon cannot select from CRM tables and can insert valid events only (run against local Supabase or the project).
- **Build checks:** `astro check` + `astro build` in CI; a post-build script asserting each HTML page has one H1, a title, meta description and canonical, and that `/admin/` is `noindex` and absent from the sitemap.
- **Manual/browser:** Lighthouse on Home/Services; hero fallback with reduced motion; end-to-end lead flow against a real Supabase project.

## 13. Out of scope (v1)

Online payments, client portal, CMS editing UI (content is Markdown/TS in repo), multi-user admin roles, automated WhatsApp messaging, A/B testing.
