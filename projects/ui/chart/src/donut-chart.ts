import { DOCUMENT } from '@angular/common';
import {
  ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject,
  input, output, signal, untracked, viewChild,
} from '@angular/core';
import { injectUiStrings } from '@zouriel/ui';

/** One segment of `ui-donut-chart`. */
export interface UiDonutSegment {
  name: string;
  value: number;
  /** Any CSS colour. Default: `--ui-chart-1` through `--ui-chart-6`. */
  color?: string;
}

/** Prepared segment with true share and minimum-arc-adjusted draw share. */
export interface UiDonutPreparedSegment {
  index: number;
  name: string;
  value: number;
  share: number;
  drawShare: number;
  color: string;
  isOther: boolean;
}

interface ArcSegment extends UiDonutPreparedSegment {
  path: string;
  isCircle: boolean;
  pctText: string;
  valueText: string;
  summary: string;
}

/** Maximum segments drawn in a donut chart before folding the tail into "Other". */
export const UI_DONUT_CHART_MAX_SEGMENTS = 6;

/** Minimum drawn share (3%) so small slices remain visible. */
export const UI_DONUT_MIN_VISIBLE_SHARE = 0.03;

/**
 * Folds more than 6 segments into a 6th "Other" segment and computes true shares plus
 * minimum-visible-arc (`>= 3%`) draw shares.
 */
export function uiDonutPrepareSegments(
  segments: readonly UiDonutSegment[],
  otherLabel: string,
): UiDonutPreparedSegment[] {
  const positive = segments.filter((s) => typeof s.value === 'number' && Number.isFinite(s.value) && s.value > 0);
  if (positive.length === 0) return [];

  const folded: { name: string; value: number; color?: string; isOther: boolean }[] =
    positive.length > UI_DONUT_CHART_MAX_SEGMENTS
      ? [
          ...positive.slice(0, UI_DONUT_CHART_MAX_SEGMENTS - 1).map((s) => ({ ...s, isOther: false })),
          {
            name: otherLabel,
            value: positive.slice(UI_DONUT_CHART_MAX_SEGMENTS - 1).reduce((sum, s) => sum + s.value, 0),
            isOther: true,
          },
        ]
      : positive.map((s) => ({ ...s, isOther: false }));

  const total = folded.reduce((sum, s) => sum + s.value, 0);
  if (total <= 0) return [];

  const rawShares = folded.map((s) => s.value / total);
  const smallCount = rawShares.filter((sh) => sh < UI_DONUT_MIN_VISIBLE_SHARE).length;
  const largeSum = rawShares.reduce((sum, sh) => (sh >= UI_DONUT_MIN_VISIBLE_SHARE ? sum + sh : sum), 0);
  const remaining = Math.max(0, 1 - smallCount * UI_DONUT_MIN_VISIBLE_SHARE);

  return folded.map((s, index) => {
    const share = rawShares[index];
    const drawShare =
      folded.length === 1
        ? 1
        : share < UI_DONUT_MIN_VISIBLE_SHARE
          ? UI_DONUT_MIN_VISIBLE_SHARE
          : largeSum > 0
            ? (share / largeSum) * remaining
            : 1 / folded.length;
    return {
      index,
      name: s.name,
      value: s.value,
      share,
      drawShare,
      color: s.color || `var(--ui-chart-${index + 1})`,
      isOther: s.isOther,
    };
  });
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number, ccw: boolean): string {
  const x1 = cx + r * Math.cos(startAngle);
  const y1 = cy + r * Math.sin(startAngle);
  const x2 = cx + r * Math.cos(endAngle);
  const y2 = cy + r * Math.sin(endAngle);
  const sweep = Math.abs(endAngle - startAngle);
  const largeArc = sweep > Math.PI ? 1 : 0;
  const sweepFlag = ccw ? 0 : 1;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${r.toFixed(2)} ${r.toFixed(2)} 0 ${largeArc} ${sweepFlag} ${x2.toFixed(2)} ${y2.toFixed(2)}`;
}

let nextId = 0;

/**
 * `ui-donut-chart`: up to six segments (extra segments fold into "Other"), 2px surface-colour gaps,
 * minimum 3% visible arc with true figures in the legend, optional centre value/label, clockwise in
 * LTR and counter-clockwise in RTL, arrow-key navigation, and a screen-reader table.
 */
@Component({
  selector: 'ui-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div #wrap class="wrap" [class.legend-end]="legend() === 'end'" [class.legend-bottom]="legend() === 'bottom'">
      <div #frame class="frame" role="group" tabindex="0"
        [style.width.px]="size()" [style.height.px]="size()"
        [attr.aria-label]="ariaLabel()" [attr.aria-describedby]="id + '-live'"
        (keydown)="onKey($event)" (focus)="onFocus()" (blur)="onBlur()" (pointerleave)="onLeave($event)">
        <svg class="ring" [attr.viewBox]="'0 0 ' + size() + ' ' + size()" aria-hidden="true">
          @if (arcs().length === 0) {
            <circle class="empty-ring" [attr.cx]="center()" [attr.cy]="center()" [attr.r]="radius()"
              [attr.stroke-width]="thickness()" fill="none" />
          } @else {
            @for (a of arcs(); track a.index) {
              @if (a.isCircle) {
                <circle class="seg" [attr.data-index]="a.index" [attr.data-s]="a.index"
                  [class.active]="active() === a.index" [class.selected]="selectedIndex() === a.index"
                  [attr.cx]="center()" [attr.cy]="center()" [attr.r]="radius()"
                  [attr.stroke]="a.color" [attr.stroke-width]="thickness()" fill="none"
                  (pointerenter)="onEnter(a.index, $event)" (click)="onPick(a.index)" />
              } @else {
                <path class="seg" [attr.data-index]="a.index" [attr.data-s]="a.index"
                  [class.active]="active() === a.index" [class.selected]="selectedIndex() === a.index"
                  [attr.d]="a.path" [attr.stroke]="a.color" [attr.stroke-width]="thickness()"
                  stroke-linecap="butt" fill="none"
                  (pointerenter)="onEnter(a.index, $event)" (click)="onPick(a.index)" />
              }
            }
          }
        </svg>
        <div class="center" aria-hidden="true">
          @if (arcs().length === 0) {
            <span class="empty-text">{{ emptyText() }}</span>
          } @else {
            @if (centerValue(); as cv) { <span class="center-value">{{ cv }}</span> }
            @if (centerLabel(); as cl) { <span class="center-label">{{ cl }}</span> }
          }
        </div>
        @if (activeArc(); as a) {
          <div class="tip" aria-hidden="true">
            <span class="tip-row">
              <span class="swatch" [attr.data-s]="a.index" [style.background]="a.color"></span>
              <span class="tip-name">{{ a.name }}</span>
              <strong>{{ a.valueText }} ({{ a.pctText }})</strong>
            </span>
          </div>
        }
      </div>

      @if (legend() !== 'none' && arcs().length > 0) {
        <ul class="legend" aria-hidden="true">
          @for (a of arcs(); track a.index) {
            <li class="legend-item" [class.active]="active() === a.index" [class.selected]="selectedIndex() === a.index"
              (pointerenter)="onEnter(a.index, $event)" (pointerleave)="onLeave($event)" (click)="onPick(a.index)">
              <span class="swatch" [attr.data-s]="a.index" [style.background]="a.color"></span>
              <span class="legend-name">{{ a.name }}</span>
              <span class="legend-val">{{ a.valueText }}</span>
              <span class="legend-pct">{{ a.pctText }}</span>
            </li>
          }
        </ul>
      }
    </div>
    <span class="sr" aria-live="polite" [attr.id]="id + '-live'">{{ liveText() }}</span>
    <div class="sr"><table>
      <caption>{{ ariaLabel() }}</caption>
      <thead><tr><th scope="col">Segment</th><th scope="col">Value</th><th scope="col">Share</th></tr></thead>
      <tbody>
        @for (s of tableRows(); track $index) {
          <tr><th scope="row">{{ s.name }}</th><td>{{ s.valueText }}</td><td>{{ s.pctText }}</td></tr>
        }
      </tbody>
    </table></div>
  `,
  styles: `
    :host { display: block; position: relative; min-width: 0; color: var(--ui-color-text); font-family: var(--ui-font-default); }
    .wrap { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ui-space-5); }
    .wrap.legend-bottom { flex-direction: column; align-items: flex-start; }

    .frame { position: relative; flex: none; border-radius: 50%; outline: none; }
    .frame:focus-visible { box-shadow: var(--ui-focus-ring); }
    .ring { display: block; width: 100%; height: 100%; overflow: visible; }
    .empty-ring { stroke: var(--ui-color-border-subtle); }

    .seg {
      cursor: pointer;
      transition: opacity var(--ui-motion-fast) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard);
      transform-origin: center;
    }
    .seg.active, .seg.selected { opacity: 0.85; }

    .center {
      position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center;
      text-align: center; pointer-events: none; padding: var(--ui-space-4);
    }
    .center-value { font-size: calc(20px * var(--ui-font-scale)); font-weight: 700; line-height: 1.15; font-variant-numeric: tabular-nums; color: var(--ui-color-text); }
    .center-label { font-size: calc(12px * var(--ui-font-scale)); line-height: 1.3; color: var(--ui-color-text-muted); margin-top: 2px; }
    .empty-text { font-size: calc(13px * var(--ui-font-scale)); color: var(--ui-color-text-muted); }

    .tip {
      position: absolute; left: 50%; bottom: calc(100% + var(--ui-space-2)); transform: translateX(-50%); z-index: 3;
      padding: var(--ui-space-2) var(--ui-space-3); border-radius: var(--ui-radius-sm);
      background: var(--ui-color-surface-raised); border: 1px solid var(--ui-color-border); box-shadow: var(--ui-shadow-2);
      font-size: calc(13px * var(--ui-font-scale)); line-height: 1.35; white-space: nowrap; pointer-events: none;
    }
    .tip-row { display: inline-flex; align-items: center; gap: var(--ui-space-2); }
    .tip-name { color: var(--ui-color-text-secondary); }
    .tip-row strong { font-weight: 600; font-variant-numeric: tabular-nums; }

    .legend { display: flex; flex-direction: column; gap: var(--ui-space-2); margin: 0; padding: 0; list-style: none; min-width: 0; }
    .legend-bottom .legend { flex-direction: row; flex-wrap: wrap; gap: var(--ui-space-2) var(--ui-space-4); }
    .legend-item {
      display: inline-flex; align-items: center; gap: var(--ui-space-2); cursor: pointer;
      padding: 2px var(--ui-space-1); border-radius: var(--ui-radius-xs);
      font-size: calc(13px * var(--ui-font-scale)); line-height: 1.4;
    }
    .legend-item.active { background: color-mix(in srgb, var(--ui-color-text) 7%, transparent); }
    .legend-item.selected { background: var(--ui-color-selected); }
    .swatch { flex: none; width: 10px; height: 10px; border-radius: 2px; }
    .legend-name { color: var(--ui-color-text-secondary); overflow-wrap: anywhere; }
    .legend-val { font-weight: 600; font-variant-numeric: tabular-nums; color: var(--ui-color-text); }
    .legend-pct { font-variant-numeric: tabular-nums; color: var(--ui-color-text-muted); }

    .sr { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; border: 0; }

    @media (prefers-reduced-motion: reduce) { .seg { transition: none; } }
    :host-context(.ui-no-anim) .seg { transition: none; }

    @media (forced-colors: active) {
      .seg { forced-color-adjust: none; stroke: CanvasText !important; }
      [data-s="1"].seg { stroke: Highlight !important; }
      [data-s="2"].seg { stroke: GrayText !important; }
      .tip { border-color: CanvasText; }
    }
  `,
})
export class UiDonutChart {
  private readonly strings = injectUiStrings();
  private readonly doc = inject(DOCUMENT);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly frame = viewChild.required<ElementRef<HTMLElement>>('frame');
  private readonly destroy = inject(DestroyRef);
  protected readonly id = `ui-donut-chart-${nextId++}`;

  /** Segments to plot. More than six are folded into "Other". */
  segments = input<UiDonutSegment[]>([]);
  /** Outer diameter in px. */
  size = input(180);
  /** Ring thickness in px. */
  thickness = input(24);
  /** Primary text in the centre of the ring (for example the total). */
  centerValue = input<string | undefined>(undefined);
  /** Secondary label in the centre of the ring. */
  centerLabel = input<string | undefined>(undefined);
  /** Legend placement: `'end'`, `'bottom'`, or `'none'`. */
  legend = input<'end' | 'bottom' | 'none'>('end');
  /** Formats a segment's value for the legend, tooltip and screen-reader table. */
  formatValue = input<((value: number) => string) | undefined>(undefined);
  /** Selected segment index, or `null` for none. */
  selectedIndex = input<number | null | undefined>(undefined);
  /** Chart name read by screen readers and used as the table's caption. */
  ariaLabel = input.required<string>();
  /** Shown in the centre when there are no positive segments. */
  emptyLabel = input<string | undefined>(undefined);

  /** Emits the clicked, tapped or keyboard-chosen segment index. */
  segmentSelect = output<number>();

  protected readonly active = signal<number | null>(null);
  protected readonly isRtl = signal(false);
  private keyboard = false;
  private ready = false;

  protected readonly center = computed(() => this.size() / 2);
  protected readonly radius = computed(() => Math.max(4, (this.size() - this.thickness()) / 2));
  protected readonly emptyText = computed(() => this.emptyLabel() ?? this.strings.noData);

  protected readonly prepared = computed(() =>
    uiDonutPrepareSegments(this.segments(), this.strings.chartOther),
  );

  protected readonly arcs = computed<ArcSegment[]>(() => {
    const list = this.prepared();
    if (list.length === 0) return [];
    const c = this.center();
    const r = this.radius();
    const ccw = this.isRtl();
    // 2px gap in surface colour between adjacent segments
    const halfGap = list.length > 1 ? 1 / r : 0;
    let angle = -Math.PI / 2;

    return list.map((seg) => {
      const fullSweep = seg.drawShare * Math.PI * 2;
      const dir = ccw ? -1 : 1;
      const start = angle + dir * Math.min(halfGap, fullSweep / 4);
      const end = angle + dir * Math.max(fullSweep - halfGap, fullSweep / 2);
      angle += dir * fullSweep;

      const valueText = this.fmt(seg.value);
      const pctNum = seg.share * 100;
      const pctText = `${pctNum < 1 && pctNum > 0 ? pctNum.toFixed(1) : Math.round(pctNum)}%`;
      return {
        ...seg,
        path: list.length === 1 ? '' : describeArc(c, c, r, start, end, ccw),
        isCircle: list.length === 1,
        valueText,
        pctText,
        summary: `${seg.name}: ${valueText} (${pctText})`,
      };
    });
  });

  protected readonly activeArc = computed(() => {
    const i = this.active();
    return i === null ? null : (this.arcs()[i] ?? null);
  });

  protected readonly liveText = computed(() => {
    const arc = this.activeArc();
    return arc && this.keyboard ? arc.summary : '';
  });

  protected readonly tableRows = computed(() => {
    const segs = this.segments();
    const total = segs.reduce((sum, s) => sum + (typeof s.value === 'number' && Number.isFinite(s.value) && s.value > 0 ? s.value : 0), 0);
    return segs.map((s) => {
      const val = typeof s.value === 'number' && Number.isFinite(s.value) ? s.value : 0;
      const pctNum = total > 0 && val > 0 ? (val / total) * 100 : 0;
      const pctText = `${pctNum < 1 && pctNum > 0 ? pctNum.toFixed(1) : Math.round(pctNum)}%`;
      return { name: s.name, valueText: this.fmt(val), pctText };
    });
  });

  constructor() {
    afterNextRender(() => {
      this.syncDir();
      const win = this.doc.defaultView;
      const outside = (e: Event) => {
        if (this.active() !== null && !this.keyboard && !this.host.nativeElement.contains(e.target as Node)) this.active.set(null);
      };
      win?.addEventListener('pointerdown', outside, true);
      this.destroy.onDestroy(() => win?.removeEventListener('pointerdown', outside, true));
      this.ready = true;
    });
    effect(() => {
      this.segments();
      if (!this.ready) return;
      untracked(() => queueMicrotask(() => this.syncDir()));
    });
  }

  private syncDir(): void {
    const el = this.frame().nativeElement;
    const dir = this.doc.defaultView?.getComputedStyle(el).direction;
    const attrDir = el.closest('[dir]')?.getAttribute('dir');
    this.isRtl.set(dir === 'rtl' || attrDir === 'rtl');
  }

  protected fmt(v: number): string {
    const f = this.formatValue();
    return f ? f(v) : v.toLocaleString();
  }

  protected onEnter(i: number, e: PointerEvent): void {
    if (e.pointerType === 'touch') return;
    this.keyboard = false;
    this.active.set(i);
  }

  protected onLeave(e: PointerEvent): void {
    if (e.pointerType === 'touch' || this.keyboard) return;
    this.active.set(null);
  }

  protected onPick(i: number): void {
    this.keyboard = false;
    this.active.set(i);
    this.segmentSelect.emit(i);
  }

  protected onFocus(): void {
    let fromKeys = true;
    try { fromKeys = this.frame().nativeElement.matches(':focus-visible'); } catch { /* treat as keyboard */ }
    const n = this.arcs().length;
    if (!fromKeys || !n || this.active() !== null) return;
    const sel = this.selectedIndex();
    this.keyboard = true;
    this.active.set(typeof sel === 'number' && sel >= 0 && sel < n ? sel : 0);
  }

  protected onBlur(): void {
    this.keyboard = false;
    this.active.set(null);
  }

  protected onKey(e: KeyboardEvent): void {
    const n = this.arcs().length;
    if (!n) return;
    const cur = this.active();
    const rtl = this.doc.defaultView?.getComputedStyle(this.frame().nativeElement).direction === 'rtl';
    const back = rtl ? 'ArrowRight' : 'ArrowLeft';
    const forward = rtl ? 'ArrowLeft' : 'ArrowRight';
    let next: number | null = null;
    if (e.key === forward || e.key === 'ArrowDown') next = cur === null ? 0 : (cur + 1) % n;
    else if (e.key === back || e.key === 'ArrowUp') next = cur === null ? n - 1 : (cur - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else if (e.key === 'Escape') { if (cur !== null) { this.keyboard = false; this.active.set(null); e.preventDefault(); } return; }
    else if (e.key === 'Enter' || e.key === ' ') {
      if (cur !== null) { this.segmentSelect.emit(cur); e.preventDefault(); }
      return;
    } else return;
    e.preventDefault();
    this.keyboard = true;
    this.active.set(next);
  }
}
