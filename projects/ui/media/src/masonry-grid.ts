import { DOCUMENT, NgTemplateOutlet, isPlatformBrowser } from '@angular/common';
import {
  Component, DestroyRef, Directive, ElementRef, PLATFORM_ID, TemplateRef, afterNextRender, afterRenderEffect,
  computed, contentChild, inject, input, model, signal,
} from '@angular/core';
import { UiPinch, type UiPinchStep } from '@zouriel/ui/behaviors';

/** A tile's place in the grid, in px from the grid's top-left corner. */
export interface UiMasonryRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * The masonry layout: column width `(width - gap*(columns-1)) / columns`; each item goes, in order, to
 * the shortest column so far (ties to the leftmost; heights within 0.001 count as equal), `gap` apart
 * down a column, `ratio` (height / width) times the column width tall. Same maths as the Flutter
 * `uiMasonryLayout`.
 */
export function uiMasonryLayout(
  width: number,
  ratios: readonly number[],
  columns: number,
  gap: number,
): { rects: UiMasonryRect[]; height: number } {
  const cols = Math.max(1, Math.floor(columns));
  const w = Math.max(0, (width - gap * (cols - 1)) / cols);
  const heights = new Array<number>(cols).fill(0);
  const counts = new Array<number>(cols).fill(0);
  const rects = ratios.map((raw) => {
    const ratio = Number.isFinite(raw) && raw > 0 ? raw : 1;
    let c = 0;
    for (let k = 1; k < cols; k++) if (heights[k] < heights[c] - 0.001) c = k;
    const y = heights[c] + (counts[c] > 0 ? gap : 0);
    const h = w * ratio;
    heights[c] = y + h;
    counts[c]++;
    return { x: c * (w + gap), y, width: w, height: h };
  });
  return { rects, height: Math.max(0, ...heights) };
}

/** Context of a `uiMasonryTile` template: the item's index. */
export interface UiMasonryTileContext {
  $implicit: number;
  index: number;
}

/**
 * Put on an `<ng-template>` inside ui-masonry-grid to draw one tile: `<ng-template uiMasonryTile let-i>`.
 * The content fills the tile (give pictures `width/height: 100%; object-fit: cover`).
 */
@Directive({ selector: 'ng-template[uiMasonryTile]' })
export class UiMasonryTile {
  readonly template = inject<TemplateRef<UiMasonryTileContext>>(TemplateRef);
  static ngTemplateContextGuard(_d: UiMasonryTile, ctx: unknown): ctx is UiMasonryTileContext {
    return true;
  }
}

/** How a tile moves: from where it was seen to its new place. */
interface Flight {
  from: UiMasonryRect;
  to: UiMasonryRect;
}

const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const lerpRect = (a: UiMasonryRect, b: UiMasonryRect, t: number): UiMasonryRect => ({
  x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), width: lerp(a.width, b.width, t), height: lerp(a.height, b.height, t),
});
const sameRect = (a: UiMasonryRect, b: UiMasonryRect): boolean =>
  Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01 && Math.abs(a.width - b.width) < 0.01;

/**
 * `ui-masonry-grid`: a photo grid of columns of different heights, each picture in its own shape, like a
 * phone's gallery, whose column count changes with a two-finger pinch (apart: fewer, bigger pictures;
 * together: more) and animates between sizes.
 *
 * `ratios` gives each item's height / width; `[(columns)]` is the count (clamped to `minColumns` to
 * `maxColumns`). When it changes, every tile on screen moves and grows or shrinks from where it was to
 * its new place (`duration` ms, ease-out), and a second pinch mid-way carries on from where the tiles
 * are. After a pinch the page scrolls so the picture under the fingers stays under them. Tiles off
 * screen just take their new place, so a 1,500-picture album costs no more than one screenful. With
 * reduced motion (or animations switched off) the change is instant. Tiles keep their identity
 * (`keyOf`), so nothing reloads.
 */
@Component({
  selector: 'ui-masonry-grid',
  imports: [NgTemplateOutlet, UiPinch],
  template: `
    <div class="grid" uiPinch [uiPinchDisabled]="!pinchable()" (uiPinchStep)="onStep($event)" [style.height.px]="layout().height">
      @for (r of layout().rects; track keyOf()($index); let i = $index) {
        <div class="cell" [attr.data-index]="i" [style.left.px]="r.x" [style.top.px]="r.y" [style.width.px]="r.width" [style.height.px]="r.height">
          @if (tile(); as t) {
            <ng-container *ngTemplateOutlet="t.template; context: { $implicit: i, index: i }" />
          }
        </div>
      }
    </div>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .grid { position: relative; width: 100%; overflow-anchor: none; }
    .cell { position: absolute; box-sizing: border-box; transform-origin: 0 0; }
    .cell > * { width: 100%; height: 100%; }
  `,
})
export class UiMasonryGrid {
  /** Each item's height / width. Its length is the number of tiles. */
  readonly ratios = input<readonly number[]>([]);
  /** Columns shown; a pinch changes it (two-way). */
  readonly columns = model(2);
  readonly gap = input(4);
  readonly minColumns = input(1);
  readonly maxColumns = input(5);
  /** Let a two-finger pinch change the column count. */
  readonly pinchable = input(true);
  /** How long the change between sizes takes (ms). */
  readonly duration = input(280);
  /** A stable identity per item (default: its index), so tiles survive a change of order. */
  readonly keyOf = input<(index: number) => unknown>((i: number) => i);

  protected readonly tile = contentChild(UiMasonryTile);

  private readonly hostEl = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly doc = inject(DOCUMENT);
  private readonly browser = isPlatformBrowser(inject(PLATFORM_ID));

  /** The grid's own width, measured. */
  readonly width = signal(0);

  /** Columns after clamping. */
  readonly shownColumns = computed(() =>
    Math.min(Math.max(1, this.maxColumns()), Math.max(Math.max(1, this.minColumns()), Math.round(this.columns()))),
  );

  readonly layout = computed(() => uiMasonryLayout(this.width(), this.ratios(), this.shownColumns(), this.gap()));

  /** What was on screen last, by key: where each tile was laid out. */
  private placed = new Map<unknown, UiMasonryRect>();
  private placedColumns = 0;
  private placedWidth = 0;
  /** Tiles in motion, by key. */
  private flights = new Map<unknown, Flight>();
  private startedAt = 0;
  private frameId: number | null = null;
  /** Set by a pinch step: keep this point of this tile under the fingers. */
  private anchor: { key: unknown; fx: number; fy: number; screenY: number } | null = null;

  constructor() {
    if (this.browser) {
      afterNextRender(() => this.width.set(this.hostEl.clientWidth));
      if (typeof ResizeObserver !== 'undefined') {
        const ro = new ResizeObserver(() => this.width.set(this.hostEl.clientWidth));
        ro.observe(this.hostEl);
        inject(DestroyRef).onDestroy(() => ro.disconnect());
      }
    }
    inject(DestroyRef).onDestroy(() => this.stopFrames());
    // Runs after the DOM has the new layout and before it is painted, so the first frame already
    // shows each tile where it was.
    afterRenderEffect(() => this.relaid(this.layout(), this.shownColumns(), this.width()));
  }

  /** Where a tile appears right now (mid-flight or at rest), in grid coordinates. */
  currentRect(index: number, now = this.now()): UiMasonryRect | null {
    const key = this.keyOf()(index);
    const flight = this.flights.get(key);
    if (flight) return lerpRect(flight.from, flight.to, this.progress(now));
    return this.placed.get(key) ?? null;
  }

  protected onStep(step: UiPinchStep): void {
    const next = Math.min(this.maxColumns(), Math.max(this.minColumns(), this.shownColumns() + (step.apart ? -1 : 1)));
    if (next === this.shownColumns()) return;
    this.anchor = this.anchorAt(step.x, step.y);
    this.columns.set(next);
  }

  /** The tile under a screen point (or the nearest), and where in it the point is. */
  private anchorAt(clientX: number, clientY: number): { key: unknown; fx: number; fy: number; screenY: number } | null {
    const box = this.hostEl.getBoundingClientRect();
    const px = clientX - box.left;
    const py = clientY - box.top;
    const now = this.now();
    let best: { key: unknown; rect: UiMasonryRect; d: number } | null = null;
    const n = this.ratios().length;
    for (let i = 0; i < n; i++) {
      const r = this.currentRect(i, now);
      if (!r) continue;
      const dx = Math.max(r.x - px, 0, px - (r.x + r.width));
      const dy = Math.max(r.y - py, 0, py - (r.y + r.height));
      const d = dx * dx + dy * dy;
      if (!best || d < best.d) best = { key: this.keyOf()(i), rect: r, d };
      if (d === 0) break;
    }
    if (!best) return null;
    const { rect } = best;
    return {
      key: best.key,
      fx: rect.width ? Math.min(1, Math.max(0, (px - rect.x) / rect.width)) : 0.5,
      fy: rect.height ? Math.min(1, Math.max(0, (py - rect.y) / rect.height)) : 0.5,
      screenY: clientY,
    };
  }

  private relaid(layout: { rects: UiMasonryRect[] }, columns: number, width: number): void {
    const keyOf = this.keyOf();
    const next = new Map<unknown, UiMasonryRect>();
    layout.rects.forEach((r, i) => next.set(keyOf(i), r));

    const animate = this.placedColumns > 0 && columns !== this.placedColumns && width === this.placedWidth && width > 0;
    const anchor = this.anchor;
    this.anchor = null;

    if (!animate) {
      // A new width, new items or a first render: everything just takes its place.
      this.flights.clear();
      this.stopFrames();
      this.placed = next;
      this.placedColumns = columns;
      this.placedWidth = width;
      this.applyTransforms();
      return;
    }

    // Where each tile appears now, before anything moves.
    const now = this.now();
    const t = this.progress(now);
    const seen = new Map<unknown, UiMasonryRect>();
    for (const [key, rect] of this.placed) {
      const flight = this.flights.get(key);
      seen.set(key, flight ? lerpRect(flight.from, flight.to, t) : rect);
    }

    // Keep the pinched picture under the fingers: scroll by however far its point moved.
    let shift = 0;
    if (anchor) {
      const to = next.get(anchor.key);
      if (to) {
        const top = this.hostEl.getBoundingClientRect().top;
        const want = top + to.y + anchor.fy * to.height - anchor.screenY;
        shift = this.scrollBy(want);
      }
    }

    // Only what is (or will be) on screen moves; the rest is placed at once.
    const top = this.hostEl.getBoundingClientRect().top;
    const view = this.doc.defaultView?.innerHeight || 800;
    const bandFrom = -top - view;
    const bandTo = -top + 2 * view;
    const inBand = (r: UiMasonryRect) => r.y + r.height >= bandFrom && r.y <= bandTo;

    const flights = new Map<unknown, Flight>();
    const reduced = this.reducedMotion();
    if (!reduced) {
      for (const [key, to] of next) {
        const was = seen.get(key);
        if (!was) continue;
        const from = { ...was, y: was.y + shift };
        if (sameRect(from, to) || !(inBand(from) || inBand(to))) continue;
        flights.set(key, { from, to });
      }
    }

    this.placed = next;
    this.placedColumns = columns;
    this.placedWidth = width;
    this.flights = flights;
    this.startedAt = now;
    this.applyTransforms(now);
    if (flights.size) this.startFrames();
    else this.stopFrames();
  }

  private progress(now: number): number {
    const d = this.duration();
    if (d <= 0) return 1;
    return easeOutCubic(Math.min(1, Math.max(0, (now - this.startedAt) / d)));
  }

  /** Moves each tile in flight to where it is at `now` (a transform over its new place). */
  private applyTransforms(now = this.now()): void {
    const t = this.progress(now);
    const keyOf = this.keyOf();
    const cells = this.hostEl.querySelectorAll<HTMLElement>('.cell');
    cells.forEach((cell) => {
      const key = keyOf(Number(cell.dataset['index']));
      const flight = this.flights.get(key);
      if (!flight || t >= 1) {
        if (cell.style.transform) cell.style.transform = '';
        return;
      }
      const at = lerpRect(flight.from, flight.to, t);
      const scale = flight.to.width > 0 ? at.width / flight.to.width : 1;
      cell.style.transform = `translate(${at.x - flight.to.x}px, ${at.y - flight.to.y}px) scale(${scale})`;
    });
  }

  private startFrames(): void {
    if (this.frameId !== null || !this.browser || typeof requestAnimationFrame === 'undefined') return;
    const tick = () => {
      const now = this.now();
      this.applyTransforms(now);
      if (now - this.startedAt >= this.duration()) {
        this.flights.clear();
        this.frameId = null;
        this.applyTransforms(now);
        return;
      }
      this.frameId = requestAnimationFrame(tick);
    };
    this.frameId = requestAnimationFrame(tick);
  }

  private stopFrames(): void {
    if (this.frameId !== null && typeof cancelAnimationFrame !== 'undefined') cancelAnimationFrame(this.frameId);
    this.frameId = null;
  }

  /** Scrolls the nearest scrolling ancestor (or the page) by `by` px; returns how far it really went. */
  private scrollBy(by: number): number {
    if (!by) return 0;
    let el: HTMLElement | null = this.hostEl.parentElement;
    const win = this.doc.defaultView;
    while (el && el !== this.doc.body && el !== this.doc.documentElement) {
      const style = win?.getComputedStyle(el);
      if (style && /(auto|scroll)/.test(style.overflowY) && el.scrollHeight > el.clientHeight) {
        const before = el.scrollTop;
        el.scrollTop = before + by;
        return el.scrollTop - before;
      }
      el = el.parentElement;
    }
    const root = (this.doc.scrollingElement ?? this.doc.documentElement) as HTMLElement | null;
    if (!root) return 0;
    const before = root.scrollTop;
    root.scrollTop = before + by;
    return root.scrollTop - before;
  }

  private reducedMotion(): boolean {
    if (this.doc.documentElement.classList.contains('ui-no-anim')) return true;
    if (this.hostEl.closest('.ui-no-anim')) return true;
    return !!this.doc.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  }

  private now(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }
}
