/* HUMAN OUTPUT - the water hero (alternate title card).

   The mark does not sit on the page. It sits under a still black
   liquid, and the cursor is the only thing that disturbs it.

   How it works
   ------------
   A damped wave equation integrated on the GPU across two floating
   point buffers that swap every step (ping-pong). Each texel holds
   the surface height now (r) and one step ago (g); the next height
   is  2*now - then + c2 * laplacian,  damped. Drag the pointer and
   energy is deposited along the segment it travelled, so a flick
   leaves a stroke rather than a row of dots.

   A second pass reads that height field, takes its gradient, and
   refracts a texture of the wordmark through it. The gradient also
   lights the surface: a hard specular on the crests, and a
   curvature term that shades the flat ground, which is what makes
   black read as liquid rather than as wobbling text.

   Cost is held down by simulating small. The height field is at
   most 512px on its long side however big the canvas gets; waves
   are broad and do not need the pixels. The loop runs only while
   the card is the live frame and the tab is visible.

   No dependency and no build step. If WebGL2 or a float render
   target is missing, or the visitor asked for reduced motion,
   none of this runs and the static card stands as authored.      */
(function () {
  'use strict';

  var card = document.querySelector('[data-water]');
  if (!card) return;

  var root   = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var coarse = window.matchMedia('(hover: none), (pointer: coarse)');

  /* ---- tuning ---------------------------------------------- */

  var SIM_LONG  = 512;     /* height field long side, desktop        */
  var SIM_SMALL = 320;     /* ...and on a phone                      */
  var STEP      = 1 / 60;  /* fixed timestep: same water at any fps  */
  var MAX_STEPS = 3;       /* catch-up cap after a stall             */
  var C2        = 0.30;    /* wave speed squared. Past 0.5 it blows up */
  var DAMP      = 0.9955;
  var BAND      = 0.11;    /* edge strip that eats waves, so the     */
  var EDGE      = 0.90;    /* viewport is open water and not a tank  */
  var RADIUS    = 0.026;   /* stroke half-width, aspect-corrected uv */
  var FORCE     = 0.020;   /* deposit at full drag speed             */
  var DROP      = 0.034;   /* a tap, or an ambient drop              */
  var REFRACT   = 0.16;
  var MAX_PX    = 10;      /* hard ceiling on displacement. The mark  */
                           /* ripples; it must never tear, whatever   */
                           /* speed the pointer is scrubbed at.       */
  var SPEC      = 0.45;    /* glint on a fresh wave front             */
  var GAIN      = 20.0;    /* ...and how steep a slope earns one      */
  var CAUSTIC   = 2.2;
  var IDLE_MS   = 2400;    /* quiet this long and the surface breathes */

  /* Ambient drops. On a cursor machine they are a slow idle breath
     between one visit of the pointer and the next. On a phone they
     are the whole effect, because nothing hovers there, so they hit
     harder and more often. */
  function ambient() {
    var touch = coarse.matches;
    return {
      gap:  touch ?  900 : 1500,
      vary: touch ? 1300 : 2600,
      base: touch ? 0.85 : 0.30,
      spread: touch ? 0.55 : 0.30,
      wait: touch ? 1200 : IDLE_MS
    };
  }

  /* ---- shaders --------------------------------------------- */

  /* One triangle covering the viewport. Cheaper than two quads,
     and no diagonal seam for the interpolator to worry about. */
  var VERT = [
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = aPos * 0.5 + 0.5;',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}'
  ].join('\n');

  var SIM = [
    'precision highp float;',
    'uniform sampler2D uState;',
    'uniform vec2  uTexel;',
    'uniform vec2  uAspect;',
    'uniform vec2  uFrom;',
    'uniform vec2  uTo;',
    'uniform float uForce;',
    'uniform float uRadius;',
    'uniform float uC2;',
    'uniform float uDamp;',
    'uniform float uBand;',
    'uniform float uEdge;',
    'varying vec2 vUv;',

    /* Distance to the segment the pointer swept this frame. */
    'float stroke(vec2 p, vec2 a, vec2 b) {',
    '  vec2 pa = p - a, ba = b - a;',
    '  float h = clamp(dot(pa, ba) / max(dot(ba, ba), 1e-7), 0.0, 1.0);',
    '  return length(pa - ba * h);',
    '}',

    'void main() {',
    '  vec2  s = texture2D(uState, vUv).rg;',
    '  float l = texture2D(uState, vUv - vec2(uTexel.x, 0.0)).r;',
    '  float r = texture2D(uState, vUv + vec2(uTexel.x, 0.0)).r;',
    '  float d = texture2D(uState, vUv - vec2(0.0, uTexel.y)).r;',
    '  float u = texture2D(uState, vUv + vec2(0.0, uTexel.y)).r;',
    '  float lap = (l + r + u + d) - 4.0 * s.r;',

    '  float next = (2.0 * s.r - s.g) + uC2 * lap;',
    '  next *= uDamp;',

    '  if (uForce != 0.0) {',
    '    float k = stroke(vUv * uAspect, uFrom * uAspect, uTo * uAspect) / uRadius;',
    '    next += uForce * exp(-k * k);',
    '  }',

    /* Soak the border so waves leave instead of bouncing back. */
    '  vec2 e = min(vUv, 1.0 - vUv) / uBand;',
    '  float edge = clamp(min(e.x, e.y), 0.0, 1.0);',
    '  next *= mix(uEdge, 1.0, edge * edge);',

    '  gl_FragColor = vec4(next, s.r, 0.0, 1.0);',
    '}'
  ].join('\n');

  var VIEW = [
    'precision highp float;',
    'uniform sampler2D uState;',
    'uniform sampler2D uText;',
    'uniform vec2  uTexel;',
    'uniform vec2  uSize;',
    'uniform float uRefract;',
    'uniform float uMaxPx;',
    'uniform float uSpec;',
    'uniform float uGain;',
    'uniform float uCaustic;',
    'varying vec2 vUv;',

    'float H(vec2 uv) { return texture2D(uState, uv).r; }',

    'void main() {',
    '  float l = H(vUv - vec2(uTexel.x, 0.0));',
    '  float r = H(vUv + vec2(uTexel.x, 0.0));',
    '  float d = H(vUv - vec2(0.0, uTexel.y));',
    '  float u = H(vUv + vec2(0.0, uTexel.y));',
    '  vec2  g = vec2(r - l, u - d);',

    /* The mark is under the surface, so it moves with the slope -
       but only ever so far. Past the ceiling the offset is scaled
       back instead of clipped, so the direction survives and the
       letterforms stay whole under any speed of scrub. */
    '  vec2 off = g * uRefract;',
    '  float m = length(off * uSize);',
    '  if (m > uMaxPx) off *= uMaxPx / m;',
    '  vec3 col = texture2D(uText, vUv + off).rgb;',

    /* One hard light, upper left. A slope facing it catches; a still
       surface has no slope and stays black, so the glint belongs to
       the wave front and not to the page. */
    '  float lit = dot(g, vec2(-0.62, 0.78)) * uGain;',
    /* A steep exponent is what keeps this a rim and not a blob: the
       gain puts the fastest wave front near 1, and everything below
       it falls away hard. */
    '  col += pow(clamp(lit, 0.0, 1.0), 5.0) * uSpec;',

    /* Curvature shading on a wider stencil than the gradient uses.
       This is what makes flat black read as liquid, and the extra
       reach keeps it off the texel grid, where a tight stencil
       amplifies the half-float steps into visible grain. */
    '  vec2 w = uTexel * 2.5;',
    '  col += ((H(vUv - vec2(w.x, 0.0)) + H(vUv + vec2(w.x, 0.0))',
    '        +  H(vUv - vec2(0.0, w.y)) + H(vUv + vec2(0.0, w.y)))',
    '        - 4.0 * H(vUv)) * uCaustic;',

    '  gl_FragColor = vec4(col, 1.0);',
    '}'
  ].join('\n');

  /* ---- gl plumbing ----------------------------------------- */

  var canvas, gl, quad, simProg, viewProg, rtA, rtB, textTex;
  var simW = 0, simH = 0, cw = 0, ch = 0, dpr = 1;
  var running = false, booted = false, dead = false;
  var rafId = 0, last = 0, acc = 0;

  var wordmark = card.querySelector('.card__wordmark');
  var line     = card.querySelector('.card__line');

  function compile(type, src) {
    var s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (gl.getShaderParameter(s, gl.COMPILE_STATUS)) return s;
    if (window.console) console.warn('[water]', gl.getShaderInfoLog(s));
    return null;
  }

  function program(fragSrc, names) {
    var v = compile(gl.VERTEX_SHADER, VERT);
    var f = compile(gl.FRAGMENT_SHADER, fragSrc);
    if (!v || !f) return null;
    var p = gl.createProgram();
    gl.attachShader(p, v);
    gl.attachShader(p, f);
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    gl.deleteShader(v);
    gl.deleteShader(f);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      if (window.console) console.warn('[water]', gl.getProgramInfoLog(p));
      return null;
    }
    var u = {};
    for (var i = 0; i < names.length; i++) u[names[i]] = gl.getUniformLocation(p, names[i]);
    return { p: p, u: u };
  }

  function target(w, h) {
    var tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

    var fb = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    var ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return ok ? { tex: tex, fb: fb } : null;
  }

  function draw(prog) {
    gl.useProgram(prog.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  /* ---- the wordmark, as a texture --------------------------- */

  /* Measured off the real card rather than reimplemented, so the
     water version and the static one place the mark identically at
     every viewport width. */
  function paintText() {
    if (!gl || !cw || !ch) return;

    var c = document.createElement('canvas');
    c.width  = Math.max(1, Math.round(cw * dpr));
    c.height = Math.max(1, Math.round(ch * dpr));
    var x = c.getContext('2d');

    x.fillStyle = getComputedStyle(root).getPropertyValue('--ground').trim() || '#0b0b0b';
    x.fillRect(0, 0, c.width, c.height);
    x.scale(dpr, dpr);

    var frame = card.getBoundingClientRect();

    if (wordmark && wordmark.naturalWidth) {
      var w = wordmark.getBoundingClientRect();
      x.drawImage(wordmark, w.left - frame.left, w.top - frame.top, w.width, w.height);
    }

    if (line) {
      var s = getComputedStyle(line);
      var b = line.getBoundingClientRect();
      var text = (line.textContent || '').trim();
      if (s.textTransform === 'uppercase') text = text.toUpperCase();

      x.font = s.fontStyle + ' ' + s.fontWeight + ' ' + s.fontSize + ' ' + s.fontFamily;
      x.fillStyle = s.color;
      x.textBaseline = 'middle';

      /* Canvas letterSpacing is not everywhere yet, so advance by
         hand. Centring on the true run width also drops the half
         letter-space CSS leaves hanging off the right. */
      var track = parseFloat(s.letterSpacing) || 0;
      var run = -track, i;
      for (i = 0; i < text.length; i++) run += x.measureText(text[i]).width + track;

      var px = (b.left - frame.left) + (b.width - run) / 2;
      var py = (b.top - frame.top) + b.height / 2;
      for (i = 0; i < text.length; i++) {
        x.fillText(text[i], px, py);
        px += x.measureText(text[i]).width + track;
      }
    }

    if (!textTex) {
      textTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, textTex);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }
    gl.bindTexture(gl.TEXTURE_2D, textTex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  /* ---- sizing ---------------------------------------------- */

  function resize() {
    var w = card.clientWidth  || window.innerWidth;
    var h = card.clientHeight || window.innerHeight;
    if (!w || !h) return false;

    var was = cw + 'x' + ch + '@' + dpr;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    cw = w; ch = h;

    var pw = Math.round(w * dpr), ph = Math.round(h * dpr);
    if (canvas.width !== pw)  canvas.width  = pw;
    if (canvas.height !== ph) canvas.height = ph;

    var long = (coarse.matches || Math.max(w, h) < 720) ? SIM_SMALL : SIM_LONG;
    var nw, nh;
    if (w >= h) { nw = long; nh = Math.max(64, Math.round(long * h / w)); }
    else        { nh = long; nw = Math.max(64, Math.round(long * w / h)); }

    if (nw !== simW || nh !== simH) {
      if (rtA) { gl.deleteTexture(rtA.tex); gl.deleteFramebuffer(rtA.fb); }
      if (rtB) { gl.deleteTexture(rtB.tex); gl.deleteFramebuffer(rtB.fb); }
      simW = nw; simH = nh;
      rtA = target(simW, simH);
      rtB = target(simW, simH);
      if (!rtA || !rtB) return false;
      clearState();
    }

    if (!textTex || was !== cw + 'x' + ch + '@' + dpr) paintText();
    return true;
  }

  function clearState() {
    var buf = [rtA, rtB];
    gl.clearColor(0, 0, 0, 1);
    for (var i = 0; i < 2; i++) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, buf[i].fb);
      gl.viewport(0, 0, simW, simH);
      gl.clear(gl.COLOR_BUFFER_BIT);
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  }

  /* ---- pointer --------------------------------------------- */

  var from = [-9, -9], to = [-9, -9], force = 0, radius = RADIUS;
  var have = false, lastMove = 0, nextDrop = 0;

  function at(e) {
    var b = card.getBoundingClientRect();
    return [(e.clientX - b.left) / b.width, 1 - (e.clientY - b.top) / b.height];
  }

  function onMove(e) {
    if (!running) return;
    var p = at(e);

    /* While a deposit is still pending the segment keeps growing,
       so nothing is dropped on a display fast enough to paint more
       often than the simulation steps. */
    if (!have) from = p;
    else if (force === 0) from = to;

    var dx = p[0] - to[0], dy = p[1] - to[1];
    to = p;
    have = true;
    lastMove = performance.now();

    /* A resting cursor still holds a dimple; a moving one digs.
       The ramp is shallow on purpose so slow drags register. */
    var speed = Math.sqrt(dx * dx + dy * dy);
    force = Math.max(force, FORCE * (0.22 + Math.min(speed / 0.035, 1) * 0.78));
    radius = RADIUS;
  }

  function onLeave() { have = false; }

  function drop(u, v, amount) {
    from = [u, v];
    to = [u, v];
    force = amount;
    radius = RADIUS * 1.9;
    have = false;
  }

  function onDown(e) {
    if (!running) return;
    var p = at(e);
    drop(p[0], p[1], DROP);
    lastMove = performance.now();
  }

  /* ---- loop ------------------------------------------------ */

  function simStep() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, rtB.fb);
    gl.viewport(0, 0, simW, simH);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, rtA.tex);

    var u = simProg.u;
    gl.useProgram(simProg.p);
    gl.uniform1i(u.uState, 0);
    gl.uniform2f(u.uTexel, 1 / simW, 1 / simH);
    gl.uniform2f(u.uAspect, simW >= simH ? simW / simH : 1, simW >= simH ? 1 : simH / simW);
    gl.uniform2f(u.uFrom, from[0], from[1]);
    gl.uniform2f(u.uTo, to[0], to[1]);
    gl.uniform1f(u.uForce, force);
    gl.uniform1f(u.uRadius, radius);
    gl.uniform1f(u.uC2, C2);
    gl.uniform1f(u.uDamp, DAMP);
    gl.uniform1f(u.uBand, BAND);
    gl.uniform1f(u.uEdge, EDGE);
    draw(simProg);

    var t = rtA; rtA = rtB; rtB = t;
    force = 0;                  /* one deposit per frame, not per step */
  }

  function render() {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, rtA.tex);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, textTex);

    var u = viewProg.u;
    gl.useProgram(viewProg.p);
    gl.uniform1i(u.uState, 0);
    gl.uniform1i(u.uText, 1);
    gl.uniform2f(u.uTexel, 1 / simW, 1 / simH);
    gl.uniform2f(u.uSize, cw, ch);
    gl.uniform1f(u.uRefract, REFRACT);
    gl.uniform1f(u.uMaxPx, MAX_PX);
    gl.uniform1f(u.uSpec, SPEC);
    gl.uniform1f(u.uGain, GAIN);
    gl.uniform1f(u.uCaustic, CAUSTIC);
    draw(viewProg);
  }

  function tick(now) {
    if (!running) { rafId = 0; return; }
    rafId = requestAnimationFrame(tick);

    var dt = last ? (now - last) / 1000 : STEP;
    last = now;
    if (dt > 0.25) dt = 0.25;
    acc += dt;

    /* Nothing has touched the water for a while: let it breathe,
       so a phone with no cursor is not looking at a dead slab. */
    var amb = ambient();
    if (now - lastMove > amb.wait && now > nextDrop) {
      nextDrop = now + amb.gap + Math.random() * amb.vary;
      drop(0.5 + (Math.random() - 0.5) * 0.72,
           0.5 + (Math.random() - 0.5) * 0.52,
           DROP * (amb.base + Math.random() * amb.spread));
    }

    var steps = 0;
    while (acc >= STEP && steps < MAX_STEPS) { simStep(); acc -= STEP; steps++; }
    if (acc > STEP * MAX_STEPS) acc = 0;

    render();
  }

  /* ---- lifecycle ------------------------------------------- */

  function start() {
    if (dead || running || reduce.matches || document.hidden) return;
    if (!booted) { boot(start); return; }      /* comes back when ready */
    if (!resize()) { fallback(); return; }
    running = true;
    last = 0;
    lastMove = performance.now();
    if (!rafId) rafId = requestAnimationFrame(tick);
  }

  function stop() {
    running = false;
    if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
  }

  function fallback() {
    dead = true;
    stop();
    root.classList.remove('is-water');
    if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
  }

  /* Boot in slices, and not while the page is still coming up.
     Measured on this machine: creating the context costs about 330ms,
     compiling the two programs another 410ms, and drawing and
     uploading the wordmark texture 250ms more. Run as one block from
     load, that is a full second with the main thread held shut. Run a
     step at a time on idle, the page is up and readable first and no
     single step is long enough to be felt.

     Nothing is mounted until the last step, so the authored card is
     what shows for the whole of it, and the canvas only takes over
     once it already has the identical mark drawn in it. */
  function idle(fn) {
    if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 1200 });
    else setTimeout(fn, 60);
  }

  function makeContext() {
    canvas = document.createElement('canvas');
    canvas.className = 'card__water';
    canvas.setAttribute('aria-hidden', 'true');

    gl = canvas.getContext('webgl2', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, powerPreference: 'high-performance'
    });
    if (!gl) return false;

    /* RGBA16F is only colour-renderable with one of these, and a
       height field cannot hold a wave in eight bits. */
    if (!gl.getExtension('EXT_color_buffer_float') &&
        !gl.getExtension('EXT_color_buffer_half_float')) return false;

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      fallback();
    });
    return true;
  }

  function makePrograms() {
    quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    simProg = program(SIM, ['uState', 'uTexel', 'uAspect', 'uFrom', 'uTo',
                            'uForce', 'uRadius', 'uC2', 'uDamp', 'uBand', 'uEdge']);
    viewProg = program(VIEW, ['uState', 'uText', 'uTexel', 'uSize', 'uRefract',
                              'uMaxPx', 'uSpec', 'uGain', 'uCaustic']);
    return !!(simProg && viewProg);
  }

  function mount() {
    if (!resize()) return false;
    card.insertBefore(canvas, card.firstChild);
    root.classList.add('is-water');
    booted = true;

    /* The first thing the visitor sees is the mark settling out of
       a single drop, not a mark that was already sitting there. */
    setTimeout(function () { drop(0.5, 0.5, DROP * 1.15); }, 240);
    return true;
  }

  var booting = false;

  function boot(done) {
    if (booting) return;
    booting = true;
    var steps = [makeContext, makePrograms, mount], i = 0;
    idle(function step() {
      if (dead) { booting = false; return; }
      if (!steps[i++]()) { booting = false; fallback(); return; }
      if (i < steps.length) idle(step);
      else { booting = false; done(); }
    });
  }

  /* ---- wiring ---------------------------------------------- */

  card.addEventListener('pointermove', onMove, { passive: true });
  card.addEventListener('pointerdown', onDown, { passive: true });
  card.addEventListener('pointerleave', onLeave, { passive: true });

  function onViewport() { if (booted && !dead) resize(); }

  /* ho:viewport is already debounced by site.js. The raw event is
     not, and every one of them would re-upload a texture the size
     of the viewport, so it gets a debounce of its own before it is
     allowed to touch anything. */
  var rzTimer;
  window.addEventListener('ho:viewport', onViewport);
  window.addEventListener('resize', function () {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(onViewport, 140);
  }, { passive: true });

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) stop();
    else if (card.classList.contains('is-live')) start();
  });

  function onReduce() { if (reduce.matches) fallback(); }
  if (reduce.addEventListener) reduce.addEventListener('change', onReduce);
  else if (reduce.addListener) reduce.addListener(onReduce);

  /* The shutter owns is-live. Follow it rather than duplicating the
     scroll maths: no cycles are spent on water nobody can see. */
  new MutationObserver(function () {
    if (dead) return;
    if (card.classList.contains('is-live')) start();
    else stop();
  }).observe(card, { attributes: true, attributeFilter: ['class'] });

  /* Jost must be resident before the tagline is drawn, or the
     texture bakes in the fallback face. */
  function begin() {
    if (!reduce.matches && card.classList.contains('is-live')) start();
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(begin);
  else window.addEventListener('load', begin);

  if (wordmark && !wordmark.complete) {
    wordmark.addEventListener('load', function () { if (booted && !dead) paintText(); });
  }
}());
