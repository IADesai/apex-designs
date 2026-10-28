// Pure maths for the hero landscape: seeded noise, the mountain height field, and terrain colouring.
// No three.js here, so it is testable and can also run at build time (for the static fallback skyline).

/** Small, fast seeded PRNG (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seeded 2D gradient (Perlin) noise in roughly [-1, 1]. */
export function makeNoise(seed: number): (x: number, y: number) => number {
  const rand = rng(seed);
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const grad = (h: number, x: number, y: number) => {
    switch (h & 7) {
      case 0: return x + y; case 1: return -x + y; case 2: return x - y; case 3: return -x - y;
      case 4: return x; case 5: return -x; case 6: return y; default: return -y;
    }
  };
  const fade = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
  return (x: number, y: number) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const X = xi & 255, Y = yi & 255;
    const u = fade(xf), v = fade(yf);
    const aa = perm[perm[X] + Y], ab = perm[perm[X] + Y + 1], ba = perm[perm[X + 1] + Y], bb = perm[perm[X + 1] + Y + 1];
    const l1 = grad(aa, xf, yf) + u * (grad(ba, xf - 1, yf) - grad(aa, xf, yf));
    const l2 = grad(ab, xf, yf - 1) + u * (grad(bb, xf - 1, yf - 1) - grad(ab, xf, yf - 1));
    return (l1 + v * (l2 - l1)) * 0.92;
  };
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export interface Landscape {
  /** Ground height at world (x, z). Camera looks down -z. */
  height(x: number, z: number): number;
  /** Small-scale noise in [-1, 1], used to break up colour bands. */
  detail(x: number, z: number): number;
  summit: { x: number; z: number };
  snowLine: number;
  treeLine: number;
}

/**
 * A mountain range with one dominant summit (where the flag goes), sharp ridges from
 * ridged multifractal noise, a background range that rises with distance, and low foothills
 * close to the camera so the text sits over calm ground.
 */
export function makeLandscape(seed = 7): Landscape {
  const n1 = makeNoise(seed);
  const n2 = makeNoise(seed + 101);
  const summit = { x: 16, z: -46 };

  const fbm = (x: number, z: number, oct: number) => {
    let sum = 0, amp = 0.5, f = 1;
    for (let i = 0; i < oct; i++) { sum += amp * n2(x * f, z * f); f *= 2.03; amp *= 0.5; }
    return sum;
  };
  // Ridged multifractal: sharp crests where noise crosses zero, each octave weighted by the last.
  const ridged = (x: number, z: number) => {
    let sum = 0, amp = 0.55, f = 1, weight = 1;
    for (let i = 0; i < 6; i++) {
      let s = 1 - Math.abs(n1(x * f, z * f));
      s *= s;
      s *= weight;
      weight = Math.min(1, Math.max(0, s * 1.6));
      sum += s * amp;
      f *= 2.1;
      amp *= 0.5;
    }
    return sum; // ~0..1
  };

  const peak = (x: number, z: number, cx: number, cz: number, radius: number, power: number) => {
    const d = Math.hypot((x - cx) / 1.15, z - cz);
    return Math.pow(Math.max(0, 1 - d / radius), power);
  };

  const height = (x: number, z: number) => {
    // Domain warp bends ridgelines so nothing looks like a perfect cone.
    const wx = x + 7 * n2(x * 0.03, z * 0.03), wz = z + 7 * n2(x * 0.03 + 9.2, z * 0.03 - 4.1);
    const r = ridged(wx * 0.022 + 3.1, wz * 0.022 - 1.7);
    const crag = ridged(wx * 0.06 - 8.3, wz * 0.06 + 2.2); // finer crests and gullies on the big faces
    const massif = peak(wx, wz, summit.x, summit.z, 44, 1.5);
    const shoulders =
      peak(wx, wz, summit.x - 26, summit.z + 8, 24, 1.4) * 21 +
      peak(wx, wz, summit.x + 34, summit.z - 12, 26, 1.4) * 20 +
      peak(wx, wz, summit.x - 58, summit.z - 22, 30, 1.3) * 22;
    const depth = smoothstep(-2, -70, z);                      // ranges rise with distance
    const far = smoothstep(-80, -170, z);                      // a hazier range at the back
    const nearHills = smoothstep(4, -12, z) * (1 - smoothstep(-30, -60, z)) * 5 * (fbm(x * 0.05, z * 0.05, 3) + 0.6);
    const foothills = 2.2 * fbm(x * 0.03, z * 0.03, 4) + 1.2;
    return (
      foothills + nearHills +
      depth * (4 + 13 * r) +
      far * (6 + 14 * r) +
      shoulders * (0.75 + 0.5 * crag) +
      massif * (30 + 10 * r + 10 * crag) +
      peak(x, z, summit.x, summit.z, 13, 1.8) * 9 // a sharper summit block for the flag
    );
  };

  return {
    height,
    detail: (x, z) => fbm(x * 0.18, z * 0.18, 3) * 1.6,
    summit,
    snowLine: 27,
    treeLine: 15,
  };
}

export type RGB = [number, number, number];

// sRGB palette taken from the brand: logo teal and charcoal, the old site's cream, plus snow.
export const PALETTE = {
  forestDeep: [0x2b / 255, 0x52 / 255, 0x48 / 255] as RGB,
  forest: [0x3e / 255, 0x7d / 255, 0x6e / 255] as RGB,
  scrub: [0x7d / 255, 0x8c / 255, 0x6f / 255] as RGB,
  rock: [0x5a / 255, 0x5f / 255, 0x5f / 255] as RGB,
  rockLight: [0x84 / 255, 0x86 / 255, 0x80 / 255] as RGB,
  snow: [0xf4 / 255, 0xf5 / 255, 0xf0 / 255] as RGB,
};

const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];

/**
 * Terrain colour from height, steepness (normal's up component, 1 = flat) and a detail value.
 * Forest low down, scrub then bare rock higher up and on steep faces, snow on high gentle slopes.
 */
export function terrainColor(h: number, up: number, detail: number, land: Pick<Landscape, 'snowLine' | 'treeLine'>): RGB {
  const hh = h + detail * 2.2;
  let c = mix(PALETTE.forestDeep, PALETTE.forest, smoothstep(0, 9, hh) * (0.6 + 0.4 * Math.max(0, detail)));
  c = mix(c, PALETTE.scrub, smoothstep(land.treeLine - 4, land.treeLine + 2, hh) * 0.7);
  const steep = smoothstep(0.86, 0.62, up);
  const rocky = Math.max(steep, smoothstep(land.treeLine, land.treeLine + 6, hh));
  c = mix(c, mix(PALETTE.rock, PALETTE.rockLight, smoothstep(-0.5, 0.8, detail)), rocky);
  const snow = smoothstep(land.snowLine - 3, land.snowLine + 2, hh) * smoothstep(0.3, 0.55, up);
  return mix(c, PALETTE.snow, snow);
}

/** Flag cloth displacement: a travelling wave that grows towards the free edge, with gusts. */
export function flagWave(u: number, v: number, t: number): { dz: number; dy: number; dx: number } {
  const gust = 0.75 + 0.35 * Math.sin(t * 0.7) + 0.15 * Math.sin(t * 1.9);
  const reach = Math.pow(u, 1.15); // 0 at the pole, 1 at the free edge
  const dz = (Math.sin(u * 6.2 - t * 6.4 + v * 1.4) * 0.26 + Math.sin(u * 13 - t * 11.5) * 0.05) * reach * gust;
  const dy = -0.14 * u * u * (1.2 - gust * 0.5);
  const dx = -0.07 * reach * (1 + Math.sin(t * 6.4 - u * 6.2) * 0.5);
  return { dz, dy, dx };
}
