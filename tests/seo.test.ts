import { describe, it, expect } from 'vitest';
import { pageTitle, canonicalUrl, businessJsonLd, faqJsonLd, breadcrumbJsonLd, articleJsonLd } from '../src/lib/seo';
import type { Review } from '../src/data/reviews';

describe('pageTitle', () => {
  it('appends the brand', () => {
    expect(pageTitle('Website Packages & Prices')).toBe('Website Packages & Prices | Apex Designs');
  });
  it('does not double the brand', () => {
    expect(pageTitle('About Apex Designs')).toBe('About Apex Designs');
  });
  it('has a default', () => {
    expect(pageTitle()).toBe('Apex Designs | Web Design Romford & East London');
  });
});

describe('canonicalUrl', () => {
  it('adds a trailing slash', () => {
    expect(canonicalUrl('/services')).toBe('https://apexdesigns.org.uk/services/');
  });
  it('keeps the root', () => {
    expect(canonicalUrl('/')).toBe('https://apexdesigns.org.uk/');
  });
  it('strips query and hash', () => {
    expect(canonicalUrl('/quote/?ref=abc#x')).toBe('https://apexdesigns.org.uk/quote/');
  });
  it('leaves file paths alone', () => {
    expect(canonicalUrl('/rss.xml')).toBe('https://apexdesigns.org.uk/rss.xml');
  });
  it('handles a missing leading slash', () => {
    expect(canonicalUrl('about')).toBe('https://apexdesigns.org.uk/about/');
  });
});

describe('businessJsonLd', () => {
  const revs: Review[] = [
    { author: 'A', text: 'Great', rating: 5, source: 'Google' },
    { author: 'B', text: 'Good', rating: 4, source: 'Google' },
  ];
  it('computes aggregate rating', () => {
    const ld = businessJsonLd(revs) as any;
    expect(ld['@type']).toBe('ProfessionalService');
    expect(ld.aggregateRating).toEqual({ '@type': 'AggregateRating', ratingValue: '4.5', reviewCount: 2, bestRating: 5 });
    expect(ld.review).toHaveLength(2);
    expect(ld.address.addressLocality).toBe('Romford');
  });
  it('omits rating with no reviews', () => {
    const ld = businessJsonLd([]) as any;
    expect(ld.aggregateRating).toBeUndefined();
    expect(ld.review).toBeUndefined();
  });
  it('publishes the real WhatsApp number as the business telephone', () => {
    const ld = businessJsonLd([]) as any;
    expect(ld.telephone).toBe('+447486600030');
  });
});

describe('other JSON-LD', () => {
  it('builds FAQPage', () => {
    const ld = faqJsonLd([{ q: 'How long?', a: 'Two weeks.' }]) as any;
    expect(ld['@type']).toBe('FAQPage');
    expect(ld.mainEntity[0]).toEqual({ '@type': 'Question', name: 'How long?', acceptedAnswer: { '@type': 'Answer', text: 'Two weeks.' } });
  });
  it('builds breadcrumbs with absolute URLs', () => {
    const ld = breadcrumbJsonLd([{ name: 'Home', path: '/' }, { name: 'Work', path: '/work/' }]) as any;
    expect(ld.itemListElement[1]).toEqual({ '@type': 'ListItem', position: 2, name: 'Work', item: 'https://apexdesigns.org.uk/work/' });
  });
  it('builds Article with ISO dates', () => {
    const ld = articleJsonLd({ title: 'T', description: 'D', path: '/learn/t/', published: new Date('2026-10-27T00:00:00Z') }) as any;
    expect(ld.datePublished).toBe('2026-10-27T00:00:00.000Z');
    expect(ld.dateModified).toBe('2026-10-27T00:00:00.000Z');
    expect(ld.mainEntityOfPage).toBe('https://apexdesigns.org.uk/learn/t/');
  });
});

describe('serializeJsonLd', () => {
  it('cannot be broken out of by a closing script tag (final review)', async () => {
    const { serializeJsonLd } = await import('../src/lib/seo');
    const out = serializeJsonLd({ reviewBody: 'nice</script><script>alert(1)</script>' });
    expect(out).not.toContain('<');
    expect(JSON.parse(out).reviewBody).toBe('nice</script><script>alert(1)</script>');
  });
});
