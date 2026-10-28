import * as THREE from 'three';
import { LOGO_PEAKS, BRAND_COLORS, snowCapFor } from './peaks';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOutBack = (t: number) => { const c = 1.4; const u = t - 1; return 1 + (c + 1) * u * u * u + c * u * u; };

/** A soft round shadow under the mountains, drawn once to a canvas. */
function contactShadow(): THREE.Mesh {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  grad.addColorStop(0, 'rgba(83, 74, 69, 0.35)');
  grad.addColorStop(1, 'rgba(83, 74, 69, 0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 256, 256);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(16, 9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = 0.01;
  return mesh;
}

function pyramid(radius: number, height: number, segments: number, color: number): THREE.Group {
  const geo = new THREE.ConeGeometry(radius, height, segments, 1);
  geo.translate(0, height / 2, 0); // base on y = 0
  const solid = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color, flatShading: true }));
  // White facet lines, like the separations in the logo.
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: BRAND_COLORS.snow, transparent: true, opacity: 0.85 }));
  const group = new THREE.Group();
  group.add(solid, edges);
  return group;
}

export function initHero(root: HTMLElement): (() => void) | null {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas[data-hero-canvas]');
  if (!canvas) return null;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);

  const mountains = new THREE.Group();
  const risers: { node: THREE.Object3D; delay: number }[] = [];
  for (const p of LOGO_PEAKS) {
    const peak = pyramid(p.radius, p.height, p.segments, p.color);
    if (p.id === 'main') {
      const cap = snowCapFor(p, 0.24);
      const snow = pyramid(cap.radius * 1.02, cap.height * 1.02, p.segments, cap.color);
      snow.position.y = cap.baseY - cap.height * 0.02;
      peak.add(snow);
    }
    peak.position.set(p.x, 0, p.z);
    peak.rotation.y = p.rotation;
    peak.scale.y = 0.001;
    mountains.add(peak);
    risers.push({ node: peak, delay: p.delay });
  }
  mountains.add(contactShadow());
  scene.add(mountains);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2bd, 1.15));
  const sun = new THREE.DirectionalLight(0xffffff, 1.5);
  sun.position.set(-6, 10, 8);
  scene.add(sun);

  const lookAt = new THREE.Vector3(0, 2.7, 0);
  const box = canvas.parentElement ?? root;
  const resize = () => {
    const w = box.clientWidth, h = box.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    // Pull back on narrow screens so the whole mark stays in frame.
    camera.position.set(0, 4.4, w < 700 ? 19 : 15);
    camera.lookAt(lookAt);
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(box);
  resize();

  const pointer = { x: 0, y: 0 };
  const eased = { x: 0, y: 0, p: 0 };
  let progress = 0;
  const onPointer = (e: PointerEvent) => {
    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  const onScroll = () => {
    const rect = root.getBoundingClientRect();
    progress = clamp01(-rect.top / Math.max(1, rect.height));
  };
  window.addEventListener('pointermove', onPointer, { passive: true });
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  let raf = 0;
  let visible = true;
  let first = true;
  const t0 = performance.now();

  const frame = () => {
    raf = 0;
    if (!visible || document.hidden) return;
    const t = (performance.now() - t0) / 1000;
    eased.x += (pointer.x - eased.x) * 0.06;
    eased.y += (pointer.y - eased.y) * 0.06;
    eased.p += (progress - eased.p) * 0.08;

    for (const r of risers) {
      const k = clamp01((t - r.delay) / 1.1);
      r.node.scale.y = Math.max(0.001, easeOutBack(k));
    }

    mountains.rotation.y = Math.sin(t * 0.25) * 0.12 + eased.x * 0.35 + eased.p * 1.2;
    mountains.rotation.x = eased.y * 0.06;
    mountains.position.y = -eased.p * 1.5;

    renderer.render(scene, camera);
    if (first) { first = false; root.dataset.hero = 'live'; }
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (!raf) raf = requestAnimationFrame(frame); };

  const io = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) start(); });
  io.observe(root);
  const onVisibility = () => { if (!document.hidden) start(); };
  document.addEventListener('visibilitychange', onVisibility);

  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    cancelAnimationFrame(raf);
    io.disconnect();
    ro.disconnect();
    window.removeEventListener('pointermove', onPointer);
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', onVisibility);
    scene.traverse((o) => {
      const m = o as THREE.Mesh;
      m.geometry?.dispose();
      const mat = m.material as THREE.Material | THREE.Material[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
    });
    renderer.dispose();
  };

  canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    root.dataset.hero = 'fallback';
    dispose();
  });

  start();
  return dispose;
}
