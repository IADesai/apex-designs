// Shared by the website (Vite) and the Edge Function (Deno). No imports allowed.

export const CHANGE_KINDS = ['text', 'image', 'new', 'fix', 'design', 'other'] as const;
export type ChangeKind = (typeof CHANGE_KINDS)[number];
export const URGENCIES = ['urgent', 'normal', 'whenever'] as const;
export type Urgency = (typeof URGENCIES)[number];
export const CHANGE_STATUSES = ['new', 'approved', 'in_progress', 'done', 'declined'] as const;
export type ChangeStatus = (typeof CHANGE_STATUSES)[number];

export const TOKEN_PATTERN = /^[0-9a-f]{64}$/;
/** Most requests one client can send in 24 hours, so a leaked link cannot flood the inbox. */
export const DAILY_REQUEST_CAP = 15;

export interface ChatLine { from: 'agent' | 'client'; text: string }

export interface CleanChange {
  title: string;
  kind: ChangeKind;
  page: string | null;
  details: string;
  urgency: Urgency;
  transcript: ChatLine[];
}

export type ChangeResult = { ok: true; change: CleanChange } | { ok: false; errors: Record<string, string> };

const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');

export function cleanToken(raw: unknown): string | null {
  const t = text(raw).toLowerCase();
  return TOKEN_PATTERN.test(t) ? t : null;
}

function cleanTranscript(raw: unknown): ChatLine[] {
  if (!Array.isArray(raw)) return [];
  const lines: ChatLine[] = [];
  for (const item of raw.slice(0, 40)) {
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const line = text(r.text).slice(0, 1500);
    if (line && (r.from === 'agent' || r.from === 'client')) lines.push({ from: r.from, text: line });
  }
  return lines;
}

export function validateChange(raw: unknown): ChangeResult {
  if (!raw || typeof raw !== 'object') return { ok: false, errors: { form: 'Something went wrong. Please try again.' } };
  const r = raw as Record<string, unknown>;
  const title = text(r.title);
  const kind = text(r.kind);
  const page = text(r.page);
  const details = text(r.details);
  const urgency = text(r.urgency) || 'normal';

  const errors: Record<string, string> = {};
  if (!title || title.length > 120) errors.title = 'Please describe the change in a short sentence.';
  if (!(CHANGE_KINDS as readonly string[]).includes(kind)) errors.kind = 'Unknown type of change.';
  if (page.length > 200) errors.page = 'Please keep the page name short.';
  if (details.length < 10) errors.details = 'Please tell us a little more (at least 10 characters).';
  else if (details.length > 4000) errors.details = 'Please keep the details under 4,000 characters.';
  if (!(URGENCIES as readonly string[]).includes(urgency)) errors.urgency = 'Unknown urgency.';
  if (Object.keys(errors).length) return { ok: false, errors };

  return {
    ok: true,
    change: { title, kind: kind as ChangeKind, page: page || null, details, urgency: urgency as Urgency, transcript: cleanTranscript(r.transcript) },
  };
}

export function formatChangeEmail(
  client: { name: string; business: string },
  change: CleanChange,
  id: string,
  siteUrl = 'https://apexdesigns.org.uk',
): { subject: string; text: string } {
  const subject = `Change request: ${client.business}: ${change.title}`;
  const body = [
    `Client: ${client.name} (${client.business})`,
    `Type: ${change.kind}`,
    `Page: ${change.page ?? '-'}`,
    `Urgency: ${change.urgency}`,
    '',
    change.details,
    '',
    `Review and approve: ${siteUrl}/admin/#request=${id}`,
  ];
  return { subject, text: body.join('\n') };
}
