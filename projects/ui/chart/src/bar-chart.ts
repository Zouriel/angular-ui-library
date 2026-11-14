import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject,
  input, output, signal, untracked, viewChild,
} from '@angular/core';
import { injectUiStrings } from '@zouriel/ui';
import { type UiChartLabel, uiChartLabels, uiChartScale } from './chart-scale';

/** One series of `ui-bar-chart`: a name, a value per category, and optionally its own colour. */
export interface UiBarChartSeries {
  name: string;
  /** One value per category, in the order of `categories`. A missing value counts as 0. */
  values: number[];
  /** Any CSS colour. Default: the theme's chart colour for this position (`--ui-chart-1` to `-4`). */
  color?: string;
}

interface Bar { key: number; color: string; value: number; text: string; bottom: number; height: number; negative: boolean; }
interface Band { index: number; label: string; bars: Bar[]; summary: string; }

/** The most series one chart draws; more than this are not drawn (they stay in the table). */
export const UI_BAR_CHART_MAX_SERIES = 4;

let nextId = 0;

/**
 * `ui-bar-chart`: columns over categories, from a zero baseline. One series draws plain columns; two
 * to four draw grouped bars side by side with a legend. Hover, tap or the arrow keys show a
 * category's values; every number is also in a table for screen readers.
 */
@Component({
  selector: 'ui-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (drawn().length > 1) {
      <ul class="legend" aria-hidden="true">
        @for (s of drawn(); track $index) {
          <li><span class="swatch" [attr.data-s]="$index" [style.background]="colorOf($index)"></span><span class="legend-name">{{ s.name }}</span></li>
        }
      </ul>
    }
    <div #frame class="frame" role="group" tabindex="0" [attr.aria-label]="ariaLabel()" [attr.aria-describedby]="id + '-live'"
      [class.has-values]="showValues()" [class.has-negative]="scale().min < 0"
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
            <div class="bands" (pointerleave)="onLeave($event)">
              @for (b of bands(); track b.index) {
                <div class="band" [attr.data-index]="b.index" [class.active]="active() === b.index" [class.selected]="selectedIndex() === b.index"
                  (pointerenter)="onEnter(b.index, $event)" (pointermove)="onEnter(b.index, $event)" (click)="onPick(b.index)">
                  @for (bar of b.bars; track bar.key) {
                    <span class="slot">
                      @if (bar.value !== 0) {
                        <span class="bar" [class.negative]="bar.negative" [attr.data-s]="bar.key" [style.background]="bar.color"
                          [style.bottom.%]="bar.bottom" [style.height.%]="bar.height"></span>
                      }
                      @if (showValues()) {
                        <span class="value" [class.negative]="bar.negative"
                          [style.bottom.%]="bar.negative ? null : bar.bottom + bar.height"
                          [style.top.%]="bar.negative ? 100 - bar.bottom : null">{{ bar.text }}</span>
                      }
                    </span>
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
          @for (bar of t.band.bars; track bar.key) {
            <span class="tip-row">
              <span class="key" [attr.data-s]="bar.key" [style.background]="bar.color"></span>
              <strong>{{ bar.text }}</strong>
              @if (drawn().length > 1) { <span class="tip-name">{{ drawn()[bar.key].name }}</span> }
            </span>
          }
        </div>
      }
    </div>
    <span class="sr" aria-live="polite" [attr.id]="id + '-live'">{{ liveText() }}</span>
    <table class="sr">
      <caption>{{ ariaLabel() }}</caption>
      <thead><tr><td></td>@for (s of series(); track $index) { <th scope="col">{{ s.name }}</th> }</tr></thead>
      <tbody>
        @for (c of categories(); track $index; let i = $index) {
          <tr><th scope="row">{{ c }}</th>@for (s of series(); track $index) { <td>{{ fmt(valueOf(s, i)) }}</td> }</tr>
        }
      </tbody>
    </table>
  `,
  styles: `
    :host { display: block; position: relative; min-width: 0; color: var(--ui-color-text); font-family: var(--ui-font-default); }
    .legend { display: flex; flex-wrap: wrap; gap: var(--ui-space-1) var(--ui-space-4); margin: 0 0 var(--ui-space-3); padding: 0; list-style: none; }
    .legend li { display: inline-flex; align-items: center; gap: var(--ui-space-2); min-width: 0; }
    .legend-name { font-size: calc(13px * var(--ui-font-scale)); line-height: 1.4; color: var(--ui-color-text-secondary); overflow-wrap: anywhere; }
    .swatch { flex: none; width: 10px; height: 10px; border-radius: 2px; }

    .frame { position: relative; display: grid; grid-template-columns: auto minmax(0, 1fr); column-gap: var(--ui-space-2); border-radius: var(--ui-radius-xs); outline: none;
      /* The top tick's label is centred on its gridline: half of it stands above the plot. */
      padding-top: var(--ui-space-2); }
    .frame:focus-visible { box-shadow: var(--ui-focus-ring); }
    /* Room for a value label above the tallest bar, and under the lowest negative one. */
    .frame.has-values .inner { padding-top: var(--ui-space-6); }
    .frame.has-values .yaxis { margin-top: var(--ui-space-6); }
    .frame.has-values.has-negative .xaxis { margin-top: var(--ui-space-6); }

    /* Evenly spaced ticks: a column with the top tick first, each label centred on its gridline. */
    .yaxis { display: flex; flex-direction: column; justify-content: space-between; }
    .ytick { display: flex; align-items: center; justify-content: flex-end; height: 0; }
    .ytick > span, .xlabel, .value {
      font-size: calc(12px * var(--ui-font-scale)); line-height: 1; white-space: nowrap; font-variant-numeric: tabular-nums;
    }
    .ytick > span { color: var(--ui-color-text-muted); }
    /* A lone tick is the zero line, at the bottom. */
    .ytick:only-child { margin-top: auto; }

    /* The plot scrolls sideways in here when the categories need more room; the page never does. */
    .scroller { min-width: 0; overflow-x: auto; overflow-y: hidden; overscroll-behavior-x: contain; scrollbar-width: thin; }
    .inner { position: relative; }
    .plot { position: relative; }
    .grid { position: absolute; left: 0; right: 0; height: 0; border-top: 1px solid var(--ui-color-border-subtle); pointer-events: none; }
    .grid.zero { border-top-color: var(--ui-color-border-strong); z-index: 1; }

    .bands { position: absolute; inset: 0; display: flex; }
    /* The whole band is the target for hover and tap, not only the bars. */
    .band {
      position: relative; flex: 1 1 0; min-width: 0; display: flex; justify-content: center; gap: 2px;
      padding-inline: 2px; cursor: default; border-radius: var(--ui-radius-xs);
      transition: background-color var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .band.active { background: color-mix(in srgb, var(--ui-color-text) 7%, transparent); }
    .band.selected { background: var(--ui-color-selected); }
    .band.selected.active { background: color-mix(in srgb, var(--ui-color-text) 7%, var(--ui-color-selected)); }
    /* Thin bars: 24px at most, the rest of the band is air. The 2px gap between bars is the band's. */
    .slot { position: relative; flex: 0 1 24px; min-width: 1px; height: 100%; }
    .bar {
      position: absolute; left: 0; right: 0; min-height: 1px; border-radius: 4px 4px 0 0;
      transition: height var(--ui-motion-base) var(--ui-ease-standard), bottom var(--ui-motion-base) var(--ui-ease-standard);
    }
    .bar.negative { border-radius: 0 0 4px 4px; }
    .value {
      position: absolute; left: 50%; transform: translateX(-50%); padding-block: var(--ui-space-1);
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
    /* The chosen category: a rule under it and its label in full ink, so it never rests on colour alone. */
    .xband.selected { border-top-color: var(--ui-color-text); }
    .xband.selected .xlabel { color: var(--ui-color-text); font-weight: 600; }

    .tip {
      position: absolute; top: 0; z-index: 2; display: grid; gap: var(--ui-space-1); box-sizing: border-box;
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

    @media (prefers-reduced-motion: reduce) { .bar, .band { transition: none; } }
    :host-context(.ui-no-anim) .bar, :host-context(.ui-no-anim) .band { transition: none; }

    /* Forced colours repaint backgrounds, so the series keep system colours and the last one is hollow. */
    @media (forced-colors: active) {
      .bar, .swatch, .key { forced-color-adjust: none; background: CanvasText !important; }
      [data-s="1"].bar, [data-s="1"].swatch, [data-s="1"].key { background: Highlight !important; }
      [data-s="2"].bar, [data-s="2"].swatch, [data-s="2"].key { background: GrayText !important; }
      [data-s="3"].bar, [data-s="3"].swatch, [data-s="3"].key { background: Canvas !important; outline: 2px solid CanvasText; outline-offset: -2px; }
      .band.active, .band.selected { outline: 1px solid Highlight; outline-offset: -1px; }
      .grid { border-top-color: GrayText; }
      .grid.zero, .xband.selected { border-top-color: CanvasText; }
      .tip { border-color: CanvasText; }
    }
  `,
})
export class UiBarChart {
  private readonly strings = injectUiStrings();
  private readonly doc = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');
  private readonly scroller = viewChild.required<ElementRef<HTMLElement>>('scroller');
  protected readonly id = `ui-bar-chart-${nextId++}`;

  /** The x labels, one per category, oldest first. */
  categories = input<string[]>([]);
  /** One to four series. One draws plain columns; more draw grouped bars side by side, with a legend. */
  series = input<UiBarChartSeries[]>([]);
  /** Formats a number for the axis, the tooltip, the value labels and the table. Default: the locale's number format. */
  formatValue = input<((value: number) => string) | undefined>(undefined);
  /** Height of the plot in px (the x labels and the legend come on top of it). */
  height = input(220);
  /** A value above each bar, in text ink. For charts with a few bars; many bars leave it to the axis and the tooltip. */
  showValues = input(false);
  /** The chosen category: its band is tinted, with a rule under its label in bold. `null`: none. */
  selectedIndex = input<number | null | undefined>(undefined);
  /** The chart's name, read by screen readers and used as the table's caption. */
  ariaLabel = input.required<string>();
  /** Least width of one category in px. When the plot is narrower than that for all of them it scrolls sideways inside the chart, starting at the latest. */
  minCategoryWidth = input<number | null>(null);
  /** Shown over the axes when there is no data or every value is 0. Default: the built-in `noData` (No data). */
  emptyLabel = input<string | undefined>(undefined);

  /** A category was clicked, tapped or chosen with Enter or Space: its index. */
  categorySelect = output<number>();

  protected readonly active = signal<number | null>(null);
  private readonly bandWidth = signal(0);
  private readonly labelWidths = signal<number[]>([]);
  private readonly tipAt = signal<{ centre: number; half: number; width: number } | null>(null);
  private keyboard = false;

  protected readonly drawn = computed(() => this.series().slice(0, UI_BAR_CHART_MAX_SERIES));
  protected readonly scale = computed(() => uiChartScale(this.drawn().flatMap((s) => this.categories().map((_, i) => this.valueOf(s, i)))));
  protected readonly ticksDown = computed(() => [...this.scale().ticks].reverse());
  protected readonly empty = computed(() => this.scale().ticks.length === 1);
  protected readonly emptyText = computed(() => this.emptyLabel() ?? this.strings.noData);
  protected readonly minInner = computed(() => {
    const w = this.minCategoryWidth();
    return w && w > 0 ? w * this.categories().length : null;
  });

  protected readonly bands = computed<Band[]>(() => {
    const { min, max } = this.scale();
    const span = max - min;
    const zero = ((0 - min) / span) * 100;
    const drawn = this.drawn();
    return this.categories().map((label, index) => {
      const bars = drawn.map((s, key): Bar => {
        const value = this.valueOf(s, index);
        const size = (Math.abs(value) / span) * 100;
        return { key, value, text: this.fmt(value), color: this.colorOf(key), negative: value < 0, height: size, bottom: value < 0 ? zero - size : zero };
      });
      const summary = bars.map((b) => (drawn.length > 1 ? `${drawn[b.key].name} ${b.text}` : b.text)).join(', ');
      return { index, label, bars, summary: `${label}: ${summary}` };
    });
  });

  /** The x labels that are shown, by category index, with how each lines up in its band. */
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
    if (!band || !at) return null;
    // Beside the band, on the side with more room, so it never covers the bars it describes.
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
    // New categories or labels: measure again, and show the latest end.
    effect(() => {
      this.categories();
      this.minCategoryWidth();
      this.formatValue();
      if (!this.ready) return;
      untracked(() => queueMicrotask(() => { this.measure(); this.toEnd(); }));
    });
  }

  private readonly destroy = inject(DestroyRef);
  private ready = false;
  private canvas: CanvasRenderingContext2D | null | undefined;

  protected colorOf(i: number): string {
    return this.drawn()[i]?.color || `var(--ui-chart-${i + 1})`;
  }

  protected valueOf(s: UiBarChartSeries, i: number): number {
    const v = s.values[i];
    return typeof v === 'number' && Number.isFinite(v) ? v : 0;
  }

  protected fmt(v: number): string {
    const f = this.formatValue();
    return f ? f(v) : v.toLocaleString();
  }

  protected pct(tick: number): number {
    const { min, max } = this.scale();
    return ((tick - min) / (max - min)) * 100;
  }

  /** Width of one band and of every label, for thinning the x labels. */
  private measure(): void {
    const el = this.scroller().nativeElement;
    const n = this.categories().length;
    const inner = el.scrollWidth || el.clientWidth;
    this.bandWidth.set(n ? inner / n : 0);
    this.labelWidths.set(this.categories().map((c) => this.textWidth(c)));
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

  /** Start at the latest category: the inline end of the plot. */
  private toEnd(): void {
    const el = this.scroller().nativeElement;
    if (el.scrollWidth <= el.clientWidth) return;
    const rtl = this.doc.defaultView?.getComputedStyle(el).direction === 'rtl';
    el.scrollLeft = rtl ? -el.scrollWidth : el.scrollWidth;
  }

  /** Where the active band is inside the frame, for the tooltip. */
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
      // Bring a band that is scrolled out of the plot into it before placing the tooltip.
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
    if (e.pointerType === 'touch') return; // a tap shows it (onPick); a finger scrolling past does not
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
    // Focus from the keyboard starts at the chosen category, or the latest one. A click sets its own.
    let fromKeys = true;
    try { fromKeys = this.frame().nativeElement.matches(':focus-visible'); } catch { /* older engines: treat as keyboard */ }
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
