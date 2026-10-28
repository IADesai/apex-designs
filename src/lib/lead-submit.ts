export type SubmitOutcome =
  | { ok: true }
  | { ok: false; kind: 'invalid'; errors: Record<string, string> }
  | { ok: false; kind: 'network' | 'server' | 'unconfigured' | 'busy' };

export function leadEndpoint(supabaseUrl: string | undefined): string | undefined {
  return supabaseUrl ? `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/submit-lead` : undefined;
}

export function createLeadSubmitter(endpoint: string | undefined, fetchFn: typeof fetch, timeoutMs = 20_000) {
  let inFlight = false;
  return async function submit(payload: Record<string, unknown>): Promise<SubmitOutcome> {
    if (!endpoint) return { ok: false, kind: 'unconfigured' };
    if (inFlight) return { ok: false, kind: 'busy' };
    inFlight = true;
    // A stalled connection (common in in-app browsers) must end in the WhatsApp/email fallback, not an endless spinner.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetchFn(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal });
      if (res.status === 422) {
        const body = (await res.json().catch(() => ({}))) as { errors?: Record<string, string> };
        return { ok: false, kind: 'invalid', errors: body.errors ?? {} };
      }
      if (!res.ok) return { ok: false, kind: 'server' };
      return { ok: true };
    } catch {
      return { ok: false, kind: 'network' };
    } finally {
      clearTimeout(timer);
      inFlight = false;
    }
  };
}

export function buildMailto(to: string, fields: Record<string, string>): string {
  const subject = `Website quote request${fields.name ? ` from ${fields.name}` : ''}`;
  const body = Object.entries(fields).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n');
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
