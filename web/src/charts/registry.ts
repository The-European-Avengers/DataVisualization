import type { ComponentType } from 'react'
import type { ControlKey } from '../state/useControls'
import { BoxPlot } from './BoxPlot'
import { Bubble } from './Bubble'
import { Choropleth } from './Choropleth'
import { DumbbellFamily } from './DumbbellFamily'
import { EastWest } from './EastWest'
import { Heatmap } from './Heatmap'
import { HouseVsFlat } from './HouseVsFlat'
import { Ranking } from './Ranking'
import { RatioLines } from './RatioLines'
import { SmallMultiples } from './SmallMultiples'

export interface ChartDef {
  num: number
  slug: string
  /** Nav label — matches the Figma drawer. */
  nav: string
  /** Chart title: states the finding, not the chart type. */
  title: string
  subtitle: string
  /** Research question from report/sections/04-objectives.tex. */
  question: string
  /** The definition and caveats behind the info button. */
  info: string
  /**
   * The global controls this chart actually reads. Anything left out is hidden
   * from the control bar on this page: several charts vary one dimension
   * themselves (house against flat, couples against singles) or draw all thirty
   * years at once, so the matching control would do nothing here.
   */
  uses: ControlKey[]
  /**
   * The selects that offer a "Both" setting here, i.e. where the chart can
   * carry two marks per province instead of one.
   */
  both?: ('property' | 'basis')[]
  Component: ComponentType
}

/** The division behind research question 2, written out once and reused. */
const GREAT_BELT =
  'The Great Belt (Storebælt) is the strait between Zealand and Funen, and the line this project treats as the country’s east/west divide. East is Zealand and its islands — City of Copenhagen, Copenhagen Suburbs, North Zealand, East Zealand, West and South Zealand — plus Bornholm, which lies 150 km further east in the Baltic. West is Funen and the whole Jutland peninsula — Funen, South Jutland, West Jutland, East Jutland, North Jutland. The split follows the national postal grid, where codes under 5000 cover the eastern provinces and 5000 and above the western ones, and it matches the pre-1997 position of the Great Belt as a physical barrier: before the bridge opened, crossing it meant a ferry, which is why the two housing markets were priced separately for most of the period this dashboard covers. Bornholm is counted east because it belongs to the Capital Region administratively, though it is a thin market and its own case.'

const PALETTE_NOTE =
  'Province colours come from an eleven-colour set solved for maximum perceptual distance under normal vision and under simulated protanopia, deuteranopia and tritanopia at once; the cool hues are the six eastern provinces and the warm hues the five western ones, so the Great Belt split is readable from temperature alone. Eleven categories is still more than any palette can make perfectly safe, so colour is never the only cue: marks are labelled directly, the legend names every province, and the table view carries the numbers.'

export const CHARTS: ChartDef[] = [
  {
    num: 1,
    slug: 'choropleth-map',
    nav: 'Choropleth map',
    title: 'Where housing is least affordable',
    subtitle: 'Price-to-income ratio by province',
    question: '1a. What is the trend of house prices in the different provinces?',
    info: 'Colour shows the average sale price divided by the average annual family income in the same province and year. Darker means less affordable. The ramp is a single blue hue, light to dark, because this is magnitude rather than identity — it stays readable under every form of colour blindness. The scale is fixed across all thirty years, so a colour means the same thing wherever the playhead is. Bornholm is drawn as an inset because it is too small to read in place.',
    uses: ['property', 'family', 'basis', 'year', 'region'],
    Component: Choropleth,
  },
  {
    num: 2,
    slug: 'regional-ranking',
    nav: 'Horizontal bars',
    title: 'The provinces ranked by affordability',
    subtitle: 'Price-to-income ratio, selected year',
    question: '2. Is housing more affordable east or west of the Great Belt?',
    info: `Bars are sorted by the price-to-income ratio, and coloured by which side of the Great Belt the province lies on. ${GREAT_BELT} The inset map shows the division itself. Setting Property or Income to "Both" draws two bars per province, so houses can be read against flats, or disposable income against pre-tax, without flipping the select and trying to remember the first view.`,
    uses: ['property', 'family', 'basis', 'year', 'region'],
    both: ['property', 'basis'],
    Component: Ranking,
  },
  {
    num: 3,
    slug: 'ratio-over-time',
    nav: 'Line chart',
    title: 'Thirty years of affordability, province by province',
    subtitle: 'Price-to-income ratio, 1995–2024',
    question: '1 & 1a. How have prices and income evolved, and where?',
    info: `Every province is named at the right-hand end of its own line, at the height it finishes on, so the chart can be read without a legend lookup. Hovering a line brings it forward and greys the rest. Ticking provinces in the Province filter, or clicking their lines, drops every province that is not ticked, so a few can be read on their own. ${PALETTE_NOTE}`,
    uses: ['property', 'family', 'basis', 'region'],
    Component: RatioLines,
  },
  {
    num: 4,
    slug: 'small-multiples',
    nav: 'Small multiples',
    title: 'Where prices pulled away from income',
    subtitle: 'Price and income as a multiple of their 1995 level',
    question: '1. How have house prices and income evolved since 1995?',
    info: 'Each line is that province’s own 1995 value set to 1×, so the axis reads as growth: 4× means prices quadrupled since 1995, whatever they started at. That is why the eleven panels are comparable at all — a province where houses cost 600,000 kr in 1995 and one where they cost 1.2 M kr both start at 1×. Hover anywhere in a panel to read both multiples for that year. Both series are in current prices; because each is a ratio to its own base year, no inflation adjustment is needed to compare the two shapes. The gap between the lines is the affordability squeeze.',
    uses: ['property', 'family', 'basis', 'region'],
    Component: SmallMultiples,
  },
  {
    num: 5,
    slug: 'animated-bubble',
    nav: 'Animated bubble',
    title: 'Income against price, year by year',
    subtitle: 'Log-log, bubble size = sales',
    question: '3. Is it worth living in Copenhagen?',
    info: `Diagonal reference lines mark constant price-to-income ratios (3×, 5×, 10×). A bubble drifting above a diagonal means affordability worsened. Each province keeps its own colour across every chart that shows provinces. Setting Property to "Both" pools houses and flats into one bubble per province — prices and ratios sales-weighted, sales summed — so a province is a single mark rather than two. Bubble size can be normalised by the number of families, since raw sales mostly measure how big a province is. ${PALETTE_NOTE}`,
    uses: ['property', 'family', 'basis', 'year', 'region', 'norm'],
    both: ['property'],
    Component: Bubble,
  },
  {
    num: 6,
    slug: 'heatmap',
    nav: 'Heatmap',
    title: 'Every province and every year at once',
    subtitle: 'Price-to-income ratio, rows sorted by 2024',
    question: '1 & 1a. How have prices evolved, and where?',
    info: 'The same measure as the map, laid out as province by year so the break in the early 2000s and the 2020s surge are visible in one view. One blue ramp carries magnitude; the column of the selected year is outlined, and clicking any cell moves the playhead to that year.',
    uses: ['property', 'family', 'basis', 'year', 'region'],
    Component: Heatmap,
  },
  {
    num: 7,
    slug: 'box-plot',
    nav: 'Box plot',
    title: 'The gap between provinces is widening',
    subtitle: 'Spread of the eleven ratios, per year',
    question: '1. How has the spread between provinces changed?',
    info: 'Each box summarises the eleven provincial ratios in that year: the box spans the middle half, the line across it is the median, and the whiskers reach the cheapest and dearest province. A rising median means the whole country got less affordable; a taller box means provinces drifted further apart. This chart is about the spread *between* provinces, so it has no single-province view — one province is one number, not a distribution.',
    uses: ['property', 'family', 'basis', 'year'],
    Component: BoxPlot,
  },
  {
    num: 8,
    slug: 'couples-vs-singles',
    nav: 'Dumbbell chart',
    title: 'The same home costs a single person far more years of income',
    subtitle: 'Price-to-income ratio, couples against singles',
    question: '1b. How has affordability changed for couples compared to singles?',
    info: 'Ratios use the same average sale price for every household type, so they show what the average home would cost relative to each group’s income, not what each group actually pays. Singles more often buy smaller or cheaper homes, or rent, so their figure is hypothetical. Couples take the blue of slot 1 and singles the magenta of slot 5 — a pair that stays distinct under all three forms of colour blindness.',
    uses: ['property', 'basis', 'year', 'region'],
    Component: DumbbellFamily,
  },
  {
    num: 9,
    slug: 'house-vs-flat',
    nav: 'Grouped bars',
    title: 'Houses against flats',
    subtitle: 'Price-to-income ratio by property type',
    question: '3. Is it worth living in Copenhagen?',
    info: 'In City of Copenhagen most purchases are flats and houses are a thin market (around a thousand sales a year), so the house figure there should be read with caution — every bar resting on fewer than fifteen sales is flagged. House and flat take slots 1 and 2 of the palette, the same blue and orange used for every other two-way comparison in the dashboard.',
    uses: ['family', 'basis', 'year', 'region'],
    Component: HouseVsFlat,
  },
  {
    num: 10,
    slug: 'east-vs-west',
    nav: 'East vs West',
    title: 'East and west of the Great Belt',
    subtitle: 'Sales-weighted price-to-income ratio',
    question: '2. Is housing more affordable east or west of the Great Belt?',
    info: `Provinces are pooled with a sales-weighted mean, so a province with more transactions counts more — a plain average would give Bornholm's few hundred sales the same say as Copenhagen's thousands. ${GREAT_BELT} The inset map shows which provinces fall on each side. This chart is also the AI-generated graph required by the course.`,
    uses: ['property', 'family', 'basis'],
    Component: EastWest,
  },
]

export const chartBySlug = new Map(CHARTS.map((c) => [c.slug, c]))
