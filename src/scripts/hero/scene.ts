import * as THREE from 'three';
import { makeLandscape, terrainColor, flagWave, rng } from './terrain';

// Haze colour: matches the CSS sky at the horizon, so distant ranges melt into the page.
const HAZE = '#f1ecd7';

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

function buildTerrain(step: number) {
  const land = makeLandscape();
  const x0 = -110, x1 = 110, z0 = 20, z1 = -200;
  const nx = Math.round((x1 - x0) / step) + 1;
  const nz = Math.round((z0 - z1) / step) + 1;
  const pos = new Float32Array(nx * nz * 3);
  const top = new THREE.Vector3(0, -Infinity, 0);
  for (let j = 0; j < nz; j++) {
    const z = z0 - (j * (z0 - z1)) / (nz - 1);
    for (let i = 0; i < nx; i++) {
      const x = x0 + (i * (x1 - x0)) / (nx - 1);
      const y = land.height(x, z);
      const k = (j * nx + i) * 3;
      pos[k] = x; pos[k + 1] = y; pos[k + 2] = z;
      if (y > top.y) top.set(x, y, z);
    }
  }
  const idx = new Uint32Array((nx - 1) * (nz - 1) * 6);
  let n = 0;
  for (let j = 0; j < nz - 1; j++) {
    for (let i = 0; i < nx - 1; i++) {
      const a = j * nx + i, b = a + 1, c = a + nx, d = c + 1;
      idx[n++] = a; idx[n++] = b; idx[n++] = c;
      idx[n++] = b; idx[n++] = d; idx[n++] = c;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.computeVertexNormals();

  const normals = geo.getAttribute('normal');
  const colors = new Float32Array(pos.length);
  const c = new THREE.Color();
  for (let v = 0; v < nx * nz; v++) {
    const x = pos[v * 3], y = pos[v * 3 + 1], z = pos[v * 3 + 2];
    const [r, g, b] = terrainColor(y, normals.getY(v), land.detail(x, z), land);
    c.setRGB(r, g, b, THREE.SRGBColorSpace);
    colors[v * 3] = c.r; colors[v * 3 + 1] = c.g; colors[v * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }));
  return { mesh, top };
}

function canvasTexture(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  draw(c.getContext('2d')!);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** The Apex flag: teal field, cream peaks, mustard hoist. */
function flagTexture(): THREE.CanvasTexture {
  return canvasTexture(512, 320, (g) => {
    g.fillStyle = '#3e7d6e'; g.fillRect(0, 0, 512, 320);
    g.fillStyle = '#f3d97a'; g.fillRect(0, 0, 34, 320);
    g.fillStyle = '#d9e4dc';
    g.beginPath(); g.moveTo(262, 250); g.lineTo(352, 128); g.lineTo(442, 250); g.closePath(); g.fill();
    g.fillStyle = '#fffff2';
    g.beginPath(); g.moveTo(150, 250); g.lineTo(268, 72); g.lineTo(386, 250); g.closePath(); g.fill();
    g.fillStyle = '#3e7d6e';
    g.beginPath(); g.moveTo(232, 126); g.lineTo(268, 72); g.lineTo(304, 126); g.lineTo(286, 116); g.lineTo(268, 132); g.lineTo(250, 116); g.closePath(); g.fill();
    g.fillStyle = '#fffff2';
    g.beginPath(); g.moveTo(238, 118); g.lineTo(268, 72); g.lineTo(298, 118); g.lineTo(284, 108); g.lineTo(268, 122); g.lineTo(252, 108); g.closePath(); g.fill();
  });
}

function cloudTexture(seed: number): THREE.CanvasTexture {
  const rand = rng(seed);
  return canvasTexture(512, 192, (g) => {
    for (let i = 0; i < 14; i++) {
      const x = 90 + rand() * 330, y = 80 + rand() * 50, r = 40 + rand() * 60;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(255,255,250,0.55)');
      grad.addColorStop(1, 'rgba(255,255,250,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  });
}

function dotTexture(): THREE.CanvasTexture {
  return canvasTexture(32, 32, (g) => {
    const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad; g.fillRect(0, 0, 32, 32);
  });
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
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const box = canvas.parentElement ?? root;
  const lowPower = Math.min(box.clientWidth, window.innerHeight) < 700 || (navigator.hardwareConcurrency ?? 8) <= 4;

  const scene = new THREE.Scene();
  const fog = new THREE.Fog(HAZE, 95, 340);
  scene.fog = fog;
  const camera = new THREE.PerspectiveCamera(45, 1, 0.5, 520);

  // Ground
  const { mesh: terrain, top } = buildTerrain(lowPower ? 1.8 : 1.1);
  scene.add(terrain);

  // Light: warm sun from the upper left, cool fill from the ground.
  const sun = new THREE.DirectionalLight('#fff1d6', 3.1);
  sun.position.set(-70, 55, 30);
  scene.add(sun, new THREE.HemisphereLight('#fffdf0', '#3b574f', 0.9));

  // Flag on the true summit.
  const POLE_H = 6.4, FLAG_W = 4.6, FLAG_H = 2.9;
  const flagGroup = new THREE.Group();
  flagGroup.position.copy(top).add(new THREE.Vector3(0, -0.4, 0));
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, POLE_H, 8), new THREE.MeshLambertMaterial({ color: '#3b3f40' }));
  pole.position.y = POLE_H / 2;
  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), new THREE.MeshLambertMaterial({ color: '#f3d97a' }));
  finial.position.y = POLE_H + 0.1;
  const clothGeo = new THREE.PlaneGeometry(FLAG_W, FLAG_H, 28, 14);
  clothGeo.translate(FLAG_W / 2, 0, 0);
  const rest = Float32Array.from(clothGeo.getAttribute('position').array as Float32Array);
  const cloth = new THREE.Mesh(clothGeo, new THREE.MeshLambertMaterial({ map: flagTexture(), side: THREE.DoubleSide }));
  cloth.position.set(0.1, POLE_H - FLAG_H / 2 - 0.15, 0);
  flagGroup.add(pole, finial, cloth);
  scene.add(flagGroup);

  // Clouds drifting through the range, and a couple of wisps around the summit.
  const rand = rng(42);
  const clouds: { sprite: THREE.Sprite; speed: number }[] = [];
  const cloudCount = lowPower ? 6 : 10;
  for (let i = 0; i < cloudCount; i++) {
    const near = i < 2;
    const mat = new THREE.SpriteMaterial({ map: cloudTexture(i + 1), transparent: true, depthWrite: false, opacity: near ? 0.55 : 0.8 });
    const sprite = new THREE.Sprite(mat);
    const s = near ? 26 : 40 + rand() * 30;
    sprite.scale.set(s, s * 0.38, 1);
    sprite.position.set(
      near ? top.x + (i === 0 ? -22 : 26) : -120 + rand() * 240,
      near ? top.y - 12 - rand() * 4 : 26 + rand() * 18,
      near ? top.z + 6 : -80 - rand() * 90,
    );
    scene.add(sprite);
    clouds.push({ sprite, speed: near ? 0.5 : 0.8 + rand() * 1.2 });
  }

  // Fine snow blown off the summit, the same way the flag is flying.
  const SPIN = lowPower ? 70 : 150;
  const spin = new Float32Array(SPIN * 3);
  const spinLife = new Float32Array(SPIN);
  const spinVel = new Float32Array(SPIN * 2);
  const seedSpin = (i: number, age = 0) => {
    spin[i * 3] = top.x + (rand() - 0.5) * 3;
    spin[i * 3 + 1] = top.y - rand() * 3;
    spin[i * 3 + 2] = top.z + (rand() - 0.5) * 4;
    spinVel[i * 2] = 4 + rand() * 5;
    spinVel[i * 2 + 1] = (rand() - 0.3) * 1.2;
    spinLife[i] = age;
  };
  for (let i = 0; i < SPIN; i++) seedSpin(i, rand() * 3);
  const spinGeo = new THREE.BufferGeometry();
  spinGeo.setAttribute('position', new THREE.BufferAttribute(spin, 3));
  const drift = new THREE.Points(spinGeo, new THREE.PointsMaterial({ map: dotTexture(), size: 0.55, transparent: true, opacity: 0.75, depthWrite: false, color: '#ffffff' }));
  scene.add(drift);

  // Camera framing: summit right of the copy on wide screens, centred under it on tall ones.
  const base = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  const resize = () => {
    const w = box.clientWidth, h = box.clientHeight;
    renderer.setSize(w, h, false);
    const aspect = w / Math.max(1, h);
    camera.aspect = aspect;
    if (aspect < 0.9) {
      // Tall screens: the copy fills the top, so the range sits small in the band below it.
      camera.fov = 52;
      base.pos.set(top.x - 6, 30, 170);
      base.look.set(top.x - 2, 106, -60);
      fog.near = 175; fog.far = 440; // the camera is further away, so the haze starts later
    } else {
      fog.near = 95; fog.far = 340;
      camera.fov = 40;
      base.pos.set(-14, 26, 104);
      base.look.set(-6, 36, -60);
    }
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
  let last = t0;
  const clothPos = clothGeo.getAttribute('position') as THREE.BufferAttribute;
  const look = new THREE.Vector3();

  const frame = () => {
    raf = 0;
    if (!visible || document.hidden) return;
    const now = performance.now();
    const t = (now - t0) / 1000;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;

    eased.x += (pointer.x - eased.x) * 0.04;
    eased.y += (pointer.y - eased.y) * 0.04;
    eased.p += (progress - eased.p) * 0.08;

    // Intro: glide in from further back and higher up.
    const intro = 1 - easeOut(clamp01(t / 3.2));
    camera.position.set(
      base.pos.x + Math.sin(t * 0.07) * 2.2 + eased.x * 3.2,
      base.pos.y + intro * 6 - eased.y * 1.6 + eased.p * 7,
      base.pos.z + intro * 16 - eased.p * 6,
    );
    look.copy(base.look).add(new THREE.Vector3(eased.x * 1.2, eased.p * 5, 0));
    camera.lookAt(look);

    // Flag
    for (let i = 0; i < clothPos.count; i++) {
      const bx = rest[i * 3], by = rest[i * 3 + 1];
      const w = flagWave(bx / FLAG_W, by / FLAG_H + 0.5, t);
      clothPos.setXYZ(i, bx + w.dx * FLAG_W, by + w.dy * FLAG_H, w.dz * FLAG_W);
    }
    clothPos.needsUpdate = true;
    clothGeo.computeVertexNormals();

    // Clouds
    for (const c of clouds) {
      c.sprite.position.x += c.speed * dt;
      if (c.sprite.position.x > 140) c.sprite.position.x = -140;
    }

    // Spindrift
    for (let i = 0; i < SPIN; i++) {
      spinLife[i] += dt;
      if (spinLife[i] > 3.2) { seedSpin(i); continue; }
      spin[i * 3] += spinVel[i * 2] * dt;
      spin[i * 3 + 1] += spinVel[i * 2 + 1] * dt;
    }
    spinGeo.getAttribute('position').needsUpdate = true;

    renderer.render(scene, camera);
    if (first) { first = false; root.dataset.hero = 'live'; }
    raf = requestAnimationFrame(frame);
  };
  const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };

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
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => {
        (x as THREE.MeshBasicMaterial).map?.dispose();
        x.dispose();
      });
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
