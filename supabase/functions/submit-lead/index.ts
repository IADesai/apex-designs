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
