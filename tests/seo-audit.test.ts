import { describe, it, expect } from 'vitest';
import { auditPage, auditSitemap, findDuplicateTitles } from '../scripts/seo-audit.mjs';

const good = (extra = '') => `<html><head><title>Services | Apex Designs</title>
<meta name="description" content="Packages and prices.">
<link rel="canonical" href="https://apexdesigns.org.uk/services/">${extra}</head><body><h1>Services</h1></body></html>`;

describe('auditPage', () => {
  it('passes a good page', () => {
    expect(auditPage(good(), 'services/index.html').errors).toEqual([]);
  });
  it('flags missing or multiple h1', () => {
    expect(auditPage(good().replace('<h1>Services</h1>', ''), 'services/index.html').errors).toContain('expected 1 <h1>, found 0');
    expect(auditPage(good().replace('</body>', '<h1>Two</h1></body>'), 'services/index.html').errors).toContain('expected 1 <h1>, found 2');
  });
  it('flags missing title, description and canonical', () => {
    const html = '<html><head></head><body><h1>x</h1></body></html>';
    const { errors } = auditPage(html, 'x/index.html');
    expect(errors).toEqual(expect.arrayContaining(['missing <title>', 'missing meta description', 'missing canonical']));
  });
  it('flags an over-long description', () => {
    const html = good().replace('Packages and prices.', 'a'.repeat(171));
    expect(auditPage(html, 'services/index.html').errors[0]).toMatch(/too long/);
  });
  it('requires noindex on admin and 404', () => {
    expect(auditPage(good(), 'admin/index.html').errors).toContain('must be noindex');
    expect(auditPage(good(), '404.html').errors).toContain('must be noindex');
    expect(auditPage(good('<meta name="robots" content="noindex, nofollow">'), 'admin/index.html').errors).toEqual([]);
  });
  it('requires the home hero to default to the fallback state', () => {
    expect(auditPage(good(), 'index.html').errors).toContain('home hero must default to data-hero="fallback"');
    expect(auditPage(good('<section data-hero="fallback"></section>'), 'index.html').errors).toEqual([]);
  });
  it('requires no-JS contact fallbacks on the quote page', () => {
    const errs = auditPage(good(), 'quote/index.html').errors;
    expect(errs).toContain('quote page needs a mailto: link');
    expect(errs).toContain('quote page needs a wa.me link');
    expect(auditPage(good('<a href="mailto:a@b.uk"></a><a href="https://wa.me/44"></a>'), 'quote/index.html').errors).toEqual([]);
  });
  it('skips meta-refresh redirect stubs', () => {
    const stub = '<!doctype html><title>Redirecting to: /work/</title><meta http-equiv="refresh" content="0;url=/work/"><meta name="robots" content="noindex">';
    expect(auditPage(stub, 'portfolio/index.html')).toEqual({ title: undefined, errors: [] });
  });
  it('rejects noindex on public pages', () => {
    expect(auditPage(good('<meta name="robots" content="noindex, nofollow">'), 'services/index.html').errors).toContain('unexpected noindex');
  });
});

describe('auditSitemap', () => {
  it('rejects admin URLs', () => {
    expect(auditSitemap('<loc>https://apexdesigns.org.uk/admin/</loc>')).toHaveLength(1);
    expect(auditSitemap('<loc>https://apexdesigns.org.uk/services/</loc>')).toEqual([]);
  });
});

describe('findDuplicateTitles', () => {
  it('reports duplicates', () => {
    const errs = findDuplicateTitles([{ path: 'a', title: 'X' }, { path: 'b', title: 'X' }, { path: 'c', title: 'Y' }]);
    expect(errs).toEqual(['duplicate title "X": a, b']);
  });
});
