# Apex Designs website

The website for [Apex Designs](https://apexdesigns.org.uk), a one-person web studio in Romford. It's a static Astro site with a Three.js low-poly peak hero, built for local SEO, plus a small Supabase-backed CRM: tracked links for WhatsApp groups, consent-aware clickstream, quote leads and a private `/admin/` dashboard. It's hosted on GitHub Pages.

## Stack

- Astro 7 (static output), TypeScript
- three.js (home hero only, lazy-loaded), GSAP + Lenis for motion
- Supabase: Postgres with row level security, Auth (magic link), one Edge Function (`submit-lead`, emails via Hostinger SMTP)
- Vitest for unit tests; a post-build SEO audit (`scripts/check-seo.mjs`)
- GitHub Actions → GitHub Pages

## Commands

```bash
npm install
npm run dev       # http://localhost:4321
npm test          # unit tests
npm run build     # type check + build + SEO audit
npm run preview   # serve the built site
```

## Where to edit things

| What | Where |
| --- | --- |
| Email, WhatsApp number, areas | `src/config/site.ts` |
| Packages and prices | `src/data/packages.ts` |
| Google reviews | `src/data/reviews.ts` |
| Services FAQ | `src/data/faqs.ts` |
| Location pages | `src/data/locations.ts` |
| Case studies | `src/content/work/*.md` |
| Blog articles | `src/content/learn/*.md` |
| Colours and fonts | `src/styles/global.css` |
| Old URL redirects | `astro.config.mjs` |

## Setup and launch

See [docs/SETUP.md](docs/SETUP.md) for Supabase, GitHub Pages and the Hostinger DNS change (which keeps your email working).

Design and planning: [spec](docs/superpowers/specs/2026-10-27-apex-site-revamp-design.md) · [implementation plan](docs/superpowers/plans/2026-10-27-apex-site-revamp.md)
