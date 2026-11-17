import { sanitizeRef } from '../../supabase/functions/_shared/ref.ts';
import { packages } from '../data/packages';

export const LEAD_STATUSES = ['new', 'warm', 'quoted', 'won', 'lost'] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const CHANNELS = ['whatsapp', 'instagram', 'facebook', 'email', 'print', 'other'] as const;

export interface JourneyEvent {
  type: string;
  path: string;
  ref: string | null;
  props: Record<string, unknown> | null;
  created_at: string;
}

export function slugFromLabel(label: string): string | null {
  return sanitizeRef(label);
}

export function trackedUrl(siteUrl: string, destination: string, slug: string): string {
  const u = new URL(destination.startsWith('/') ? destination : `/${destination}`, siteUrl);
  u.searchParams.set('ref', slug);
  return u.toString();
}

export function shareText(url: string): string {
  return `Need a website for your business? Apex Designs in Romford builds custom sites from ${packages[0].price}, with one team looking after you from start to finish. Have a look: ${url}`;
}

export function conversionRate(leads: number, landings: number): string {
  return landings ? `${((leads / landings) * 100).toFixed(1)}%` : '–';
}

export function eventLabel(e: JourneyEvent): string {
  switch (e.type) {
    case 'ref_landing': return `Arrived via link "${e.ref ?? 'unknown'}" on ${e.path}`;
    case 'page_view': return `Viewed ${e.path}`;
    case 'cta_click': return `Clicked "${String(e.props?.id ?? 'button')}" on ${e.path}`;
    case 'whatsapp_click': return `Opened WhatsApp from ${e.path}`;
    case 'scroll_depth': return `Scrolled ${String(e.props?.depth ?? '?')}% of ${e.path}`;
    case 'form_start': return 'Started the quote form';
    case 'form_submit': return 'Submitted the quote form';
    default: return `${e.type} on ${e.path}`;
  }
}

export function sortJourney(events: JourneyEvent[]): JourneyEvent[] {
  return [...events].sort((a, b) => a.created_at.localeCompare(b.created_at));
}

const UUID = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

function idFromHash(hash: string, key: string): string | null {
  const m = new RegExp(`(?:^#|&)${key}=(${UUID})`, 'i').exec(hash);
  return m ? m[1] : null;
}

export function leadIdFromHash(hash: string): string | null {
  return idFromHash(hash, 'lead');
}

export function requestIdFromHash(hash: string): string | null {
  return idFromHash(hash, 'request');
}

/** A client's private portal link. The key sits in the fragment so it never reaches server logs. */
export function portalUrl(siteUrl: string, token: string): string {
  return `${new URL('/portal/', siteUrl).toString()}#key=${token}`;
}
