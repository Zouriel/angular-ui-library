/** The y scale of a chart: a zero-based domain on round numbers, and the gridline values in it. */
export interface UiChartScale {
  /** Bottom of the plot: 0, or a round number below the lowest negative value. */
  min: number;
  /** Top of the plot: a round number at or above the highest value (1 when every value is 0). */
  max: number;
  /** Gridline values from `min` to `max`, evenly spaced and always including 0. */
  ticks: number[];
}

const clean = (n: number): number => +n.toPrecision(12) || 0;

/**
 * A y scale that starts from zero, on round steps (1, 2, 2.5 or 5 times a power of ten): the
 * smallest such step that needs at most four intervals (three or four gridlines above the baseline),
 * or five when the data has values on both sides of zero. Values that are not finite count as 0.
 * With no data, or all zeros, the scale is 0 to 1 with a single tick at 0.
 */
export function uiChartScale(values: readonly number[]): UiChartScale {
  let lo = 0;
  let hi = 0;
  for (const v of values) {
    if (!Number.isFinite(v)) continue;
    if (v < lo) lo = v;
    if (v > hi) hi = v;
  }
  if (lo === 0 && hi === 0) return { min: 0, max: 1, ticks: [0] };
  const most = lo < 0 && hi > 0 ? 5 : 4;
  const below = (step: number) => Math.ceil(-lo / step - 1e-9);
  const above = (step: number) => Math.ceil(hi / step - 1e-9);
  let step = 0;
  search: for (let exp = Math.floor(Math.log10(hi - lo)) - 2; ; exp++) {
    for (const m of [1, 2, 2.5, 5]) {
      step = clean(m * Math.pow(10, exp));
      if (below(step) + above(step) <= most) break search;
    }
  }
  const min = clean(-below(step) * step);
  const max = clean(above(step) * step);
  const ticks: number[] = [];
  for (let i = -below(step); i <= above(step); i++) ticks.push(clean(i * step));
  return { min, max, ticks };
}

/** How one x label is shown: which category it names and whether it is pulled in from an edge. */
export interface UiChartLabel {
  index: number;
  /** `start` / `end`: the label would stick out of the plot if centred, so it lines up with that edge of its band. */
  align: 'start' | 'center' | 'end';
}

/**
 * Which x labels to show so that none overlap: every label when they fit, otherwise every nth,
 * counted back from the last category (the latest is always labelled). `widths` are the labels'
 * widths in px, `band` the width of one category and `gap` the least space between two labels.
 * A band of 0 (not measured yet) shows every label.
 */
export function uiChartLabels(widths: readonly number[], band: number, gap = 8): UiChartLabel[] {
  const n = widths.length;
  if (!n) return [];
  if (!(band > 0)) return widths.map((_, index) => ({ index, align: 'center' as const }));
  const widest = Math.max(...widths);
  // The last label lines up with the plot's end when it is wider than its band; leave room for that shift.
  const step = Math.max(1, Math.ceil((widest + gap + Math.max(0, (widest - band) / 2)) / band));
  const total = band * n;
  const out: (UiChartLabel & { left: number; right: number })[] = [];
  for (let index = n - 1; index >= 0; index -= step) {
    const w = widths[index];
    const centre = (index + 0.5) * band;
    let align: UiChartLabel['align'] = 'center';
    let left = centre - w / 2;
    if (left < 0) {
      align = 'start';
      left = index * band;
    } else if (left + w > total) {
      align = 'end';
      left = (index + 1) * band - w;
    }
    const next = out[out.length - 1];
    // A label pulled in from the edge can reach its neighbour: leave it out, the neighbour stays.
    if (next && left + w + gap > next.left) continue;
    if (left < 0) continue;
    out.push({ index, align, left, right: left + w });
  }
  return out.reverse().map(({ index, align }) => ({ index, align }));
}
