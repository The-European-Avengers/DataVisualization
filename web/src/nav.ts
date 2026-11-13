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
    title: 'Thirty years of Danish housing, one spike per province',
    kind: 'globe',
  },
  ...CHARTS.map<Stop>((c) => ({
    path: `/chart/${c.slug}`,
    label: c.nav,
    title: c.title,
    kind: 'chart',
    num: c.num,
  })),
  {
    path: '/story',
    label: 'The story',
    title: 'Why the line bends: the crash of 2008 and the tax freeze',
    kind: 'page',
  },
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
