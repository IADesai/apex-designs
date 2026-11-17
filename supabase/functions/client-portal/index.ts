// Supabase Edge Function (Deno): the only way the client portal reads or writes data.
// Deploy: npx supabase@latest functions deploy client-portal --no-verify-jwt
// Secrets: the same ones as submit-lead (SMTP_USER, SMTP_PASS, NOTIFY_TO, ALLOWED_ORIGINS).
import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6';
import { smtpOptions } from '../_shared/lead.ts';
import { cleanToken, validateChange, formatChangeEmail, DAILY_REQUEST_CAP, type CleanChange } from '../_shared/change.ts';

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

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
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

async function notify(client: { name: string; business: string; email: string | null }, change: CleanChange, id: string): Promise<void> {
  const user = Deno.env.get('SMTP_USER');
  const pass = Deno.env.get('SMTP_PASS');
  const to = Deno.env.get('NOTIFY_TO') ?? user;
  if (!user || !pass || !to) { console.warn('SMTP not configured; skipping notification'); return; }
  const transport = nodemailer.createTransport(smtpOptions(Deno.env.get('SMTP_HOST') ?? 'smtp.hostinger.com', user, pass));
  const { subject, text } = formatChangeEmail(client, change, id);
  await transport.sendMail({ from: `"Apex Designs portal" <${user}>`, to, replyTo: client.email ?? undefined, subject, text });
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const cors = corsHeaders(origin);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, cors);
  if (origin && !ALLOWED.includes(origin)) return json({ error: 'Forbidden' }, 403, cors);

  let raw: Record<string, unknown>;
  try { raw = (await req.json()) as Record<string, unknown>; } catch { return json({ error: 'Invalid request' }, 400, cors); }

  const token = cleanToken(raw?.token);
  if (!token) return json({ error: 'This link is not valid.' }, 404, cors);

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: client, error: clientErr } = await db.from('clients').select('id,name,business,email,site_url').eq('token', token).eq('active', true).maybeSingle();
  if (clientErr) { console.error('client lookup failed', clientErr); return json({ error: 'Could not load your portal' }, 500, cors); }
  if (!client) return json({ error: 'This link is not valid.' }, 404, cors);

  if (raw.action === 'open') {
    const { data: requests, error } = await db.from('change_requests')
      .select('id,title,status,reply,created_at').eq('client_id', client.id).order('created_at', { ascending: false }).limit(50);
    if (error) { console.error('request list failed', error); return json({ error: 'Could not load your requests' }, 500, cors); }
    return json({ client: { name: client.name, business: client.business, site_url: client.site_url }, requests: requests ?? [] }, 200, cors);
  }

  if (raw.action !== 'submit') return json({ error: 'Unknown action' }, 400, cors);

  const result = validateChange(raw);
  if (!result.ok) return json({ errors: result.errors }, 422, cors);

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await db.from('change_requests').select('id', { count: 'exact', head: true }).eq('client_id', client.id).gte('created_at', since);
  if ((count ?? 0) >= DAILY_REQUEST_CAP) return json({ error: 'That is a lot of requests for one day. Please message us directly.' }, 429, cors);

  const { data, error } = await db.from('change_requests').insert({ client_id: client.id, ...result.change }).select('id,title,status,reply,created_at').single();
  if (error || !data) { console.error('change request insert failed', error); return json({ error: 'Could not save your request' }, 500, cors); }

  // Email after responding, as in submit-lead: a slow mail server must not make a saved request look failed.
  const sendEmail = notify(client, result.change, data.id).catch((e) => console.error('notification email failed', e));
  if (typeof EdgeRuntime !== 'undefined') EdgeRuntime.waitUntil(sendEmail);
  else await sendEmail;
  return json({ ok: true, request: data }, 200, cors);
});
