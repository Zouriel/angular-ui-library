import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject,
  input, output, signal, untracked, viewChild,
} from '@angular/core';
import { injectUiStrings } from '@zouriel/ui';
import { type UiChartLabel, uiChartAutoScale, uiChartLabels, uiChartScale } from './chart-scale';

/** One series of `ui-line-chart`: a name, a value per category (`null` for a gap), and optionally its own colour. */
export interface UiChartSeries {
  name: string;
  /** One value per category, in the order of `categories`. `null` creates a gap in the line. */
  values: (number | null)[];
  /** Any CSS colour. Default: the theme's chart colour for this position (`--ui-chart-1` to `-4`). */
  color?: string;
}

/** Alias for {@link UiChartSeries}. */
export type UiLineChartSeries = UiChartSeries;

export interface UiLinePoint {
  x: number;
  y: number;
}

interface PlotPoint {
  index: number;
  key: number;
  value: number;
  text: string;
  color: string;
  yPct: number;
}

interface Band {
  index: number;
  label: string;
  points: PlotPoint[];
  summary: string;
}

interface SegmentPath {
  key: number;
  color: string;
  line: string;
  area: string | null;
}

/** The most series one line chart draws; more than this are not drawn (they stay in the table). */
export const UI_LINE_CHART_MAX_SERIES = 4;

/**
 * Builds a Fritsch-Carlson monotone cubic Hermite SVG path through `points` (with strictly
 * increasing `x`) so smooth curves never overshoot local extrema.
 */
export function uiMonotoneLinePath(points: readonly UiLinePoint[]): string {
  const n = points.length;
  if (n === 0) return '';
  if (n === 1) return `M ${points[0].x} ${points[0].y}`;
  if (n === 2) return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;

  const dx: number[] = [];
  const slopes: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const h = points[i + 1].x - points[i].x;
    dx.push(h);
    slopes.push(h === 0 ? 0 : (points[i + 1].y - points[i].y) / h);
  }

  const m: number[] = new Array(n).fill(0);
  m[0] = slopes[0];
  m[n - 1] = slopes[n - 2];
  for (let i = 1; i < n - 1; i++) {
    if (slopes[i - 1] * slopes[i] <= 0) {
      m[i] = 0;
    } else {
      m[i] = (slopes[i - 1] + slopes[i]) / 2;
    }
  }

  for (let i = 0; i < n - 1; i++) {
    if (slopes[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const alpha = m[i] / slopes[i];
      const beta = m[i + 1] / slopes[i];
      const sq = alpha * alpha + beta * beta;
      if (sq > 9) {
        const tau = 3 / Math.sqrt(sq);
        m[i] = tau * alpha * slopes[i];
        m[i + 1] = tau * beta * slopes[i];
      }
    }
  }

  let d = `M ${points[0].x.toFixed(2)} ${points[0].y.toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    const cp1x = points[i].x + h;
    const cp1y = points[i].y + m[i] * h;
    const cp2x = points[i + 1].x - h;
    const cp2y = points[i + 1].y - m[i + 1] * h;
    d += ` C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${points[i + 1].x.toFixed(2)} ${points[i + 1].y.toFixed(2)}`;
  }
  return d;
}

function linearLinePath(points: readonly UiLinePoint[]): string {
  if (points.length === 0) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
}

let nextId = 0;

/**
 * `ui-line-chart`: one to four line series over categories, with distinct marker shapes, null gaps,
 * optional area fill (single series), monotone smooth curves, zero or auto baseline, tooltip,
 * keyboard navigation, sideways scroll, RTL x-axis mirroring, and a screen-reader table.
 */
@Component({
  selector: 'ui-line-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (drawn().length > 1) {
      <ul class="legend" aria-hidden="true">
        @for (s of drawn(); track $index) {
          <li>
            <svg class="legend-mark" viewBox="0 0 12 12" [attr.data-s]="$index" [style.color]="colorOf($index)">
              @switch ($index) {
                @case (0) { <circle cx="6" cy="6" r="4" fill="currentColor" /> }
                @case (1) { <rect x="2" y="2" width="8" height="8" rx="1" fill="currentColor" /> }
                @case (2) { <polygon points="6,1.5 10.8,10 1.2,10" fill="currentColor" /> }
                @default { <polygon points="6,1.5 10.5,6 6,10.5 1.5,6" fill="currentColor" /> }
              }
            </svg>
            <span class="legend-name">{{ s.name }}</span>
          </li>
        }
      </ul>
    }
    <div #frame class="frame" role="group" tabindex="0" [attr.aria-label]="ariaLabel()" [attr.aria-describedby]="id + '-live'"
      [class.has-values]="showValues()"
      (keydown)="onKey($event)" (focus)="onFocus()" (blur)="onBlur()">
      <div class="yaxis" aria-hidden="true" [style.height.px]="height()">
        @for (t of ticksDown(); track t) { <span class="ytick"><span>{{ fmt(t) }}</span></span> }
      </div>
      <div #scroller class="scroller" (scroll)="place()">
        <div class="inner" [style.min-width.px]="minInner()">
          <div class="plot" aria-hidden="true" [style.height.px]="height()">
            @for (t of scale().ticks; track t) {
              <span class="grid" [class.zero]="t === 0" [style.bottom.%]="pct(t)"></span>
            }
            @if (!empty() && categories().length > 0) {
              <svg class="lines" [class.rtl]="isRtl()" viewBox="0 0 1000 1000" preserveAspectRatio="none">
                @for (seg of segments(); track $index) {
                  @if (seg.area) {
                    <path class="area" [attr.data-s]="seg.key" [attr.d]="seg.area" [style.fill]="seg.color" />
                  }
                  <path class="line" [attr.data-s]="seg.key" [attr.d]="seg.line" [style.stroke]="seg.color" vector-effect="non-scaling-stroke" />
                }
              </svg>
            }
            <div class="bands" (pointerleave)="onLeave($event)">
              @for (b of bands(); track b.index) {
                <div class="band" [attr.data-index]="b.index" [class.active]="active() === b.index" [class.selected]="selectedIndex() === b.index"
                  (pointerenter)="onEnter(b.index, $event)" (pointermove)="onEnter(b.index, $event)" (click)="onPick(b.index)">
                  @for (pt of b.points; track pt.key) {
                    <svg class="marker" viewBox="0 0 12 12" [attr.data-s]="pt.key" [style.color]="pt.color" [style.bottom.%]="pt.yPct">
                      @switch (pt.key) {
                        @case (0) { <circle cx="6" cy="6" r="4" fill="currentColor" /> }
                        @case (1) { <rect x="2" y="2" width="8" height="8" rx="1" fill="currentColor" /> }
                        @case (2) { <polygon points="6,1.5 10.8,10 1.2,10" fill="currentColor" /> }
                        @default { <polygon points="6,1.5 10.5,6 6,10.5 1.5,6" fill="currentColor" /> }
                      }
                    </svg>
                    @if (showValues()) {
                      <span class="value" [style.bottom.%]="pt.yPct">{{ pt.text }}</span>
                    }
                  }
                </div>
              }
            </div>
            @if (empty()) { <span class="empty">{{ emptyText() }}</span> }
          </div>
          <div class="xaxis" aria-hidden="true">
            @for (b of bands(); track b.index) {
              <span class="xband" [class.selected]="selectedIndex() === b.index" [attr.data-align]="labelAlign().get(b.index) ?? null">
                @if (labelAlign().has(b.index)) { <span class="xlabel">{{ b.label }}</span> }
              </span>
            }
          </div>
        </div>
      </div>
      @if (tip(); as t) {
        <div class="tip" aria-hidden="true" [style.left.px]="t.left" [style.right.px]="t.right" [style.max-width.px]="t.max">
          <span class="tip-title">{{ t.band.label }}</span>
          @for (pt of t.band.points; track pt.key) {
            <span class="tip-row">
              <span class="key" [attr.data-s]="pt.key" [style.background]="pt.color"></span>
              <strong>{{ pt.text }}</strong>
              @if (drawn().length > 1) { <span class="tip-name">{{ drawn()[pt.key].name }}</span> }
            </span>
          }
        </div>
      }
    </div>
    @if (rangeCaption(); as cap) {
      <div class="axis-caption">{{ cap }}</div>
    }
    <span class="sr" aria-live="polite" [attr.id]="id + '-live'">{{ liveText() }}</span>
    <div class="sr"><table>
      <caption>{{ tableCaption() }}</caption>
      <thead><tr><td></td>@for (s of series(); track $index) { <th scope="col">{{ s.name }}</th> }</tr></thead>
      <tbody>
        @for (c of categories(); track $index; let i = $index) {
          <tr><th scope="row">{{ c }}</th>@for (s of series(); track $index) { <td>{{ formatCell(s.values[i]) }}</td> }</tr>
        }
      </tbody>
    </table></div>
  `,
  styles: `
    :host { display: block; position: relative; min-width: 0; color: var(--ui-color-text); font-family: var(--ui-font-default); }
    .legend { display: flex; flex-wrap: wrap; gap: var(--ui-space-1) var(--ui-space-4); margin: 0 0 var(--ui-space-3); padding: 0; list-style: none; }
    .legend li { display: inline-flex; align-items: center; gap: var(--ui-space-2); min-width: 0; }
    .legend-mark { flex: none; width: 12px; height: 12px; }
    .legend-name { font-size: calc(13px * var(--ui-font-scale)); line-height: 1.4; color: var(--ui-color-text-secondary); overflow-wrap: anywhere; }

    .frame { position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: var(--ui-space-2); border-radius: var(--ui-radius-xs); outline: none;
      padding-top: var(--ui-space-2); }
    .frame:focus-visible { box-shadow: var(--ui-focus-ring); }
    .frame.has-values .inner { padding-top: var(--ui-space-6); }
    .frame.has-values .yaxis { margin-top: var(--ui-space-6); }

    .yaxis { display: flex; flex-direction: column; justify-content: space-between; }
    .ytick { display: flex; align-items: center; justify-content: flex-end; height: 0; }
    .ytick > span, .xlabel, .value {
      font-size: calc(12px * var(--ui-font-scale)); line-height: 1; white-space: nowrap; font-variant-numeric: tabular-nums;
    }
    .ytick > span { color: var(--ui-color-text-muted); }
    .ytick:only-child { margin-top: auto; }

    .scroller { min-width: 0; overflow-x: auto; overflow-y: hidden; overscroll-behavior-x: contain; scrollbar-width: thin; }
    .inner { position: relative; }
    .plot { position: relative; }
    .grid { position: absolute; left: 0; right: 0; height: 0; border-top: 1px solid var(--ui-color-border-subtle); pointer-events: none; }
    .grid.zero { border-top-color: var(--ui-color-border-strong); z-index: 1; }

    .lines { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; pointer-events: none; z-index: 1; }
    .lines.rtl { transform: scaleX(-1); }
    .line { fill: none; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
    .area { opacity: 0.12; stroke: none; }

    .bands { position: absolute; inset: 0; display: flex; z-index: 2; }
    .band {
      position: relative; flex: 1 1 0; min-width: 0; cursor: default; border-radius: var(--ui-radius-xs);
      transition: background-color var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .band.active { background: color-mix(in srgb, var(--ui-color-text) 7%, transparent); }
    .band.selected { background: var(--ui-color-selected); }
    .band.selected.active { background: color-mix(in srgb, var(--ui-color-text) 7%, var(--ui-color-selected)); }

    .marker {
      position: absolute; left: 50%; width: 10px; height: 10px;
      transform: translate(-50%, 50%); pointer-events: none;
    }
    .value {
      position: absolute; left: 50%; transform: translate(-50%, -6px); padding-bottom: var(--ui-space-1);
      color: var(--ui-color-text); font-weight: 600; pointer-events: none;
    }
    .empty {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; text-align: center;
      font-size: calc(13px * var(--ui-font-scale)); color: var(--ui-color-text-muted); pointer-events: none;
    }

    .xaxis { display: flex; padding-top: var(--ui-space-2); }
    .xband { flex: 1 1 0; min-width: 0; height: calc(18px * var(--ui-font-scale)); display: flex; justify-content: center; align-items: flex-start; border-top: 2px solid transparent; padding-top: var(--ui-space-1); }
    .xband[data-align="start"] { justify-content: flex-start; }
    .xband[data-align="end"] { justify-content: flex-end; }
    .xlabel { flex: none; color: var(--ui-color-text-muted); }
    .xband.selected { border-top-color: var(--ui-color-text); }
    .xband.selected .xlabel { color: var(--ui-color-text); font-weight: 600; }

    .axis-caption {
      margin-top: var(--ui-space-1);
      font-size: calc(12px * var(--ui-font-scale));
      color: var(--ui-color-text-muted);
      font-variant-numeric: tabular-nums;
      text-align: end;
    }

    .tip {
      position: absolute; top: 0; z-index: 3; display: grid; gap: var(--ui-space-1); box-sizing: border-box;
      padding: var(--ui-space-2) var(--ui-space-3); border-radius: var(--ui-radius-sm);
      background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border); box-shadow: var(--ui-shadow-2);
      font-size: calc(13px * var(--ui-font-scale)); line-height: 1.35; pointer-events: none;
    }
    .tip-title { color: var(--ui-color-text-secondary); overflow-wrap: anywhere; }
    .tip-row { display: flex; align-items: center; gap: var(--ui-space-2); min-width: 0; }
    .tip-row strong { font-weight: 600; font-variant-numeric: tabular-nums; white-space: nowrap; }
    .tip-name { color: var(--ui-color-text-secondary); overflow-wrap: anywhere; min-width: 0; }
    .key { flex: none; width: 12px; height: 3px; border-radius: 2px; }

    .sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; border: 0; }

    @media (prefers-reduced-motion: reduce) { .band { transition: none; } }
    :host-context(.ui-no-anim) .band { transition: none; }

    @media (forced-colors: active) {
      .line, .marker, .legend-mark { forced-color-adjust: none; color: CanvasText !important; stroke: CanvasText !important; }
      [data-s="1"].line, [data-s="1"].marker, [data-s="1"].legend-mark { color: Highlight !important; stroke: Highlight !important; }
      [data-s="2"].line, [data-s="2"].marker, [data-s="2"].legend-mark { color: GrayText !important; stroke: GrayText !important; }
      .band.active, .band.selected { outline: 1px solid Highlight; outline-offset: -1px; }
      .grid { border-top-color: GrayText; }
      .grid.zero, .xband.selected { border-top-color: CanvasText; }
      .tip { border-color: CanvasText; }
    }
  `,
})
export class UiLineChart {
  private readonly strings = injectUiStrings();
  private readonly doc = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  private readonly destroy = inject(DestroyRef);
  protected readonly id = `ui-line-chart-${nextId++}`;

  /** The x labels, one per category, oldest first. */
  categories = input<string[]>([]);
  /** One to four series. `null` values create gaps in the line. */
  series = input<UiChartSeries[]>([]);
  /** Formats a number for the axis, the tooltip, the value labels and the table. */
  formatValue = input<((value: number) => string) | undefined>(undefined);
  /** Height of the plot in px. */
  height = input(220);
  /** Fill under the line at 12% opacity (applies when there is a single series). */
  area = input(false);
  /** Line interpolation: `'linear'` or `'smooth'` (monotone, never overshoots). */
  curve = input<'linear' | 'smooth'>('linear');
  /** `'zero'` (default) starts at 0; `'auto'` fits the axis to the data range and prints the range in the caption. */
  baseline = input<'zero' | 'auto'>('zero');
  /** Print the value at each point (for short series). */
  showValues = input(false);
  /** The chosen category index, or `null` for none. */
  selectedIndex = input<number | null | undefined>(undefined);
  /** The chart's name, read by screen readers and used as the table's caption. */
  ariaLabel = input.required<string>();
  /** Least width of one category in px before sideways scrolling. */
  minCategoryWidth = input<number | null>(null);
  /** Shown over the axes when there is no data or every value is null/empty. */
  emptyLabel = input<string | undefined>(undefined);

  /** A category was clicked, tapped or chosen with Enter or Space: its index. */
  categorySelect = output<number>();

  protected readonly active = signal<number | null>(null);
  protected readonly isRtl = signal(false);
  private readonly bandWidth = signal(0);
  private readonly labelWidths = signal<number[]>([]);
  private readonly tipAt = signal<{ centre: number; half: number; width: number } | null>(null);
  private keyboard = false;
  private ready = false;
  private canvas: CanvasRenderingContext2D | null | undefined;

  protected readonly drawn = computed(() => this.series().slice(0, UI_LINE_CHART_MAX_SERIES));

  private readonly finiteValues = computed(() => {
    const out: number[] = [];
    const n = this.categories().length;
    for (const s of this.drawn()) {
      for (let i = 0; i < n; i++) {
        const v = s.values[i];
        if (typeof v === 'number' && Number.isFinite(v)) out.push(v);
      }
    }
    return out;
  });

  protected readonly empty = computed(() => this.finiteValues().length === 0);

  protected readonly scale = computed(() => {
    const vals = this.finiteValues();
    if (vals.length === 0) return { min: 0, max: 1, ticks: [0] };
    return this.baseline() === 'auto' ? uiChartAutoScale(vals) : uiChartScale(vals);
  });

  protected readonly ticksDown = computed(() => [...this.scale().ticks].reverse());
  protected readonly emptyText = computed(() => this.emptyLabel() ?? this.strings.noData);
  protected readonly minInner = computed(() => {
    const w = this.minCategoryWidth();
    return w && w > 0 ? w * this.categories().length : null;
  });

  protected readonly rangeCaption = computed(() => {
    if (this.baseline() !== 'auto' || this.empty()) return null;
    const { min, max } = this.scale();
    return `${this.fmt(min)} – ${this.fmt(max)}`;
  });

  protected readonly tableCaption = computed(() => {
    const cap = this.rangeCaption();
    return cap ? `${this.ariaLabel()} (${cap})` : this.ariaLabel();
  });

  protected readonly segments = computed<SegmentPath[]>(() => {
    const cats = this.categories();
    const n = cats.length;
    const { min, max } = this.scale();
    const span = max - min || 1;
    const drawn = this.drawn();
    const smooth = this.curve() === 'smooth';
    const showArea = this.area() && drawn.length === 1;
    const baseVal = this.baseline() === 'zero' && min <= 0 && max >= 0 ? 0 : min;
    const baseY = (1 - (baseVal - min) / span) * 1000;
    const out: SegmentPath[] = [];

    drawn.forEach((s, key) => {
      const color = this.colorOf(key);
      let run: UiLinePoint[] = [];
      const flush = () => {
        if (run.length >= 2) {
          const line = smooth ? uiMonotoneLinePath(run) : linearLinePath(run);
          const area = showArea
            ? `${line} L ${run[run.length - 1].x.toFixed(2)} ${baseY.toFixed(2)} L ${run[0].x.toFixed(2)} ${baseY.toFixed(2)} Z`
            : null;
          out.push({ key, color, line, area });
        }
        run = [];
      };
      for (let i = 0; i < n; i++) {
        const v = s.values[i];
        if (typeof v === 'number' && Number.isFinite(v)) {
          const x = ((i + 0.5) / n) * 1000;
          const y = (1 - (v - min) / span) * 1000;
          run.push({ x, y });
        } else {
          flush();
        }
      }
      flush();
    });
    return out;
  });

  protected readonly bands = computed<Band[]>(() => {
    const { min, max } = this.scale();
    const span = max - min || 1;
    const drawn = this.drawn();
    return this.categories().map((label, index) => {
      const points: PlotPoint[] = [];
      drawn.forEach((s, key) => {
        const v = s.values[index];
        if (typeof v === 'number' && Number.isFinite(v)) {
          points.push({
            index,
            key,
            value: v,
            text: this.fmt(v),
            color: this.colorOf(key),
            yPct: ((v - min) / span) * 100,
          });
        }
      });
      const summary = points.length
        ? points.map((p) => (drawn.length > 1 ? `${drawn[p.key].name} ${p.text}` : p.text)).join(', ')
        : '—';
      return { index, label, points, summary: `${label}: ${summary}` };
    });
  });

  protected readonly labelAlign = computed(() => {
    const widths = this.labelWidths();
    const cats = this.categories();
    const labels: UiChartLabel[] = widths.length === cats.length
      ? uiChartLabels(widths, this.bandWidth())
      : cats.map((_, index) => ({ index, align: 'center' as const }));
    return new Map(labels.map((l) => [l.index, l.align]));
  });

  protected readonly tip = computed(() => {
    const i = this.active();
    const at = this.tipAt();
    const band = i === null ? undefined : this.bands()[i];
    if (!band || !at || band.points.length === 0) return null;
    const gap = at.half + 8;
    return at.centre <= at.width / 2
      ? { band, left: at.centre + gap, right: null, max: Math.max(0, at.width - at.centre - gap) }
      : { band, left: null, right: at.width - at.centre + gap, max: Math.max(0, at.centre - gap) };
  });

  protected readonly liveText = computed(() => {
    const i = this.active();
    const band = i === null ? undefined : this.bands()[i];
    return band && this.keyboard ? band.summary : '';
  });

  constructor() {
    afterNextRender(() => {
      const el = this.scroller().nativeElement;
      const measure = () => this.measure();
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        this.destroy.onDestroy(() => ro.disconnect());
      }
      const win = this.doc.defaultView;
      const outside = (e: Event) => {
        if (this.active() !== null && !this.keyboard && !this.host.nativeElement.contains(e.target as Node)) this.active.set(null);
      };
      win?.addEventListener('pointerdown', outside, true);
      this.destroy.onDestroy(() => win?.removeEventListener('pointerdown', outside, true));
      this.ready = true;
      measure();
      this.toEnd();
    });
    effect(() => {
      this.categories();
      this.minCategoryWidth();
      this.formatValue();
      if (!this.ready) return;
      untracked(() => queueMicrotask(() => { this.measure(); this.toEnd(); }));
    });
  }

  protected colorOf(i: number): string {
    return this.drawn()[i]?.color || `var(--ui-chart-${i + 1})`;
  }

  protected fmt(v: number): string {
    const f = this.formatValue();
    return f ? f(v) : v.toLocaleString();
  }

  protected formatCell(v: number | null | undefined): string {
    return typeof v === 'number' && Number.isFinite(v) ? this.fmt(v) : '—';
  }

  protected pct(tick: number): number {
    const { min, max } = this.scale();
    return ((tick - min) / (max - min || 1)) * 100;
  }

  private measure(): void {
    const el = this.scroller().nativeElement;
    const n = this.categories().length;
    const inner = el.scrollWidth || el.clientWidth;
    this.bandWidth.set(n ? inner / n : 0);
    this.labelWidths.set(this.categories().map((c) => this.textWidth(c)));
    const frameEl = this.frame().nativeElement;
    const dir = this.doc.defaultView?.getComputedStyle(frameEl).direction;
    const attrDir = frameEl.closest('[dir]')?.getAttribute('dir');
    this.isRtl.set(dir === 'rtl' || attrDir === 'rtl');
    if (this.active() !== null) this.place();
  }

  private textWidth(text: string): number {
    if (this.canvas === undefined) {
      try { this.canvas = this.doc.createElement('canvas').getContext('2d'); } catch { this.canvas = null; }
    }
    const view = this.doc.defaultView;
    if (this.canvas && view) {
      const cs = view.getComputedStyle(this.scroller().nativeElement);
      const size = 12 * (parseFloat(cs.getPropertyValue('--ui-font-scale')) || 1);
      this.canvas.font = `${size}px ${cs.fontFamily}`;
      return Math.ceil(this.canvas.measureText(text).width) + 1;
    }
    return Math.ceil(text.length * 7);
  }

  private toEnd(): void {
    const el = this.scroller().nativeElement;
    if (el.scrollWidth <= el.clientWidth) return;
    const rtl = this.doc.defaultView?.getComputedStyle(el).direction === 'rtl';
    el.scrollLeft = rtl ? -el.scrollWidth : el.scrollWidth;
  }

  protected place(): void {
    const i = this.active();
    if (i === null) return;
    const frame = this.frame().nativeElement;
    const band = frame.querySelector<HTMLElement>(`.band[data-index="${i}"]`);
    if (!band) return;
    const f = frame.getBoundingClientRect();
    const b = band.getBoundingClientRect();
    this.tipAt.set({ centre: b.left - f.left + b.width / 2, half: b.width / 2, width: f.width });
  }

  private show(i: number | null, keyboard: boolean): void {
    this.keyboard = keyboard;
    this.active.set(i);
    if (i === null) return;
    if (keyboard) {
      const el = this.scroller().nativeElement;
      const band = el.querySelector<HTMLElement>(`.band[data-index="${i}"]`);
      if (band && el.scrollWidth > el.clientWidth) {
        const s = el.getBoundingClientRect();
        const b = band.getBoundingClientRect();
        if (b.left < s.left) el.scrollLeft -= s.left - b.left;
        else if (b.right > s.right) el.scrollLeft += b.right - s.right;
      }
    }
    this.place();
  }

  protected onEnter(i: number, e: PointerEvent): void {
    if (e.pointerType === 'touch') return;
    if (this.active() !== i || this.keyboard) this.show(i, false);
  }

  protected onLeave(e: PointerEvent): void {
    if (e.pointerType === 'touch' || this.keyboard) return;
    this.active.set(null);
  }

  protected onPick(i: number): void {
    this.show(i, false);
    this.categorySelect.emit(i);
  }

  protected onFocus(): void {
    let fromKeys = true;
    try { fromKeys = this.frame().nativeElement.matches(':focus-visible'); } catch { /* treat as keyboard */ }
    const n = this.categories().length;
    if (!fromKeys || !n || this.active() !== null) return;
    const sel = this.selectedIndex();
    this.show(typeof sel === 'number' && sel >= 0 && sel < n ? sel : n - 1, true);
  }

  protected onBlur(): void {
    this.keyboard = false;
    this.active.set(null);
  }

  protected onKey(e: KeyboardEvent): void {
    const n = this.categories().length;
    if (!n) return;
    const cur = this.active();
    const rtl = this.doc.defaultView?.getComputedStyle(this.frame().nativeElement).direction === 'rtl';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    let next: number | null = null;
    if (e.key === back) next = cur === null ? n - 1 : Math.max(0, cur - 1);
    else if (e.key === forward) next = cur === null ? 0 : Math.min(n - 1, cur + 1);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else if (e.key === 'Escape') { if (cur !== null) { this.show(null, false); e.preventDefault(); } return; }
    else if (e.key === 'Enter' || e.key === ' ') {
      if (cur !== null) { this.categorySelect.emit(cur); e.preventDefault(); }
      return;
    } else return;
    e.preventDefault();
    this.show(next, true);
  }
}
