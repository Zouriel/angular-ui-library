import { Component, DestroyRef, ElementRef, afterNextRender, computed, effect, inject, input, model, output, signal, untracked } from '@angular/core';
import { HugeiconsIconComponent, type IconSvgObject } from '@hugeicons/angular';
import FullScreenIcon from '@hugeicons/core-free-icons/FullScreenIcon';
import MinusSignIcon from '@hugeicons/core-free-icons/MinusSignIcon';
import PlusSignIcon from '@hugeicons/core-free-icons/PlusSignIcon';

export interface UiViewportView {
  /** Screen pixels the world is shifted by. */
  x: number;
  y: number;
  zoom: number;
}

export interface UiMinimapItem {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Highlighted (e.g. selected). */
  active?: boolean;
}

/**
 * `ui-canvas-viewport` — a pannable, zoomable surface for diagrams. Put the diagram inside, laid
 * out in world coordinates (0,0 at the top left, `contentWidth` × `contentHeight`).
 *
 * - Pan: drag empty space (mouse or one finger), scroll with a trackpad or wheel, or arrow keys.
 * - Zoom: Ctrl/⌘ + wheel or trackpad pinch, two-finger pinch on touch, `+`/`-`, or the buttons.
 * - `0` or the fit button shows everything.
 *
 * Children that handle their own pointer gestures (cards being dragged) should stop propagation of
 * `pointerdown`, or carry `data-viewport-no-pan`. Use `toWorld()` to turn pointer positions into
 * world coordinates.
 */
@Component({
  selector: 'ui-canvas-viewport',
  imports: [HugeiconsIconComponent],
  host: {
    class: 'ui-canvas-viewport',
    tabindex: '0',
    role: 'application',
    '[attr.aria-label]': 'label()',
    '[attr.aria-roledescription]': '"canvas"',
    '(pointerdown)': 'down($event)',
    '(wheel)': 'wheel($event)',
    '(keydown)': 'key($event)',
  },
  template: `
    <div class="world" [style.transform]="transform()" [style.width.px]="contentWidth()" [style.height.px]="contentHeight()">
      <ng-content />
    </div>
    @if (controls()) {
      <div class="controls" data-viewport-no-pan>
        <button type="button" (click)="zoomBy(1 / 1.2)" aria-label="Zoom out" title="Zoom out (−)"><hugeicons-icon aria-hidden="true" [icon]="icons.out" [size]="15" [strokeWidth]="1.8" /></button>
        <span class="pct">{{ pct() }}%</span>
        <button type="button" (click)="zoomBy(1.2)" aria-label="Zoom in" title="Zoom in (+)"><hugeicons-icon aria-hidden="true" [icon]="icons.in" [size]="15" [strokeWidth]="1.8" /></button>
        <button type="button" (click)="fit()" aria-label="Fit to view" title="Fit to view (0)"><hugeicons-icon aria-hidden="true" [icon]="icons.fit" [size]="15" [strokeWidth]="1.8" /></button>
      </div>
    }
    @if (minimap() && minimapItems().length && roomy()) {
      <svg class="minimap" data-viewport-no-pan [attr.viewBox]="'0 0 ' + mini().w + ' ' + mini().h" (pointerdown)="miniDown($event)" aria-hidden="true">
        @for (it of minimapItems(); track $index) {
          <rect [attr.x]="it.x * mini().s" [attr.y]="it.y * mini().s" [attr.width]="it.w * mini().s" [attr.height]="it.h * mini().s" rx="2" [class.active]="it.active" />
        }
        <rect class="view" [attr.x]="mini().vx" [attr.y]="mini().vy" [attr.width]="mini().vw" [attr.height]="mini().vh" rx="2" />
      </svg>
    }
  `,
  styles: `
    :host { display: block; position: relative; overflow: hidden; touch-action: none; outline: none; cursor: grab;
      background-color: var(--ui-color-bg);
      background-image: radial-gradient(color-mix(in srgb, var(--ui-color-text) 10%, transparent) 1px, transparent 1px);
      background-size: calc(18px * var(--ui-vp-zoom, 1)) calc(18px * var(--ui-vp-zoom, 1));
      background-position: var(--ui-vp-x, 0) var(--ui-vp-y, 0); }
    :host(.panning) { cursor: grabbing; }
    :host(:focus-visible) { box-shadow: inset 0 0 0 2px var(--ui-color-primary); }
    .world { position: absolute; left: 0; top: 0; transform-origin: 0 0; will-change: transform; }
    .controls { position: absolute; right: var(--ui-space-2); bottom: var(--ui-space-2); z-index: 2; display: flex; align-items: center; gap: 2px; padding: 2px;
      background: var(--ui-color-surface-raised, var(--ui-color-surface)); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); box-shadow: var(--ui-shadow-1); cursor: default; }
    .controls button { display: grid; place-items: center; width: 28px; height: 28px; padding: 0; border: 0; border-radius: var(--ui-radius-xs);
      background: transparent; color: var(--ui-color-text-secondary); cursor: pointer; }
    .controls button:hover { background: var(--ui-color-surface-hover); color: var(--ui-color-text); }
    .controls button:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    @media (pointer: coarse) { .controls button { width: 40px; height: 40px; } }
    .pct { min-width: 38px; text-align: center; font-size: 11.5px; font-variant-numeric: tabular-nums; color: var(--ui-color-text-muted); }
    .minimap { position: absolute; left: var(--ui-space-2); bottom: var(--ui-space-2); z-index: 2; width: 150px; height: auto; max-height: 110px; padding: 4px;
      background: var(--ui-color-surface-raised, var(--ui-color-surface)); border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); cursor: pointer; }
    .minimap rect { fill: color-mix(in srgb, var(--ui-color-text) 22%, transparent); }
    .minimap rect.active { fill: var(--ui-color-primary); }
    .minimap rect.view { fill: color-mix(in srgb, var(--ui-color-primary) 10%, transparent); stroke: var(--ui-color-primary); stroke-width: 1.5; }
  `,
})
export class UiCanvasViewport {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly contentWidth = input(800);
  readonly contentHeight = input(600);
  readonly minZoom = input(0.25);
  readonly maxZoom = input(2.5);
  /** Space kept around the content when fitting. */
  readonly padding = input(32);
  readonly controls = input(true);
  readonly minimap = input(false);
  readonly minimapItems = input<readonly UiMinimapItem[]>([]);
  readonly label = input('Diagram');
  /** The current view; two-way so a host can save and restore it. */
  readonly view = model<UiViewportView>({ x: 0, y: 0, zoom: 1 });
  /** A click on empty space (not after a pan). */
  readonly backgroundClick = output<void>();

  protected readonly icons: Record<'in' | 'out' | 'fit', IconSvgObject> = { in: PlusSignIcon as IconSvgObject, out: MinusSignIcon as IconSvgObject, fit: FullScreenIcon as IconSvgObject };
  protected readonly transform = computed(() => { const v = this.view(); return `translate(${v.x}px, ${v.y}px) scale(${v.zoom})`; });
  protected readonly pct = computed(() => Math.round(this.view().zoom * 100));
  private readonly size = signal({ w: 0, h: 0 });
  /** The minimap only shows where it can't cover much of the content. */
  protected readonly roomy = computed(() => this.size().w >= 520 && this.size().h >= 340);
  protected readonly mini = computed(() => {
    const cw = Math.max(1, this.contentWidth()), ch = Math.max(1, this.contentHeight());
    const s = 140 / Math.max(cw, ch);
    const v = this.view();
    const { w, h } = this.size();
    return { s, w: cw * s, h: ch * s, vx: (-v.x / v.zoom) * s, vy: (-v.y / v.zoom) * s, vw: (w / v.zoom) * s, vh: (h / v.zoom) * s };
  });

  private readonly pointers = new Map<number, { x: number; y: number }>();
  private pan: { x: number; y: number; vx: number; vy: number; moved: boolean } | null = null;
  private pinch: { dist: number; zoom: number; wx: number; wy: number } | null = null;
  /**
   * True until the person pans or zooms: until then the view keeps fitting the content as the canvas
   * resizes (a panel opening beside it) or the content changes. Clicking or dragging things on the
   * canvas doesn't count; a refit that comes up mid-drag waits for the pointer to lift.
   */
  private auto = true;
  private held = false;
  /** Window listeners of gestures in progress, removed when they end or the canvas goes away. */
  private readonly gestures = new Set<() => void>();
  private fitWhenReleased = false;

  constructor() {
    const destroy = inject(DestroyRef);
    destroy.onDestroy(() => { for (const end of [...this.gestures]) end(); });
    afterNextRender(() => {
      const el = this.host.nativeElement;
      const measure = () => {
        const r = el.getBoundingClientRect();
        this.size.set({ w: r.width, h: r.height });
        this.autoFit();
      };
      measure();
      const ro = new ResizeObserver(measure);
      ro.observe(el);
      destroy.onDestroy(() => ro.disconnect());
    });
    // New content (a state added, a layout tidied) refits too, as long as the person hasn't moved the view.
    effect(() => {
      this.contentWidth();
      this.contentHeight();
      untracked(() => this.autoFit());
    });
  }

  private autoFit(): void {
    if (!this.auto) return;
    if (this.held) this.fitWhenReleased = true;
    else this.fit();
  }

  private setView(v: UiViewportView): void {
    const el = this.host.nativeElement;
    el.style.setProperty('--ui-vp-zoom', String(v.zoom));
    el.style.setProperty('--ui-vp-x', `${v.x}px`);
    el.style.setProperty('--ui-vp-y', `${v.y}px`);
    this.view.set(v);
    this.auto = false;
  }

  /** The smallest zoom fitting uses; below it text is unreadable, so a large diagram starts at its left. */
  readonly fitMinZoom = input(0.6);

  private clamp(z: number): number {
    return Math.min(this.maxZoom(), Math.max(this.minZoom(), z));
  }

  /** World coordinates of a point on screen (e.g. a pointer event's clientX/Y). */
  toWorld(clientX: number, clientY: number): { x: number; y: number } {
    const r = this.host.nativeElement.getBoundingClientRect();
    const v = this.view();
    return { x: (clientX - r.left - v.x) / v.zoom, y: (clientY - r.top - v.y) / v.zoom };
  }

  /**
   * Shows all the content, centred, never zooming in past 100% or out past `fitMinZoom`. Content too
   * big for that is shown from its top-left corner (the minimap shows the rest).
   */
  fit(): void {
    const { w, h } = this.size();
    if (!w || !h) return;
    const p = this.padding();
    const cw = Math.max(1, this.contentWidth()), ch = Math.max(1, this.contentHeight());
    const zoom = this.clamp(Math.max(Math.min(this.fitMinZoom(), 1), Math.min(1, (w - p * 2) / cw, (h - p * 2) / ch)));
    // Too big to fit: start at the top-left edge (the content brings its own margin), not a padding in.
    const place = (room: number, size: number) => (size * zoom <= room - p * 2 ? (room - size * zoom) / 2 : 0);
    this.setView({ zoom, x: place(w, cw), y: place(h, ch) });
    this.auto = true;
  }

  /** Zooms around a screen point (the centre by default). */
  zoomBy(factor: number, clientX?: number, clientY?: number): void {
    const r = this.host.nativeElement.getBoundingClientRect();
    const cx = clientX ?? r.left + r.width / 2;
    const cy = clientY ?? r.top + r.height / 2;
    const v = this.view();
    const zoom = this.clamp(v.zoom * factor);
    const w = this.toWorld(cx, cy);
    this.setView({ zoom, x: cx - r.left - w.x * zoom, y: cy - r.top - w.y * zoom });
  }

  /** Scrolls so a world point is in the middle. */
  centerOn(x: number, y: number): void {
    const { w, h } = this.size();
    const z = this.view().zoom;
    this.setView({ zoom: z, x: w / 2 - x * z, y: h / 2 - y * z });
  }

  /** Scrolls just enough to bring a world rectangle into view. */
  reveal(x: number, y: number, rw: number, rh: number): void {
    const { w, h } = this.size();
    const v = this.view();
    const m = 24;
    let nx = v.x, ny = v.y;
    const sx = x * v.zoom + v.x, sy = y * v.zoom + v.y, ex = (x + rw) * v.zoom + v.x, ey = (y + rh) * v.zoom + v.y;
    if (sx < m) nx += m - sx; else if (ex > w - m) nx -= ex - (w - m);
    if (sy < m) ny += m - sy; else if (ey > h - m) ny -= ey - (h - m);
    if (nx !== v.x || ny !== v.y) this.setView({ ...v, x: nx, y: ny });
  }

  protected down(e: PointerEvent): void {
    // While a pointer is down (dragging a node, say), refits wait so nothing jumps mid-gesture.
    this.held = true;
    const release = this.track(['pointerup', 'pointercancel'], () => {
      release();
      this.held = false;
      if (this.fitWhenReleased) { this.fitWhenReleased = false; this.autoFit(); }
    });
    const target = e.target as HTMLElement;
    if (target.closest('[data-viewport-no-pan]')) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      // A second finger turns whatever the first was doing into a pinch.
      const [a, b] = [...this.pointers.values()];
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      const w = this.toWorld(mid.x, mid.y);
      this.pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom: this.view().zoom, wx: w.x, wy: w.y };
      this.pan = null;
    } else if (this.pointers.size === 1 && e.button === 0) {
      const v = this.view();
      this.pan = { x: e.clientX, y: e.clientY, vx: v.x, vy: v.y, moved: false };
    }
    const move = (ev: PointerEvent) => {
      if (!this.pointers.has(ev.pointerId)) return;
      this.pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (this.pinch && this.pointers.size >= 2) {
        const [a, b] = [...this.pointers.values()];
        const r = this.host.nativeElement.getBoundingClientRect();
        const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        const zoom = this.clamp((this.pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y)) / this.pinch.dist);
        this.setView({ zoom, x: mid.x - r.left - this.pinch.wx * zoom, y: mid.y - r.top - this.pinch.wy * zoom });
      } else if (this.pan) {
        const dx = ev.clientX - this.pan.x, dy = ev.clientY - this.pan.y;
        if (!this.pan.moved && Math.hypot(dx, dy) > 3) {
          this.pan.moved = true;
          this.host.nativeElement.classList.add('panning');
        }
        if (this.pan.moved) this.setView({ ...this.view(), x: this.pan.vx + dx, y: this.pan.vy + dy });
      }
    };
    const up = (ev: PointerEvent) => {
      if (!this.pointers.has(ev.pointerId)) return;
      this.pointers.delete(ev.pointerId);
      if (this.pointers.size < 2) this.pinch = null;
      if (this.pointers.size === 0) {
        const clicked = this.pan && !this.pan.moved && ev.type === 'pointerup';
        this.pan = null;
        this.host.nativeElement.classList.remove('panning');
        stopMove();
        stopUp();
        if (clicked) this.backgroundClick.emit();
      }
    };
    let stopMove = () => undefined as void, stopUp = () => undefined as void;
    if (this.pointers.size === 1) {
      stopMove = this.track(['pointermove'], move);
      stopUp = this.track(['pointerup', 'pointercancel'], up);
    }
  }

  protected wheel(e: WheelEvent): void {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Trackpad pinches arrive as ctrl+wheel with small deltas.
      this.zoomBy(Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0025)), e.clientX, e.clientY);
      return;
    }
    const v = this.view();
    const k = e.deltaMode === 1 ? 16 : 1;
    this.setView({ ...v, x: v.x - e.deltaX * k, y: v.y - e.deltaY * k });
  }

  protected key(e: KeyboardEvent): void {
    if (e.target !== this.host.nativeElement) return;
    const v = this.view();
    const step = 40;
    switch (e.key) {
      case '+': case '=': this.zoomBy(1.2); break;
      case '-': case '_': this.zoomBy(1 / 1.2); break;
      case '0': this.fit(); break;
      case 'ArrowLeft': this.setView({ ...v, x: v.x + step }); break;
      case 'ArrowRight': this.setView({ ...v, x: v.x - step }); break;
      case 'ArrowUp': this.setView({ ...v, y: v.y + step }); break;
      case 'ArrowDown': this.setView({ ...v, y: v.y - step }); break;
      default: return;
    }
    e.preventDefault();
  }

  protected miniDown(e: PointerEvent): void {
    e.stopPropagation();
    const svg = e.currentTarget as SVGSVGElement;
    const r = svg.getBoundingClientRect();
    const m = this.mini();
    const go = (cx: number, cy: number) => {
      const px = ((cx - r.left - 4) / Math.max(1, r.width - 8)) * m.w;
      const py = ((cy - r.top - 4) / Math.max(1, r.height - 8)) * m.h;
      this.centerOn(px / m.s, py / m.s);
    };
    go(e.clientX, e.clientY);
    const stopMove = this.track(['pointermove'], (ev) => go(ev.clientX, ev.clientY));
    const stopUp = this.track(['pointerup', 'pointercancel'], () => { stopMove(); stopUp(); });
  }

  /** Listens on the window for a gesture; returns the function that stops listening. */
  private track(types: ('pointermove' | 'pointerup' | 'pointercancel')[], fn: (e: PointerEvent) => void): () => void {
    for (const t of types) window.addEventListener(t, fn);
    const stop = () => {
      for (const t of types) window.removeEventListener(t, fn);
      this.gestures.delete(stop);
    };
    this.gestures.add(stop);
    return stop;
  }
}
