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
