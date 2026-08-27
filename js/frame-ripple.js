/* HUMAN OUTPUT - colour arrives on a wave (alternate reel).

   Loaded only by hero-water.html. The shipped reel is untouched.

   js/tint.js already blooms colour out from the centre of a frame's
   subject while the pointer holds on it. This puts that bloom on
   water: reach the subject and a ring leaves the centre, the colour
   rides out with it, and rings keep leaving while you hold. Take the
   pointer off and the water goes still first, so what drains is
   colour from a flat surface and not a ripple caught mid-travel.

   Why this is not the title card's simulation
   -------------------------------------------
   The hero integrates a wave field because its input is an arbitrary
   pointer path, and there is no closed form for that. Here the source
   is a single fixed point, so the answer is sin(r*k - t*w) and can be
   evaluated straight in the fragment shader. No height field, no
   ping-pong, no float render target, and the rings come out crisp
   instead of smeared across a 512px buffer.

   How it attaches
   ---------------
   Entirely through what tint.js already publishes to the DOM: the
   is-on class, the --tint-x / --tint-y centre, and the src of the
   colour crop it picked for this device. Nothing reaches into either
   shared module, so index.html keeps running the plain tint.        */
(function () {
  'use strict';

  var reel = document.querySelector('[data-reel]');
  if (!reel) return;

  var root   = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---- tuning ---------------------------------------------- */

  /* Bloom timings. site.css runs 780/480 for the shipped reel; this
     version is deliberately slower, to move at the pace of the title
     card's water rather than at the pace of a hover state. The same
     numbers are set on .frame__tint in css/hero-water.css, because
     that layer takes the colour over during a scroll and the handover
     has to land where this left off. Change one, change both. */
  var IN_MS    = 2200;
  var OUT_MS   = 900;
  var GATE_IN  = 140;      /* the water arrives with the colour...    */
  var GATE_OUT = 420;      /* ...and leaves well before it            */

  var WAVE_PX  = 230;      /* ring to ring. Broad and slow, like the  */
                           /* swells a drop leaves on the title card,  */
                           /* not the tight rings of a struck surface  */
  var WIDTH_PX = 180;      /* how much of the wave train exists at all:*/
                           /* a packet this wide carries about three   */
                           /* rings and nothing behind them            */
  var WAVE_MS  = 2900;     /* how long the rings take to cross. Longer */
                           /* than the bloom on purpose: they set out  */
                           /* on the colour's leading edge and carry on*/
                           /* past it, so the gesture is long enough to*/
                           /* be seen rather than over in half a blink */
  var RIDE     = 1.00;     /* ...and reach the far corners             */
  var SPEND    = 0.70;     /* spent over the last third of the travel  */
  var CORE_PX  = 72;       /* the source has a size: at the exact     */
                           /* centre there is no radial direction to  */
                           /* push along, and forcing one there wrings*/
                           /* the middle of the subject into a rosette*/
  var AMP      = 18.0;     /* px of displacement across the packet     */
  var LIGHT    = 0.34;     /* shading across a wave, signed           */

  var FREQ = 2 * Math.PI / WAVE_PX;

  function idle(fn) {
    if (window.requestIdleCallback) window.requestIdleCallback(fn, { timeout: 1500 });
    else setTimeout(fn, 80);
  }

  function smooth01(x) {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return x * x * (3 - 2 * x);
  }

  /* ---- easing ---------------------------------------------- */

  /* The site's curve, solved properly rather than approximated with a
     smoothstep, so the colour moves the way everything else does. */
  function bez(p1, p2, t) {
    var u = 1 - t;
    return 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t;
  }
  function slope(p1, p2, t) {
    return 3 * p1 * (1 - 4 * t + 3 * t * t) + 3 * p2 * (2 * t - 3 * t * t) + 3 * t * t;
  }
  function easer(x1, y1, x2, y2) {
    return function (x) {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      var t = x;
      for (var i = 0; i < 6; i++) {
        var e = bez(x1, x2, t) - x;
        if (Math.abs(e) < 1e-5) break;
        var s = slope(x1, x2, t);
        if (Math.abs(s) < 1e-6) break;
        t -= e / s;
      }
      return bez(y1, y2, t);
    };
  }
  var ease = easer(0.4, 0, 0.2, 1);

  /* ---- shaders --------------------------------------------- */

  var VERT = [
    'attribute vec2 aPos;',
    'varying vec2 vUv;',
    'void main() {',
    '  vUv = aPos * 0.5 + 0.5;',
    '  gl_Position = vec4(aPos, 0.0, 1.0);',
    '}'
  ].join('\n');

  var FRAG = [
    'precision highp float;',
    'uniform sampler2D uMono;',
    'uniform sampler2D uPhoto;',
    'uniform vec2  uSize;',
    'uniform vec2  uCover;',
    'uniform vec2  uOffset;',
    'uniform vec2  uCentre;',
    'uniform float uOpen;',
    'uniform float uMaxR;',
    'uniform float uFront;',
    'uniform float uWidth;',
    'uniform float uAmp;',
    'uniform float uFreq;',
    'uniform float uCore;',
    'uniform float uLight;',
    'varying vec2 vUv;',

    'void main() {',
    '  vec2 p = vUv * uSize;',
    '  vec2 d = p - uCentre;',
    '  float r = length(d);',

    /* The reveal, matching the CSS gradient this layer replaces:
       solid to 76% of the radius, then out to nothing. */
    '  float R = max(uOpen * uMaxR, 0.0001);',
    '  float m = 1.0 - smoothstep(R * 0.76, R, r);',

    '  vec2 uv = vUv;',
    '  float dh = 0.0;',
    '  if (m > 0.001 && uAmp > 0.0) {',
    /* One packet of rings, travelling. The wave train is windowed by
       a gaussian riding outward on uFront, so about three rings exist
       at any moment and there is nothing behind them: the ripple is
       something that passes through, not a surface that keeps being
       stirred. Amplitude is tied to the reveal as well, so the two
       crops always agree exactly where one gives way to the other. */
    '    float x = r - uFront;',
    '    float env = exp(-(x * x) / (uWidth * uWidth))',
    '              * m * smoothstep(0.0, uCore, r);',
    '    float k = x * uFreq;',
    '    uv += (d / max(r, 0.0001)) * (sin(k) * uAmp * env) / uSize;',
    '    dh = cos(k) * uFreq * uAmp * env;',
    '  }',

    /* Both crops are the same file dimensions, so one cover mapping
       serves them both. */
    '  vec2 t = uv * uCover - uOffset;',
    '  vec3 col = mix(texture2D(uMono, t).rgb, texture2D(uPhoto, t).rgb, m);',

    /* Signed, so one face of every wave lightens and the other
       darkens. The title card adds white to a black ground and gets
       away with it; over a photograph an additive-only highlight is
       invisible, and shading is what refraction looks like anyway. */
    '  gl_FragColor = vec4(col + dh * uLight, 1.0);',
    '}'
  ].join('\n');

  var UNIFORMS = ['uMono', 'uPhoto', 'uSize', 'uCover', 'uOffset', 'uCentre',
                  'uOpen', 'uMaxR', 'uFront', 'uWidth', 'uAmp', 'uFreq',
                  'uCore', 'uLight'];

  /* ---- one frame ------------------------------------------- */

  function Ripple(frame, tint, mono) {
    this.frame = frame;
    this.tint = tint;
    this.monoImg = mono;
    this.gl = null;
    this.dead = false;
    this.raf = 0;

    this.on = false;
    this.open = 0;      this.openFrom = 0; this.openT0 = 0; this.openDur = IN_MS;
    this.gate = 0;      this.gateFrom = 0; this.gateT0 = 0; this.gateDur = GATE_IN;
    this.struck = 0;
    this.texSrc = '';
    this.monoSrc = '';
    this.stale = true;
    this.cw = 0; this.ch = 0; this.dpr = 1;
  }

  Ripple.prototype.boot = function () {
    var canvas = this.canvas = document.createElement('canvas');
    canvas.className = 'frame__ripple';
    canvas.setAttribute('aria-hidden', 'true');

    /* Opaque. An alpha canvas here has to be blended over eleven
       clipped photographs every frame, which measured three times the
       cost of drawing it. Covering them instead, and drawing what they
       were drawing, takes them out of the compositor entirely. */
    var gl = this.gl = canvas.getContext('webgl', {
      alpha: false, antialias: false, depth: false, stencil: false,
      premultipliedAlpha: false, powerPreference: 'high-performance'
    }) || canvas.getContext('experimental-webgl');
    if (!gl) return false;

    var v = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(v, VERT); gl.compileShader(v);
    var f = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(f, FRAG); gl.compileShader(f);
    if (!gl.getShaderParameter(v, gl.COMPILE_STATUS) ||
        !gl.getShaderParameter(f, gl.COMPILE_STATUS)) {
      if (window.console) console.warn('[ripple]', gl.getShaderInfoLog(f));
      return false;
    }
    var p = this.prog = gl.createProgram();
    gl.attachShader(p, v); gl.attachShader(p, f);
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) return false;

    this.u = {};
    for (var i = 0; i < UNIFORMS.length; i++) {
      this.u[UNIFORMS[i]] = gl.getUniformLocation(p, UNIFORMS[i]);
    }

    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

    this.tex  = this.newTex();
    this.mono = this.newTex();
    if (!this.upload()) return false;

    var self = this;
    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      self.kill();
    });

    this.frame.insertBefore(canvas, this.tint.nextSibling);

    /* Draw the plain monochrome state once, now. The class that hides
       the blades is set from a pointer event, and if that paints
       before the first animation frame it would put an undrawn buffer
       on screen for one frame. */
    if (!this.measure()) return false;
    this.stale = false;
    this.paint(0, 0, 0);
    return true;
  };

  Ripple.prototype.newTex = function () {
    var gl = this.gl, t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  };

  function put(gl, tex, img) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  /* The pair of crops for this device: the monochrome one the blades
     are showing, and the colour one tint.js picked to flood it with.
     Both are images this module loaded itself. The frame's own base
     img cannot be used: it is display:none and marked loading="lazy",
     so the browser has no reason to ever finish it, and it sits at
     complete === false for the life of the page even though the
     blades are showing the very same file. */
  Ripple.prototype.upload = function () {
    var img = this.tint, mono = this.monoImg, gl = this.gl;
    if (!img.complete || !img.naturalWidth) return false;
    if (!mono || !mono.complete || !mono.naturalWidth) return false;

    put(gl, this.tex, img);
    put(gl, this.mono, mono);
    this.texSrc = img.src;
    this.monoSrc = mono.src;
    this.nw = img.naturalWidth;
    this.nh = img.naturalHeight;
    return true;
  };

  Ripple.prototype.setMono = function (img) {
    this.monoImg = img;
  };

  Ripple.prototype.measure = function () {
    var frame = this.frame, img = this.tint;
    var fw = frame.clientWidth, fh = frame.clientHeight;
    if (!fw || !fh || !this.nw) return false;

    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.cw = fw; this.ch = fh;
    var pw = Math.round(fw * this.dpr), ph = Math.round(fh * this.dpr);
    if (this.canvas.width !== pw)  this.canvas.width  = pw;
    if (this.canvas.height !== ph) this.canvas.height = ph;

    /* Repeat object-fit: cover, exactly as tint.js does for its hit
       box. The crop is centred, so one scale and one offset serve
       both axes whichever way y runs. */
    var s = Math.max(fw / this.nw, fh / this.nh);
    var dw = this.nw * s, dh = this.nh * s;
    this.cover  = [fw / dw, fh / dh];
    this.offset = [(fw - dw) / 2 / dw, (fh - dh) / 2 / dh];

    /* The subject centre, published by tint.js in frame pixels with y
       running down. Everything here runs y up, so flip it once. */
    var cx = parseFloat(img.style.getPropertyValue('--tint-x'));
    var cy = parseFloat(img.style.getPropertyValue('--tint-y'));
    if (!isFinite(cx) || !isFinite(cy)) return false;
    this.centre = [cx, fh - cy];

    var y = fh - cy;
    this.maxR = Math.max(
      Math.sqrt(cx * cx + y * y),
      Math.sqrt((fw - cx) * (fw - cx) + y * y),
      Math.sqrt(cx * cx + (fh - y) * (fh - y)),
      Math.sqrt((fw - cx) * (fw - cx) + (fh - y) * (fh - y))
    ) * 1.30;
    return true;
  };

  Ripple.prototype.set = function (on, since) {
    on = !!on;
    if (this.dead || this.on === on) return;
    this.on = on;
    var now = performance.now();

    /* Take the clock from the moment the subject was reached, not the
       moment this happened to be told. If the canvas was still being
       built when the pointer arrived, the bloom and the rings pick up
       exactly where tint.js has already got to instead of snapping
       back to the start. */
    var t0 = (on && since) ? since : now;

    this.openFrom = this.open; this.openT0 = t0;
    this.openDur = on ? IN_MS : OUT_MS;
    this.gateFrom = this.gate; this.gateT0 = t0;
    this.gateDur = on ? GATE_IN : GATE_OUT;

    /* Struck on arrival, so the burst is spent on the way in and the
       surface is already settling by the time the colour is full. */
    if (on) {
      this.struck = t0;
      this.frame.classList.add('has-ripple');
    }
    this.run();
  };

  Ripple.prototype.run = function () {
    if (this.dead || this.raf) return;
    var self = this;
    this.raf = requestAnimationFrame(function tick(now) {
      self.raf = 0;
      if (self.dead) return;
      if (self.draw(now)) self.raf = requestAnimationFrame(tick);
    });
  };

  Ripple.prototype.draw = function (now) {
    var gl = this.gl;

    var o = (now - this.openT0) / this.openDur;
    this.open = this.openFrom + ((this.on ? 1 : 0) - this.openFrom) * ease(o > 1 ? 1 : o);
    var g = (now - this.gateT0) / this.gateDur;
    this.gate = this.gateFrom + ((this.on ? 1 : 0) - this.gateFrom) * ease(g > 1 ? 1 : g);

    /* Nothing left to show: clear once and let the loop end, so a
       frame nobody is holding costs nothing at all. */
    /* Drained. Hand the frame back to the blades and stand down, so
       a frame nobody is holding costs nothing at all - and so the next
       scroll finds the shutter's own layers where it left them. */
    if (!this.on && this.open <= 0.0005 && this.gate <= 0.0005) {
      this.frame.classList.remove('has-ripple');
      return false;
    }

    if (this.tint.src !== this.texSrc || this.monoImg.src !== this.monoSrc) {
      if (!this.upload()) return true;
      this.stale = true;
    }
    /* clientWidth flushes layout, so it is read when the viewport has
       moved and not once per animation frame. The frame is fixed to
       the viewport; nothing else can change its size. */
    if (this.stale) {
      if (!this.measure()) return true;
      this.stale = false;
    }

    /* The packet only ever runs outward, from the moment the subject
       was reached. Driving it off uOpen instead would send it running
       backwards into the centre as the colour drains, which is the one
       thing it must not do. */
    var w = ease(Math.min((now - this.struck) / WAVE_MS, 1));
    var amp = this.gate * AMP * (1 - smooth01((w - SPEND) / (1 - SPEND)));

    this.paint(this.open, w * this.maxR * RIDE, amp);

    /* Held, fully open, and the rings have gone: draw the settled
       frame once and stand still. Holding a subject should not cost a
       frame a second for as long as the pointer rests there. */
    if (this.on && this.open >= 0.9995 && amp <= 0.0005) return false;
    return true;
  };

  Ripple.prototype.paint = function (open, front, amp) {
    var gl = this.gl;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.useProgram(this.prog);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.mono);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);

    var u = this.u;
    gl.uniform1i(u.uMono, 0);
    gl.uniform1i(u.uPhoto, 1);
    gl.uniform2f(u.uSize, this.cw, this.ch);
    gl.uniform2f(u.uCover, this.cover[0], this.cover[1]);
    gl.uniform2f(u.uOffset, this.offset[0], this.offset[1]);
    gl.uniform2f(u.uCentre, this.centre[0], this.centre[1]);
    gl.uniform1f(u.uOpen, open);
    gl.uniform1f(u.uMaxR, this.maxR);
    gl.uniform1f(u.uFront, front);
    gl.uniform1f(u.uWidth, WIDTH_PX);
    gl.uniform1f(u.uAmp, amp);
    gl.uniform1f(u.uFreq, FREQ);
    gl.uniform1f(u.uCore, CORE_PX);
    gl.uniform1f(u.uLight, LIGHT);

    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  /* Off at once, with no drain: the shutter is about to wipe this
     frame and needs its own layers back this frame, not in half a
     second. tint.js keeps the colour going on its own layer while the
     wipe runs, which is exactly what the shipped reel does. Both were
     driven from the same instants with the same curve and the same
     durations, so the handover lands where the canvas left off. */
  Ripple.prototype.standDown = function () {
    if (!this.frame.classList.contains('has-ripple')) return;
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
    this.frame.classList.remove('has-ripple');
    this.on = false;
    this.open = 0; this.openFrom = 0;
    this.gate = 0; this.gateFrom = 0;
  };

  Ripple.prototype.kill = function () {
    this.dead = true;
    if (this.raf) { cancelAnimationFrame(this.raf); this.raf = 0; }
    /* Only if it is actually set. classList.remove of an absent token
       still writes the attribute, which wakes the observer that called
       this, which calls this again. */
    if (this.frame.classList.contains('has-ripple')) {
      this.frame.classList.remove('has-ripple');
    }
    if (this.canvas && this.canvas.parentNode) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  };

  /* ---- wiring ---------------------------------------------- */

  var seen = [], live = [], hooks = [];

  /* Raised while the reel is moving. The frames are fixed to the
     viewport, so scrolling never moves the pointer off a subject and
     tint.js has no reason to let go; without this the canvas would
     keep standing in for a frame the shutter is trying to wipe. */
  var scrolling = false;

  function attach(tint) {
    var frame = tint.closest('.frame');
    if (!frame || seen.indexOf(tint) >= 0) return;
    seen.push(tint);

    var base = frame.querySelector('.frame__base');
    if (!base) return;

    var rip = null, mono = null, wanted = '', refused = false;
    var primed = false, onSince = 0, dead = false;

    /* Load the monochrome crop ourselves, and not before something
       asks for it. The blades have already pulled this exact file, so
       it comes out of cache the moment it is wanted, and nothing is
       added to what the page fetches on the way in. Owning it also
       means nothing here waits on the frame's own base img, which is
       display:none and marked loading="lazy" and therefore sits at
       complete === false for the life of the page. */
    function load() {
      var src = base.currentSrc || base.src;
      if (!src || wanted === src) return;
      wanted = src;
      var im = new Image();
      im.decoding = 'async';
      im.onload = function () {
        if (wanted !== im.src) return;      /* a rotation overtook it */
        mono = im;
        if (rip) rip.setMono(im);
        primed = false;
        sync();
      };
      im.src = src;
    }

    /* A turn to portrait swaps the crop, but only for a subject that
       has already been reached once. */
    function refresh() { if (mono) load(); }

    /* Build the canvas while the frame is on screen and the pointer
       is still somewhere else. Creating a context and compiling the
       program costs a few hundred milliseconds, and doing that on the
       first hover meant the colour was most of the way out before the
       rings existed - which is to say they were never seen at all. */
    function prime() {
      if (rip || refused || primed) return;
      /* The frame in front, not merely the one staged behind it. At
         the top of the page the first project is already live, and
         building its canvas there would put a second context and a
         second shader compile into the middle of the page load - the
         one place there is no idle time to spend them in. */
      if (!frame.classList.contains('is-live')) return;
      if (frame.classList.contains('is-inert')) return;
      if (reduce.matches || root.classList.contains('reduced')) return;
      if (!mono) { load(); return; }
      primed = true;
      idle(function () {
        if (rip || refused || dead) return;
        var r = new Ripple(frame, tint, mono);
        if (!r.boot()) { refused = true; r.kill(); return; }
        rip = r;
        live.push(rip);
        sync();                 /* in case the pointer got there first */
      });
    }

    function sync() {
      /* Standing down removes a class, which wakes the observer that
         called this. Without the flag it would simply be put straight
         back on. */
      if (scrolling) { if (rip) rip.standDown(); return; }

      var want = tint.classList.contains('is-on') && frame.classList.contains('is-live');
      if (want) { if (!onSince) onSince = performance.now(); }
      else onSince = 0;

      prime();
      if (!rip) return;
      rip.set(want, onSince);
    }

    new MutationObserver(sync).observe(tint, { attributes: true, attributeFilter: ['class'] });
    new MutationObserver(sync).observe(frame, { attributes: true, attributeFilter: ['class'] });
    tint.addEventListener('load', sync);

    hooks.push({ sync: sync, refresh: refresh });
    sync();
  }

  function scan() {
    var t = reel.querySelectorAll('.frame__tint');
    for (var i = 0; i < t.length; i++) attach(t[i]);
  }

  /* shutter.js builds each frame on demand, so the tint layers appear
     over the course of the scroll rather than at load. Watch for them
     rather than scanning once and missing four of the five. */
  new MutationObserver(scan).observe(reel, { childList: true, subtree: true });
  scan();

  /* shutter.js relayouts on this event and tint.js republishes the
     subject centre inside it. Ours is the later listener, so by the
     time it runs those values are the new ones. */
  window.addEventListener('ho:viewport', function () {
    for (var i = 0; i < live.length; i++) live[i].stale = true;
    /* A turn to portrait swaps both crops. */
    for (var j = 0; j < hooks.length; j++) hooks[j].refresh();
  });

  /* Hand every frame back for the length of the scroll, then offer
     the subject under the pointer again once it has settled. */
  var settle;
  window.addEventListener('scroll', function () {
    scrolling = true;
    for (var i = 0; i < live.length; i++) live[i].standDown();
    clearTimeout(settle);
    settle = setTimeout(function () {
      scrolling = false;
      for (var j = 0; j < hooks.length; j++) hooks[j].sync();
    }, 180);
  }, { passive: true });
}());
