import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const dir = join(process.cwd(), 'src/content/learn');
const files = readdirSync(dir).filter((f) => f.endsWith('.md'));

describe('learn articles', () => {
  it('has the three starter articles', () => {
    expect(files.sort()).toEqual(['google-business-profile-local-shops.md', 'website-cost-romford-east-london.md', 'wordpress-vs-custom-website.md']);
  });
  for (const f of files) {
    const body = readFileSync(join(dir, f), 'utf8').split('---').slice(2).join('---');
    it(`${f} is substantial, links internally and has no H1`, () => {
      expect(body.split(/\s+/).filter(Boolean).length).toBeGreaterThanOrEqual(700);
      expect(body).toMatch(/\]\(\/(services|quote|web-design-[a-z-]+)\/\)/);
      expect(body).not.toMatch(/^# /m);
    });
  }
});
