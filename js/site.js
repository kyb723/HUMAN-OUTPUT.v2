/* HUMAN OUTPUT - shared behaviour: capability flags, viewport unit, menu. */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.remove('no-js');
  root.classList.add('js');

  /* ---- reduced motion ------------------------------------- */

  var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  function syncMotion() { root.classList.toggle('reduced', mq.matches); }
  syncMotion();
  if (mq.addEventListener) mq.addEventListener('change', syncMotion);
  else if (mq.addListener) mq.addListener(syncMotion);

  /* ---- stable viewport unit --------------------------------
     window.innerHeight changes when a mobile URL bar hides, which
     would otherwise re-length the scroll runway mid-scroll. Only
     react to a width change or a substantial height change.       */

  var lastW = 0, lastH = 0;

  function measure(force) {
    var w = window.innerWidth;
    var h = window.innerHeight;
    if (!force && w === lastW && Math.abs(h - lastH) < 120) return;
    lastW = w;
    lastH = h;
    root.style.setProperty('--vh', h + 'px');
    window.dispatchEvent(new CustomEvent('ho:viewport'));
  }

  measure(true);

  var rzTimer;
  window.addEventListener('resize', function () {
    clearTimeout(rzTimer);
    rzTimer = setTimeout(function () { measure(false); }, 120);
  }, { passive: true });

  window.addEventListener('orientationchange', function () {
    setTimeout(function () { measure(true); }, 220);
  });

  /* ---- menu ------------------------------------------------ */

  var toggle = document.querySelector('.menu-toggle');
  var menu = document.getElementById('menu');
  if (!toggle || !menu) return;

  var isOpen = false;

  function setMenu(open) {
    if (open === isOpen) return;
    isOpen = open;
    root.classList.toggle('menu-open', open);
    root.style.overflow = open ? 'hidden' : '';
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    menu.setAttribute('aria-hidden', open ? 'false' : 'true');
    menu.toggleAttribute('inert', !open);

    if (open) {
      var first = menu.querySelector('a');
      if (first) first.focus();
    } else {
      toggle.focus();
    }
  }

  menu.setAttribute('aria-hidden', 'true');
  menu.toggleAttribute('inert', true);

  toggle.addEventListener('click', function () { setMenu(!isOpen); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && isOpen) setMenu(false);
  });

  /* Keep tab focus inside the overlay while it is open. */
  menu.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab' || !isOpen) return;
    var f = menu.querySelectorAll('a[href], button:not([disabled])');
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
}());
