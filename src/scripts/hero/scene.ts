import * as THREE from 'three';
import { heightAt, colorForHeight, jitter, TERRAIN } from './terrain';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

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
  scene.fog = new THREE.FogExp2(0x0b0f0e, 0.022);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);

  // Terrain: displaced plane, made non-indexed so each triangle gets one flat colour.
  const base = new THREE.PlaneGeometry(TERRAIN.size, TERRAIN.size, TERRAIN.segments, TERRAIN.segments);
  base.rotateX(-Math.PI / 2);
  const bp = base.attributes.position;
  let maxH = 0;
  for (let i = 0; i < bp.count; i++) {
    const [jx, jz] = jitter(bp.getX(i), bp.getZ(i));
    const x = bp.getX(i) + jx, z = bp.getZ(i) + jz;
    const h = heightAt(x, z);
    bp.setXYZ(i, x, h, z);
    if (h > maxH) maxH = h;
  }
  const geo = base.toNonIndexed();
  base.dispose();
  geo.computeVertexNormals();
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i += 3) {
    const avg = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3;
    const [r, g, b] = colorForHeight(avg, maxH);
    for (let k = 0; k < 3; k++) colors.set([r, g, b], (i + k) * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

  const terrainMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.9, metalness: 0.05 });
  const wireGeo = new THREE.WireframeGeometry(geo);
  const wireMat = new THREE.LineBasicMaterial({ color: 0x5fd3b5, transparent: true, opacity: 0.07 });
  const group = new THREE.Group();
  group.add(new THREE.Mesh(geo, terrainMat), new THREE.LineSegments(wireGeo, wireMat));
  scene.add(group);

  // Drifting particles (snow / dust) for depth.
  const pCount = 600;
  const pPos = new Float32Array(pCount * 3);
  for (let i = 0; i < pCount; i++) {
    pPos[i * 3] = (Math.random() - 0.5) * 40;
    pPos[i * 3 + 1] = Math.random() * 18;
    pPos[i * 3 + 2] = (Math.random() - 0.5) * 40;
  }
  const pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
  const pMat = new THREE.PointsMaterial({ color: 0xcfe9e1, size: 0.06, transparent: true, opacity: 0.7, depthWrite: false });
  const particles = new THREE.Points(pGeo, pMat);
  scene.add(particles);

  scene.add(new THREE.HemisphereLight(0xcfe9e1, 0x0b0f0e, 0.7));
  const sun = new THREE.DirectionalLight(0xffffff, 2.4);
  sun.position.set(-10, 16, 8);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0x5fd3b5, 1.4);
  rim.position.set(12, 6, -12);
  scene.add(rim);

  // Camera climbs from the valley to just above the apex as the hero scrolls away.
  const camStart = new THREE.Vector3(0, 4.2, 24);
  const camEnd = new THREE.Vector3(0, maxH + 3.5, 7);
  const lookStart = new THREE.Vector3(0, 4, 0);
  const lookEnd = new THREE.Vector3(0, maxH - 0.5, 0);
  const look = new THREE.Vector3();

  const pointer = { x: 0, y: 0 };
  const eased = { x: 0, y: 0, p: 0 };
  let progress = 0;

  const resize = () => {
    const w = root.clientWidth, h = root.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.fov = w < 700 ? 55 : 42;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(root);
  resize();

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
    eased.x += (pointer.x - eased.x) * 0.05;
    eased.y += (pointer.y - eased.y) * 0.05;
    eased.p += (progress - eased.p) * 0.08;
    const k = easeInOut(eased.p);

    camera.position.lerpVectors(camStart, camEnd, k);
    camera.position.x += eased.x * 1.6;
    camera.position.y += -eased.y * 0.8;
    look.lerpVectors(lookStart, lookEnd, k);
    camera.lookAt(look);

    group.rotation.y = Math.sin(t * 0.05) * 0.08 + eased.x * 0.05;
    particles.rotation.y = t * 0.01;
    const pp = pGeo.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pCount; i++) {
      let y = pp.getY(i) - 0.004;
      if (y < 0) y = 18;
      pp.setY(i, y);
    }
    pp.needsUpdate = true;

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
    geo.dispose(); wireGeo.dispose(); pGeo.dispose();
    terrainMat.dispose(); wireMat.dispose(); pMat.dispose();
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
