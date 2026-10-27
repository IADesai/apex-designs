import { describe, it, expect } from 'vitest';
import { heightAt, colorForHeight, jitter, TERRAIN } from '../src/scripts/hero/terrain';

describe('heightAt', () => {
  it('is deterministic', () => {
    expect(heightAt(3.3, -2.1)).toBe(heightAt(3.3, -2.1));
  });
  it('is never negative', () => {
    for (let x = -24; x <= 24; x += 1.5) for (let z = -24; z <= 24; z += 1.5) expect(heightAt(x, z)).toBeGreaterThanOrEqual(0);
  });
  it('puts the highest point (the apex) near the centre', () => {
    let best = { h: -1, x: 0, z: 0 };
    const half = TERRAIN.size / 2;
    for (let x = -half; x <= half; x += 0.5) for (let z = -half; z <= half; z += 0.5) {
      const h = heightAt(x, z);
      if (h > best.h) best = { h, x, z };
    }
    expect(Math.hypot(best.x, best.z)).toBeLessThan(2);
  });
});

describe('colorForHeight', () => {
  it('is charcoal at the base and snow at the apex', () => {
    const [r0, g0, b0] = colorForHeight(0, 10);
    expect(Math.max(r0, g0, b0)).toBeLessThan(0.2);
    const [r1, g1, b1] = colorForHeight(10, 10);
    expect(Math.min(r1, g1, b1)).toBeGreaterThan(0.85);
  });
  it('is teal in the middle', () => {
    const [r, g, b] = colorForHeight(6, 10);
    expect(g).toBeGreaterThan(r);
    expect(g).toBeGreaterThanOrEqual(b);
  });
});

describe('jitter', () => {
  it('is deterministic and bounded', () => {
    expect(jitter(1.1, 2.2)).toEqual(jitter(1.1, 2.2));
    for (let x = -24; x <= 24; x += 3) for (let z = -24; z <= 24; z += 3) {
      const [jx, jz] = jitter(x, z);
      expect(Math.abs(jx)).toBeLessThanOrEqual(0.35);
      expect(Math.abs(jz)).toBeLessThanOrEqual(0.35);
    }
  });
});
