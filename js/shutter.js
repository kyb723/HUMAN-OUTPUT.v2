/* HUMAN OUTPUT - the shutter.
   Eleven vertical blades sweep each project into frame as you scroll.

   Scroll model
   ------------
   Each frame owns 1.5 viewport heights of runway. Within that block,
   progress p runs 0 -> 1.5. Blade j opens on  p * 4.5 - j * 0.1
   (clamped 0..1), so the blades cascade left to right and the frame
   is fully open by p ~= 0.44, then holds.

   Performance
   -----------
   The scroll listener is passive and only schedules a frame; every
   read and write happens inside one requestAnimationFrame callback.
   The wipe animates clip-path, which is paint-only, so scrolling
   never triggers layout.                                            */
(function () {
  'use strict';

  var root = document.documentElement;
  var reel = document.querySelector('[data-reel]');
  if (!reel) return;

  var BLADES  = 11;
  var HOLD    = 1.5;
  var SPEED   = 4.5;
  var STAGGER = 0.1;

  var frames = Array.prototype.slice.call(reel.querySelectorAll('.frame'));
  if (frames.length < 2) return;

  var runway = reel.querySelector('.runway');
  var ruler  = document.querySelector('.ruler');

  /* ---- scaffolding ----------------------------------------- */

  frames.forEach(function (f) {
    f._cap = f.querySelector('[data-caption]');
    f._base = f.querySelector('.frame__base');
    f._built = false;
    f._live = null;
  });

  if (runway) {
    runway.innerHTML = '';
    for (var i = 0; i < frames.length; i++) runway.appendChild(document.createElement('i'));
  }

  if (ruler) {
    ruler.innerHTML = '';
    for (var k = 0; k < frames.length; k++) ruler.appendChild(document.createElement('i'));
  }

  /* Build a frame's blades on demand, so we do not pull every
     photograph over the wire before the first one is on screen. */
  function build(frame) {
    if (frame._built) return;
    frame._built = true;

    var base  = frame.querySelector('.frame__base');
    var solid = frame.hasAttribute('data-solid');
    if (!base && !solid) return;             /* title card: nothing to wipe */

    var wrap = document.createElement('div');
    wrap.className = 'frame__blades';

    for (var j = 0; j < BLADES; j++) {
      var blade = document.createElement('div');
      blade.className = solid ? 'blade blade--solid' : 'blade';
      blade.style.setProperty('--p', 0);

      if (base) {
        var img = document.createElement('img');
        img.src = base.currentSrc || base.src;
        img.alt = '';                        /* named by the caption inside the link */
        img.setAttribute('aria-hidden', 'true');
        img.decoding = 'async';
        img.draggable = false;
        blade.appendChild(img);
      }
      wrap.appendChild(blade);
    }

    frame.insertBefore(wrap, frame.firstChild);
    frame._blades = wrap.children;
    layout(frame);
  }

  /* Whole-pixel blade geometry, with each blade overlapping its right
     neighbour by 1px. Sub-pixel boundaries antialias against the frame
     behind and draw a visible seam down a light photograph. */
  function layout(frame) {
    var b = frame._blades;
    if (!b) return;
    var w = frame.clientWidth || window.innerWidth;

    /* <picture> swaps the wide crop for the tall one when the viewport
       turns portrait. The blades hold their own copies, so re-point them
       whenever the browser has picked a different source. */
    var pick = frame._base && frame._base.currentSrc;
    if (pick && pick !== frame._src) {
      frame._src = pick;
      for (var s = 0; s < b.length; s++) {
        var bi = b[s].firstChild;
        if (bi && bi.tagName === 'IMG') bi.src = pick;
      }
    }

    for (var j = 0; j < b.length; j++) {
      var l = Math.round(j * w / BLADES);
      var r = Math.round((j + 1) * w / BLADES);
      var blade = b[j];
      blade.style.left = l + 'px';
      blade.style.width = (r - l + (j < BLADES - 1 ? 1 : 0)) + 'px';
      var img = blade.firstChild;
      if (img && img.tagName === 'IMG') {
        img.style.width = w + 'px';
        img.style.left = (-l) + 'px';
      }
    }
  }

  function relayout() {
    for (var i = 0; i < frames.length; i++) layout(frames[i]);
  }

  function blades(frame, t) {
    var b = frame._blades;
    if (!b) return;
    for (var j = 0; j < b.length; j++) {
      var v = t * SPEED - j * STAGGER;
      b[j].style.setProperty('--p', v < 0 ? 0 : (v > 1 ? 1 : v));
    }
  }

  function caption(frame, o) {
    if (frame._cap) frame._cap.style.setProperty('--caption-o', o < 0 ? 0 : (o > 1 ? 1 : o));
  }

  function live(frame, on) {
    if (frame._live === on) return;
    frame._live = on;
    frame.classList.toggle('is-live', on);
    frame.setAttribute('aria-hidden', on ? 'false' : 'true');
  }

  /* ---- render ---------------------------------------------- */

  var lastIdx = -1;
  var lastP = -1;
  var lastActive = -1;
  var queued = false;

  function stage(idx) {
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i];
      if (i === idx) {
        build(f);
        blades(f, 1);
        caption(f, 1);
        live(f, true);
        f.classList.remove('is-front');
      } else if (i === idx + 1) {
        build(f);
        live(f, true);
        f.classList.add('is-front');
      } else {
        live(f, false);
        f.classList.remove('is-front');
        if (f._built) { blades(f, 0); caption(f, 0); }
      }
    }
    /* Warm the frame after next so its photograph is decoded in time. */
    if (frames[idx + 2]) build(frames[idx + 2]);
  }

  function paint() {
    queued = false;

    if (root.classList.contains('reduced')) return;   /* CSS unstacks the reel */

    var vh = window.innerHeight;
    if (!vh) return;

    var y = window.pageYOffset || root.scrollTop || 0;
    var idx = Math.floor(y / (vh * HOLD));
    var max = frames.length - 2;
    if (idx < 0) idx = 0;
    else if (idx > max) idx = max;

    var p = (y / vh) - idx * HOLD;
    if (p < 0) p = 0;
    else if (p > HOLD) p = HOLD;

    if (idx !== lastIdx) {
      stage(idx);
      lastIdx = idx;
      lastP = -1;
    }

    if (Math.abs(p - lastP) > 0.0004) {
      lastP = p;
      var next = frames[idx + 1];
      blades(next, p);
      caption(next, p * 2);
    }

    /* Only the frame in front takes the pointer and the tab order. */
    var active = p >= 0.5 ? idx + 1 : idx;
    if (active !== lastActive) {
      lastActive = active;
      for (var i = 0; i < frames.length; i++) {
        var isActive = i === active;
        frames[i].classList.toggle('is-inert', !isActive);
        frames[i].toggleAttribute('inert', !isActive);
      }
      if (ruler) {
        for (var r = 0; r < ruler.children.length; r++) {
          ruler.children[r].classList.toggle('on', r === active);
        }
      }
    }
  }

  /* Scroll is passive and only schedules a frame; every read and
     write happens inside paint(). The timeout is a safety net: if a
     rAF callback is ever dropped (a throttled or occluded tab, some
     headless contexts) the gate must not latch shut, or the shutter
     would stay dead for the rest of the session. */
  var rafId = 0;
  var netId = 0;

  function onScroll() {
    if (queued) return;
    queued = true;
    rafId = requestAnimationFrame(paint);
    clearTimeout(netId);
    netId = setTimeout(function () {
      if (!queued) return;
      cancelAnimationFrame(rafId);
      paint();
    }, 250);
  }

  /* ---- wiring ---------------------------------------------- */

  /* Listeners are always attached; paint() is the one place that
     checks reduced motion, so toggling the OS setting mid-session
     picks the reel up or drops it without a reload. */
  window.addEventListener('scroll', onScroll, { passive: true });

  /* Paints synchronously. The first render must never wait on a
     requestAnimationFrame callback: where rAF is throttled (a
     backgrounded tab, a restored session, some headless contexts)
     a deferred first paint leaves every frame hidden and the page
     black. Scroll updates still coalesce through rAF below. */
  function invalidate() {
    lastIdx = -1; lastP = -1; lastActive = -1;
    relayout();
    paint();
  }

  window.addEventListener('ho:viewport', invalidate);
  window.addEventListener('pageshow', invalidate);

  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (mq.addEventListener) mq.addEventListener('change', invalidate);
  else if (mq.addListener) mq.addListener(invalidate);

  invalidate();
}());
