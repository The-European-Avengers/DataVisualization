# PLAN — Housing Affordability Dashboard (SDU Data Visualization, E26, Group 03)

Build plan for the interactive dashboard that accompanies the report in `report/`.
Scope, data and research questions are fixed by `README.md` and
`report/sections/04-objectives.tex`; this document covers **how the website gets built**.

---

## 1. What we are building

A single-page React application with two kinds of surface:

1. **A landing view** — a 3D globe that flies to Denmark and shows one chosen
   measure as **vertical spikes**, one per *landsdel*, height = value. The measure is
   switchable (population, number of sales, price-to-income ratio, average income) and
   the year is scrubbable. This is the entry point and the visual signature of the project.
2. **Ten chart pages** — one per chart in the `README.md` table, reached from the left
   drawer already sketched in Figma (page 2, node `65:2`).

The report PDF is downloadable from the dashboard (must-have feature 6).

### Decisions taken (2026-11-09)

| Area | Decision |
|---|---|
| Framework | React 19 + TypeScript + Vite |
| Charts | D3 for scales/shapes/projections, **React renders the SVG** (no chart library) |
| Globe | `react-globe.gl` (three.js), Blue Marble texture, self-hosted |
| Typography | **IBM Plex Sans** (UI, labels) + **IBM Plex Mono** (all numerals) |
| Shell | Light "paper" UI (`#fcfcfb` surface, near-black ink) + **dark immersive hero** |
| Series colours | Unchanged — the validated CVD-safe palette already used in the notebook |
| Hosting | GitHub Pages via Actions, base `/DataVisualization/` |

---

## 2. Design direction

### 2.1 What changes from the Figma

The Figma mock (page 2) is the right *structure* — full-bleed map, left drawer with the
ten chart names. Three things change:

- **Font.** The mock uses a default UI sans. Replace with IBM Plex Sans; every number
  (ratios, DKK, years, counts) renders in IBM Plex Mono so digits align in columns and
  tooltips do not jitter while the year animates.
- **The drawer.** A fully saturated blue panel sitting on a satellite photograph is the
  part that reads as "off". Replace with a near-opaque dark surface
  (`#1a1a19` at ~92% + backdrop blur) in the hero, and a plain light surface on the
  chart pages. Colour is reserved for data, never for chrome.
- **Two gaps in the mock.** The title still reads `Group 11` (placeholder), and the
  open-drawer frame has no close control. Both get fixed: real title, and the hamburger
  becomes a toggle present in both states.

### 2.2 Tokens

Defined once in `web/src/design/tokens.css`, referenced by role everywhere — never raw hex
in a component.

```
--surface-1      #fcfcfb   light pages          --surface-dark   #1a1a19   hero, drawer
--text-primary   #0b0b0b                        --text-inverse   #f0efec
--text-secondary #52514e                        --text-muted-dk  #c3c2b7
--grid           #e6e5e1   recessive axes/grid
--accent         #2a78d6   links, active nav, focus ring
```

### 2.3 Data palette (keep as-is — it is already validated)

Categorical slots, in fixed order, never cycled:

`#2a78d6` blue · `#eb6834` orange · `#1baf7a` aqua · `#eda100` yellow ·
`#e87ba4` magenta · `#008300` green · `#6250d6` violet · `#e34948` red

Sequential (choropleth, heatmap): single blue ramp, light → dark,
`#cde2fb → #0d366b`. The globe's prisms use its twin in red, `#fcdbd4 → #5c1a10`,
read from the dark end — same single-hue construction, turned round for the one
dark ground in the dashboard.

Binary comparisons use slots 1 and 2 (east/west, house/flat, couples/singles).

**Hard rule, already flagged in the notebook: 11 provinces is more than the 8-slot
colourblind-safe limit.** No chart gets an 11-colour legend. Instead:

- **Line chart (3) and bubble (5):** all series drawn in `--grid` grey; the hovered or
  selected province is painted in slot 1 and directly labelled. Max 3 simultaneously
  emphasised (the all-pairs cap).
- **Small multiples (4):** 11 panels, 2 colours inside each panel (price vs income).
- **Choropleth (1), heatmap (6), spikes:** sequential ramp — magnitude, not identity.

**The hero's one departure is the hue, not the construction.** The globe's prisms run
a single-hue ramp like every other magnitude encoding here, but in red and read from its
dark end: the ground under them is a blue-green satellite image, and red is the hue
furthest from it, so a prism reads as a mark on the map rather than as terrain. The ramp
is sampled at each province's *global* value, so a low province stays deep maroon and
only the highest reach the pale top, and the hero carries its own labelled legend.

Before shipping any palette change, run the validator:
`node scripts/validate_palette.js "<hex,...>" --mode light` (and `--mode dark`).

### 2.4 Chart conventions

Applied uniformly, enforced by a shared `<ChartFrame>`:

- Title states the finding, not the chart type. Subtitle carries the definition.
- Units in every axis title (`Price-to-income ratio`, `DKK`, `Sales`).
- Thin marks, 2px lines, ≥8px markers, 4px rounded bar ends, recessive grid.
- Direct labels on the few series that matter; never a number on every point.
- Hover layer on every chart: crosshair + tooltip on lines/areas, per-mark tooltip on
  bars/dots/cells. Tooltip always shows `n_sales` and a `⚠ low sample` note under 15 sales.
- An **info button** per chart (README note) opening the caption and caveats — in
  particular the singles-ratio caveat from `README.md` row 8, verbatim.
- A **table view** toggle per chart (accessibility, and it covers the three palette slots
  that sit under 3:1 contrast on light).
- One y-axis. Never two scales. Price vs income are compared **indexed to 1995 = 100**.

---

## 3. Data

### 3.1 What we already have

| File | Shape | Use |
|---|---|---|
| `data/processed/affordability_annual.csv` | 1,980 rows × 12 cols | every chart |
| `data/processed/prices_quarterly.csv` | 2,640 rows | optional quarterly detail |
| `data/processed/landsdele.topo.json` | 11 provinces, 178 KB | choropleth + globe spikes |

Columns: `year, nuts3, landsdel, property_type, family_type, n_sales, avg_price_dkk,
n_families, avg_disposable_income_dkk, avg_pretax_income_dkk, ratio_disposable, ratio_pretax`.

The panel is complete — 30 years × 11 provinces × 2 property types × 3 family types, no NAs.

### 3.2 Population — the one thing missing

The globe needs population, and `README.md` row 5 asks for sales normalised by population.

- **Already available as a stand-in:** `n_families` is in the panel for every
  province-year, 1995–2024. It is a legitimate denominator (sales per 1,000 families)
  and needs zero new work. **Ship with this first.**
- **Real population:** Statistics Denmark, subject 02 (Population). `FOLK1A` is the usual
  table but only starts at 2008Q1, so 1995–2007 needs a longer series. Before pulling,
  resolve the right table with the StatBank API:
  `GET https://api.statbank.dk/v1/tables?subjects=02&format=JSON` then
  `GET https://api.statbank.dk/v1/tableinfo/<TABLE>?format=JSON` to confirm the `OMRÅDE`
  classification contains *landsdele* for the full 1995–2024 range.
- **Caveat to check and to write up:** if only municipality-level data goes back to 1995,
  aggregating to landsdele across the **2007 municipal reform** is not a clean mapping.
  If that turns out to be the case, state it in the Data section and keep `n_families`
  as the primary denominator rather than fabricating a join.

Treat population as an **enhancement, not a blocker** — the globe works on day one with
sales, ratio and income, all of which exist.

### 3.3 Build step

`scripts/build_web_data.py` (runs in the existing `notebooks/requirements.txt` env) emits
to `web/public/data/`:

| Output | Contents |
|---|---|
| `panel.json` | the annual panel in **columnar** form (arrays per column + a dictionary for `landsdel`) — small enough to ship whole, no API needed |
| `landsdele.topo.json` | copied unchanged |
| `centroids.json` | `d3.geoCentroid` per province, for spike placement |
| `meta.json` | years, provinces (en + da names), metric definitions, min/max per metric |
| `population.json` | once §3.2 is resolved |

Rules: the script is **idempotent and committed**; generated files under
`web/public/data/` are committed too, so the site builds without Python in CI.
English names everywhere in the UI (`README.md` note), Danish name kept in the tooltip.

---

## 4. Architecture

```
web/
  index.html
  vite.config.ts                  base: '/DataVisualization/'
  public/
    data/                         generated, committed
    textures/earth-blue-marble.jpg
    report/main.pdf               copied by build, for the manual download
  src/
    design/  tokens.css  palette.ts  typography.css
    data/    load.ts  selectors.ts  types.ts  format.ts
    state/   useControls.ts        year, propertyType, familyType, incomeBasis, metric
    components/  AppShell  Drawer  ChartFrame  Legend  Tooltip  YearSlider
                 ControlBar  InfoButton  TableView  DownloadReport
    globe/   GlobeHero.tsx  spikes.ts  cameraFlight.ts
    charts/  Choropleth  Ranking  RatioLines  SmallMultiples  Bubble
             Heatmap  BoxPlot  DumbbellFamily  HouseVsFlat  EastWest
    pages/   Home  ChartPage
scripts/build_web_data.py
.github/workflows/deploy.yml
```

**State.** One `useControls` store holds the four global filters — year, property type,
family type, income basis — exactly the notebook's parameters cell. They persist across
pages and live in the URL query string, so any view is linkable (useful for the report
figures and the demo video).

**Data loading.** `panel.json` fetched once, memoised, indexed by
`(year, landsdel, property_type, family_type)`. All selectors are pure functions, unit-tested.

**Charts.** Each chart is a pure function of `(rows, controls, dimensions)` returning SVG.
D3 supplies `scaleLinear`, `scaleBand`, `geoMercator`, `line`, `area`, `extent`; React
renders every element. No `d3.select` on the DOM — this keeps React in control and makes
transitions declarative.

**Responsiveness.** `ResizeObserver` → chart dimensions. One breakpoint: drawer is
permanent ≥1024px, overlay below.

---

## 5. The globe (landing view)

- `react-globe.gl`, textures **self-hosted** in `public/textures/` (no CDN dependency, no
  API key, no tile bill): the 4K Blue Marble paints first, then an 8K day map replaces it,
  both with anisotropic filtering because the landing camera looks across the surface
  rather than down at it. Coastlines and borders are drawn as vector paths over the top —
  Natural Earth for the world's coasts and national borders, the DAGI landsdele for the
  Danish coastline — since no texture stays
  sharp at the zoom this camera sits at.
- **Spikes** are a custom three.js layer (`customLayerData` + `customThreeObject`), not the
  built-in `pointsData` layer, which can only draw flat-coloured cylinders. Each one is the
  province itself, extruded: the landsdel's own rings flattened onto the plane tangent at
  its centroid, triangulated for the roof, walled edge by edge, and built standing from
  y = 0 to y = 1 so a single `scale.y` grows it every frame. A `ShaderMaterial` runs the
  ramp along the height and knocks the walls back behind the roof, with an
  `UnrealBloomPass` on the globe's composer. Alpha blending, not additive: eleven volumes
  this wide stack additively straight to white, which is the one thing a single-hue ramp
  cannot survive. Front faces only — winding is derived per polygon from the outer ring's
  signed area, since nothing guarantees how the shapes shipped — which is worth a third of
  the frame rate on walls this large. Orientation note: a cone can be aimed with
  `Object3D.lookAt`, but a province has a front, so the mesh takes an explicit east-up-south
  basis. Each prism carries a `LineSegments2` around its roof — faint at rest, thickened and
  brightened by `onCustomLayerHover` — because translucent walls meeting at every height
  leave the top edge to be guessed at otherwise; it is sized in pixels, so every outline
  shares one resolution vector that the resize effect writes once. The ground layer was
  dimmed to make room for it, and the lines between the landsdele dropped from it
  altogether: the prisms already divide the country, and a second set of division lines a
  few pixels below the first only blurs them. `customLayerLabel` gives the tooltip with province, value
  and `n_sales`.
- **Normalisation:** each metric scaled against its **global max across all years**, not the
  current year's max — otherwise every year looks identical while the slider moves.
- **Metric switch:** Population (or sales per 1,000 families until §3.2 lands), Number of
  sales, Price-to-income ratio, Average income. Smooth altitude transition on change.
- **Camera:** wide establishing shot, then a ~2.6s flight down to a low oblique view
  from the south, so the spikes are seen *across* rather than down. Respects
  `prefers-reduced-motion` (jump straight to the final view).
  **How, and why it is not obvious:** globe.gl installs a `change` listener on the orbit
  controls that forces `controls.target.setScalar(0)` on every frame, pinning the camera
  to look at the planet's core. With that in place the only control is `pointOfView`, and
  a close-up oblique view of one country is geometrically impossible — the country leaves
  the frame before the angle gets interesting. `freeTheCamera()` in `GlobeHero.tsx` drops
  that listener (and shadows `setScalar` on the target vector as a fallback), after which
  the target can sit on Denmark: the camera orbits and zooms around the country rather
  than the globe. The listener also overrode rotate/zoom speed every frame, so removing it
  is what makes the controls feel responsive.
- **Spike animation:** every spike eases towards its target height in one shared rAF loop.
  At the end of the flight they grow out of the ground, shortest first, ~90ms apart. The
  same loop carries later changes of year or measure, so those transition rather than jump.
- **Year scrubber** shared with the chart pages.
- Click a spike → open that province's detail (filters the chart pages to it).
- **Fallback:** if WebGL is unavailable, render the D3 choropleth in its place.

---

## 6. The ten pages

Sources: `README.md` chart table (including the *Decision* column) and
`notebooks/chart_prototypes.ipynb`. The decisions in the README are applied here.

| # | Page | Form | Applied decisions |
|---|---|---|---|
All ten are implemented. The *Applied decisions* column records what changed from the
notebook prototypes.

| 1 | Choropleth map | Mercator, sequential ramp, year slider | gradient colour; **Bornholm as an inset**, which the notebook never had |
| 2 | Regional ranking | Sorted horizontal bars | year selector; colour = east/west (2 slots) |
| 3 | Ratio over time | 11 lines, grey + hover emphasis | no 11-colour legend; direct labels on emphasised |
| 4 | Small multiples | 11 panels, price vs income, 1995 = 100 | **explain the index in the caption** (README asks) |
| 5 | Animated bubble | log–log scatter, time = year | add population normalisation; **axis-swap toggle**; play/pause + year scrub |
| 6 | Heatmap | province × year, rows sorted by 2024 | framed as the summary of page 1 |
| 7 | Box plot | spread of the 11 ratios per year | as prototyped |
| 8 | Couples vs singles | Dumbbell, year selector | **the hypothetical-ratio caveat is shown inline**, not only in the info panel |
| 9 | House vs flat | **Grouped bars + region dropdown** | changed from dumbbell per README decision |
| 10 | East vs West | Weighted lines, 2 slots | this is the **AI-generated graph** slot — document platform, prompt, output |

### Must-have features → where

| # | Requirement | Where |
|---|---|---|
| 1 | ≥3 chart types | map, bars, lines, small multiples, scatter, heatmap, box, dumbbell |
| 2 | ≥1 animated graph | page 5 (bubble over time) + the globe |
| 3 | AI-generated graph, documented | page 10 |
| 4 | ≥9 graphs | 10 pages + globe |
| 5 | Dashboard link in report | `\dashboardurl` in `report/main.tex` |
| 6 | Report downloadable as manual | `DownloadReport` button in the drawer footer → `public/report/main.pdf` |
| 7 | Custom visualization | **the spike globe** — province-level 3D spikes on a textured earth with a year axis is not a standard R/Python function. Backup candidate if a reviewer calls three.js "a library": a hand-built price–income *scissors* chart (indexed price and income lines with the divergence filled and annotated per province). Decide in week 3 and write up in §4.7 of the report |

---

## 7. Work plan

Four members (`report/sections/01-team.tex`). Phases, not dates — fill the deadlines in
once the course schedule is pinned, then mirror this table into
`report/sections/08-conclusion.tex`.

| Phase | Work | Suggested owner |
|---|---|---|
| 0 | Scaffold Vite + TS + routing, tokens, fonts, `AppShell`, `Drawer`, deploy pipeline green with a placeholder page | 1 |
| 0 | `scripts/build_web_data.py`, `panel.json`, loaders, selectors + their tests | 2 |
| 1 | `ChartFrame`, `Legend`, `Tooltip`, `YearSlider`, `ControlBar`, `InfoButton`, `TableView` | 1 |
| 1 | Resolve population (§3.2); pull or document the gap | 2 |
| 2 | Globe hero: spikes, metric switch, camera flight, fallback | 3 |
| 2 | Pages 1, 2, 6 (map, ranking, heatmap — all sequential/2-colour) | 4 |
| 3 | Pages 3, 4, 7 (lines + emphasis, small multiples, box plot) | 1 |
| 3 | Pages 5, 8, 9 (bubble + animation, dumbbell, grouped bars) | 2 |
| 4 | Page 10 + the AI-generated graph, documented | 3 |
| 4 | Captions, info panels, table views, English labels, caveats | 4 |
| 5 | Accessibility pass (palette validator both modes, keyboard nav, focus ring, reduced motion), responsive pass, Lighthouse | all |
| 5 | Export final PNGs → `report/figures/`, fill `06-visualization.tex` and `07-story.tex`, 2-min demo video, `DV_E26_group03.zip` | all |

---

## 8. Definition of done

- [ ] `npm run build` clean, no TypeScript errors, deployed URL live
- [ ] Dashboard URL written into `report/main.tex` (`\dashboardurl`)
- [ ] All ten pages render from `panel.json` with the four global filters applied
- [ ] Globe: four metrics, 30 years, flight, tooltip, WebGL fallback
- [ ] No chart uses more than 8 categorical colours; no dual-axis chart anywhere
- [ ] `validate_palette.js` passes for light and for dark
- [ ] Every chart: title, units, legend-or-direct-labels, hover, info button, table view
- [ ] `⚠ low sample` shown wherever `n_sales < 15`
- [ ] Singles-ratio caveat visible on page 8 without opening the info panel
- [ ] Report PDF downloadable from the drawer
- [ ] Keyboard navigable; `prefers-reduced-motion` respected
- [ ] Works at 1280×800 (demo video) and on a phone

---

## 9. Open questions

1. **Population table** — which StatBank table covers landsdele back to 1995 (§3.2), and
   does the 2007 municipal reform break the aggregation?
2. **Custom-visualization claim** — globe, or the hand-built scissors chart? (§6)
3. **Great Belt split** — the notebook sets `BORNHOLM_SIDE = "east"`. Confirm and state it
   in the UI, since it moves the east line.
4. **Quarterly data** — `prices_quarterly.csv` is currently unused by any chart. Drop it
   from the dashboard, or add a quarterly zoom on page 3?
5. **Deadlines** — phase table above has no dates yet.




## 10. Improvement ideas

| Idea | Status |
|---|---|
| Home page link in the side bar, or a button on the other pages | **Done** — "Globe" at the top of the drawer, the title in the top bar links home, and the pager on chart 1 goes back to the globe |
| Improve the spikes | **Done** — tapered cones with a gradient along their height and bloom, after the Kontur density maps (§5) |
| Control buttons on the map (zoom, reset) | **Done** — zoom in/out and "back to Denmark" at the right of the hero |
| Mobility of the earth is not very good | **Done** — damping on, slower rotate and zoom, panning off, and the camera clamped between 0.12 and 4 globe radii so it can no longer be flung inside the earth or lost in space |
| Improve the style of the dashboard pages | **Done (first pass)** — chart number and the research question as a page header, sticky filter bar, card shadow, pill pager. Worth revisiting once three or four real charts exist and the rhythm between them is visible |

Still open from this list: nothing blocking. The next visual pass should wait until charts 1,
3 and 6 are real, so the page style is judged against actual charts rather than placeholders. 



## 11. Status

Built and verified in the browser:

- All ten chart pages, from the notebook prototypes, with the README's decisions applied.
- Shared chart chrome: info panel, table view, tooltips with `n_sales` and the low-sample
  warning, legend or direct labels on every chart, one y-axis everywhere.
- The globe: oblique close-up camera, gradient spikes with a growth animation, five
  measures, year scrubber, zoom and reset controls, WebGL fallback.
- Transparent top bar over the hero.

Not done yet:

- Population (§3.2) — `n_families` still stands in as the denominator.
- The report sections that depend on the dashboard: `06-visualization.tex` figures,
  `07-story.tex`, the AI-generated graph write-up, the custom-visualization justification.
- Final PNG exports to `report/figures/`, the demo video, and the submission zip.
