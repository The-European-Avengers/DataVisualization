import { CHARTS } from './charts/registry'

export interface Stop {
  path: string
  /** Short label for the drawer and the dot tooltip. */
  label: string
  /** The finding, shown under the label in the dot tooltip. */
  title: string
  kind: 'globe' | 'chart' | 'page'
  /** Position in the dot rail, 1-based, blank for the globe and the extras. */
  num?: number
}

/**
 * Every stop in the dashboard, in reading order. The dot rail, the pager and
 * the drawer all read this one list, so adding a view puts it in all three.
 */
export const STOPS: Stop[] = [
  {
    path: '/',
    label: 'Globe',
    title: 'Thirty years of Danish housing, from one block to eleven',
    kind: 'globe',
  },
  {
    path: '/story',
    label: 'The story',
    title: 'Why the line bends: the crash of 2008 and the tax freeze',
    kind: 'page',
  },
  ...CHARTS.map<Stop>((c) => ({
    path: `/chart/${c.slug}`,
    label: c.nav,
    title: c.title,
    kind: 'chart',
    num: c.num,
  })),
  {
    path: '/build',
    label: 'Build a chart',
    title: 'Pick a chart type and two variables, and plot it yourself',
    kind: 'page',
  },
]

export const stopIndex = (pathname: string) => {
  const i = STOPS.findIndex((s) => s.path === pathname)
  return i === -1 ? 0 : i
}

/**
 * The query string to carry when jumping to another view.
 *
 * Every filter travels — property, household, income, province — but the year
 * is dropped, so a view always opens on the default (2024) rather than on
 * whatever year the last one happened to be showing. Opening a chart should
 * show the chart, not a year inherited from somewhere else and then a
 * transition settling into place.
 *
 * The parameter is removed rather than set to "2024" because the controls omit
 * any value equal to its default; an explicit `year=2024` would be the same
 * state written a second way.
 */
export function searchForJump(search: string): string {
  const params = new URLSearchParams(search)
  params.delete('year')
  const next = params.toString()
  return next ? `?${next}` : ''
}
