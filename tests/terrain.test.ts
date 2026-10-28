import { describe, it, expect } from 'vitest';
import { makeNoise, makeLandscape, terrainColor, flagWave, PALETTE } from '../src/scripts/hero/terrain';

describe('makeNoise', () => {
  it('is deterministic for a seed and stays roughly within [-1, 1]', () => {
    const a = makeNoise(3), b = makeNoise(3), c = makeNoise(4);
    let differs = false;
    for (let i = 0; i < 400; i++) {
      const x = i * 0.37, y = i * 0.11;
      expect(a(x, y)).toBe(b(x, y));
      expect(Math.abs(a(x, y))).toBeLessThanOrEqual(1);
      if (a(x, y) !== c(x, y)) differs = true;
    }
    expect(differs).toBe(true);
  });
});

describe('makeLandscape', () => {
  const land = makeLandscape();
  // Same extent and spacing the scene samples.
  const grid: { x: number; z: number; h: number }[] = [];
  for (let x = -110; x <= 110; x += 2) for (let z = 20; z >= -200; z -= 2) grid.push({ x, z, h: land.height(x, z) });
  const top = grid.reduce((a, b) => (b.h > a.h ? b : a));

  it('puts its highest point on the summit, where the flag goes', () => {
    expect(Math.hypot(top.x - land.summit.x, top.z - land.summit.z)).toBeLessThan(10);
  });
  it('gives the summit snow', () => {
    expect(top.h).toBeGreaterThan(land.snowLine);
  });
  it('keeps the ground near the camera low, so text sits over calm foothills', () => {
    for (const p of grid) if (p.z > 0) expect(p.h).toBeLessThan(6);
  });
  it('only produces finite heights', () => {
    for (const p of grid) expect(Number.isFinite(p.h)).toBe(true);
  });
});

describe('terrainColor', () => {
  const land = { snowLine: 27, treeLine: 15 };
  const dist = (a: number[], b: number[]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  it('is snow high up on gentle slopes', () => {
    expect(dist(terrainColor(36, 0.95, 0, land), PALETTE.snow)).toBeLessThan(0.05);
  });
  it('is bare rock on steep faces, even high up', () => {
    expect(dist(terrainColor(36, 0.4, 0, land), PALETTE.snow)).toBeGreaterThan(0.3);
  });
  it('is green forest low down', () => {
    const c = terrainColor(2, 0.98, 0, land);
    expect(c[1]).toBeGreaterThan(c[0]);
  });
  it('stays within the colour range', () => {
    for (const h of [-5, 0, 10, 20, 30, 50]) for (const up of [0, 0.5, 1]) for (const d of [-1, 0, 1]) {
      for (const ch of terrainColor(h, up, d, land)) { expect(ch).toBeGreaterThanOrEqual(0); expect(ch).toBeLessThanOrEqual(1); }
    }
  });
});

describe('flagWave', () => {
  it('keeps the edge on the pole fixed', () => {
    for (const t of [0, 1.3, 7.9]) {
      const w = flagWave(0, 0.5, t);
      expect(Math.abs(w.dz) + Math.abs(w.dy) + Math.abs(w.dx)).toBeLessThan(1e-9);
    }
  });
  it('ripples the free edge, within a sensible range', () => {
    let maxDz = 0;
    for (let t = 0; t < 10; t += 0.05) {
      const w = flagWave(1, 0.5, t);
      maxDz = Math.max(maxDz, Math.abs(w.dz));
      expect(Math.abs(w.dz)).toBeLessThan(0.5);
    }
    expect(maxDz).toBeGreaterThan(0.1);
  });
});
