import { describe, it, expect } from 'vitest';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { packages } from '../src/data/packages';
import { locations } from '../src/data/locations';
import { serviceFaqs } from '../src/data/faqs';

describe('packages', () => {
  it('has the three packages with the agreed prices', () => {
    expect(packages.map((p) => [p.id, p.price])).toEqual([
      ['standard', '£300'],
      ['premium', '£500'],
      ['custom', 'On quote'],
    ]);
    expect(packages.find((p) => p.id === 'premium')?.priceNote).toBe('+ £15/month');
  });
});

describe('locations', () => {
  it('has the four agreed slugs', () => {
    expect(locations.map((l) => l.slug)).toEqual(['web-design-romford', 'web-design-east-london', 'web-design-essex', 'remote-web-design-uk']);
  });
  it('has unique titles, descriptions, H1s and intros (no duplicate content)', () => {
    for (const key of ['title', 'description', 'h1'] as const) {
      expect(new Set(locations.map((l) => l[key])).size).toBe(locations.length);
    }
    expect(new Set(locations.map((l) => l.intro[0])).size).toBe(locations.length);
  });
  it('keeps descriptions within 170 chars', () => {
    for (const l of locations) expect(l.description.length).toBeLessThanOrEqual(170);
  });
  it('only references existing work entries', () => {
    const work = readdirSync(join(process.cwd(), 'src/content/work')).map((f) => f.replace(/\.md$/, ''));
    for (const l of locations) for (const w of l.work) expect(work).toContain(w);
  });
});

describe('faqs', () => {
  it('has answers for every question', () => {
    expect(serviceFaqs.length).toBeGreaterThanOrEqual(6);
    for (const f of serviceFaqs) expect(f.a.length).toBeGreaterThan(20);
  });
});
