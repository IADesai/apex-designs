export interface RenderEnv { webgl: boolean; reducedMotion: boolean; saveData: boolean }

export function shouldRender3D(env: RenderEnv): boolean {
  return env.webgl && !env.reducedMotion && !env.saveData;
}

export function readRenderEnv(win: Window): RenderEnv {
  let webgl = false;
  try {
    const c = win.document.createElement('canvas');
    webgl = Boolean(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    webgl = false;
  }
  const conn = (win.navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return {
    webgl,
    reducedMotion: win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
    saveData: Boolean(conn?.saveData),
  };
}
