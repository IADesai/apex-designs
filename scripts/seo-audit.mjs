export const PLACEHOLDER_MARKERS = ['447000000000'];

export function auditPage(html, relPath) {
  const errors = [];
  const isAdmin = relPath.startsWith('admin/');
  const is404 = relPath === '404.html' || relPath === '404/index.html';

  const h1Count = (html.match(/<h1[\s>]/gi) ?? []).length;
  if (h1Count !== 1) errors.push(`expected 1 <h1>, found ${h1Count}`);

  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim();
  if (!title) errors.push('missing <title>');

  const desc = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i)?.[1]?.trim();
  if (!desc) errors.push('missing meta description');
  else if (desc.length > 170) errors.push(`meta description too long (${desc.length})`);

  if (!/<link\s+rel="canonical"\s+href="https:\/\/apexdesigns\.org\.uk\/[^"]*"/i.test(html)) errors.push('missing canonical');

  const noindex = /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);
  if ((isAdmin || is404) && !noindex) errors.push('must be noindex');
  if (!isAdmin && !is404 && noindex) errors.push('unexpected noindex');

  if (relPath === 'index.html' && !/data-hero="fallback"/.test(html)) errors.push('home hero must default to data-hero="fallback"');

  return { title, errors };
}

export function auditSitemap(xml) {
  return /\/admin\//.test(xml) ? ['sitemap must not include /admin/'] : [];
}

export function findDuplicateTitles(pages) {
  const byTitle = new Map();
  for (const p of pages) {
    if (!p.title) continue;
    byTitle.set(p.title, [...(byTitle.get(p.title) ?? []), p.path]);
  }
  return [...byTitle].filter(([, paths]) => paths.length > 1).map(([t, paths]) => `duplicate title "${t}": ${paths.join(', ')}`);
}
