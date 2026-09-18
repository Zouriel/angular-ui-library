import {
  Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, model, output, signal, untracked, viewChild,
} from '@angular/core';
import {
  UiPathBounds, UiPathContour, UiPathItem, UiPathPoint, UiPathXY, UiPointRef, allPoints, deletePoints, insertPoint, itemOp,
  moveHandle, movePoints, nearestOnPath, pathBounds, pathD, pullHandles, rotateContours, scaleContours, segmentCount,
  segmentPathD, toggleSmooth, translateContours,
} from './path';
import {
  UiBrush, UiInkSample, UiInkShape, brushSteadiness, inkArea, inkPiece, inkRadiusAt, pieceD, recognizeShape, shapeSamples,
  simulatedPressure,
} from './ink';

let editorSeq = 0;
let itemSeq = 0;

export type UiPathEditorMode = 'objects' | 'points' | 'draw' | 'pen';

/** A finished stroke in draw mode: what was drawn, and the area it paints (see `ink.ts`). */
export interface UiInkStroke {
  samples: UiInkSample[];
  brush: UiBrush;
  /** Convex pieces whose union is the painted area. */
  pieces: UiPathXY[][];
  /** Set when the stroke was held at the end and snapped to a shape. */
  shape: UiInkShape | null;
}

type Gesture =
  | { kind: 'point'; ref: UiPointRef; itemId: string; group: UiPointRef[]; before: UiPointRef[]; select: 'single' | 'keep' }
  | { kind: 'handle'; ref: UiPointRef; side: 'in' | 'out'; itemId: string }
  | { kind: 'convert'; ref: UiPointRef; itemId: string }
  | { kind: 'item'; itemId: string }
  | { kind: 'corner'; corner: 'nw' | 'ne' | 'se' | 'sw'; itemId: string; box: UiPathBounds }
  | { kind: 'rotate'; itemId: string; box: UiPathBounds }
  | { kind: 'segment'; itemId: string; contour: number; segment: number }
  | { kind: 'marquee'; additive: boolean }
  | { kind: 'ink' }
  | { kind: 'anchor'; index: number; closing: boolean; last: boolean }
  | { kind: 'empty' };

interface Drag {
  gesture: Gesture;
  pointerId: number;
  pointerType: string;
  startClient: UiPathXY;
  startUnits: UiPathXY;
  startCenter: UiPathXY;
  origin: UiPathItem[];
  moved: boolean;
  /** A long press already did something; the release shouldn't. */
  pressed: boolean;
}

interface Ink {
  brush: UiBrush;
  samples: UiInkSample[];
  radii: number[];
  along: number;
  parts: string[];
  /** Where the pointer really is (the samples trail it slightly when the stroke is steadied). */
  raw: UiInkSample;
  snapped: UiInkShape | null;
  holdFrom: UiPathXY;
  pen: boolean;
}

const LONG_PRESS_MS = 450;
const HOLD_TO_SNAP_MS = 600;
const DOUBLE_TAP_MS = 320;

/**
 * `ui-path-editor` — a vector editing surface. It draws `items` (outlines made of points with optional
 * curve handles, see `path.ts`) over an artboard and lets them be edited with a mouse, a finger or a pen.
 *
 * Four modes:
 * - **objects**: tap an item to select it, drag to move it, the corner knobs scale it and the top knob
 *   rotates it.
 * - **points** (Photoshop's Direct Selection): the selected item's points and handles show. Drag a point
 *   or a handle; tap an edge to add a point; double-tap a point to switch it between corner and curve;
 *   Shift-click or long-press to select several and move them together; drag across empty space with a
 *   mouse or pen to select a box of them. Alt-drag a handle to bend one side only (or set
 *   `freeHandles`), Alt-drag a corner to pull curve handles out of it, and hold Shift to keep to 45°.
 * - **pen** (Photoshop's Pen): tap to place corners, drag to place a curve, tap the first point to close
 *   the shape, tap the last point (or press Enter) to finish an open line. Starting on a loose end of
 *   the selected item carries that line on.
 * - **draw**: paint with `brush`. Pens report pressure; a finger or mouse gets it from speed. Once a pen
 *   has been used, fingers move the view instead of drawing (palm rejection, as `fingerDraws` 'auto').
 *   Hold still at the end of a stroke to snap it to a line, circle, ellipse, rectangle or triangle.
 *   Each finished stroke is reported through `stroke`: the host decides what it becomes.
 *
 * The view zooms with a two-finger pinch or the wheel, and pans by dragging empty space (or with two
 * fingers). It never mutates `items`: a finished gesture is reported once through `itemsChange`, so
 * the host owns undo. While a gesture runs, a draft is drawn instead.
 */
@Component({
  selector: 'ui-path-editor',
  host: {
    class: 'ui-path-editor',
    tabindex: '0',
    role: 'application',
    '[attr.aria-label]': 'label()',
    '[attr.data-mode]': 'mode()',
    '(keydown)': 'onKey($event)',
  },
  template: `
    <svg #svg class="surface" [attr.viewBox]="viewBox()" preserveAspectRatio="none"
      (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up($event)" (pointercancel)="cancel($event)"
      (pointerleave)="hover.set(null)" (wheel)="wheel($event)">
      <defs>
        <pattern [attr.id]="hatchId" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="8" height="8" class="hatch-bg" />
          <line x1="0" y1="0" x2="0" y2="8" class="hatch-line" />
        </pattern>
      </defs>
      @if (showArtboard()) {
        <rect class="artboard" x="0" y="0" [attr.width]="width()" [attr.height]="height()" />
      }
      @for (item of view(); track item.id) {
        <path class="item" [class.cut]="op(item) === 'cut'" [class.intersect]="op(item) === 'intersect'" [class.exclude]="op(item) === 'exclude'"
          [class.dim]="mode() === 'points' && item.id !== selectedId()"
          [attr.d]="d(item)" [attr.data-item]="item.id" fill-rule="nonzero"
          [attr.fill]="op(item) === 'cut' ? 'url(#' + hatchId + ')' : (item.fill || null)" />
      }

      @if (inkD()) {
        <path class="ink" [class.eraser]="inkEraser()" [attr.d]="inkD()" fill-rule="nonzero" [attr.fill]="inkEraser() ? null : (fill() || null)" />
      }

      @if (mode() === 'objects' && selectedBox(); as b) {
        <g class="frame">
          <rect class="frame-box" [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" />
          <line class="frame-stem" [attr.x1]="b.x + b.w / 2" [attr.y1]="b.y" [attr.x2]="b.x + b.w / 2" [attr.y2]="b.y - px(28)" />
          <circle class="knob rotate" [attr.cx]="b.x + b.w / 2" [attr.cy]="b.y - px(28)" [attr.r]="px(knob())" data-rotate="1" />
          @for (c of corners(b); track c.id) {
            <circle class="knob" [attr.cx]="c.x" [attr.cy]="c.y" [attr.r]="px(knob())" [attr.data-corner]="c.id" />
          }
        </g>
      }

      @if (mode() === 'points' && selectedItem(); as it) {
        <g class="points">
          <path class="outline" [attr.d]="d(it)" />
          @for (c of it.contours; track $index; let ci = $index) {
            @for (s of segments(c); track s) {
              <path class="seg-hit" [attr.d]="segD(c, s)" [attr.data-seg]="ci + ':' + s" />
            }
          }
          @for (h of handles(); track h.key) {
            <line class="arm" [attr.x1]="h.from.x" [attr.y1]="h.from.y" [attr.x2]="h.at.x" [attr.y2]="h.at.y" />
            <circle class="knob handle" [attr.cx]="h.at.x" [attr.cy]="h.at.y" [attr.r]="px(knob() * 0.8)" [attr.data-handle]="h.key" />
          }
          @for (c of it.contours; track $index; let ci = $index) {
            @for (p of c.points; track $index; let pi = $index) {
              @if (p.in || p.out) {
                <circle class="knob point" [class.on]="isSelected(ci, pi)" [class.end]="!c.closed && (pi === 0 || pi === c.points.length - 1)"
                  [attr.cx]="p.x" [attr.cy]="p.y" [attr.r]="px(knob())" [attr.data-point]="ci + ':' + pi" />
              } @else {
                <rect class="knob point" [class.on]="isSelected(ci, pi)" [class.end]="!c.closed && (pi === 0 || pi === c.points.length - 1)"
                  [attr.x]="p.x - px(knob())" [attr.y]="p.y - px(knob())" [attr.width]="px(knob() * 2)" [attr.height]="px(knob() * 2)"
                  [attr.data-point]="ci + ':' + pi" />
              }
            }
          }
        </g>
      }

      @if (mode() === 'pen' && penPoints().length) {
        <g class="pen">
          <path class="pen-line" [attr.d]="penD()" />
          @if (rubberD(); as rb) { <path class="rubber" [attr.d]="rb" /> }
          @if (penPoints().at(-1); as lp) {
            @if (lp.in) {
              <line class="arm" [attr.x1]="lp.x" [attr.y1]="lp.y" [attr.x2]="lp.in.x" [attr.y2]="lp.in.y" />
              <circle class="knob handle" [attr.cx]="lp.in.x" [attr.cy]="lp.in.y" [attr.r]="px(knob() * 0.7)" />
            }
            @if (lp.out) {
              <line class="arm" [attr.x1]="lp.x" [attr.y1]="lp.y" [attr.x2]="lp.out.x" [attr.y2]="lp.out.y" />
              <circle class="knob handle" [attr.cx]="lp.out.x" [attr.cy]="lp.out.y" [attr.r]="px(knob() * 0.7)" />
            }
          }
          @for (p of penPoints(); track $index; let i = $index; let last = $last) {
            <rect class="knob point" [class.on]="last" [class.start]="i === 0 && penPoints().length > 1" [class.closable]="i === 0 && closable()"
              [attr.x]="p.x - px(knob())" [attr.y]="p.y - px(knob())" [attr.width]="px(knob() * 2)" [attr.height]="px(knob() * 2)" />
          }
        </g>
      }

      @if (marquee(); as m) {
        <rect class="marquee" [attr.x]="m.x" [attr.y]="m.y" [attr.width]="m.w" [attr.height]="m.h" />
      }
    </svg>
  `,
  styles: `
    :host { display: block; position: relative; overflow: hidden; touch-action: none; outline: none; user-select: none;
      -webkit-user-select: none; -webkit-touch-callout: none; background: var(--ui-color-surface-subtle); color: var(--ui-color-text); }
    :host(:focus-visible) { box-shadow: inset var(--ui-focus-ring); }
    :host([data-mode="draw"]), :host([data-mode="pen"]) { cursor: crosshair; }
    .surface { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .artboard { fill: var(--ui-color-surface); stroke: var(--ui-color-border-strong); stroke-dasharray: 4 4; vector-effect: non-scaling-stroke; }
    .item { fill: var(--ui-color-text-muted); stroke: none; cursor: pointer; }
    :host([data-mode="draw"]) .item, :host([data-mode="pen"]) .item { cursor: inherit; }
    .item.dim { opacity: .28; }
    .item.cut { stroke: var(--ui-color-danger); stroke-dasharray: 5 4; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
    .item.intersect, .item.exclude { fill-opacity: .45; stroke: var(--ui-color-primary); stroke-width: 1.5; vector-effect: non-scaling-stroke; }
    .item.intersect { stroke-dasharray: 2 3; }
    .item.exclude { stroke-dasharray: 8 3 2 3; }
    .hatch-bg { fill: color-mix(in srgb, var(--ui-color-danger) 10%, transparent); }
    .hatch-line { stroke: var(--ui-color-danger); stroke-width: 1.5; opacity: .55; }
    .ink { fill: var(--ui-color-text-muted); pointer-events: none; }
    .ink.eraser { fill: color-mix(in srgb, var(--ui-color-danger) 22%, transparent); stroke: var(--ui-color-danger); stroke-width: 1;
      stroke-dasharray: 3 3; vector-effect: non-scaling-stroke; }
    .frame-box { fill: none; stroke: var(--ui-color-primary); stroke-width: 1.5; vector-effect: non-scaling-stroke; pointer-events: none; }
    .frame-stem, .arm { stroke: var(--ui-color-primary); stroke-width: 1.25; vector-effect: non-scaling-stroke; pointer-events: none; }
    .knob { fill: var(--ui-color-surface); stroke: var(--ui-color-primary); stroke-width: 1.75; vector-effect: non-scaling-stroke; cursor: grab; }
    .knob.rotate { fill: var(--ui-color-primary); }
    .knob.point.on { fill: var(--ui-color-primary); }
    .knob.point.end { stroke-width: 2.5; }
    .knob.handle { fill: var(--ui-color-primary); stroke: var(--ui-color-surface); }
    .outline { fill: none; stroke: var(--ui-color-primary); stroke-width: 1.5; vector-effect: non-scaling-stroke; pointer-events: none; }
    .seg-hit { fill: none; stroke: transparent; stroke-width: 18; vector-effect: non-scaling-stroke; cursor: copy; }
    .pen { pointer-events: none; }
    .pen-line { fill: none; stroke: var(--ui-color-primary); stroke-width: 1.75; vector-effect: non-scaling-stroke; }
    .rubber { fill: none; stroke: var(--ui-color-primary); stroke-width: 1.25; stroke-dasharray: 4 4; opacity: .8; vector-effect: non-scaling-stroke; }
    .knob.point.start { stroke-width: 2.5; }
    .knob.point.closable { fill: var(--ui-color-primary); }
    .marquee { fill: color-mix(in srgb, var(--ui-color-primary) 10%, transparent); stroke: var(--ui-color-primary); stroke-width: 1;
      stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; pointer-events: none; }
  `,
})
export class UiPathEditor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');

  readonly items = input.required<UiPathItem[]>();
  /** The artboard, in editor units. The view fits it on first layout and on `fit()`. */
  readonly width = input(100);
  readonly height = input(100);
  readonly mode = input<UiPathEditorMode>('objects');
  readonly selectedId = model<string | null>(null);
  /** The point being worked on (the last one touched). */
  readonly selectedPoint = model<UiPointRef | null>(null);
  /** Every selected point of the selected item; `selectedPoint` is among them. */
  readonly selectedPoints = model<UiPointRef[]>([]);
  readonly showArtboard = input(true);
  /** Keep proportions when scaling with the corner knobs (Shift does it once). */
  readonly lockAspect = input(false);
  readonly label = input('Shape editor');
  /** The brush for draw mode. */
  readonly brush = input<UiBrush>({ kind: 'pen', size: 4 });
  /** Paint for what's drawn here: ink as it goes down, and items the pen makes. */
  readonly fill = input<string | null>(null);
  /**
   * Whether a finger draws in draw mode. 'auto': until a pen is used — then fingers pan and zoom, and a
   * palm resting on the screen doesn't draw.
   */
  readonly fingerDraws = input<boolean | 'auto'>('auto');
  /** Hold at the end of a stroke to snap it to a shape. */
  readonly snapToShape = input(true);
  /** Handles move independently (what Alt does once) — for touch, where there's no Alt key. */
  readonly freeHandles = input(false);

  /** A finished edit: the whole list, for the host to keep (and undo). */
  readonly itemsChange = output<UiPathItem[]>();
  /** A point was tapped (not dragged) — hosts use it to pick ends to join. */
  readonly pointTap = output<UiPointRef>();
  /** A stroke was drawn in draw mode (the eraser's included). */
  readonly stroke = output<UiInkStroke>();
  /** A pen touched the surface for the first time — fingers stop drawing now (with `fingerDraws` 'auto'). */
  readonly penDetected = output<void>();

  protected readonly hatchId = `ui-path-hatch-${editorSeq++}`;
  private readonly draft = signal<UiPathItem[] | null>(null);
  protected readonly view = computed(() => this.draft() ?? this.items());

  private readonly hostSize = signal({ w: 0, h: 0 });
  private readonly zoom = signal(1);
  private readonly center = signal<UiPathXY>({ x: 50, y: 50 });
  private readonly coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
  protected readonly knob = signal(this.coarse ? 9 : 6);

  /** Screen pixels per editor unit. */
  private readonly pxPerUnit = computed(() => {
    const { w, h } = this.hostSize();
    if (!w || !h) return 1;
    const fit = Math.min(w / (this.width() * 1.35), h / (this.height() * 1.35));
    return Math.max(0.01, fit * this.zoom());
  });

  protected readonly viewBox = computed(() => {
    const { w, h } = this.hostSize();
    const p = this.pxPerUnit();
    const vw = (w || 1) / p;
    const vh = (h || 1) / p;
    const c = this.center();
    return `${c.x - vw / 2} ${c.y - vh / 2} ${vw} ${vh}`;
  });

  protected readonly selectedItem = computed(() => this.view().find((i) => i.id === this.selectedId()) ?? null);
  protected readonly selectedBox = computed(() => {
    const it = this.selectedItem();
    return it ? pathBounds(it.contours) : null;
  });
  private readonly selectedKeys = computed(() => new Set(this.selectedPoints().map((r) => `${r.contour}:${r.point}`)));

  /** Handles of the selected points (the most recent few, so a big selection stays readable). */
  protected readonly handles = computed(() => {
    const it = this.selectedItem();
    if (!it) return [];
    const out: { key: string; from: UiPathXY; at: UiPathXY }[] = [];
    for (const ref of this.selectedPoints().slice(-8)) {
      const p = it.contours[ref.contour]?.points[ref.point];
      if (!p) continue;
      if (p.in) out.push({ key: `${ref.contour}:${ref.point}:in`, from: p, at: p.in });
      if (p.out) out.push({ key: `${ref.contour}:${ref.point}:out`, from: p, at: p.out });
    }
    return out;
  });

  // Draw mode.
  protected readonly inkD = signal('');
  protected readonly inkEraser = signal(false);
  private ink: Ink | null = null;
  private inkFrame = 0;
  private holdTimer: ReturnType<typeof setTimeout> | null = null;
  private penSeen = false;

  // Pen mode.
  protected readonly penPoints = signal<UiPathPoint[]>([]);
  /** An existing line being carried on, instead of a new item. */
  private penTarget: { itemId: string; contour: number } | null = null;
  protected readonly hover = signal<UiPathXY | null>(null);
  /** How many points the pen has placed on the path it's drawing (0 when it isn't drawing one). */
  readonly penCount = computed(() => this.penPoints().length);
  protected readonly penD = computed(() => pathD([{ closed: false, points: this.penPoints() }]));
  protected readonly closable = computed(() => {
    const pts = this.penPoints();
    const h = this.hover();
    return pts.length > 1 && !!h && this.near(h, pts[0]);
  });
  protected readonly rubberD = computed(() => {
    const pts = this.penPoints();
    const h = this.hover();
    const last = pts.at(-1);
    if (!last || !h) return null;
    const to = this.closable() ? pts[0] : h;
    const c1 = last.out ?? last;
    const c2 = this.closable() ? pts[0].in ?? pts[0] : to;
    return `M${last.x} ${last.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${to.x} ${to.y}`;
  });

  // Points mode.
  protected readonly marquee = signal<UiPathBounds | null>(null);
  private lastTap: { key: string; at: number } | null = null;
  private pressTimer: ReturnType<typeof setTimeout> | null = null;

  private drag: Drag | null = null;
  private readonly pointers = new Map<number, UiPathXY>();
  private pinch: { dist: number; zoom: number; world: UiPathXY } | null = null;

  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    // A new artboard is a new drawing: frame it (the host often sets the size just after creating this).
    effect(() => {
      this.width();
      this.height();
      untracked(() => this.fit());
    });
    // The point the host sets (or clears) is the selection, unless it's already part of it.
    effect(() => {
      const ref = this.selectedPoint();
      untracked(() => {
        if (!ref) {
          if (this.selectedPoints().length) this.selectedPoints.set([]);
        } else if (!this.selectedKeys().has(`${ref.contour}:${ref.point}`)) {
          this.selectedPoints.set([ref]);
        }
      });
    });
    // Leaving the pen finishes the path it was drawing; leaving draw mode drops a stroke in progress.
    effect(() => {
      const mode = this.mode();
      untracked(() => {
        if (mode !== 'pen' && this.penPoints().length) this.finishPen(false);
        if (mode !== 'draw') this.dropInk();
        this.marquee.set(null);
      });
    });
    afterNextRender(() => {
      const el = this.host.nativeElement;
      // Layout size, not the on-screen rect: opened inside a dialog that scales in, the rect is the
      // mid-animation size, and a transform finishing doesn't fire the observer to correct it.
      const measure = () => this.hostSize.set({ w: el.clientWidth, h: el.clientHeight });
      measure();
      this.fit();
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      this.destroyRef.onDestroy(() => ro.disconnect());
    });
    this.destroyRef.onDestroy(() => {
      this.clearHold();
      this.clearPress();
      cancelAnimationFrame(this.inkFrame);
    });
  }

  /** Frames the artboard and everything drawn, whichever reaches further. */
  fit(): void {
    const W = this.width();
    const H = this.height();
    const drawn = pathBounds(this.items().flatMap((i) => i.contours));
    const x0 = Math.min(0, drawn?.x ?? 0);
    const y0 = Math.min(0, drawn?.y ?? 0);
    const x1 = Math.max(W, drawn ? drawn.x + drawn.w : W);
    const y1 = Math.max(H, drawn ? drawn.y + drawn.h : H);
    const { w, h } = this.hostSize();
    const base = w && h ? Math.min(w / (W * 1.35), h / (H * 1.35)) : 1;
    const want = w && h ? Math.min(w / ((x1 - x0) * 1.35), h / ((y1 - y0) * 1.35)) : 1;
    this.zoom.set(Math.min(20, Math.max(0.2, want / base)));
    this.center.set({ x: (x0 + x1) / 2, y: (y0 + y1) / 2 });
  }

  /** Zooms by a factor about the middle of the view. */
  zoomBy(factor: number): void {
    this.zoom.update((z) => Math.min(20, Math.max(0.2, z * factor)));
  }

  /** Selects every point of the selected item. */
  selectAllPoints(): void {
    const it = this.selectedItem();
    if (!it) return;
    const all = allPoints(it.contours);
    this.selectedPoints.set(all);
    this.selectedPoint.set(all.at(-1) ?? null);
  }

  /**
   * Ends the path the pen is drawing: as a closed shape, or an open line. A new path becomes a new item
   * (selected); a line that was being carried on is replaced.
   */
  finishPen(closed: boolean): void {
    const pts = this.penPoints();
    const target = this.penTarget;
    this.penPoints.set([]);
    this.penTarget = null;
    this.hover.set(null);
    if (pts.length < 2) return;
    const contour: UiPathContour = { closed: closed && pts.length > 1, points: pts };
    const items = this.items();
    const owner = target ? items.find((i) => i.id === target.itemId) : null;
    if (owner && target) {
      const contours = owner.contours.map((c, i) => (i === target.contour ? contour : c));
      this.itemsChange.emit(items.map((i) => (i === owner ? { ...i, contours } : i)));
      return;
    }
    const item: UiPathItem = { id: `path${Date.now().toString(36)}${itemSeq++}`, contours: [contour], fill: this.fill() };
    this.itemsChange.emit([...items, item]);
    this.selectedId.set(item.id);
    this.selectedPoint.set(null);
  }

  /** Takes back the pen's last point (Backspace does the same). */
  undoPenPoint(): void {
    this.penPoints.update((pts) => pts.slice(0, -1));
  }

  /** Throws away the path the pen is drawing. */
  cancelPen(): void {
    this.penPoints.set([]);
    this.penTarget = null;
  }

  protected op(item: UiPathItem) {
    return itemOp(item);
  }

  protected d(item: UiPathItem): string {
    return pathD(item.contours);
  }

  protected segD(c: UiPathContour, s: number): string {
    return segmentPathD(c, s);
  }

  protected segments(c: UiPathContour): number[] {
    return Array.from({ length: segmentCount(c) }, (_, i) => i);
  }

  /** Screen pixels as editor units, for sizes that should look the same at any zoom. */
  protected px(n: number): number {
    return n / this.pxPerUnit();
  }

  protected isSelected(contour: number, point: number): boolean {
    return this.selectedKeys().has(`${contour}:${point}`);
  }

  protected corners(b: UiPathBounds) {
    return [
      { id: 'nw', x: b.x, y: b.y }, { id: 'ne', x: b.x + b.w, y: b.y },
      { id: 'se', x: b.x + b.w, y: b.y + b.h }, { id: 'sw', x: b.x, y: b.y + b.h },
    ];
  }

  private toUnits(clientX: number, clientY: number, center = this.center(), pxPerUnit = this.pxPerUnit()): UiPathXY {
    const r = this.host.nativeElement.getBoundingClientRect();
    return {
      x: center.x + (clientX - (r.left + r.width / 2)) / pxPerUnit,
      y: center.y + (clientY - (r.top + r.height / 2)) / pxPerUnit,
    };
  }

  /** Within a finger's reach of a point, on screen. */
  private near(a: UiPathXY, b: UiPathXY): boolean {
    return Math.hypot(a.x - b.x, a.y - b.y) * this.pxPerUnit() < this.knob() * 2.2;
  }

  // ----- Pointer --------------------------------------------------------------------------------------

  protected down(e: PointerEvent): void {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    const mode = this.mode();
    if (mode === 'draw' && e.pointerType === 'pen' && !this.penSeen) {
      this.penSeen = true;
      this.penDetected.emit();
    }
    // A pen is drawing: anything else touching the screen is a hand resting on it.
    if (this.ink?.pen && e.pointerType === 'touch') return;

    this.host.nativeElement.focus({ preventScroll: true });
    this.svg().nativeElement.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size === 2) {
      // A second finger: whatever the first one was doing becomes a pinch.
      this.draft.set(null);
      this.drag = null;
      this.dropInk();
      this.clearPress();
      this.marquee.set(null);
      const [a, b] = [...this.pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: this.zoom(), world: this.toUnits(mid.x, mid.y) };
      return;
    }
    if (this.pointers.size > 2) return;

    const units = this.toUnits(e.clientX, e.clientY);
    let gesture: Gesture;
    if (mode === 'draw') gesture = this.fingerNavigates(e) ? { kind: 'empty' } : { kind: 'ink' };
    else if (mode === 'pen') gesture = this.penDown(units, e);
    else gesture = this.editDown(e, units);

    this.drag = {
      gesture, pointerId: e.pointerId, pointerType: e.pointerType,
      startClient: { x: e.clientX, y: e.clientY }, startUnits: units, startCenter: this.center(),
      origin: this.items(), moved: false, pressed: false,
    };
    if (gesture.kind === 'ink') this.startInk(e, units);
    if (gesture.kind === 'point' && e.pointerType !== 'mouse') {
      // Long press adds the point to the selection (or takes it out) — the touch version of Shift-click.
      this.pressTimer = setTimeout(() => this.longPressPoint(), LONG_PRESS_MS);
    }
    e.preventDefault();
  }

  private fingerNavigates(e: PointerEvent): boolean {
    if (e.pointerType !== 'touch') return false;
    const setting = this.fingerDraws();
    return setting === 'auto' ? this.penSeen : !setting;
  }

  /** What a press means in objects and points modes. */
  private editDown(e: PointerEvent, units: UiPathXY): Gesture {
    const target = (e.target as Element).closest('[data-point],[data-handle],[data-corner],[data-rotate],[data-seg],[data-item]');
    const selected = this.selectedItem();
    const mode = this.mode();

    if (target?.hasAttribute('data-point') && selected) {
      const [contour, point] = target.getAttribute('data-point')!.split(':').map(Number);
      const ref = { contour, point };
      const before = this.selectedPoints();
      const inSelection = this.selectedKeys().has(`${contour}:${point}`);
      if (e.altKey) return { kind: 'convert', ref, itemId: selected.id };
      if (e.shiftKey) {
        // Shift-click: add it (or take it out) and carry on dragging the whole selection.
        const next = inSelection ? before.filter((r) => r.contour !== contour || r.point !== point) : [...before, ref];
        this.selectedPoints.set(next);
        this.selectedPoint.set(inSelection ? next.at(-1) ?? null : ref);
        return { kind: 'point', ref, itemId: selected.id, group: next, before, select: 'keep' };
      }
      if (inSelection) {
        this.selectedPoint.set(ref);
        return { kind: 'point', ref, itemId: selected.id, group: before, before, select: 'keep' };
      }
      // A plain press on another point selects just it — once it's clear this isn't a long press.
      return { kind: 'point', ref, itemId: selected.id, group: [ref], before, select: 'single' };
    }
    if (target?.hasAttribute('data-handle') && selected) {
      const [contour, point, side] = target.getAttribute('data-handle')!.split(':');
      const ref = { contour: Number(contour), point: Number(point) };
      this.selectedPoint.set(ref);
      return { kind: 'handle', ref, side: side as 'in' | 'out', itemId: selected.id };
    }
    if (target?.hasAttribute('data-corner') && selected && this.selectedBox()) {
      return { kind: 'corner', corner: target.getAttribute('data-corner') as 'nw', itemId: selected.id, box: this.selectedBox()! };
    }
    if (target?.hasAttribute('data-rotate') && selected && this.selectedBox()) {
      return { kind: 'rotate', itemId: selected.id, box: this.selectedBox()! };
    }
    if (target?.hasAttribute('data-seg') && selected) {
      const [contour, segment] = target.getAttribute('data-seg')!.split(':').map(Number);
      return { kind: 'segment', itemId: selected.id, contour, segment };
    }
    if (target?.hasAttribute('data-item')) {
      const id = target.getAttribute('data-item')!;
      if (id !== this.selectedId()) {
        this.selectedId.set(id);
        this.selectedPoint.set(null);
      }
      if (mode === 'objects') return { kind: 'item', itemId: id };
    }
    // Empty space: a mouse or pen draws a selection box over points; a finger pans.
    if (mode === 'points' && e.pointerType !== 'touch') return { kind: 'marquee', additive: e.shiftKey };
    void units;
    return { kind: 'empty' };
  }

  protected move(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) {
      // Hovering (a mouse, or a pen above the screen): the pen shows where the next segment would go.
      if (this.mode() === 'pen' && e.pointerType !== 'touch') this.hover.set(this.constrained(this.toUnits(e.clientX, e.clientY), e));
      return;
    }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pinch && this.pointers.size >= 2) {
      const [a, b] = [...this.pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const dist = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      this.zoom.set(Math.min(20, Math.max(0.2, (this.pinch.zoom * dist) / this.pinch.dist)));
      // Keep the spot that was between the fingers between them.
      const p = this.pxPerUnit();
      const r = this.host.nativeElement.getBoundingClientRect();
      this.center.set({
        x: this.pinch.world.x - (mid.x - (r.left + r.width / 2)) / p,
        y: this.pinch.world.y - (mid.y - (r.top + r.height / 2)) / p,
      });
      return;
    }

    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    const g = d.gesture;
    if (g.kind === 'ink') {
      const events = e.getCoalescedEvents?.() ?? [];
      for (const ev of events.length ? events : [e]) this.addInk(ev);
      return;
    }
    if (!d.moved) {
      const slop = d.pointerType === 'touch' ? 6 : 3;
      if (Math.hypot(e.clientX - d.startClient.x, e.clientY - d.startClient.y) < slop) return;
      d.moved = true;
      this.clearPress();
      if (d.pressed) return;
      if (g.kind === 'point' && g.select === 'single') {
        this.selectedPoints.set([g.ref]);
        this.selectedPoint.set(g.ref);
      }
    }
    if (d.pressed) return;
    if (g.kind === 'empty' || g.kind === 'segment') {
      const p = this.pxPerUnit();
      this.center.set({ x: d.startCenter.x - (e.clientX - d.startClient.x) / p, y: d.startCenter.y - (e.clientY - d.startClient.y) / p });
      return;
    }
    const u = this.toUnits(e.clientX, e.clientY);
    if (g.kind === 'marquee') {
      const a = d.startUnits;
      this.marquee.set({ x: Math.min(a.x, u.x), y: Math.min(a.y, u.y), w: Math.abs(u.x - a.x), h: Math.abs(u.y - a.y) });
      return;
    }
    if (g.kind === 'anchor') {
      this.dragAnchor(g, u, e);
      return;
    }
    this.draft.set(d.origin.map((item) => (item.id === g.itemId ? { ...item, contours: this.apply(g, item.contours, d, u, e) } : item)));
  }

  private apply(g: Gesture, contours: UiPathContour[], d: Drag, u: UiPathXY, e: PointerEvent): UiPathContour[] {
    switch (g.kind) {
      case 'point': {
        let dx = u.x - d.startUnits.x;
        let dy = u.y - d.startUnits.y;
        if (e.shiftKey) [dx, dy] = snapAngle(dx, dy);
        return movePoints(contours, g.group, dx, dy);
      }
      case 'handle': {
        const p = contours[g.ref.contour]?.points[g.ref.point];
        if (!p) return contours;
        let to = u;
        if (e.shiftKey) {
          const [dx, dy] = snapAngle(u.x - p.x, u.y - p.y);
          to = { x: p.x + dx, y: p.y + dy };
        }
        return moveHandle(contours, g.ref, g.side, to, e.altKey || this.freeHandles());
      }
      case 'convert': {
        const p = contours[g.ref.contour]?.points[g.ref.point];
        if (!p) return contours;
        let to = u;
        if (e.shiftKey) {
          const [dx, dy] = snapAngle(u.x - p.x, u.y - p.y);
          to = { x: p.x + dx, y: p.y + dy };
        }
        return pullHandles(contours, g.ref, to);
      }
      case 'item': {
        let dx = u.x - d.startUnits.x;
        let dy = u.y - d.startUnits.y;
        if (e.shiftKey) [dx, dy] = snapAngle(dx, dy);
        return translateContours(contours, dx, dy);
      }
      case 'corner': {
        const b = g.box;
        const ox = g.corner.includes('w') ? b.x + b.w : b.x;
        const oy = g.corner.includes('n') ? b.y + b.h : b.y;
        const fx = g.corner.includes('w') ? b.x : b.x + b.w;
        const fy = g.corner.includes('n') ? b.y : b.y + b.h;
        let sx = Math.abs(fx - ox) < 1e-6 ? 1 : (u.x - ox) / (fx - ox);
        let sy = Math.abs(fy - oy) < 1e-6 ? 1 : (u.y - oy) / (fy - oy);
        if (this.lockAspect() || e.shiftKey) {
          const s = Math.max(Math.abs(sx), Math.abs(sy));
          sx = Math.sign(sx || 1) * s;
          sy = Math.sign(sy || 1) * s;
        }
        return scaleContours(contours, ox, oy, sx, sy);
      }
      case 'rotate': {
        const cx = g.box.x + g.box.w / 2;
        const cy = g.box.y + g.box.h / 2;
        const a0 = Math.atan2(d.startUnits.y - cy, d.startUnits.x - cx);
        const a1 = Math.atan2(u.y - cy, u.x - cx);
        let deg = ((a1 - a0) * 180) / Math.PI;
        if (e.shiftKey) deg = Math.round(deg / 15) * 15;
        else for (const r of [-180, -90, 0, 90, 180]) if (Math.abs(deg - r) < 3) deg = r;
        return rotateContours(contours, cx, cy, deg);
      }
      default:
        return contours;
    }
  }

  protected up(e: PointerEvent): void {
    if (!this.pointers.delete(e.pointerId)) return;
    this.clearPress();
    if (this.pinch) {
      if (this.pointers.size < 2) this.pinch = null;
      return;
    }
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    this.drag = null;
    const g = d.gesture;
    if (g.kind === 'ink') {
      this.addInk(e);
      this.finishInk();
      return;
    }
    if (g.kind === 'anchor') {
      if (g.closing) this.finishPen(true);
      else if (g.last && !d.moved) this.finishPen(false);
      return;
    }
    if (g.kind === 'marquee') {
      this.finishMarquee(g.additive);
      if (d.moved) return;
    }
    const draft = this.draft();
    this.draft.set(null);
    if (d.pressed) return;
    if (d.moved) {
      if (draft) this.itemsChange.emit(draft);
      return;
    }
    if (g.kind === 'point') {
      if (g.select === 'single') {
        this.selectedPoints.set([g.ref]);
        this.selectedPoint.set(g.ref);
      }
      // A second tap on the same point switches it between corner and curve.
      const key = `${g.itemId}:${g.ref.contour}:${g.ref.point}`;
      const now = performance.now();
      if (this.lastTap?.key === key && now - this.lastTap.at < DOUBLE_TAP_MS) {
        this.lastTap = null;
        const item = this.items().find((i) => i.id === g.itemId);
        if (item) this.itemsChange.emit(this.items().map((i) => (i === item ? { ...i, contours: toggleSmooth(i.contours, g.ref) } : i)));
        return;
      }
      this.lastTap = { key, at: now };
      this.pointTap.emit(g.ref);
    } else if (g.kind === 'segment') {
      const item = this.items().find((i) => i.id === g.itemId);
      if (!item) return;
      const near = nearestOnPath(item.contours, d.startUnits);
      if (!near) return;
      const result = insertPoint(item.contours, near.contour, near.segment, near.t);
      this.itemsChange.emit(this.items().map((i) => (i.id === item.id ? { ...i, contours: result.contours } : i)));
      this.selectedPoints.set([result.point]);
      this.selectedPoint.set(result.point);
    } else if (g.kind === 'empty' || g.kind === 'marquee') {
      if (this.mode() === 'points') this.selectedPoint.set(null);
      else if (this.mode() === 'objects') this.selectedId.set(null);
    }
  }

  protected cancel(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    this.pinch = null;
    if (this.drag?.pointerId === e.pointerId || !this.pointers.size) {
      this.drag = null;
      this.draft.set(null);
      this.dropInk();
      this.marquee.set(null);
      this.clearPress();
    }
  }

  protected wheel(e: WheelEvent): void {
    e.preventDefault();
    const world = this.toUnits(e.clientX, e.clientY);
    const factor = Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015));
    this.zoom.update((z) => Math.min(20, Math.max(0.2, z * factor)));
    const p = this.pxPerUnit();
    const r = this.host.nativeElement.getBoundingClientRect();
    this.center.set({ x: world.x - (e.clientX - (r.left + r.width / 2)) / p, y: world.y - (e.clientY - (r.top + r.height / 2)) / p });
  }

  // ----- Points ---------------------------------------------------------------------------------------

  private longPressPoint(): void {
    this.pressTimer = null;
    const d = this.drag;
    if (!d || d.moved || d.gesture.kind !== 'point') return;
    const g = d.gesture;
    d.pressed = true;
    const key = `${g.ref.contour}:${g.ref.point}`;
    const had = g.before.some((r) => `${r.contour}:${r.point}` === key);
    const next = had ? g.before.filter((r) => `${r.contour}:${r.point}` !== key) : [...g.before, g.ref];
    this.selectedPoints.set(next);
    this.selectedPoint.set(had ? next.at(-1) ?? null : g.ref);
    navigator.vibrate?.(12);
  }

  private clearPress(): void {
    if (this.pressTimer) clearTimeout(this.pressTimer);
    this.pressTimer = null;
  }

  private finishMarquee(additive: boolean): void {
    const m = this.marquee();
    this.marquee.set(null);
    if (!m || (m.w < 1e-6 && m.h < 1e-6)) return;
    const inside = (p: UiPathXY) => p.x >= m.x && p.x <= m.x + m.w && p.y >= m.y && p.y <= m.y + m.h;
    const hits = (item: UiPathItem) => allPoints(item.contours).filter((r) => inside(item.contours[r.contour].points[r.point]));
    // The selected item first; otherwise whichever item the box caught points of.
    let item = this.selectedItem();
    let refs = item ? hits(item) : [];
    if (!refs.length) {
      for (const other of [...this.items()].reverse()) {
        const h = hits(other);
        if (h.length) { item = other; refs = h; break; }
      }
    }
    if (!item || !refs.length) {
      if (!additive) this.selectedPoint.set(null);
      return;
    }
    if (item.id !== this.selectedId()) {
      this.selectedId.set(item.id);
      additive = false;
    }
    const base = additive ? this.selectedPoints() : [];
    const seen = new Set(base.map((r) => `${r.contour}:${r.point}`));
    const next = [...base, ...refs.filter((r) => !seen.has(`${r.contour}:${r.point}`))];
    this.selectedPoints.set(next);
    this.selectedPoint.set(next.at(-1) ?? null);
  }

  // ----- Pen ------------------------------------------------------------------------------------------

  private penDown(at: UiPathXY, e: PointerEvent): Gesture {
    const pts = this.penPoints();
    const u = this.constrained(at, e);
    if (pts.length > 1 && this.near(at, pts[0])) return { kind: 'anchor', index: 0, closing: true, last: false };
    if (pts.length && this.near(at, pts.at(-1)!)) return { kind: 'anchor', index: pts.length - 1, closing: false, last: true };
    if (!pts.length) {
      // Starting on a loose end of the selected item carries that line on.
      const item = this.items().find((i) => i.id === this.selectedId());
      const found = item?.contours.findIndex((c) => !c.closed && c.points.length > 1 && (this.near(at, c.points[0]) || this.near(at, c.points.at(-1)!))) ?? -1;
      if (item && found >= 0) {
        const c = item.contours[found];
        const fromStart = this.near(at, c.points[0]);
        this.penPoints.set(fromStart ? [...c.points].reverse().map((p) => ({ ...p, in: p.out ?? null, out: p.in ?? null })) : [...c.points]);
        this.penTarget = { itemId: item.id, contour: found };
        return { kind: 'anchor', index: c.points.length - 1, closing: false, last: false };
      }
    }
    this.penPoints.set([...pts, { x: u.x, y: u.y }]);
    this.hover.set(null);
    return { kind: 'anchor', index: pts.length, closing: false, last: false };
  }

  /** Dragging after placing a point pulls curve handles out of it, in line (Alt: the outgoing one only). */
  private dragAnchor(g: { index: number; closing: boolean; last: boolean }, u: UiPathXY, e: PointerEvent): void {
    this.penPoints.update((pts) => pts.map((p, i) => {
      if (i !== g.index) return p;
      let to = u;
      if (e.shiftKey) {
        const [dx, dy] = snapAngle(u.x - p.x, u.y - p.y);
        to = { x: p.x + dx, y: p.y + dy };
      }
      const mirrored = { x: 2 * p.x - to.x, y: 2 * p.y - to.y };
      if (g.closing) return { ...p, in: mirrored, out: e.altKey ? p.out ?? null : to };
      if (g.last) return { ...p, out: to };
      return { ...p, out: to, in: e.altKey && p.in ? p.in : mirrored };
    }));
  }

  /** With Shift, the next point keeps to 45° steps from the last. */
  private constrained(u: UiPathXY, e: { shiftKey: boolean }): UiPathXY {
    const last = this.penPoints().at(-1);
    if (!e.shiftKey || !last) return u;
    const [dx, dy] = snapAngle(u.x - last.x, u.y - last.y);
    return { x: last.x + dx, y: last.y + dy };
  }

  // ----- Ink ------------------------------------------------------------------------------------------

  private startInk(e: PointerEvent, u: UiPathXY): void {
    const brush = this.brush();
    const pen = e.pointerType === 'pen';
    const sample: UiInkSample = { x: u.x, y: u.y, pressure: pen ? e.pressure || 0.5 : simulatedPressure(brush.kind, 0.5, 0, brush.size) };
    const r = inkRadiusAt(sample, 0, brush);
    this.ink = {
      brush, samples: [sample], radii: [r], along: 0, parts: [pieceD(inkPiece(sample, r, null, 0, brush))],
      raw: sample, snapped: null, holdFrom: { x: e.clientX, y: e.clientY }, pen,
    };
    this.inkEraser.set(brush.kind === 'eraser');
    this.armHold();
    this.paintInk();
  }

  private addInk(e: PointerEvent): void {
    const ink = this.ink;
    if (!ink || ink.snapped) return;
    const brush = ink.brush;
    const u = this.toUnits(e.clientX, e.clientY);
    const last = ink.samples.at(-1)!;
    // Steady the line: each sample moves only part of the way to the pointer.
    const k = 1 - brushSteadiness(brush.kind);
    const at = { x: last.x + (u.x - last.x) * k, y: last.y + (u.y - last.y) * k };
    const dist = Math.hypot(at.x - last.x, at.y - last.y);
    const pressure = ink.pen ? e.pressure || last.pressure : simulatedPressure(brush.kind, last.pressure, dist, brush.size);
    ink.raw = { x: u.x, y: u.y, pressure };
    if (Math.hypot(e.clientX - ink.holdFrom.x, e.clientY - ink.holdFrom.y) > 5) {
      ink.holdFrom = { x: e.clientX, y: e.clientY };
      this.armHold();
    }
    // Closer than a quarter of the nib (or a couple of pixels) adds nothing but work.
    if (dist < Math.max(this.px(1.5), brush.size * 0.25)) return;
    const sample: UiInkSample = { x: at.x, y: at.y, pressure };
    ink.along += dist;
    const r = inkRadiusAt(sample, ink.along, brush);
    ink.parts.push(pieceD(inkPiece(last, ink.radii.at(-1)!, sample, r, brush)));
    ink.samples.push(sample);
    ink.radii.push(r);
    this.paintInk();
  }

  private finishInk(): void {
    const ink = this.ink;
    this.ink = null;
    this.clearHold();
    cancelAnimationFrame(this.inkFrame);
    this.inkD.set('');
    if (!ink) return;
    let samples = ink.snapped ? this.snappedSamples(ink) : [...ink.samples];
    if (!ink.snapped) {
      // Finish where the pointer actually lifted, not where the steadied line had got to.
      const last = samples.at(-1)!;
      if (Math.hypot(ink.raw.x - last.x, ink.raw.y - last.y) > ink.brush.size * 0.1) samples = [...samples, ink.raw];
    }
    this.stroke.emit({ samples, brush: ink.brush, pieces: inkArea(samples, ink.brush), shape: ink.snapped });
  }

  private dropInk(): void {
    this.ink = null;
    this.clearHold();
    cancelAnimationFrame(this.inkFrame);
    this.inkD.set('');
  }

  private paintInk(): void {
    cancelAnimationFrame(this.inkFrame);
    this.inkFrame = requestAnimationFrame(() => this.inkD.set(this.ink ? this.ink.parts.join('') : ''));
  }

  private armHold(): void {
    this.clearHold();
    if (!this.snapToShape() || this.brush().kind === 'eraser') return;
    this.holdTimer = setTimeout(() => this.snapInk(), HOLD_TO_SNAP_MS);
  }

  private clearHold(): void {
    if (this.holdTimer) clearTimeout(this.holdTimer);
    this.holdTimer = null;
  }

  /** Held still: if the stroke looks like a shape, it becomes that shape. */
  private snapInk(): void {
    this.holdTimer = null;
    const ink = this.ink;
    if (!ink || ink.snapped || ink.samples.length < 4) return;
    const shape = recognizeShape([...ink.samples, ink.raw]);
    if (!shape) return;
    ink.snapped = shape;
    this.inkD.set(inkArea(this.snappedSamples(ink), ink.brush).map(pieceD).join(''));
    navigator.vibrate?.(12);
  }

  private snappedSamples(ink: Ink): UiInkSample[] {
    const pressure = ink.samples.reduce((s, p) => s + p.pressure, 0) / ink.samples.length;
    return shapeSamples(ink.snapped!, pressure, Math.max(this.px(2), ink.brush.size * 0.3));
  }

  // ----- Keyboard -------------------------------------------------------------------------------------

  protected onKey(e: KeyboardEvent): void {
    if (this.mode() === 'pen' && this.penPoints().length) {
      if (e.key === 'Enter' || e.key === 'Escape') {
        e.preventDefault();
        this.finishPen(false);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        this.undoPenPoint();
      }
      return;
    }
    const item = this.selectedItem();
    if (!item) return;
    const refs = this.selectedPoints();
    const pointsMode = this.mode() === 'points' && refs.length > 0;
    if ((e.key === 'Delete' || e.key === 'Backspace') && pointsMode) {
      e.preventDefault();
      const next = deletePoints(item.contours, refs);
      this.selectedPoint.set(null);
      this.itemsChange.emit(this.items().map((i) => (i.id === item.id ? { ...i, contours: next } : i)));
      return;
    }
    if (e.key === 'a' && (e.ctrlKey || e.metaKey) && this.mode() === 'points') {
      e.preventDefault();
      this.selectAllPoints();
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    const next = pointsMode ? movePoints(item.contours, refs, m[0], m[1]) : translateContours(item.contours, m[0], m[1]);
    this.itemsChange.emit(this.items().map((i) => (i.id === item.id ? { ...i, contours: next } : i)));
  }
}

/** Keeps a movement to the nearest 45° direction, the way Shift does in drawing apps. */
function snapAngle(dx: number, dy: number): [number, number] {
  const len = Math.hypot(dx, dy);
  if (!len) return [0, 0];
  const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  // Project onto the direction, so the pointer's distance along it is kept.
  const along = dx * Math.cos(a) + dy * Math.sin(a);
  return [Math.cos(a) * along, Math.sin(a) * along];
}
