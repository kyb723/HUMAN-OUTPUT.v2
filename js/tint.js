/* HUMAN OUTPUT - the tint.

   The site is monochrome. Colour exists only inside the work, and only
   while the visitor is holding the pointer on the subject of a frame:
   it blooms out from the centre of that subject, floods the frame, and
   drains back when the pointer leaves.

   Each host carries two colour crops and, for each crop, the subject's
   box as percentages of that image. The box has to be mapped through the
   same object-fit: cover crop the browser applies to the base image, or
   the hit region drifts off the subject on every viewport whose shape
   differs from the file's - which, given one file serves 16:9 through
   21:9, is nearly all of them.

   Touch has no hover, so on a coarse pointer the frame blooms by itself
   once it is the fully revealed one, and drains as the next wipes over.  */
(function () {
  'use strict';

  var portrait = window.matchMedia('(max-aspect-ratio: 1/1)');
  var hoverable = window.matchMedia('(hover: hover) and (pointer: fine)');

  function box(s) {
    var n = String(s || '').split(',').map(Number);
    if (n.length !== 4) return null;
    for (var i = 0; i < 4; i++) if (!isFinite(n[i])) return null;
    return n;
  }

  function Tint(host, parent, before) {
    this.host = host;
    this.on = false;
    this.hit = null;
    this.maxR = 0;
    this.src = '';

    var img = this.img = document.createElement('img');
    img.className = 'frame__tint';
    img.alt = '';
    img.setAttribute('aria-hidden', 'true');
    img.decoding = 'async';
    img.draggable = false;

    var self = this;
    img.addEventListener('load', function () { self.measure(); });

    if (before) parent.insertBefore(img, before);
    else parent.appendChild(img);

    this.sync();
    if (hoverable.matches) this.listen();
  }

  /* Point at the crop the browser has chosen for the base image. */
  Tint.prototype.sync = function () {
    var tall = portrait.matches;
    var src = this.host.getAttribute(tall ? 'data-tint-tall' : 'data-tint-wide');
    this.subject = box(this.host.getAttribute(tall ? 'data-subject-tall' : 'data-subject-wide'));
    if (!src || src === this.src) return;
    this.src = src;
    this.img.src = src;
  };

  Tint.prototype.measure = function () {
    var img = this.img, host = this.host;
    var nw = img.naturalWidth, nh = img.naturalHeight;
    var fw = host.clientWidth, fh = host.clientHeight;
    if (!nw || !nh || !fw || !fh || !this.subject) return false;

    /* Repeat the browser's cover crop: scale to the larger ratio, centre. */
    var s = Math.max(fw / nw, fh / nh);
    var dw = nw * s, dh = nh * s;
    var ox = (fw - dw) / 2, oy = (fh - dh) / 2;
    var b = this.subject;

    var x = ox + b[0] / 100 * dw, y = oy + b[1] / 100 * dh;
    var w = b[2] / 100 * dw,      h = b[3] / 100 * dh;
    this.hit = [x, y, x + w, y + h];

    var cx = x + w / 2, cy = y + h / 2;
    img.style.setProperty('--tint-x', cx.toFixed(1) + 'px');
    img.style.setProperty('--tint-y', cy.toFixed(1) + 'px');

    this.maxR = Math.max(
      Math.sqrt(cx * cx + cy * cy),
      Math.sqrt((fw - cx) * (fw - cx) + cy * cy),
      Math.sqrt(cx * cx + (fh - cy) * (fh - cy)),
      Math.sqrt((fw - cx) * (fw - cx) + (fh - cy) * (fh - cy))
    ) * 1.30;

    if (this.on) this.paint();
    return true;
  };

  Tint.prototype.relayout = function () { this.sync(); this.measure(); };

  Tint.prototype.paint = function () {
    this.img.style.setProperty('--tint-r', (this.on ? this.maxR : 0).toFixed(1) + 'px');
  };

  Tint.prototype.set = function (on) {
    on = !!on;
    if (this.on === on) return;
    this.on = on;
    this.img.classList.toggle('is-on', on);
    this.paint();
  };

  /* The frame link fills the host, so pointer coordinates are already
     host coordinates: no rect read, and nothing to invalidate on scroll. */
  Tint.prototype.listen = function () {
    var self = this, host = this.host;

    host.addEventListener('pointermove', function (e) {
      if (e.pointerType === 'touch') return;
      var h = self.hit;
      if (!h && !self.measure()) return;
      h = self.hit;
      var r = host.getBoundingClientRect();
      var x = e.clientX - r.left, y = e.clientY - r.top;
      self.set(x >= h[0] && x <= h[2] && y >= h[1] && y <= h[3]);
    }, { passive: true });

    host.addEventListener('pointerleave', function () { self.set(false); });
  };

  function create(host, parent, before) {
    if (!host || !host.getAttribute('data-tint-wide')) return null;
    return new Tint(host, parent || host, before || null);
  }

  window.HOTint = {
    create: create,
    hoverable: function () { return hoverable.matches; },

    /* Standalone hosts - the work page hero - drive themselves. Frames in
       the reel are driven by the shutter instead, which knows which one
       is open and can build them on demand. */
    auto: function (root) {
      var out = [];
      var hosts = (root || document).querySelectorAll('[data-tint-wide]');
      for (var i = 0; i < hosts.length; i++) {
        var host = hosts[i];
        if (host.closest('[data-reel]')) continue;
        var t = create(host, host, host.querySelector('.frame__scrim'));
        if (!t) continue;
        out.push(t);
        if (!hoverable.matches) (function (t) {
          setTimeout(function () { t.measure(); t.set(true); }, 400);
        })(t);
      }
      window.addEventListener('ho:viewport', function () {
        for (var j = 0; j < out.length; j++) out[j].relayout();
      });
      return out;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { window.HOTint.auto(); });
  } else {
    window.HOTint.auto();
  }
})();
