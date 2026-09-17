import {
  Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, model, output, signal, untracked, viewChild,
} from '@angular/core';
import {
  UiPathBounds, UiPathContour, UiPathItem, UiPathXY, UiPointRef, deletePoint, insertPoint, moveHandle, movePoint,
  nearestOnPath, pathBounds, pathD, rotateContours, scaleContours, segmentCount, segmentPathD, translateContours,
} from './path';

let editorSeq = 0;

type Gesture =
  | { kind: 'point'; ref: UiPointRef; itemId: string }
  | { kind: 'handle'; ref: UiPointRef; side: 'in' | 'out'; itemId: string }
  | { kind: 'item'; itemId: string }
  | { kind: 'corner'; corner: 'nw' | 'ne' | 'se' | 'sw'; itemId: string; box: UiPathBounds }
  | { kind: 'rotate'; itemId: string; box: UiPathBounds }
  | { kind: 'segment'; itemId: string; contour: number; segment: number }
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
}

/**
 * `ui-path-editor` — a vector editing surface. It draws `items` (outlines made of points with optional
 * curve handles, see `path.ts`) over an artboard and lets them be edited with a mouse or a finger.
 *
 * Two modes. **objects**: tap an item to select it, drag to move it, the corner knobs scale it and the
 * top knob rotates it. **points**: the selected item's points and handles show; drag them, tap an edge
 * to add a point there, Delete removes the selected point.
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
    '(keydown)': 'onKey($event)',
  },
  template: `
    <svg #svg class="surface" [attr.viewBox]="viewBox()" preserveAspectRatio="none"
      (pointerdown)="down($event)" (pointermove)="move($event)" (pointerup)="up($event)" (pointercancel)="cancel($event)"
      (wheel)="wheel($event)">
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
        <path class="item" [class.cut]="item.cut" [class.dim]="mode() === 'points' && item.id !== selectedId()"
          [attr.d]="d(item)" [attr.data-item]="item.id" fill-rule="nonzero"
          [attr.fill]="item.cut ? 'url(#' + hatchId + ')' : (item.fill || null)" />
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
          @if (activePoint(); as ap) {
            @if (ap.p.in) {
              <line class="arm" [attr.x1]="ap.p.x" [attr.y1]="ap.p.y" [attr.x2]="ap.p.in.x" [attr.y2]="ap.p.in.y" />
              <circle class="knob handle" [attr.cx]="ap.p.in.x" [attr.cy]="ap.p.in.y" [attr.r]="px(knob() * 0.8)" data-handle="in" />
            }
            @if (ap.p.out) {
              <line class="arm" [attr.x1]="ap.p.x" [attr.y1]="ap.p.y" [attr.x2]="ap.p.out.x" [attr.y2]="ap.p.out.y" />
              <circle class="knob handle" [attr.cx]="ap.p.out.x" [attr.cy]="ap.p.out.y" [attr.r]="px(knob() * 0.8)" data-handle="out" />
            }
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
    </svg>
  `,
  styles: `
    :host { display: block; position: relative; overflow: hidden; touch-action: none; outline: none; user-select: none;
      -webkit-user-select: none; background: var(--ui-color-surface-subtle); color: var(--ui-color-text); }
    :host(:focus-visible) { box-shadow: inset var(--ui-focus-ring); }
    .surface { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    .artboard { fill: var(--ui-color-surface); stroke: var(--ui-color-border-strong); stroke-dasharray: 4 4; vector-effect: non-scaling-stroke; }
    .item { fill: var(--ui-color-text-muted); stroke: none; cursor: pointer; }
    .item.dim { opacity: .28; }
    .item.cut { stroke: var(--ui-color-danger); stroke-dasharray: 5 4; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
    .hatch-bg { fill: color-mix(in srgb, var(--ui-color-danger) 10%, transparent); }
    .hatch-line { stroke: var(--ui-color-danger); stroke-width: 1.5; opacity: .55; }
    .frame-box { fill: none; stroke: var(--ui-color-primary); stroke-width: 1.5; vector-effect: non-scaling-stroke; pointer-events: none; }
    .frame-stem, .arm { stroke: var(--ui-color-primary); stroke-width: 1.25; vector-effect: non-scaling-stroke; pointer-events: none; }
    .knob { fill: var(--ui-color-surface); stroke: var(--ui-color-primary); stroke-width: 1.75; vector-effect: non-scaling-stroke; cursor: grab; }
    .knob.rotate { fill: var(--ui-color-primary); }
    .knob.point.on { fill: var(--ui-color-primary); }
    .knob.point.end { stroke-width: 2.5; }
    .knob.handle { fill: var(--ui-color-primary); stroke: var(--ui-color-surface); }
    .outline { fill: none; stroke: var(--ui-color-primary); stroke-width: 1.5; vector-effect: non-scaling-stroke; pointer-events: none; }
    .seg-hit { fill: none; stroke: transparent; stroke-width: 18; vector-effect: non-scaling-stroke; cursor: copy; }
  `,
})
export class UiPathEditor {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly svg = viewChild.required<ElementRef<SVGSVGElement>>('svg');

  readonly items = input.required<UiPathItem[]>();
  /** The artboard, in editor units. The view fits it on first layout and on `fit()`. */
  readonly width = input(100);
  readonly height = input(100);
  readonly mode = input<'objects' | 'points'>('objects');
  readonly selectedId = model<string | null>(null);
  readonly selectedPoint = model<UiPointRef | null>(null);
  readonly showArtboard = input(true);
  /** Keep proportions when scaling with the corner knobs (Shift does it once). */
  readonly lockAspect = input(false);
  readonly label = input('Shape editor');

  /** A finished edit: the whole list, for the host to keep (and undo). */
  readonly itemsChange = output<UiPathItem[]>();
  /** A point was tapped (not dragged) — hosts use it to pick ends to join. */
  readonly pointTap = output<UiPointRef>();

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
  protected readonly activePoint = computed(() => {
    const it = this.selectedItem();
    const ref = this.selectedPoint();
    const p = it && ref ? it.contours[ref.contour]?.points[ref.point] : null;
    return p ? { ref, p } : null;
  });

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
    const s = this.selectedPoint();
    return !!s && s.contour === contour && s.point === point;
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

  // ----- Pointer --------------------------------------------------------------------------------------

  protected down(e: PointerEvent): void {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    this.host.nativeElement.focus({ preventScroll: true });
    this.svg().nativeElement.setPointerCapture?.(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.pointers.size === 2) {
      // A second finger: whatever the first one was doing becomes a pinch.
      this.draft.set(null);
      this.drag = null;
      const [a, b] = [...this.pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: this.zoom(), world: this.toUnits(mid.x, mid.y) };
      return;
    }
    if (this.pointers.size > 2) return;

    const target = (e.target as Element).closest('[data-point],[data-handle],[data-corner],[data-rotate],[data-seg],[data-item]');
    const units = this.toUnits(e.clientX, e.clientY);
    const selected = this.selectedItem();
    let gesture: Gesture = { kind: 'empty' };

    if (target?.hasAttribute('data-point') && selected) {
      const [contour, point] = target.getAttribute('data-point')!.split(':').map(Number);
      gesture = { kind: 'point', ref: { contour, point }, itemId: selected.id };
      this.selectedPoint.set({ contour, point });
    } else if (target?.hasAttribute('data-handle') && selected && this.selectedPoint()) {
      gesture = { kind: 'handle', ref: this.selectedPoint()!, side: target.getAttribute('data-handle') as 'in' | 'out', itemId: selected.id };
    } else if (target?.hasAttribute('data-corner') && selected && this.selectedBox()) {
      gesture = { kind: 'corner', corner: target.getAttribute('data-corner') as 'nw', itemId: selected.id, box: this.selectedBox()! };
    } else if (target?.hasAttribute('data-rotate') && selected && this.selectedBox()) {
      gesture = { kind: 'rotate', itemId: selected.id, box: this.selectedBox()! };
    } else if (target?.hasAttribute('data-seg') && selected) {
      const [contour, segment] = target.getAttribute('data-seg')!.split(':').map(Number);
      gesture = { kind: 'segment', itemId: selected.id, contour, segment };
    } else if (target?.hasAttribute('data-item')) {
      const id = target.getAttribute('data-item')!;
      if (id !== this.selectedId()) {
        this.selectedId.set(id);
        this.selectedPoint.set(null);
      }
      gesture = this.mode() === 'objects' ? { kind: 'item', itemId: id } : { kind: 'empty' };
    }

    this.drag = {
      gesture, pointerId: e.pointerId, pointerType: e.pointerType,
      startClient: { x: e.clientX, y: e.clientY }, startUnits: units, startCenter: this.center(),
      origin: this.items(), moved: false,
    };
    e.preventDefault();
  }

  protected move(e: PointerEvent): void {
    if (!this.pointers.has(e.pointerId)) return;
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
    if (!d.moved) {
      const slop = d.pointerType === 'touch' ? 6 : 3;
      if (Math.hypot(e.clientX - d.startClient.x, e.clientY - d.startClient.y) < slop) return;
      d.moved = true;
    }
    const g = d.gesture;
    if (g.kind === 'empty' || g.kind === 'segment') {
      const p = this.pxPerUnit();
      this.center.set({ x: d.startCenter.x - (e.clientX - d.startClient.x) / p, y: d.startCenter.y - (e.clientY - d.startClient.y) / p });
      return;
    }
    const u = this.toUnits(e.clientX, e.clientY);
    this.draft.set(d.origin.map((item) => (item.id === g.itemId ? { ...item, contours: this.apply(g, item.contours, d, u, e) } : item)));
  }

  private apply(g: Gesture, contours: UiPathContour[], d: Drag, u: UiPathXY, e: PointerEvent): UiPathContour[] {
    switch (g.kind) {
      case 'point':
        return movePoint(contours, g.ref, u);
      case 'handle':
        return moveHandle(contours, g.ref, g.side, u, e.altKey);
      case 'item':
        return translateContours(contours, u.x - d.startUnits.x, u.y - d.startUnits.y);
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
    this.pointers.delete(e.pointerId);
    if (this.pinch) {
      if (this.pointers.size < 2) this.pinch = null;
      return;
    }
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    this.drag = null;
    const draft = this.draft();
    this.draft.set(null);
    if (d.moved) {
      if (draft) this.itemsChange.emit(draft);
      return;
    }
    const g = d.gesture;
    if (g.kind === 'point') {
      this.pointTap.emit(g.ref);
    } else if (g.kind === 'segment') {
      const item = this.items().find((i) => i.id === g.itemId);
      if (!item) return;
      const near = nearestOnPath(item.contours, d.startUnits);
      if (!near) return;
      const result = insertPoint(item.contours, near.contour, near.segment, near.t);
      this.itemsChange.emit(this.items().map((i) => (i.id === item.id ? { ...i, contours: result.contours } : i)));
      this.selectedPoint.set(result.point);
    } else if (g.kind === 'empty') {
      if (this.mode() === 'points') this.selectedPoint.set(null);
      else this.selectedId.set(null);
    }
  }

  protected cancel(e: PointerEvent): void {
    this.pointers.delete(e.pointerId);
    this.pinch = null;
    this.drag = null;
    this.draft.set(null);
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

  // ----- Keyboard -------------------------------------------------------------------------------------

  protected onKey(e: KeyboardEvent): void {
    const item = this.selectedItem();
    if (!item) return;
    if ((e.key === 'Delete' || e.key === 'Backspace') && this.mode() === 'points' && this.selectedPoint()) {
      e.preventDefault();
      const next = deletePoint(item.contours, this.selectedPoint()!);
      this.selectedPoint.set(null);
      this.itemsChange.emit(this.items().map((i) => (i.id === item.id ? { ...i, contours: next } : i)));
      return;
    }
    const step = e.shiftKey ? 10 : 1;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    let next: UiPathContour[];
    const ref = this.selectedPoint();
    if (this.mode() === 'points' && ref) {
      const p = item.contours[ref.contour]?.points[ref.point];
      if (!p) return;
      next = movePoint(item.contours, ref, { x: p.x + m[0], y: p.y + m[1] });
    } else {
      next = translateContours(item.contours, m[0], m[1]);
    }
    this.itemsChange.emit(this.items().map((i) => (i.id === item.id ? { ...i, contours: next } : i)));
  }
}
