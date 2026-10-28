// Shared by the website (Vite) and the Edge Function (Deno). Only relative .ts imports allowed.
import { sanitizeRef } from './ref.ts';

export const PACKAGE_CHOICES = ['standard', 'premium', 'custom', 'unsure'] as const;
export type PackageChoice = (typeof PACKAGE_CHOICES)[number];
export const MIN_FILL_MS = 3000;

export interface CleanLead {
  name: string;
  email: string;
  phone: string | null;
  business: string | null;
  package: PackageChoice | null;
  message: string;
  ref: string | null;
  first_ref: string | null;
  visitor_id: string | null;
}

export type LeadResult =
  | { ok: true; lead: CleanLead }
  | { ok: false; spam: true }
  | { ok: false; spam: false; errors: Record<string, string> };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[0-9+()\s-]{6,30}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CONTROL = /[\u0000-\u001f\u007f]/;
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

/**
 * Validates a quote request. Spam timing uses `elapsed` (ms the visitor spent on the form,
 * measured in their browser) so a wrong client clock can never drop a real lead.
 */
export function validateLead(raw: unknown): LeadResult {
  if (!raw || typeof raw !== 'object') return { ok: false, spam: false, errors: { form: 'Something went wrong. Please try again.' } };
  const r = raw as Record<string, unknown>;

  if (text(r.hp) !== '') return { ok: false, spam: true };
  const elapsed = Number(r.elapsed);
  if (!Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) return { ok: false, spam: true };

  const name = text(r.name);
  const email = text(r.email).toLowerCase();
  const phone = text(r.phone);
  const business = text(r.business);
  const pkg = text(r.package);
  const message = text(r.message);

  const errors: Record<string, string> = {};
  if (!name) errors.name = 'Please tell me your name.';
  else if (name.length > 100 || CONTROL.test(name)) errors.name = 'Please enter your name without special characters (max 100).';
  if (email.length > 200 || !EMAIL.test(email)) errors.email = 'Please enter a valid email address.';
  if (phone && !PHONE.test(phone)) errors.phone = 'Please enter a valid phone number.';
  if (business.length > 120 || CONTROL.test(business)) errors.business = 'Please use a shorter business name.';
  if (pkg && !(PACKAGE_CHOICES as readonly string[]).includes(pkg)) errors.package = 'Please choose a package from the list.';
  if (message.length < 10) errors.message = 'Please tell me a little more (at least 10 characters).';
  else if (message.length > 2000) errors.message = 'Please keep your message under 2,000 characters.';
  if (Object.keys(errors).length) return { ok: false, spam: false, errors };

  const vid = text(r.visitor_id);
  return {
    ok: true,
    lead: {
      name,
      email,
      phone: phone || null,
      business: business || null,
      package: (pkg || null) as PackageChoice | null,
      message,
      ref: sanitizeRef(r.ref),
      first_ref: sanitizeRef(r.first_ref),
      visitor_id: UUID.test(vid) ? vid : null,
    },
  };
}

export function formatLeadEmail(lead: CleanLead, id: string, siteUrl = 'https://apexdesigns.org.uk'): { subject: string; text: string } {
  const subject = `New quote request: ${lead.name}${lead.business ? ` (${lead.business})` : ''}`;
  const body = [
    `Name: ${lead.name}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone ?? '-'}`,
    `Business: ${lead.business ?? '-'}`,
    `Package: ${lead.package ?? '-'}`,
    `Source link: ${lead.first_ref ?? lead.ref ?? 'none'}`,
    '',
    lead.message,
    '',
    `View in dashboard: ${siteUrl}/admin/#lead=${id}`,
  ];
  return { subject, text: body.join('\n') };
}

/** Caps lead-notification emails so a flood of fake submissions cannot exhaust the Hostinger mailbox. Leads are still saved. */
export const NOTIFY_CAPS = { perHour: 20, perEmailPerHour: 3 } as const;

export function shouldNotify(recent: { lastHour: number; sameEmailLastHour: number }): boolean {
  return recent.lastHour < NOTIFY_CAPS.perHour && recent.sameEmailLastHour < NOTIFY_CAPS.perEmailPerHour;
}

/** Hostinger SMTP over implicit TLS (Supabase blocks 25/587), with short timeouts so a slow server cannot hang the function. */
export function smtpOptions(host: string, user: string, pass: string) {
  return { host, port: 465, secure: true, auth: { user, pass }, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 10_000 };
}
