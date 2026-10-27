import { describe, it, expect } from 'vitest';
import { slugFromLabel, trackedUrl, shareText, conversionRate, eventLabel, sortJourney, leadIdFromHash } from '../src/lib/admin-helpers';

describe('admin helpers', () => {
  it('makes slugs from labels', () => {
    expect(slugFromLabel('Romford Traders WhatsApp')).toBe('romford-traders-whatsapp');
    expect(slugFromLabel('***')).toBeNull();
  });
  it('builds tracked URLs', () => {
    expect(trackedUrl('https://apexdesigns.org.uk', '/', 'wa-group')).toBe('https://apexdesigns.org.uk/?ref=wa-group');
    expect(trackedUrl('https://apexdesigns.org.uk', 'services/', 'x')).toBe('https://apexdesigns.org.uk/services/?ref=x');
  });
  it('builds share text containing the URL and the starting price', () => {
    const t = shareText('https://apexdesigns.org.uk/?ref=x');
    expect(t).toContain('https://apexdesigns.org.uk/?ref=x');
    expect(t).toContain('£300');
  });
  it('formats conversion', () => {
    expect(conversionRate(1, 8)).toBe('12.5%');
    expect(conversionRate(0, 0)).toBe('–');
  });
  it('labels and sorts journey events', () => {
    const evs = [
      { type: 'cta_click', path: '/', ref: null, props: { id: 'hero-quote' }, created_at: '2026-10-27T10:02:00Z' },
      { type: 'ref_landing', path: '/', ref: 'wa-group', props: null, created_at: '2026-10-27T10:00:00Z' },
    ];
    expect(sortJourney(evs).map(eventLabel)).toEqual(['Arrived via link "wa-group" on /', 'Clicked "hero-quote" on /']);
  });
  it('reads a lead id from the hash', () => {
    expect(leadIdFromHash('#lead=00000000-0000-4000-8000-000000000001')).toBe('00000000-0000-4000-8000-000000000001');
    expect(leadIdFromHash('#tab=links')).toBeNull();
    expect(leadIdFromHash('#lead=<script>')).toBeNull();
  });
});
