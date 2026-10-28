// The Apex logo mark, described as low-poly 3D peaks. Units are scene units; y is up, z faces the camera.
export const BRAND_COLORS = {
  charcoal: 0x4a5050, // main peak
  teal: 0x3e7d6e,     // side peaks
  tealLight: 0x4f9a87, // front peak
  tealDeep: 0x356b5e, // right-front facet
  snow: 0xf7faf7,     // snow notch and edge lines
} as const;

export interface Peak {
  id: 'main' | 'left' | 'right' | 'front' | 'right-front';
  x: number;
  z: number;
  radius: number;
  height: number;
  segments: number; // radial segments: 4 = square pyramid
  rotation: number; // around y, radians
  color: number;
  delay: number;    // intro rise stagger, seconds
}

export const LOGO_PEAKS: Peak[] = [
  { id: 'main', x: 0, z: -1.2, radius: 3.4, height: 6.4, segments: 4, rotation: Math.PI / 4, color: BRAND_COLORS.charcoal, delay: 0 },
  { id: 'right', x: 3.1, z: -0.2, radius: 3.0, height: 4.9, segments: 4, rotation: Math.PI / 4 + 0.25, color: BRAND_COLORS.teal, delay: 0.12 },
  { id: 'left', x: -3.0, z: 0.4, radius: 2.7, height: 3.9, segments: 4, rotation: Math.PI / 4 - 0.2, color: BRAND_COLORS.teal, delay: 0.2 },
  { id: 'right-front', x: 2.4, z: 1.6, radius: 2.3, height: 2.9, segments: 4, rotation: Math.PI / 4 + 0.5, color: BRAND_COLORS.tealDeep, delay: 0.28 },
  { id: 'front', x: 0.4, z: 2.0, radius: 2.4, height: 3.3, segments: 4, rotation: Math.PI / 4 - 0.1, color: BRAND_COLORS.tealLight, delay: 0.34 },
];

/** A cap that sits exactly on the top `fraction` of a peak, with the same slope, for the white snow notch. */
export function snowCapFor(peak: Peak, fraction: number): { height: number; radius: number; baseY: number; color: number } {
  const height = peak.height * fraction;
  return { height, radius: peak.radius * fraction, baseY: peak.height - height, color: BRAND_COLORS.snow };
}
