# Multi — a truly 3D parallel-coordinates chart (WebGPU)

Single-file demo: [`index.html`](index.html)
(hosted: https://pieper.github.io/sites/multi/ — local only for now).

## The idea

In a parallel-coordinates chart, every vertical axis is secretly a
histogram of that coordinate. Here that is made literal: each polyline is
given, at every axis, a **depth (z) offset equal to its rank within that
axis's value bin** (64 bins, ranks centered). Face-on you see a classic
2D parallel-coordinates chart; raise the **unfold** slider and orbit, and
every axis fans out into a real 3D histogram — cluster strata visible as
colored layers in each wedge. Between axes, z follows a double-smoothstep
plateau (sub-segmented 4×), so each axis reads as a coherent histogram
slab with a quick crossover mid-span, while x/y stay linear (the face-on
2D chart is unchanged by the easing).

## Rendering

- Every segment is an instanced screen-facing ribbon; coverage is an
  analytic capsule SDF in pixel space (`clamp(halfW + 0.5 − d)`), so
  lines are crisp at any zoom/angle with round caps and joins for free.
  No geometry AA, no MSAA, no textures.
- **Rendered (not lookup) surface detail**: fake-tube shading from the
  lateral SDF coordinate; procedural stripe pattern (spatial frequency
  encodes a chosen column); animated flow pattern (phase speed encodes a
  chosen column); polynomial viridis colormap evaluated in-shader.
- Color: 3 phenotype clusters (Tol-ish palette) or any column via
  viridis.
- Blend modes: **opaque** (depth-tested, best for histogram inspection)
  and **density** (additive into rgba16float + Reinhard tonemap in the
  blit — line density becomes brightness; best at ≥200k lines).
- Axis names and min/max values are **3D Slug text** (same analytic glyph
  machinery as ../slug.html), billboarded at the axis tops/bottoms.

## Mobile (iPhone/iPad)

Works on phones with WebGPU Safari (shipping since iOS/Safari 26; a
~5-year-old iPhone on current iOS qualifies). Mobile affordances:

- controls collapse behind a ☰ button (safe-area aware, `viewport-fit=cover`);
- one-finger drag orbits, **pinch zooms, two-finger drag pans**
  (Safari's page-level gesture zoom is suppressed);
- no hover on touch: **tap a line** to select it and show the thumbnail
  preview — the tooltip's "Open in IDC viewer ↗" link is the tappable
  action; tap empty space to dismiss;
- axis-rod brush and axis-name reorder hit targets widen for touch;
- default synthetic line count drops to 10k on coarse-pointer devices
  (the lines select still goes to 2M); devicePixelRatio capped at 2;
- the reset camera fits the full chart width in portrait aspect.

## Interaction

- drag an axis **rod**: brush a value range (selection = AND across
  brushed axes; unbrushed lines dim; click a rod to clear its brush)
- drag an axis **name**: reorder axes (others ease aside, lines morph)
- drag background: orbit · wheel: zoom · shift-drag: pan · dbl-click:
  reset · **unfold** slider/button: morph 2D chart ↔ 3D histograms
- lines: 1k → 2M (instances = N × 6 spans × 1–4 subsegments; selection
  recompute is a JS pass over N, throttled to one per frame)

## Data

Two datasets (HUD select, or `?data=lnq`):

- **synthetic** (default): seeded, 7 clinical-ish columns (Age, BMI,
  SysBP, Glucose, HbA1c, eGFR, CRP), three correlated phenotype clusters,
  lognormal CRP — so the per-axis histograms have modes, skew, and
  visible cluster strata. Scales 1k–2M lines.
- **LNQ2023** (TCIA / IDC mediastinal lymph node collection): 513 cases ×
  7 axes (case, Sex, Condition, Spacing, Extent, Annotation, NodeVolCM;
  categorical axes mapped to ordinal positions — on unfold they become
  per-category depth stacks). Colored by PrimaryCondition (41 conditions,
  12-color cycling palette). **Hovering a line shows the case's Slicer
  screenshot thumbnail (hotlinked from the LNQ site) with volume and
  annotation status; clicking opens the study in the IDC viewer in a new
  tab** (`viewer.imaging.datacommons.cancer.gov/viewer/<StudyUID>`).
  Data vendored in `lnq-data.json` **in this directory, so it is served
  with the hosted page** (pieper.github.io/sites/multi/lnq-data.json —
  fetched by relative path, works locally and hosted). Vendoring is
  necessary because the GCS bucket sends no CORS headers (thumbnails
  hotlink fine as `<img>`); regenerate with the extraction snippet
  below. Source + attribution:
  https://storage.googleapis.com/sdp-lnq-site/site/index.html
  (TCIA collection page and MELBA special issue linked in the HUD).

```sh
# re-extract lnq-data.json from the live site
curl -s https://storage.googleapis.com/sdp-lnq-site/site/index.html -o /tmp/lnq.html
python3 -c "
import json, re
s = open('/tmp/lnq.html').read()
d = json.loads(re.search(r'\"data\":\s*(\[\[.*?\]\])\s*}', s, re.S).group(1))
json.dump([{'case': r[0], 'study': r[1], 'series': r[2], 'sex': r[3],
  'condition': r[4], 'spacing': r[5], 'extent': r[6], 'annotation': r[7],
  'volume': r[8]} for r in d], open('lnq-data.json', 'w'))"
```

Hover picking is a CPU pass over projected polylines (enabled for
datasets with per-record metadata; trivial at 513 lines), with the
hovered line widened/brightened in-shader via a uniform.
`?hover=<index>` forces a hover for headless tooltip testing.

## Testing

```sh
cd ~/sites && python3 -m http.server 8741
open http://localhost:8741/multi/
```

Headless self-test (`?test=1` drives frames via setTimeout — rAF never
fires under headless virtual time; mapAsync needs the extra frames):

```sh
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --enable-unsafe-webgpu --virtual-time-budget=15000 \
  --screenshot=/tmp/multi.png --window-size=1400,900 \
  "http://localhost:8741/multi/?test=1"
# result is drawn into #testout (bottom-left of the screenshot):
# MULTI_TEST_OK lit=284900 lines=50000 segs=1200000 labels=83 sign=1
```

URL params: `data=lnq`, `n`, `depth` (0–1), `az`, `el`, `dist`,
`blend=density`, `pat=0|1|2`, `w` (px width), `hover=<line index>`.

## Known limits / next steps

- Opaque mode draws unsorted alpha-blended edges with depth write; AA
  fringes can clip against each other at dense crossings (density mode
  avoids this entirely). A two-pass core/fringe split would fix it.
- Brushing at 2M lines costs a ~2M-element JS loop per update (throttled);
  a compute-shader selection pass is the scalable version.
- No per-line hover/pick yet (would be an ID buffer pass).
- Lines are px-width billboards; a world-width "tube" option would give
  stronger depth cues for VR.
- Candidate SlicerLive integration: this renderer is the 2D-chart "decal"
  / tractography-adjacent primitive discussed in `../slug/README.md` —
  banding by x was not even needed at these counts; geometry instancing
  carried 12M segments.

Font: DejaVu Sans subset (Bitstream Vera license, `LICENSE_DEJAVU`).
Slug algorithm: Lengyel, JCGT 2017; patent public domain 2026-03-17.
Code: Apache-2.0.
