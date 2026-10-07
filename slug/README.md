# Slug — analytic GPU text in 3D perspective

Feasibility demo for SlicerLive card/panel text: the
[Slug algorithm](https://jcgt.org/published/0006/02/02/) (Eric Lengyel,
JCGT 6(2), 2017) implemented from scratch in WebGPU/WGSL, in a single
self-contained page: [`../slug.html`](../slug.html)
(hosted: https://pieper.github.io/sites/slug.html).

Glyphs stay as quadratic Bézier outlines on the GPU; the fragment shader
computes an antialiased winding number per pixel by casting two
axis-aligned rays through banded, sorted curve lists. No glyph atlas, no
SDF bake, no mipmaps — text is pixel-exact at any scale, rotation, or
perspective, verified in-demo from ~10 px/em to ~10,000 px/em.

The US patent on Slug (10,373,352) was dedicated to the public domain on
2026-03-17; this is an independent implementation written from the paper,
under Apache-2.0.

## What's in the page (one file, ~75 KB)

- Minimal TrueType parser (head/maxp/cmap 4+12/hhea/hmtx/loca/glyf,
  simple + composite glyphs) → per-glyph quadratic curves in em units.
- Slug data builder: per glyph, 8 horizontal + 8 vertical bands, each a
  curve-index list sorted descending by max-coordinate for early exit.
- WGSL fragment shader: Lengyel's root-classification table (`0x2E74`),
  both ray axes (the vertical ray via the orientation-preserving rotation
  `(x,y) → (y,−x)`), per-crossing coverage `saturate(x/w + ½)`.
- **Extension beyond the paper**: the filter width `w` per axis is
  `length(vec2(dpdx(c), dpdy(c)))` of the interpolated glyph-space
  coordinate — so antialiasing follows the true screen-space footprint
  under 3D perspective instead of a single pixels-per-em scalar. (This is
  the scalar→derivative upgrade discussed in the DOMField plan; the next
  step beyond it is a full anisotropic Jacobian per Ellis/Hunt/Hart.)
- Word-wrap layout from font advances; winding-sign auto-detect per font.
- Demos: **Document** (any .txt on a 3D page), **Texture vs Slug**
  (same text, same font, same line breaks: mipmapped + 16× anisotropic
  texture at selectable px/em on the left, analytic on the right),
  **Glancing** (corridor walls + floor at steep angles).
- Load any `.txt` and any TrueType `.ttf` (glyf outlines; CFF `.otf`
  rejected with a message).
- `?test=1` self-test renders offscreen, reads pixels back, reports
  `SLUG_TEST_OK ink=… paper=…` in the title/`#testout` (used by headless
  Chrome CI; also drives frames by `setTimeout` because headless
  virtual-time never delivers rAF with a WebGPU canvas).

## URL parameters

`?test=1` self-test · `?t=some+text` override text ·
`?mode=doc|compare|glancing` · `?dist=` `?az=` `?tx=` `?ty=` camera.

## Local testing

```sh
cd ~/sites && python3 -m http.server 8741
open http://localhost:8741/slug.html
```

Headless check:

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --enable-unsafe-webgpu --virtual-time-budget=8000 \
  --screenshot=/tmp/slug.png --window-size=1400,900 \
  "http://localhost:8741/slug.html?test=1"
```

## Files

- `../slug.html` — the whole demo (font embedded as base64).
- `DejaVuSans-subset.ttf` — the embedded font (Latin-1 subset of DejaVu
  Sans, TrueType outlines, generated with `pyftsubset --no-hinting`).
- `LICENSE_DEJAVU` — Bitstream Vera license + DejaVu public-domain note
  (required for redistribution of the font).

## Status / known limits

- No kerning or shaping (advances only) — fine for feasibility; real use
  pulls in HarfRust/Parley per the DOMField plan.
- Winding coverage is clamped per axis then averaged; overlapping
  contours saturate (correct for fonts).
- Band count fixed at 8 per axis (plenty for Latin; CJK would want
  Lengyel's adaptive banding).
- The texture-comparison panel is deliberately the *best case* for
  textures (full mip chain, 16× anisotropy, identical metrics) and still
  loses on zoom and oblique viewing — that is the point of the demo.
- If adopted into SlicerLive this refactors into a `LiveVectors`-style
  helper (curve/band build in TS, the WGSL `crossings()` + band loops as
  a shared snippet usable inside `card-field.ts`'s front-face decal).

## Can the Slug approach render analytically correct 3D polylines?
(tractography, parallel-coordinates charts, line-heavy plotting)

Short answer: **yes for the rendering math, but Slug itself is a fill
algorithm — lines want the simpler half of it, plus Slug's banding idea
as the acceleration structure. Two regimes matter:**

**1. True 3D lines in space (DMRI tractography).** Strokes with round
caps/joins are exactly a distance field: per fragment,
`coverage = saturate((r − d)/w + ½)` with `d` the distance to the
segment/curve and `w` the derivative-based filter width — the same
screen-space-correct AA as this demo, no winding needed. The right
structure is one instanced, screen-facing quad (or ray-traced capsule)
per segment with per-fragment distance evaluation: millions of instances
are routine on WebGPU, and SlicerLive's `capsule-field.ts` already does
exactly this inside the ray march, with exact per-fragment depth — i.e.
**SlicerLive already has the tractography primitive**; what Slug adds is
the evidence that derivative-driven analytic coverage stays artifact-free
at any zoom/obliquity, which is just as true for capsule SDFs.
For density-style tract rendering, summed fractional coverage *is* the
desired accumulation — analytic AA composes naturally into opacity.

**2. Dense 2D linework on a 3D surface (parallel coordinates, ECharts-
style plots on a card).** Here Slug's *banding* is the win. A parallel-
coordinates chart is thousands of polylines, mostly x-monotone — band
the segments by x exactly as Slug bands curves by y, sort within bands,
and the fragment shader for a chart "decal" loops only the handful of
segments crossing its band, evaluating stroke-distance coverage per
pixel. That gives a **resolution-independent chart**: crisp at any zoom,
correct at glancing angles, no texture re-render on pan/zoom, and
per-pixel *density* (sum of coverages) for free, which is what parallel-
coordinates plots actually want to show when thousands of lines overlap.
Curved strokes (splines, smoothed tract projections) can either be
flattened to short segments (usually enough) or use analytic
distance-to-quadratic (a cubic root solve per fragment — well-known, a
few times the cost of the winding evaluation here).

Caveats, honestly: stroke *joins* at sharp angles need either round
joins (free with distance fields) or miter handling (geometry); very
non-monotone scribbles defeat 1D banding and want 2D tiles (the
Vello/tile-binning regime); and overlapping translucent strokes have the
same conflation-seam caveat as all analytic-coverage renderers — for
density plots that's desirable, for distinct-color overlays it needs
care. None of these block the two target uses.

Suggested follow-on experiment: add a fourth demo mode here — a few
thousand random polylines banded by x, drawn as a chart card in 3D —
to measure fragment cost per band-occupancy before wiring anything into
SlicerLive.
