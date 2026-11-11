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
  Component: ComponentType
}

export const CHARTS: ChartDef[] = [
  {
    num: 1,
    slug: 'choropleth-map',
    nav: 'Choropleth map',
    title: 'Where housing is least affordable',
    subtitle: 'Price-to-income ratio by province',
    question: '1a. What is the trend of house prices in the different provinces?',
    info: 'Colour shows the average sale price divided by the average annual family income in the same province and year. Darker means less affordable. Bornholm is drawn as an inset because it is too small to read in place.',
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
    info: 'Bars are sorted by the price-to-income ratio. Colour marks which side of the Great Belt the province lies on: east is Zealand, Lolland-Falster and Bornholm (zip codes below 5000), west is Funen and Jutland.',
    uses: ['property', 'family', 'basis', 'year'],
    Component: Ranking,
  },
  {
    num: 3,
    slug: 'ratio-over-time',
    nav: 'Line chart',
    title: 'Thirty years of affordability, province by province',
    subtitle: 'Price-to-income ratio, 1995–2024',
    question: '1 & 1a. How have prices and income evolved, and where?',
    info: 'Eleven provinces exceed the eight-colour limit for colourblind-safe categorical palettes, so every line is drawn in grey and the ones you hover or select are highlighted and labelled directly.',
    uses: ['property', 'family', 'basis', 'region'],
    Component: RatioLines,
  },
  {
    num: 4,
    slug: 'small-multiples',
    nav: 'Small multiples',
    title: 'Where prices pulled away from income',
    subtitle: 'Price and income indexed to 1995 = 100',
    question: '1. How have house prices and income evolved since 1995?',
    info: 'Indexing to 1995 = 100 means each line shows growth relative to its own 1995 value, not kroner. A price line at 400 means prices quadrupled. Both series are in current prices; because the index is a ratio to the same province’s own base year, no inflation adjustment is needed to compare the two shapes.',
    uses: ['property', 'family', 'basis'],
    Component: SmallMultiples,
  },
  {
    num: 5,
    slug: 'animated-bubble',
    nav: 'Animated bubble',
    title: 'Income against price, year by year',
    subtitle: 'Log-log, bubble size = sales',
    question: '3. Is it worth living in Copenhagen?',
    info: 'Diagonal reference lines mark constant price-to-income ratios (3x, 5x, 10x). A bubble drifting above a diagonal means affordability worsened. Values can be normalised by the number of families, and the axes can be swapped.',
    uses: ['property', 'family', 'basis', 'year', 'region'],
    Component: Bubble,
  },
  {
    num: 6,
    slug: 'heatmap',
    nav: 'Heatmap',
    title: 'Every province and every year at once',
    subtitle: 'Price-to-income ratio, rows sorted by 2024',
    question: '1 & 1a. How have prices evolved, and where?',
    info: 'The same measure as the map, laid out as province by year so the break in the early 2000s and the 2020s surge are visible in one view.',
    uses: ['property', 'family', 'basis', 'year'],
    Component: Heatmap,
  },
  {
    num: 7,
    slug: 'box-plot',
    nav: 'Box plot',
    title: 'The gap between provinces is widening',
    subtitle: 'Spread of the eleven ratios, per year',
    question: '1. How has the spread between provinces changed?',
    info: 'Each box summarises the eleven provincial ratios in that year. A rising median means the whole country got less affordable; a taller box means provinces drifted further apart.',
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
    info: 'Ratios use the same average sale price for every household type, so they show what the average home would cost relative to each group’s income, not what each group actually pays. Singles more often buy smaller or cheaper homes, or rent, so their figure is hypothetical.',
    uses: ['property', 'basis', 'year'],
    Component: DumbbellFamily,
  },
  {
    num: 9,
    slug: 'house-vs-flat',
    nav: 'Grouped bars',
    title: 'Houses against flats',
    subtitle: 'Price-to-income ratio by property type',
    question: '3. Is it worth living in Copenhagen?',
    info: 'In Byen København most purchases are flats and houses are a thin market (around a thousand sales a year), so the house figure there should be read with caution.',
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
    info: 'Provinces are pooled with a sales-weighted mean, so a province with more transactions counts more. Bornholm is grouped with the east. This chart is also the AI-generated graph required by the course.',
    uses: ['property', 'family', 'basis'],
    Component: EastWest,
  },
]

export const chartBySlug = new Map(CHARTS.map((c) => [c.slug, c]))
