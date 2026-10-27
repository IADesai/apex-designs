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
