import { readdir, readFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditPage, auditSitemap, findDuplicateTitles, PLACEHOLDER_MARKERS } from './seo-audit.mjs';

const dist = fileURLToPath(new URL('../dist/', import.meta.url));

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

let failed = false;
let placeholder = false;
const pages = [];

for await (const file of walk(dist)) {
  if (!file.endsWith('.html')) continue;
  const rel = relative(dist, file).split(sep).join('/');
  const html = await readFile(file, 'utf8');
  const { title, errors } = auditPage(html, rel);
  pages.push({ path: rel, title });
  for (const e of errors) { console.error(`✗ ${rel}: ${e}`); failed = true; }
  if (PLACEHOLDER_MARKERS.some((m) => html.includes(m))) placeholder = true;
}

for (const name of await readdir(dist)) {
  if (!/^sitemap-\d+\.xml$/.test(name)) continue;
  for (const e of auditSitemap(await readFile(join(dist, name), 'utf8'))) { console.error(`✗ ${name}: ${e}`); failed = true; }
}

for (const e of findDuplicateTitles(pages)) { console.error(`✗ ${e}`); failed = true; }

if (placeholder) console.warn('⚠ Placeholder WhatsApp number still in use: set it in src/config/site.ts before launch.');
if (failed) process.exit(1);
console.log(`✓ SEO audit passed for ${pages.length} pages`);
