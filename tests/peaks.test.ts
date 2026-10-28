import { describe, it, expect } from 'vitest';
import { LOGO_PEAKS, BRAND_COLORS, snowCapFor } from '../src/scripts/hero/peaks';

describe('LOGO_PEAKS (3D version of the logo mark)', () => {
  const main = LOGO_PEAKS.find((p) => p.id === 'main')!;

  it('has the logo’s five peaks', () => {
    expect(LOGO_PEAKS.map((p) => p.id).sort()).toEqual(['front', 'left', 'main', 'right', 'right-front']);
  });
  it('makes the charcoal main peak the tallest, like the logo', () => {
    for (const p of LOGO_PEAKS) if (p.id !== 'main') expect(p.height).toBeLessThan(main.height);
    expect(main.color).toBe(BRAND_COLORS.charcoal);
  });
  it('places teal peaks either side of the main peak', () => {
    expect(LOGO_PEAKS.find((p) => p.id === 'left')!.x).toBeLessThan(main.x);
    expect(LOGO_PEAKS.find((p) => p.id === 'right')!.x).toBeGreaterThan(main.x);
    expect(LOGO_PEAKS.find((p) => p.id === 'front')!.z).toBeGreaterThan(main.z);
  });
  it('only uses logo colours', () => {
    const palette = Object.values(BRAND_COLORS);
    for (const p of LOGO_PEAKS) expect(palette).toContain(p.color);
  });
  it('keeps every peak low-poly', () => {
    for (const p of LOGO_PEAKS) expect(p.segments).toBeLessThanOrEqual(6);
  });
});

describe('snowCapFor', () => {
  it('sits exactly on the apex of its peak and shares its slope', () => {
    const main = LOGO_PEAKS.find((p) => p.id === 'main')!;
    const cap = snowCapFor(main, 0.22);
    expect(cap.baseY + cap.height).toBeCloseTo(main.height, 6);
    expect(cap.radius / cap.height).toBeCloseTo(main.radius / main.height, 6);
    expect(cap.color).toBe(BRAND_COLORS.snow);
  });
});
