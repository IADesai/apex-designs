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

// Tell the team which link someone came from when they open WhatsApp.
const ref = tracker.leadContext().ref;
if (ref) {
  const text = `Hi, I found Apex Designs via ${ref}. I'd like to chat about a website.`;
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
