# Design

## World: The shutter

HUMAN OUTPUT is a production studio, so the site behaves like the instrument the studio works with. Every project arrives the way a focal-plane shutter opens: eleven vertical blades sweep across the frame left to right, in a staggered cascade, and the work is behind them. That single mechanic is the whole visual argument. Nothing else on the page competes with it.

The interaction is pinned by the client to layerhk.com and reproduced faithfully. The reading of it as a shutter is what makes it belong to this studio rather than that one.

## Mode

Experience. The work leads from the first viewport; the interface recedes to hairlines and a monogram.

## Ground

Locked dark, from the use scene rather than from category habit: a visitor judging low-key monochrome photography, often at night, often in a tab beside other studios. On a dark ground the photographs are the only light source on the page. There is no light mode; the page does not invert per section.

## Color strategy: Drenched monochrome

No accent. Not "neutrals plus one" but a total commitment to the greyscale the photography already lives in. Any hue introduced here would be the only colour on the page and would read as interface, not as work.

The interface is never coloured. Colour lives inside the work, and only while the visitor is reaching for it: hold the pointer on the subject of a frame and colour blooms out from the centre of that subject, floods the frame, and drains back when the pointer leaves. Nothing else on the page changes, so the reveal reads as the work waking up rather than as a state change in the UI.

This makes colour something earned rather than something asserted, and it keeps a colour photograph from having to sit permanently against a page built for greyscale. Base crops are delivered monochrome; a second colour crop is loaded per frame and revealed through a mask.

Touch has no hover. On a coarse pointer a frame blooms by itself once it is the fully revealed one and drains as the next wipes over it, which is the nearest honest reading of "the visitor is on this work".

| Token | Value | Use | Contrast on ground |
|---|---|---|---|
| `--ground` | `#0b0b0b` | page | - |
| `--ground-2` | `#141414` | raised panels | - |
| `--ink` | `#f4f4f2` | primary text | 17.7:1 |
| `--ink-2` | `#b4b4b0` | secondary text | 9.3:1 |
| `--ink-3` | `#8a8a86` | meta, labels | 5.6:1 |
| `--rule` | `rgb(244 244 242 / .16)` | hairlines | - |

Every text token clears WCAG AA at body size. There is no grey below `--ink-3` carrying text.

## Type

**Jost**, one family, whole site. Chosen because the wordmark is built on a perfect-circle geometric O and a flat-apex A: a Futura-lineage face is the only thing that sits beside it without arguing. Futura is also the native typeface of the studio and film-title tradition this work belongs to. Weights 300/400/500 only.

- Display: `clamp(2.25rem, 5.4vw, 4.5rem)`, weight 400, tracking `-0.02em`
- Title card: `clamp(2.75rem, 7vw, 6rem)`, capped at the 6rem display ceiling
- Body: 1rem / 1.62, measure capped at 66ch
- Meta: 0.6875rem, uppercase, tracking `0.34em`

No monospace anywhere. A production studio using mono for metadata is a costume; Jost's geometric figures do the job.

## Shape

Radius 0, universally. Nothing on the page is rounded. The slat geometry, the hairline rules, the image edges and the focus ring are all square, which is what makes the shutter read as mechanical rather than soft.

## Identity

The real wordmark and monogram are lifted from `assets/LOGO.jpeg` and rebuilt as white-on-transparent PNGs (`assets/wordmark.png`, `assets/monogram.png`) by an alpha-from-luminance pass. They are the client's actual letterforms, not a typeset approximation. The split O carries the brand on its own.

## Motion

One authored moment: the shutter. `progress x 4.5 - index x 0.1`, clamped, per blade, driven by scroll position. Everything else is a 200ms opacity or a hairline sweep on hover. Frame 6 closes the shutter in solid black over the last project, which is how the scroll ends.

`prefers-reduced-motion: reduce` and a no-JS load both fall back to the same thing: the frames unstack into normal document flow as plain full-bleed sections. Nothing is lost but the wipe.

**Under consideration: the water title card.** `hero-water.html` puts the wordmark under a still black liquid that the pointer disturbs — a second authored moment, and the only one that is continuous rather than scroll-driven. It earns its place by being the opposite of the shutter: the shutter is mechanical, staged and hard-edged; the water is slow, soft and entirely the visitor's to move. Both are monochrome, and the water is deliberately not the pastel of its reference — still black with a cold silver catch on the crests, a developer tray rather than a pool. The decision is open. `index.html` is unchanged and remains the shipped home page.

## Layout families

Index (fixed frames), project hero, meta grid, text column, full-bleed stack, closing panel, menu overlay. No family repeats within a page.

## Draft marking

`<html data-draft="true">` reveals placeholder marking on every unwritten string plus a corner chip. Removing that one attribute ships the site clean. Placeholders use the reserved `.example` TLD so no address can be accidentally real.
