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
| Plate captions | `work/marshall.html`, `work/slice.html` |
| Projects 02 to 05 and their photographs | see below |
| Copyright year `2026` | every page footer |
| `og:image` is a relative path; social scrapers want an absolute URL once you have a domain | `<head>` of every page |

The placeholder email uses the reserved `.example` domain, so it cannot
accidentally reach a real inbox.

Nothing on this site claims a client, an award, a press mention, a founding
date or a headcount. Do not add any of those back unless they are true.

---

## Adding or replacing a project

**1. Drop two crops in `media/`,** named `<project>-wide.jpg` and
`<project>-tall.jpg`.

| Crop | Pixels | Ratio | Serves |
|---|---|---|---|
| Wide | 2560 x 1440 | 16:9 | every landscape viewport |
| Tall | 1440 x 2560 | 9:16 | every portrait viewport, phones and tablets |

Two crops are not optional. A frame is `position: fixed; inset: 0` and the
blades draw it with `object-fit: cover`, so the file is centre-cropped to the
shape of the screen. A 16:9 image on a 390x844 phone shows only **25% of its
width**. The `<picture>` element swaps on `(max-aspect-ratio: 1/1)`, so exactly
one file is downloaded per device.

Keep the subject inside the **central 75%** of each crop, and clear of the
chrome: the top 8% (monogram and Menu), the bottom 22% (project title, over a
scrim that darkens the bottom 46%), and the right 5% (the progress ruler, on
landscape only).

Deliver **four** files: a monochrome and a colour version of each crop.
`<project>-wide.jpg`, `<project>-tall.jpg`, `<project>-wide-colour.jpg` and
`<project>-tall-colour.jpg`. The monochrome pair is what the page shows; the
colour pair is loaded alongside it and revealed through a mask when the pointer
finds the subject. Both members of a pair must be the same crop at the same
pixel size, or the colour will not land on the frame it is revealing.

How hard the tall crop is depends entirely on the subject. A vertical
subject in a landscape frame crops straight to 9:16 with nothing invented,
which is what `media/sbdw-tall.jpg` is. A horizontal subject cannot, because
9:16 at full height keeps only the central 31.7% of the width.

If a source is landscape only and cannot be reshot, `media/marshall-tall.jpg`
shows the fallback: crop to the subject, then stretch the smooth background
above and below with a continuously varying vertical scale, so the subject
stays at its true proportions and no seam appears.

**2. Add a frame to `index.html`,** in the `<main class="reel">` block, between
the title card and the closing frame. Copy an existing one:

```html
<article class="frame"
         data-tint-wide="media/your-project-wide-colour.jpg"
         data-tint-tall="media/your-project-tall-colour.jpg"
         data-subject-wide="28,24,48,50"
         data-subject-tall="5,35,74,25">
  <a class="frame__link" href="work/your-project.html">
    <picture>
      <source media="(max-aspect-ratio: 1/1)" srcset="media/your-project-tall.jpg" width="1440" height="2560">
      <img class="frame__base" src="media/your-project-wide.jpg" width="2560" height="1440"
           alt="A real description of what is in the photograph." loading="lazy">
    </picture>
    <div class="frame__overlay" data-caption>
      <div class="frame__scrim"></div>
      <div class="frame__caption">
        <h2 class="frame__name"><span class="sweep">Your Project</span></h2>
        <p class="frame__tag">The project's own title</p>
        <p class="frame__disc">Discipline &amp; Discipline</p>
      </div>
    </div>
  </a>
</article>
```

`data-subject-wide` and `data-subject-tall` are the subject's bounding box in
that crop, as `x,y,width,height` percentages of the image. They are what the
colour bloom is centred on and what the pointer has to be inside for it to
fire, so they have to be measured per crop: the subject sits in a different
place in the wide and the tall composition. Get them from the image, not by
eye. A frame with no `data-tint-wide` simply never blooms.

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
index.html            the scroll experience
hero-water.html       the same site with the alternate title card
about.html
contact.html
work/*.html           five project pages
css/site.css          all styling, tokens at the top
css/hero-water.css    loaded only by hero-water.html
js/site.js            capability flags, viewport unit, menu
js/shutter.js         the scroll mechanic
js/tint.js            colour on reach
js/hero-water.js      the alternate title card, WebGL
assets/               wordmark, monogram, favicon, social card
media/                project photographs
DESIGN.md             the visual system and why it is what it is
PRODUCT.md            durable product facts
```

`assets/wordmark.png` and `assets/monogram.png` were derived from
`assets/LOGO.jpeg` as white-on-transparent, so they sit on the dark ground and
over photographs. Regenerate them from the original if the logo changes.

---

## The alternate title card

`hero-water.html` is the whole site with one thing changed: the wordmark sits
under a still black liquid instead of on the page, and the pointer disturbs it.
Everything below the first frame is identical. Open the two pages side by side
to choose.

`index.html` does not load a byte of it. The variant is three files
(`hero-water.html`, `css/hero-water.css`, `js/hero-water.js`) and the diff
against `index.html` is six lines.

**How it works.** A damped wave equation on the GPU, integrated across two
half-float buffers that swap every step. Each texel holds the surface height
now and one step ago; the next height is `2*now - then + c2 * laplacian`,
damped, with energy deposited along the segment the pointer swept so a flick
leaves a stroke and not a row of dots. A second pass takes the gradient of that
height field, refracts the wordmark through it, lights the crests, and shades
the curvature, which is what makes flat black read as liquid.

Raw WebGL2, no library. The technique is the one every Three.js tutorial uses,
but Three.js is around 600KB to draw two full-screen triangles, and this site
has no build step to hide that behind.

**Costs and limits.**

- The height field is capped at 512px on its long side (320 on a phone) however
  big the canvas gets. Waves are broad and do not need the pixels.
- The loop runs only while the title card is the live frame and the tab is
  visible. Scroll to the first project and it stops dead.
- Displacement is clamped to 10px in the shader, so no speed of scrubbing can
  tear the letterforms.
- Measured at a locked 60fps under continuous dragging (p95 18.2ms per frame).
- Needs WebGL2 and a float-renderable target. Without either, or under
  `prefers-reduced-motion`, nothing runs and the authored card shows instead.
- The markup for the mark stays in the page at zero opacity, so it is still
  read aloud and still indexed. The texture is drawn by measuring those real
  elements, which is how both versions place the mark identically at every
  width.

If this becomes the site, move the three files' contents into `index.html`,
`css/site.css` and a script tag, and drop the ` — Water` suffix from the title.

---

## Accessibility notes

- Only the frame currently on screen is in the tab order; the others are
  `inert`. The complete project list lives in the menu overlay so every
  project stays reachable by keyboard.
- The menu traps focus while open, closes on Escape, and returns focus to the
  toggle.
- Every text colour clears WCAG AA on the page ground.
- Photographs carry real alt text. Replace it when you replace the images.
