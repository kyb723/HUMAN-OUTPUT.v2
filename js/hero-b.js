/* HUMAN OUTPUT - alternate hero: LIQUID
   Three drops trail the pointer with different lag, so they string out
   into a comet and gather when the pointer rests. The fusing with the
   wordmark and the bridge that stretches and snaps on the way out are
   not scripted: they fall out of the goo filter in css/hero-b.css once
   two shapes are close enough for the blur to overlap.

   Loaded only by hero-b.html. */
(function () {
  'use strict';

  var root  = document.documentElement;
  var stage = document.querySelector('[data-liquid]');
  if (!stage) return;

  var drops = [].slice.call(stage.querySelectorAll('.drop'));
  if (!drops.length) return;

  /* Lag per drop. The leader is quick, the tail is slow, which is what
     makes them separate on a fast move and pool together at rest. */
  var EASE   = [0.22, 0.13, 0.085];
  var ORBIT  = [ [0.00, 1.00], [2.09, 0.72], [4.19, 0.55] ];  /* phase, radius factor */
  var IDLE_AFTER = 2800;   /* ms of stillness before the drops drift on their own */

  /* Each drop trails a different point on a slowly turning ring around the
     pointer rather than the pointer itself. Without this they all settle
     on the same coordinate and read as one blob the moment you stop
     moving. The ring is tight enough that the goo keeps them fused. */
  /* Scales with the mark, like the drops and the blur do. A fixed radius
     spreads the cluster far too wide against a 260px mark on a phone. */
  var CLUSTER = 52;

  function ringOffset(now, i) {
    var o = ORBIT[i] || ORBIT[0];
    var a = now * 0.00055 + o[0];
    var rad = CLUSTER * o[1];
    return { x: Math.cos(a) * rad, y: Math.sin(a) * rad * 0.78 };
  }

  var box = { w: 0, h: 0 };
  var pointer = { x: 0, y: 0, has: false };
  var lastMove = -1e9;
  var running = false;
  var rafId = 0;

  /* offsetWidth, not getBoundingClientRect: the rect reflects the squash
     transform we wrote last frame, so measuring from it makes the radius
     drift and the drops creep away from the pointer. */
  var state = drops.map(function (el) {
    return { el: el, x: 0, y: 0, px: 0, py: 0, r: el.offsetWidth / 2 || 24 };
  });

  /* The goo threshold closes any gap narrower than about 1.35 * sigma.
     Both the mark and its gaps scale with the viewport, so sigma has to
     scale with them or the split-O survives on a laptop and closes on a
     phone. */
  var blurNode = document.querySelector('[data-goo-blur]');
  var mark = stage.querySelector('.liquid__mark');

  function tuneBlur() {
    if (!mark) return;
    var mw = mark.getBoundingClientRect().width;
    if (!mw) return;
    if (blurNode) blurNode.setAttribute('stdDeviation', (mw * 0.016).toFixed(2));
    CLUSTER = mw * 0.084;
  }

  function measure() {
    tuneBlur();
    var r = stage.getBoundingClientRect();
    box.w = r.width;
    box.h = r.height;
    box.left = r.left;
    box.top = r.top;
    state.forEach(function (s) {
      if (s.el.offsetWidth) s.r = s.el.offsetWidth / 2;
    });
    if (!pointer.has) { pointer.x = box.w / 2; pointer.y = box.h / 2; }
  }

  /* Where the drops go when nobody is pointing. This is the default state
     on a touch screen, so it has to look like the pointer version: the
     cluster as a whole drifts on a slow lissajous across the wordmark and
     the drops keep their ring offsets around it. Giving each drop its own
     wide orbit instead scatters them into three separate circles that
     never fuse, which throws the effect away on exactly the device the
     client is testing on. */
  function idleCentre(t) {
    return {
      x: box.w / 2 + Math.cos(t * 0.00034) * box.w * 0.19,
      y: box.h / 2 + Math.sin(t * 0.00051) * box.h * 0.15
    };
  }

  function idleTarget(t, i) {
    var cen = idleCentre(t);
    var o = ringOffset(t, i);
    return { x: cen.x + o.x, y: cen.y + o.y };
  }

  /* Read the scroll position rather than the shutter's is-live class.
     Both scripts answer the same scroll event, so the class is still the
     previous frame's value when this runs, and the drops would keep
     animating an expensive filter after the hero had left the screen. */
  function heroOnScreen() {
    return (window.pageYOffset || 0) < window.innerHeight * 1.55;
  }

  function tick(now) {
    rafId = 0;
    if (!running) return;
    if (!heroOnScreen()) { running = false; return; }

    var idle = (now - lastMove) > IDLE_AFTER;

    for (var i = 0; i < state.length; i++) {
      var s = state[i];
      var t;
      if (idle) {
        t = idleTarget(now, i);
      } else {
        var o = ringOffset(now, i);
        t = { x: pointer.x + o.x, y: pointer.y + o.y };
      }
      var e = EASE[i] || 0.1;

      /* Blend toward the idle path rather than snapping to it. */
      if (idle) { e *= 0.55; }

      s.px = s.x; s.py = s.y;
      s.x += (t.x - s.x) * e;
      s.y += (t.y - s.y) * e;

      /* Squash along the direction of travel. A drop under load is not
         a circle; this is what sells it as liquid rather than as a dot. */
      var dx = s.x - s.px, dy = s.y - s.py;
      var sp = Math.min(Math.sqrt(dx * dx + dy * dy), 42);
      var k  = sp / 42;
      var ang = sp > 0.4 ? Math.atan2(dy, dx) : 0;

      s.el.style.transform =
        'translate(' + (s.x - s.r) + 'px,' + (s.y - s.r) + 'px)' +
        ' rotate(' + ang + 'rad)' +
        ' scale(' + (1 + k * 0.42) + ',' + (1 - k * 0.28) + ')';
    }

    rafId = requestAnimationFrame(tick);
  }

  function start() {
    if (running) return;
    running = true;
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  }

  /* pointermove covers mouse, pen and touch in one path. */
  window.addEventListener('pointermove', function (e) {
    pointer.x = e.clientX - box.left;
    pointer.y = e.clientY - box.top;
    pointer.has = true;
    lastMove = performance.now();
  }, { passive: true });

  window.addEventListener('pointerdown', function (e) {
    pointer.x = e.clientX - box.left;
    pointer.y = e.clientY - box.top;
    pointer.has = true;
    lastMove = performance.now();
  }, { passive: true });

  window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('scroll', measure, { passive: true });
  window.addEventListener('ho:viewport', measure);

  /* Only run while the hero is the frame on screen. Scrolling into the
     work should not leave an SVG filter animating out of sight. */
  function sync() {
    if (root.classList.contains('reduced')) { stop(); return; }
    if (heroOnScreen() && !document.hidden) start(); else stop();
  }

  document.addEventListener('visibilitychange', sync);
  window.addEventListener('scroll', sync, { passive: true });
  window.addEventListener('ho:viewport', sync);

  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mq.addEventListener) mq.addEventListener('change', sync);
  else if (mq.addListener) mq.addListener(sync);

  measure();
  /* Seed the drops on their idle path so frame one is already composed. */
  state.forEach(function (s, i) {
    var t = idleTarget(0, i);
    s.x = t.x; s.y = t.y; s.px = t.x; s.py = t.y;
  });
  sync();
}());
