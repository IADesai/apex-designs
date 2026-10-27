export const TERRAIN = { size: 48, segments: 44 } as const;

function hash(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

function valueNoise(x: number, z: number, seed: number): number {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = smooth(x - ix), fz = smooth(z - iz);
  const a = hash(ix, iz, seed), b = hash(ix + 1, iz, seed);
  const c = hash(ix, iz + 1, seed), d = hash(ix + 1, iz + 1, seed);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

function fbm(x: number, z: number, seed: number): number {
  let sum = 0, amp = 0.5, freq = 1;
  for (let o = 0; o < 4; o++) { sum += amp * valueNoise(x * freq, z * freq, seed + o); amp *= 0.5; freq *= 2; }
  return sum / 0.9375; // normalise to ~0..1
}

const cone = (dx: number, dz: number, radius: number) => Math.max(0, 1 - Math.hypot(dx, dz) / radius) ** 1.2;

/** Jitter for grid vertices so facets look hand-cut rather than regular. Deterministic. */
export function jitter(x: number, z: number, amount = 0.35): [number, number] {
  const ix = Math.round(x * 10), iz = Math.round(z * 10);
  return [(hash(ix, iz, 101) - 0.5) * amount * 2, (hash(ix, iz, 202) - 0.5) * amount * 2];
}

/** Height of the low-poly range: one dominant central apex (like the logo) plus two flanking peaks. */
export function heightAt(x: number, z: number, seed = 7): number {
  const r = Math.hypot(x, z);
  const apex = 9 * cone(x, z, 9);
  const left = 5.5 * cone(x + 8, z + 1, 6.5);
  const right = 6 * cone(x - 7.5, z + 2, 7);
  const falloff = Math.max(0, 1 - r / (TERRAIN.size / 2));
  const noise = (fbm(x * 0.18, z * 0.18, seed) - 0.5) * 1.6 * (0.4 + 0.6 * falloff);
  return Math.max(0, apex + left + right + noise);
}

type RGB = [number, number, number];
const hex = (n: number): RGB => [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
const STOPS: { at: number; c: RGB }[] = [
  { at: 0, c: hex(0x141a19) },
  { at: 0.3, c: hex(0x2b3030) },
  { at: 0.55, c: hex(0x3e7d6e) },
  { at: 0.78, c: hex(0x5fd3b5) },
  { at: 0.9, c: hex(0xf4faf7) },
];

export function colorForHeight(h: number, maxH: number): RGB {
  const t = Math.min(1, Math.max(0, maxH > 0 ? h / maxH : 0));
  for (let i = 1; i < STOPS.length; i++) {
    if (t <= STOPS[i].at) {
      const a = STOPS[i - 1], b = STOPS[i];
      const k = (t - a.at) / (b.at - a.at);
      return [a.c[0] + (b.c[0] - a.c[0]) * k, a.c[1] + (b.c[1] - a.c[1]) * k, a.c[2] + (b.c[2] - a.c[2]) * k];
    }
  }
  return STOPS[STOPS.length - 1].c;
}
