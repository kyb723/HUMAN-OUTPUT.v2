# HUMAN OUTPUT

Portfolio site for HUMAN OUTPUT, a creative content and production studio.

Plain static HTML, CSS and JavaScript. No build step, no dependencies, no
package manager. Open `index.html` in a browser, or drop the whole folder on
any static host (Netlify, Vercel, GitHub Pages, Cloudflare Pages, or ordinary
shared hosting).

To preview locally with correct paths:

    python3 -m http.server 8000
    # then open http://localhost:8000

---

## The scrolling interaction

The index is a stack of fixed, full-viewport frames. On load, `js/shutter.js`
splits each project photograph into **eleven vertical blades**. As you scroll,
each blade wipes open left to right on a stagger, so the next project sweeps
into frame like a camera shutter opening.

The scroll model, in `js/shutter.js`:

| Constant  | Value | Meaning |
|-----------|-------|---------|
| `BLADES`  | 11    | vertical blades per frame |
| `HOLD`    | 1.5   | viewport heights of scroll each frame owns |
| `SPEED`   | 4.5   | wipe speed multiplier |
| `STAGGER` | 0.1   | delay added per blade |

Blade `j` opens on `progress * SPEED - j * STAGGER`, clamped to 0..1, so a
frame is fully open about 44% into its scroll block and then holds. Change
`STAGGER` to make the cascade more or less pronounced; change `HOLD` to make
each project linger longer.

Scroll listening is passive and only schedules a frame; every read and write
happens inside one `requestAnimationFrame` callback, and the wipe animates
`clip-path`, which never triggers layout.

**Reduced motion and no JavaScript** both fall back to the same thing: the
frames unstack into ordinary full-bleed sections you scroll normally. Nothing
is lost but the wipe.

---

## Three heroes

Three versions of the index are live. Everything below the first viewport is
identical in all three; only the opening frame differs.

| Page | Hero | Added weight |
|---|---|---|
| `index.html` | Title card. Wordmark and descriptor on black. Tagged `v1-shutter-hero`. | none |
| `hero-b.html` | Liquid, 2D. Three drops trail the pointer and fuse via an SVG goo filter. | ~4 KB gz |
| `hero-c.html` | Mercury, real 3D. Three.js MarchingCubes metaballs with a specular material. | ~190 KB gz |

Each alternate hero adds its own files and changes nothing else. The shared
stylesheet, both shared scripts and every other page are untouched, so the
heroes cannot affect each other.

### How the mercury hero works (`hero-c.html`)

Three.js `MarchingCubes` polygonises a scalar field every frame, so the drops
merge as real geometry and carry a specular highlight and a rim across the
join. The environment is a procedural softbox gradient prefiltered through
`PMREMGenerator`; lights alone leave the liquid looking like flat plastic.

Three.js r176 (MIT) is vendored under `js/vendor/` rather than loaded from a
CDN, so the page has no runtime dependency on anyone else's uptime. Note that
since r176 the build is split: `three.module.min.js` re-exports from
`three.core.min.js` and **both** files are required.

The one number that decides whether this holds 60fps is the field resolution,
because polygonising is O(res^3) on the main thread every frame. It starts at
56 on desktop and 44 on mobile, and steps down automatically if the rolling
median frame cost passes 22ms. Measured here: 6.5ms desktop, 3.5ms mobile.

Two coupled constants control quality:

| Constant | Does |
|---|---|
| `FR` | drop radii as a fraction of the field cube. This, times the resolution, is how many grid cells a ball spans. Below about 5 the silhouette goes faceted. |
| `FIELD` | how many pixels the field cube covers. Widening it spreads the same grid over more pixels and each drop loses cells, so it is kept just wider than the wordmark. |

To make the drops smoother at no extra cost, shrink `FIELD` and raise `FR` by
the same ratio: same size on screen, more cells per ball.

The canvas sits **above** the wordmark, so a drop crossing a letter reads as
liquid resting on the type. It fades in only after the first frame has actually
rendered, so a slow device never flashes an empty rectangle. If WebGL is
missing the canvas is removed and the hero falls back to the still wordmark.

### How the liquid hero works (`hero-b.html`)

The drops sit in a filtered layer. The filter blurs it, then drives alpha
through a steep ramp, so two blurred shapes that overlap snap into one
silhouette: metaballs. The bridge that stretches and snaps as a drop leaves is
not scripted, it falls out of that threshold.

The wordmark is deliberately **outside** the filter. Blur-plus-threshold closes
every concavity narrower than about `1.35 x sigma`, and the split-O gap is only
7px on screen at desktop size, so putting the wordmark in the goo fused
adjacent letters and swallowed the brand device. It is not needed there anyway:
the drops and the wordmark are the same white, so an overlap already reads as
one mass with no seam.

Everything tunable sits at the top of `js/hero-b.js`:

| Constant | Does |
|---|---|
| `EASE` | lag per drop. Wider spread makes them string out further on a fast move. |
| `ORBIT` | phase and radius factor per drop within the cluster. |
| `CLUSTER` | cluster radius. Scales with the wordmark. |
| `IDLE_AFTER` | ms of stillness before the drops drift on their own. |

Blur, cluster radius and drop sizes all scale with the rendered wordmark, so
the effect holds its proportions from a phone to a wide desktop.

**On a phone there is no cursor**, so with no pointer the cluster drifts on a
slow path across the wordmark and touch-drag takes it over. Under
`prefers-reduced-motion` the drops are hidden and the hero falls back to the
same still composition as `index.html`.

One thing to know if you promote this hero: `assets/wordmark.png` was written
with pure white ink, while the rest of the site uses `--ink` (`#f4f4f2`). The
drops are set to pure white to match it exactly, because any difference shows
as a seam where they overlap a letter. Regenerating the wordmark at `#f4f4f2`
and setting the drops back to `var(--ink)` would make it fully token-clean.

---

## Replace this before launch

Everything below is placeholder. While `<html data-draft="true">` is set, every
placeholder string carries a dotted underline and a small corner chip appears.

**Delete `data-draft="true"` from the `<html>` tag on every page to clear all
of that marking at once.**

| What | Where |
|---|---|
| Email address `hello@humanoutput.example` | every page (header menu, footer, `contact.html`, closing frame of `index.html`) |
| Studio address, phone, Instagram handle | `contact.html` |
| Instagram link (currently plain text, no URL yet) | `contact.html` |
| Studio statement and three About paragraphs | `about.html` |
| Six capability descriptions | `about.html` |
| Client, Year and Role on every project | `work/*.html` factsheet |
| Project lead sentence and two body paragraphs | `work/*.html` |
| Plate captions | `work/halflight.html`, `work/slice.html` |
| All five projects and their photographs | see below |
| Copyright year `2026` | every page footer |
| `og:image` is a relative path; social scrapers want an absolute URL once you have a domain | `<head>` of every page |

The placeholder email uses the reserved `.example` domain, so it cannot
accidentally reach a real inbox.

Nothing on this site claims a client, an award, a press mention, a founding
date or a headcount. Do not add any of those back unless they are true.

---

## Adding or replacing a project

**1. Drop the photograph in `media/`.** Landscape around 1600px wide works
well. The blades crop with `object-fit: cover`, so the subject should sit near
the centre.

**2. Add a frame to `index.html`,** in the `<main class="reel">` block, between
the title card and the closing frame. Copy an existing one:

```html
<article class="frame">
  <a class="frame__link" href="work/your-project.html">
    <img class="frame__base" src="media/your-project.jpg"
         alt="A real description of what is in the photograph." loading="lazy">
    <div class="frame__overlay" data-caption>
      <div class="frame__scrim"></div>
      <div class="frame__caption">
        <h2 class="frame__name"><span class="sweep">Your Project</span></h2>
        <p class="frame__disc">Discipline &amp; Discipline</p>
      </div>
    </div>
  </a>
</article>
```

The scroll length, the progress ruler and the blades all count the frames
themselves, so nothing else needs updating.

**3. Copy a page in `work/`** and edit it. Point the previous project's
"Next project" link at it.

**4. Add it to the menu list** in the `.menu__index` block. This list is how
keyboard and screen reader users reach projects that are not currently on
screen, so please keep it complete.

The header, menu and footer are repeated in each file because there is no build
step. If you change one, change all eight.

---

## Files

```
index.html            the scroll experience, title-card hero
hero-b.html           same page with the liquid hero (2D, SVG goo)
hero-c.html           same page with the mercury hero (3D, Three.js)
about.html
contact.html
work/*.html           five project pages
css/site.css          all styling, tokens at the top
css/hero-b.css        liquid hero only
css/hero-c.css        mercury hero only
js/site.js            capability flags, viewport unit, menu
js/shutter.js         the scroll mechanic
js/hero-b.js          liquid hero only
js/hero-c.js          mercury hero only (ES module)
js/vendor/            Three.js r176 (MIT), vendored
assets/               wordmark, monogram, favicon, social card
media/                project photographs
DESIGN.md             the visual system and why it is what it is
PRODUCT.md            durable product facts
```

`assets/wordmark.png` and `assets/monogram.png` were derived from
`assets/LOGO.jpeg` as white-on-transparent, so they sit on the dark ground and
over photographs. Regenerate them from the original if the logo changes.

---

## Accessibility notes

- Only the frame currently on screen is in the tab order; the others are
  `inert`. The complete project list lives in the menu overlay so every
  project stays reachable by keyboard.
- The menu traps focus while open, closes on Escape, and returns focus to the
  toggle.
- Every text colour clears WCAG AA on the page ground.
- Photographs carry real alt text. Replace it when you replace the images.
