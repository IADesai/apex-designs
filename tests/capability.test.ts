import { describe, it, expect } from 'vitest';
import { shouldRender3D } from '../src/scripts/hero/capability';

describe('shouldRender3D', () => {
  it('renders when everything is available', () => {
    expect(shouldRender3D({ webgl: true, reducedMotion: false, saveData: false })).toBe(true);
  });
  it('falls back without WebGL', () => {
    expect(shouldRender3D({ webgl: false, reducedMotion: false, saveData: false })).toBe(false);
  });
  it('falls back for reduced motion', () => {
    expect(shouldRender3D({ webgl: true, reducedMotion: true, saveData: false })).toBe(false);
  });
  it('falls back for data saver', () => {
    expect(shouldRender3D({ webgl: true, reducedMotion: false, saveData: true })).toBe(false);
  });
});
