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

describe('notification cap and SMTP options (final review)', () => {
  it('stops emailing when the endpoint is being flooded', async () => {
    const { shouldNotify, NOTIFY_CAPS } = await import('../supabase/functions/_shared/lead.ts');
    expect(shouldNotify({ lastHour: 0, sameEmailLastHour: 0 })).toBe(true);
    expect(shouldNotify({ lastHour: NOTIFY_CAPS.perHour, sameEmailLastHour: 0 })).toBe(false);
    expect(shouldNotify({ lastHour: 1, sameEmailLastHour: NOTIFY_CAPS.perEmailPerHour })).toBe(false);
  });
  it('sets short SMTP timeouts so a slow mail server cannot hang the function', async () => {
    const { smtpOptions } = await import('../supabase/functions/_shared/lead.ts');
    const o = smtpOptions('smtp.hostinger.com', 'u', 'p');
    expect(o).toMatchObject({ host: 'smtp.hostinger.com', port: 465, secure: true, auth: { user: 'u', pass: 'p' } });
    for (const k of ['connectionTimeout', 'greetingTimeout', 'socketTimeout'] as const) expect(o[k]).toBeLessThanOrEqual(10_000);
  });
});
