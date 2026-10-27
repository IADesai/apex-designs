import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://apexdesigns.org.uk',
  trailingSlash: 'always',
  build: { format: 'directory' },
  // Old WordPress URLs → new pages. Check Search Console after launch for any others.
  redirects: {
    '/portfolio': '/work/',
    '/contact': '/quote/',
    '/cookie-policy-uk': '/cookies/',
    '/privacy-policy': '/privacy/',
    '/terms-and-conditions': '/terms/',
  },
  integrations: [sitemap({ filter: (page) => !page.includes('/admin/') })],
});
