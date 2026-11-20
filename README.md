# DataVisualization

## Research Questions
1. How did house prices and income evolve over time?
1.1 What is the trend of house prices in different provinces?
1.2 How did it evolve affordability for couples vs singles? (In whole Denmark or in different provinces)
2. Is it better to live in areas with zip code above 5000 or not? (DK1 vs DK2)
3. Is it worth to live in copenhagen or not? (We suppose that the average income is higher but the house prices are also higher)

## Variables
- **`year`**: The year in which the data was recorded (1995-2024).
- **`landsdel`**: The Danish region or geographical area.
- **`property_type`**: The type of property included in the analysis. (one_family_house, owner_occupied_flat)
- **`family_type`**: The type of household or family being considered. (all_families, couples, singles)
- **`n_sales`**: The number of property sales recorded.
- **`avg_price_dkk`**: The average property price in Danish kroner (DKK).
- **`n_families`**: The number of families represented in the data.
- **`avg_income_dkk`**: The average income in Danish kroner (DKK).
- **`avg_income_before_tax_dkk`**: The average income before taxes in Danish kroner (DKK).



## Charts


| #   | Chart                                                                    | Encoding                                                                                   | Shows                                                                               | Decision                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Choropleth map with year slider                                          | Colour = ratio; toggles for property type, family type and income basis; Bornholm as inset | Spatial pattern, entry point to the dashboard                                       | Yes, make it gradient color                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 2   | Sorted horizontal bars (selected year)                                   | Length = ratio, colour = DK1/DK2                                                           | Clean regional ranking, e.g. 2024: Bornholm 3.5 to Byen København 15.2              | Select year                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 3   | Line chart, ratio per landsdel 1995–2024                                 | Position = ratio, 11 lines with hover highlight and direct labels                          | Per-region trend                                                                    | Yes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 4   | Small multiples (11 panels), price and income both indexed to 1995 = 100 | Two lines per panel                                                                        | Where and when price and income diverged, with no inflation data needed             | Check the meaning of the index                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 5   | Animated bubble scatter (log-log)                                        | x = income, y = price, size = n_sales, colour = region, time = year                        | The divergence as it happens. Straight diagonals mark constant ratios (3x, 5x, 10x) | Think about add the population and compare with the number of sales. We could add the option to normalize the data with population or sales. Try swap the axis                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 6   | Heatmap, region × year                                                   | Colour = ratio, rows sorted by 2024 ratio                                                  | All 330 house cells at once, shows the break in the early 2000s                     | Its good as summary of 1st one                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 7   | Box plot of the 11 regional ratios per year                              | Spread across regions                                                                      | The widening gap between regions (1995: 2.3 to 6.3, 2024: 3.5 to 15.2)              | Yes                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 8   | Dumbbell chart, couples vs singles per landsdel                          | Two dots joined by a line, year selector                                                   | Household effect. In 2024 singles range from 5.3 to 23.9, couples from 2.4 to 8.8   | Specify what its single and couple.  Because the price in the ratio isn’t what singles actually pay.<br><br>The ratio for singles is the average price of all homes sold in the province divided by the average income of singles. The data doesn’t tell us who bought each home, so the price is the same for couples, singles and all families. Only the income changes.<br><br>In reality, singles often buy smaller or cheaper homes (more often flats), and many rent instead of buying. So a ratio of 23.9 doesn’t mean singles in that province actually pay 23.9 times their income. It means: if a single person bought the average home here, it would cost 23.9 times their yearly income. That’s a “what if” number, which is why it’s called hypothetical.<br><br>Strictly speaking, the same goes for couples. Their number is just closer to reality, because couples are a bigger share of the people who buy one-family houses.<br><br>“Hypothetical” might sound stronger than needed. A clearer caption could be: “Ratios use the same average price for all household types, so they show what the average home would cost relative to each group’s income, not what each group actually pays.” Your Data section already says something similar (“regardless of who actually bought the property”), so you can point to that. |
| 9   | Grouped bars or dumbbell, house vs flat                                  | Two values per landsdel                                                                    | Copenhagen: house 15.2 vs flat 9.8                                                  | Better explanation, change to bar chart, with a dropdown to show the regions                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 10  | East vs West over time                                                   |                                                                                            |                                                                                     | Its useful for research question but does not bring anything new                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
### Notes
- Names in english 
- Caption with definition 
- Add extra info of each chart with more explanation in the info button
- Total sales in west are always more than east



### Feedback

Review notes from the professor, and what was done about each.

| # | Note | Status |
|---|------|--------|
| 1 | Dot navigation on the right, globe on top, hover shows the title, click jumps, current highlighted, prev/next arrows that appear on hover | Done — `components/DotNav.tsx`, fed by `nav.ts`; also binds the arrow keys, and carries the query string across every jump so filters survive |
| 2 | Fit the chart to the screen, responsive, no scrolling | Done — chart pages and the builder are one viewport tall (`.page-fit`); `ChartFrame` measures its plot box and every chart sizes rows, panels and marks from it. Short viewports shed chrome; below 760px the page scrolls again |
| 3 | Smoother, better-paced animation | Done — `state/playback.tsx` replaces the 420 ms `setInterval` with a continuous playhead. Charts interpolate between calendar years, so playback and slider drags are one motion. 2.5 years/s, with 0.5×/1×/2× |
| 4 | Colour the bubble chart as in the notebook; review all colours for consistency and colourblind safety; update the info text to match | Done — new 11-province palette (`design/palette.ts`), cool = east, warm = west. **The audit found the existing 8-slot palette failing its own brief** (see below). Info text rewritten |
| 5 | Add the families count to the globe (it is families, not population) | Done — the measure is labelled "Number of families" and the stale "not in the dataset yet" note is replaced |
| 6 | Normalisation toggles where they are needed | Done — a `Normalise` control (raw / per 1,000 families) on the globe's count measures and the bubble chart; the builder exposes "Sales per 1,000 families" as a measure |
| 7 | Smooth globe zoom | Done — the +/− buttons ease the orbit distance over 440 ms instead of jumping; wheel zoom slowed to run through the existing damping |
| 8 | Improve spike resolution | Done — cone geometry 12 → 48 sides with 8 height segments, a tapered tip, and a bloom pass that resizes with the canvas |
| 9 | Chart 2: explain the east/west split, fill the empty corner with a Denmark map, "both" in the property and income dropdowns with two bars per region | Done — full Great Belt explanation in the info panel, faint `DenmarkInset` in the empty corner (sized to what the corner can spare), and "Both" on both selects giving grouped bars |
| 10 | Chart 3: keep every region name on the right, highlight on hover, option for all lines or only the selected one | Done — all eleven labelled at their own end point, de-collided with leader lines (`components/labels.ts`), plus the "Selected only" toggle |
| 11 | Chart 4: hover to read the index per year; multiplier scale instead of index | Done — axis reads 1×, 2×, 3× …; hovering anywhere in a panel gives a crosshair and both multiples for that year |
| 12 | Chart 5: "both" in property pooling into one bubble per region; all bubbles or only the selected one | Done — pooled with sales-weighted prices and summed sales (`poolRows`); province colours and a clickable legend |
| 13 | New page: charts plus an animated explanation of the trend (2008 crisis, 2011 tax) | Done — `/story`, an auto-playing annotated timeline with chapters, scrubber and event markers. **Not a video file**; see the caveat below |
| 14 | New page: build your own chart | Done — `/build`, pick bars/lines/scatter and the measures; the row grain stays province × year so every combination is meaningful |
| 15 | Chart 10: add the map and the east/west explanation | Done — same `DenmarkInset` in the lower-left, full explanation in the hint and info panel |
| 16 | Every province chart: select a province, or show all | Done — `Province` select plus a `Show: selected only / all provinces` toggle, wired through charts 1–6 and 8–9. Chart 7 (box plot) is excluded on purpose: it summarises the spread *between* provinces, and one province is a number, not a distribution |
| 17 | Smooth slider transitions | Done — the same continuous playhead as #3; the slider thumb tracks it and eases onto the nearest year on release |

#### Playback and navigation

Three bugs found in review, all in how the year animation interacted with the
router, all fixed:

- **The animation never auto-starts, and never survives a jump.** Playback stops
  on every route change, so a page always opens with the slider at rest.
- **A running animation no longer blocks navigation.** The loop used to push the
  year into the query string on every step. `setSearchParams` issues a
  *relative* navigation, which resolves against the pathname its closure last
  saw — so a click that changed the page was undone by the next step ~400 ms
  later and the view snapped back. It also forced a full re-render of the app
  several times a second, which is why it showed up as "we cannot switch the
  page" on a slower machine and only intermittently on a fast one. The playhead
  is now the year while it runs; the URL is brought back in step once, on pause.
- **Stopping is synchronous, and never reads a stale flag.** `stop()` flips the
  loop's own flag as well as React state, because the state update queues behind
  whatever is rendering — and a page change is exactly when the main thread is
  busiest. The flag is written in the Play handler itself rather than by an
  effect mirroring `playing`: an effect-synced ref is still stale at the moment
  of a click, so on a slow machine a jump could land in the gap, find the flag
  false, conclude there was nothing to stop, and carry playback into the next
  page. The dot rail, the drawer and the pager all stop it on click, and the
  route-change effect stops it unconditionally as a backstop.

**Charts are finished in their first frame.** Two things used to make a chart
visibly settle after it opened. The body of the chart frame had no `flex: 1`,
so it took its height from its own content — which is the SVG, whose height
comes from measuring the body — and each ResizeObserver pass nudged the chart a
few pixels larger; the map swelled for about half a second on every open. And
the year tween, which exists so that dragging the slider reads as one movement,
also fired on arrival whenever the incoming year differed, so a chart drew
itself at the year it inherited and then eased onto the right one. The body is
now a flex child of a bounded column, so the first measurement is the right one,
and a route change sets the playhead directly instead of animating to it.

**Every view opens stopped, at 2024.** A stop caused by navigation returns the
playhead to the year the URL carries — 2024 unless one was picked deliberately —
rather than keeping whatever frame the animation was on. A view should open on a
year the reader chose, not on the leftover of an animation they walked away
from. Jumping to another view drops the `year` parameter entirely, so
every chart opens on 2024 rather than inheriting a year from the view before it
— the parameter is removed rather than written as `year=2024`, because the
controls omit any value equal to its default. Every other filter — property,
household, income, province — still travels. A year is therefore scoped to the
view it was chosen in; a link copied from that view still carries it and still
opens on it.

**The globe's opening flight plays once per page load.** React unmounts the
globe whenever a chart is opened, so the whole cinematic — hold, 2.6 s camera
flight, staggered spike growth — used to replay in full on every return, about
four seconds of waiting to see a view already seen. Later visits land on the
finished frame.

#### Two things worth flagging

**The existing palette was the problem, not just the bubble chart.** Running the
new `scripts/validate_palette.js` (the validator PLAN.md §2.3 referenced but
which did not exist) against the shipped 8-slot palette showed it failing its
own colourblind-safety brief: the violet sat ΔE 7.4 from the blue under
deuteranopia, the red ΔE 9.7 from the orange under tritanopia, and the yellow
cleared only 2.1:1 contrast on the light paper. Slots 4, 7 and 8 were re-solved,
keeping each slot's hue family, and now hold ΔE ≥ 11.5 in all four views. The
new 11-province palette was solved the same way and holds ΔE ≥ 20.7 — for
comparison, the notebook's hand-picked eleven collapse to ΔE 1.9 under
protanopia, where its brown and red become the same colour. Eleven categories
still cannot be made perfectly safe, so colour never carries identity alone:
every mark is directly labelled, the legends name every province, and the table
view carries the numbers. Re-run the validator before changing any colour.

**The story page is an animated explainer, not a video file.** It plays on a
timeline with chapters, a scrubber and annotations that appear as the playhead
reaches them, which is what a narrated animation would do — but it is live SVG,
not an mp4. If the deliverable has to be a video file, screen-record this page.
More importantly: the chapter text *describes* shapes measured from this
dataset, but the causes it names — the 2008 crash, the 2011 tax change, the rate
cycle — are context that belongs to the report, not something a price series and
an income series can establish on their own. The page says so on screen. Check
and cite those claims in the report before relying on them.

### Map assets

The globe is textured with an 8192 x 4096 day map from
[Solar System Scope](https://www.solarsystemscope.com/textures/), licensed
CC BY 4.0 — the credit is in the drawer footer, next to the data sources. The
4096 x 2048 blue-marble image is kept as well and loads first, so the opening
flight is never flown over an untextured sphere.

Coastlines and national borders come from `data/raw/countries-50m.json`
(world-atlas 2.0.2, built from Natural Earth, public domain), copied to
`web/public/data/` and fetched by the globe after mount. Denmark included: it
is drawn at the same generalisation as its neighbours — 297 points for the
whole country, against the 17,000 in the DAGI boundaries — because two
coastlines of different detail on the same map read as an error in the coarser
one. The DAGI boundaries are used for the prisms, which stand above the water
rather than beside it.
