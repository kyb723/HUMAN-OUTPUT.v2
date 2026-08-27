# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Plain static HTML/CSS/JS, no build step and no dependencies (user decision). Chosen so the site hosts on any static host and so adding a project later is a block of HTML plus an image dropped in `media/`. Fonts are self-hosted or loaded from Google Fonts; no bundler, no package manager.

## Users

Primary: prospective clients commissioning creative content and production work - brand and marketing leads, creative directors, and producers evaluating studios. They arrive from a referral, a link, or a credit, and their job is to judge in under a minute whether this studio's work is at the level they need, then find a way to make contact.

Secondary: collaborators and crew (directors, photographers, retouchers) checking the studio's range before working with it.

## Product Purpose

A portfolio site for HUMAN OUTPUT. It exists to present a small, curated body of production work at full scale and to make the studio contactable. Success is a visitor reaching the end of the work index with a clear read on the studio's craft level, and knowing how to get in touch.

## Positioning

A creative content and production studio - the work is made, not merely designed. The studio's own name is its argument: human-made output. The site's job is to let the imagery carry that claim without the interface explaining it.

## Operating Context

Visitors evaluate on desktop and on phones, often quickly and often in a browser tab alongside other studios. The work is photographic and monochrome, so it must be shown full-bleed and uncropped-feeling, never as thumbnails in a grid. The site will be updated by the owner by hand as new work ships.

## Capabilities and Constraints

- Static site. No CMS, no backend, no forms that submit anywhere; contact is a `mailto:` link unless the owner later adds a form service.
- Content is currently placeholder. Five dummy projects (Halflight, Koto Athletic, Northbound, Paloma, Slice) built from stock imagery in `media/`, to be replaced with real work by the owner.
- Studio contact details, address, and about copy are undecided and must ship as clearly marked placeholders. Do not invent client names, awards, press, headcount, founding date, or testimonials.
- The signature interaction is a scroll-driven vertical-slat wipe between full-viewport projects, replicating the interaction on layerhk.com at the owner's explicit request.

## Brand Commitments

- Name: HUMAN OUTPUT. Descriptor line: "Creative Content & Production Studio".
- Wordmark is a wide geometric sans, all caps, with a signature split O: left half a solid disc, right half an open ring. Monogram is "HO" using the same split O. Source asset: `Assets/LOGO.jpeg` (black on white).
- The split-O device is the studio's distinguishing mark and should be usable on its own.
- Reference the owner made binding: layerhk.com, specifically its scrolling interaction.

## Evidence on Hand

- `Assets/LOGO.jpeg` - full wordmark plus monogram plus descriptor, black on white, 1456x1080.
- Project 01 Marshall, `media/marshall-*.jpg` - the owner's own CGI render. Landscape source, so the tall crop is recomposed rather than cropped. Supplied 2026-08-27.
- Project 03 SBDW, `media/sbdw-*.jpg` - the owner's own photograph. The subject is vertical, so the tall crop is a true crop and needs no reconstruction. Supplied 2026-08-27.
- Both are graded with one curve so the reel reads as a single body of work: channel-weighted greyscale, then a midtone contrast that falls to zero at both ends and so cannot clip.
- Slot 02 is still the Koto Athletic placeholder, as are 04 and 05.
- `media/` - stock images standing in for the remaining slots: `halflight-wireframe.jpg`, `koto-athletic.jpg`, `paloma.jpg`, `slice-campaign.jpg`, `slice-social.jpg`, `slice-video.jpg`, `studio.jpg`. These are tinted, not truly monochrome, so the reveal does not read on them.
- Every project needs two crops, 16:9 and 9:16, swapped by `<picture>` on `(max-aspect-ratio: 1/1)`. See README for the full spec.
- No real client work, credits, press, or testimonials exist yet. Nothing of the kind may be fabricated.

## Product Principles

1. The work is the interface. Chrome recedes; nothing competes with the image for the first viewport.
2. Show few things at full scale rather than many things small.
3. Never fabricate credibility. Absent facts ship as visible placeholders, not as plausible copy.
4. Editable by hand. A non-developer owner must be able to add a project without touching the interaction code.
5. The monochrome is a commitment, not a phase. No colour is introduced that the photography does not already contain.

## Accessibility & Inclusion

The signature interaction is scroll-driven and motion-heavy, so a `prefers-reduced-motion` path is required, not optional: under it the work must remain fully readable and navigable without the slat animation. Keyboard navigation must reach every project and every nav destination.
