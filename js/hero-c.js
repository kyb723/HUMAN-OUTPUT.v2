/* HUMAN OUTPUT - alternate hero: MERCURY
   Real 3D metaballs. Three.js MarchingCubes polygonises a scalar field
   every frame, so three drops merge as actual geometry and carry a
   specular highlight and a rim light across the join.

   The drop physics are the same as the CSS hero: different lag per drop
   so they string out on a fast move and pool at rest, a slowly turning
   ring so they never stack on one point, and a drifting cluster when
   there is no pointer, which is the normal state on a phone.

   Loaded only by hero-c.html, as a module. */

import * as THREE from 'three';
import { MarchingCubes } from './vendor/MarchingCubes.js';

const root  = document.documentElement;
const stage = document.querySelector('[data-metal]');
if (stage) init(stage);

function init(stage) {
  const canvas = stage.querySelector('.metal__canvas');
  const mark   = stage.querySelector('.metal__mark');
  if (!canvas) return;

  /* ---- capability gate ------------------------------------ */
  const gl = canvas.getContext('webgl2', { alpha: true, antialias: true })
          || canvas.getContext('webgl',  { alpha: true, antialias: true });
  if (!gl) { root.classList.add('no-webgl'); return; }

  /* ---- tunables (mirror js/hero-b.js) --------------------- */
  const EASE  = [0.22, 0.13, 0.085];
  const ORBIT = [[0.00, 1.00], [2.09, 0.72], [4.19, 0.55]];
  const IDLE_AFTER = 2800;

  /* Drop radii as a fraction of the field cube, which is the only unit
     MarchingCubes cares about. A ball smaller than ~4 grid cells cannot
     be polygonised smoothly, so these are sized against RES, not against
     the viewport. */
  /* Sized against a deliberately tight field (below), so each ball spans
     6-7 grid cells instead of 4. Same size on screen, no extra cost, and
     it is the difference between liquid and low-poly. */
  const FR    = [0.130, 0.097, 0.074];
  const SUB   = 12;                          /* MarchingCubes subtract term */

  const small = window.matchMedia('(max-width: 760px)').matches;

  /* MarchingCubes polygonises the whole grid on the main thread every
     frame and the cost is O(res^3), so this is the one number that
     decides whether the hero holds 60fps. It starts conservative and
     steps down if the device cannot keep up. */
  const STEPS = small ? [44, 34, 26] : [56, 44, 34];
  let   step  = 0;
  let   RES   = STEPS[0];

  /* World span of the field cube, in px. Deliberately narrower than the
     stage: spreading the grid over the full width leaves each drop about
     one cell across, which is what made them facet and fuse into a single
     lump. Keeping it near the wordmark buys resolution where it shows. */
  let FIELD = 900;
  let CLUSTER = 52;

  /* ---- renderer ------------------------------------------- */
  const renderer = new THREE.WebGLRenderer({
    canvas, context: gl, alpha: true, antialias: true, powerPreference: 'high-performance'
  });
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;

  const scene  = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 40);
  camera.position.set(0, 0, 10);

  /* A studio softbox as an equirect gradient, prefiltered into an
     environment map. This is what puts a moving highlight on the liquid;
     lights alone leave it looking like flat plastic. */
  const env = (() => {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, 128);
    g.addColorStop(0.00, '#ffffff');
    g.addColorStop(0.32, '#d8d8d6');
    g.addColorStop(0.52, '#3a3a3a');
    g.addColorStop(1.00, '#050505');
    x.fillStyle = g; x.fillRect(0, 0, 256, 128);
    x.fillStyle = 'rgba(255,255,255,0.95)';
    x.beginPath(); x.ellipse(74, 30, 46, 20, 0, 0, Math.PI * 2); x.fill();
    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    const pmrem = new THREE.PMREMGenerator(renderer);
    const rt = pmrem.fromEquirectangular(tex);
    pmrem.dispose(); tex.dispose();
    return rt.texture;
  })();

  const material = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: 0.07,
    metalness: 0.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.04,
    reflectivity: 0.85,
    envMap: env,
    envMapIntensity: 1.7
  });

  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(-1.4, 2.0, 2.4);
  const rim = new THREE.DirectionalLight(0xffffff, 1.1);
  rim.position.set(1.8, -1.2, -1.0);
  scene.add(key, rim, new THREE.AmbientLight(0xffffff, 0.35));

  let blob = makeBlob(RES);

  function makeBlob(res) {
    const b = new MarchingCubes(res, material, false, false, 90000);
    b.isolation = SUB * 5;
    scene.add(b);
    return b;
  }

  /* Rolling frame cost. If the polygonise plus draw is consistently
     blowing the budget, drop a resolution step and rebuild rather than
     letting the hero stutter. */
  const cost = [];
  function gauge(ms) {
    cost.push(ms);
    if (cost.length < 90) return;
    cost.sort((a, b) => a - b);
    const med = cost[45];
    cost.length = 0;
    if (med > 22 && step < STEPS.length - 1) {
      step += 1;
      RES = STEPS[step];
      scene.remove(blob);
      blob.geometry.dispose();
      blob = makeBlob(RES);
      measure();
    }
  }

  /* ---- state ---------------------------------------------- */
  const box = { w: 0, h: 0, left: 0, top: 0 };
  const pointer = { x: 0, y: 0, has: false };
  let lastMove = -1e9, running = false, rafId = 0, ready = false;

  const drops = FR.map(() => ({ x: 0, y: 0, px: 0, py: 0 }));
  const clamp = (v, a, b) => v < a ? a : (v > b ? b : v);

  function ringOffset(t, i) {
    const [phase, rad] = ORBIT[i] || ORBIT[0];
    const a = t * 0.00055 + phase;
    return { x: Math.cos(a) * CLUSTER * rad, y: Math.sin(a) * CLUSTER * rad * 0.78 };
  }

  function idleCentre(t) {
    return {
      x: box.w / 2 + Math.cos(t * 0.00034) * box.w * 0.19,
      y: box.h / 2 + Math.sin(t * 0.00051) * box.h * 0.15
    };
  }

  function idleTarget(t, i) {
    const c = idleCentre(t), o = ringOffset(t, i);
    return { x: c.x + o.x, y: c.y + o.y };
  }

  function measure() {
    const r = stage.getBoundingClientRect();
    box.w = r.width; box.h = r.height; box.left = r.left; box.top = r.top;
    if (!box.w || !box.h) return;

    const dpr = Math.min(window.devicePixelRatio || 1, small ? 2 : 2);
    renderer.setPixelRatio(dpr);
    renderer.setSize(box.w, box.h, false);

    const aspect = box.w / box.h;
    camera.left = -aspect; camera.right = aspect;
    camera.top = 1; camera.bottom = -1;
    camera.updateProjectionMatrix();

    const mw = mark ? mark.getBoundingClientRect().width : 620;
    /* Tight on purpose. A wider field spreads the same grid over more
       pixels and each drop loses cells, which is what makes the
       silhouette faceted. Keeping it just wider than the wordmark also
       keeps the drops orbiting the type instead of wandering into empty
       corners. */
    FIELD = Math.min(box.w, Math.max(480, mw * 1.35));
    CLUSTER = mw * 0.105;

    /* Uniform scale, or the balls come out as ellipsoids. One world unit
       is box.h/2 px, so a cube of local span 2 covers k * box.h px. */
    if (blob) blob.scale.setScalar(FIELD / box.h);
    if (!pointer.has) { pointer.x = box.w / 2; pointer.y = box.h / 2; }
  }

  function heroOnScreen() {
    return (window.pageYOffset || 0) < window.innerHeight * 1.55;
  }

  function frame(now) {
    rafId = 0;
    if (!running) return;
    if (!heroOnScreen()) { running = false; return; }

    const t0 = performance.now();
    const idle = (now - lastMove) > IDLE_AFTER;
    blob.reset();

    const aspect = box.w / box.h || 1;

    for (let i = 0; i < drops.length; i++) {
      const d = drops[i];
      let t;
      if (idle) { t = idleTarget(now, i); }
      else { const o = ringOffset(now, i); t = { x: pointer.x + o.x, y: pointer.y + o.y }; }

      let e = EASE[i] || 0.1;
      if (idle) e *= 0.55;

      d.px = d.x; d.py = d.y;
      d.x += (t.x - d.x) * e;
      d.y += (t.y - d.y) * e;

      /* Screen px -> the field's own 0..1 cube, measured from the centre
         of the stage. Clamped inside the cube because MarchingCubes
         clips anything that reaches a wall. */
      const fx = clamp(0.5 + (d.x - box.w / 2) / FIELD, FR[0], 1 - FR[0]);
      const fy = clamp(0.5 - (d.y - box.h / 2) / FIELD, FR[0], 1 - FR[0]);

      /* Swell slightly with speed. MarchingCubes derives a ball's radius
         as sqrt(strength / subtract), so a radius target converts back to
         a strength directly. */
      const vx = d.x - d.px, vy = d.y - d.py;
      const sp = Math.min(Math.hypot(vx, vy), 42) / 42;
      const r  = FR[i] * (1 + sp * 0.18);
      blob.addBall(fx, fy, 0.5, r * r * SUB, SUB);
    }

    blob.update();
    renderer.render(scene, camera);
    gauge(performance.now() - t0);

    if (!ready) { ready = true; canvas.classList.add('is-ready'); }
    rafId = requestAnimationFrame(frame);
  }

  function start() { if (!running) { running = true; if (!rafId) rafId = requestAnimationFrame(frame); } }
  function stop()  { running = false; if (rafId) { cancelAnimationFrame(rafId); rafId = 0; } }

  function sync() {
    if (root.classList.contains('reduced')) { stop(); return; }
    if (heroOnScreen() && !document.hidden) start(); else stop();
  }

  window.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX - box.left;
    pointer.y = e.clientY - box.top;
    pointer.has = true;
    lastMove = performance.now();
  }, { passive: true });

  window.addEventListener('pointerdown', (e) => {
    pointer.x = e.clientX - box.left;
    pointer.y = e.clientY - box.top;
    pointer.has = true;
    lastMove = performance.now();
  }, { passive: true });

  window.addEventListener('resize', () => { measure(); sync(); }, { passive: true });
  window.addEventListener('scroll', () => { measure(); sync(); }, { passive: true });
  window.addEventListener('ho:viewport', () => { measure(); sync(); });
  document.addEventListener('visibilitychange', sync);

  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener ? mq.addEventListener('change', sync) : mq.addListener(sync);

  measure();
  drops.forEach((d, i) => { const t = idleTarget(0, i); d.x = d.px = t.x; d.y = d.py = t.y; });
  sync();
}
