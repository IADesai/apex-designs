import { site, hasRealWhatsApp } from '../config/site';
import { reviews as allReviews, type Review } from '../data/reviews';

export function pageTitle(title?: string): string {
  if (!title) return `${site.name} | Web Design Romford & East London`;
  return title.includes(site.name) ? title : `${title} | ${site.name}`;
}

export function canonicalUrl(pathname: string, base: string = site.url): string {
  let p = pathname.split(/[?#]/)[0] || '/';
  if (!p.startsWith('/')) p = `/${p}`;
  if (!p.endsWith('/') && !/\.[a-z0-9]+$/i.test(p)) p += '/';
  return new URL(p, base).toString();
}

export function businessJsonLd(revs: Review[] = allReviews): Record<string, unknown> {
  const ld: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    '@id': `${site.url}/#business`,
    name: site.name,
    url: `${site.url}/`,
    logo: `${site.url}/logo.png`,
    image: `${site.url}/og-default.png`,
    email: site.email,
    slogan: site.tagline,
    priceRange: '££',
    founder: { '@type': 'Person', name: site.founder },
    address: {
      '@type': 'PostalAddress',
      addressLocality: site.base.locality,
      addressRegion: site.base.region,
      addressCountry: site.base.country,
    },
    areaServed: site.areasServed.map((name) => ({ '@type': 'Place', name })),
  };
  if (hasRealWhatsApp()) ld.telephone = `+${site.whatsapp}`;
  const sameAs = [site.social.instagram, site.social.linkedin].filter(Boolean);
  if (sameAs.length) ld.sameAs = sameAs;
  if (revs.length) {
    const avg = revs.reduce((sum, r) => sum + r.rating, 0) / revs.length;
    ld.aggregateRating = { '@type': 'AggregateRating', ratingValue: avg.toFixed(1), reviewCount: revs.length, bestRating: 5 };
    ld.review = revs.map((r) => ({
      '@type': 'Review',
      author: { '@type': 'Person', name: r.author },
      reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5 },
      reviewBody: r.text,
    }));
  }
  return ld;
}

export function breadcrumbJsonLd(items: { name: string; path: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: canonicalUrl(it.path) })),
  };
}

export function faqJsonLd(faqs: { q: string; a: string }[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
  };
}

export function articleJsonLd(a: { title: string; description: string; path: string; published: Date; updated?: Date }): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.description,
    datePublished: a.published.toISOString(),
    dateModified: (a.updated ?? a.published).toISOString(),
    author: { '@type': 'Person', name: site.founder, url: `${site.url}/about/` },
    publisher: { '@id': `${site.url}/#business` },
    mainEntityOfPage: canonicalUrl(a.path),
  };
}

// Built at runtime so no tool or shell can collapse the escape: the 6 characters backslash-u-0-0-3-c.
const LT_ESCAPE = String.fromCharCode(92) + 'u003c';

/** JSON for a <script type="application/ld+json"> tag. Escapes "<" so content can never close the tag. */
export function serializeJsonLd(d: Record<string, unknown>): string {
  return JSON.stringify(d).replace(/</g, LT_ESCAPE);
}
