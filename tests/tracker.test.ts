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
