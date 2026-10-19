import {
  Component, ElementRef, NgZone, OnDestroy, OnInit, computed, effect, inject, input, model, output, signal, untracked,
} from '@angular/core';
import { UI_CONFIG } from '@zouriel/ui';
import { UiDockSide, UiWindowBounds, UiWindowManager } from './window-manager';

/** How much of the title bar (in px, horizontally) a drag always leaves on screen. */
const GRAB_MARGIN = 48;
/** Title-bar height used when it can't be measured (no layout, e.g. in tests). */
const TITLEBAR_FALLBACK = 32;

type ResizeEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

/**
 * `ui-window` — floating, draggable, resizable window shell ("a window inside
 * the window"). Drag the title bar to move; drag near a screen edge to snap
 * (left/right half, maximize). A drag always leaves at least 48px of the title bar on screen, so
 * the window can be grabbed again. Resize from any edge/corner. Min/max/restore/
 * close chrome, focus-to-front z-index via {@link UiWindowManager}. Glass +
 * radius + open animation. Hosts any content via `<ng-content>`.
 *
 * `[(open)]` controls whether it is on screen: Close sets it false (and emits `closed`), and the
 * window unregisters from the manager until it is opened again.
 */
@Component({
  selector: 'ui-window',
  template: `
    @if (open()) {
    @if (snap()) { <div class="snap-preview" [style.left.px]="snapBounds().x" [style.top.px]="snapBounds().y"
                        [style.width.px]="snapBounds().width" [style.height.px]="snapBounds().height"></div> }
    <section
      class="ui-window"
      [class.glass]="glass()"
      [class.no-radius]="!radius()"
      [class.minimized]="minimized()"
      [style.left.px]="x()" [style.top.px]="y()"
      [style.width.px]="width()" [style.height.px]="minimized() ? null : height()"
      [style.z-index]="z()"
      role="dialog" [attr.aria-label]="title()"
      (pointerdown)="focus()"
      animate.enter="ui-window-open-enter"
      animate.leave="ui-window-close-leave">
      <header class="titlebar" (pointerdown)="startDrag($event)" (dblclick)="toggleMax()">
        <span class="title">{{ title() }}</span>
        <div class="chrome">
          <!-- Minimized, the first control brings the window back (it keeps a maximized size). -->
          <button type="button" class="ctl" [attr.aria-label]="minimized() ? 'Restore' : 'Minimize'" (pointerdown)="$event.stopPropagation()" (click)="minimized() ? unminimize() : minimize()">@if (minimized()) {<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4.5 3.5h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1zM3.5 6.5h9" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>} @else {<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4 8h8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>}</button>
          <button type="button" class="ctl" [attr.aria-label]="maximized() ? 'Restore' : 'Maximize'" (pointerdown)="$event.stopPropagation()" (click)="toggleMax()">@if (maximized()) {<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M3.5 6.5a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1zM6 3.5h5.5a1 1 0 0 1 1 1V10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>} @else {<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M4.5 3.5h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-7a1 1 0 0 1 1-1z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>}</button>
          <button type="button" class="ctl close" aria-label="Close" (pointerdown)="$event.stopPropagation()" (click)="close()"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
        </div>
      </header>
      @if (!minimized()) {
        <div class="body"><ng-content /></div>
      }
      @if (resizable() && !maximized() && !minimized()) {
        @for (edge of edges; track edge) {
          <div class="rz rz-{{edge}}" (pointerdown)="startResize($event, edge)"></div>
        }
      }
    </section>
    }
  `,
  styles: `
    :host { display: contents; }
    .ui-window {
      position: fixed; display: flex; flex-direction: column; box-sizing: border-box;
      min-width: 220px; min-height: 120px;
      background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius-lg);
      box-shadow: var(--ui-shadow-3); font-family: var(--ui-font-default); line-height: 1.35;
      overflow: hidden;
    }
    .ui-window.no-radius { border-radius: 0; }
    .ui-window.glass { background: var(--ui-glass-bg); backdrop-filter: blur(var(--ui-glass-blur)); border-color: var(--ui-glass-border); }
    .ui-window.minimized { min-height: 0; height: auto; }
    .titlebar { display: flex; align-items: center; justify-content: space-between; gap: var(--ui-space-3);
      height: calc(var(--ui-size-sm) + var(--ui-space-2)); box-sizing: border-box; padding: 0 var(--ui-space-1) 0 var(--ui-space-3); flex: none;
      background: var(--ui-color-surface-raised); border-bottom: 1px solid var(--ui-color-border);
      cursor: grab; user-select: none; touch-action: none; }
    .titlebar:active { cursor: grabbing; }
    .title { min-width: 0; font-size: var(--ui-font-size-sm); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .chrome { display: flex; flex: none; gap: 2px; }
    .ctl { position: relative; display: inline-grid; place-items: center; width: var(--ui-size-sm); height: var(--ui-size-sm); padding: 0;
      border: none; background: transparent; color: var(--ui-color-text-muted);
      border-radius: var(--ui-radius-xs); cursor: pointer; font: inherit; line-height: 1;
      transition: background var(--ui-motion-fast) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .ctl:hover { background: var(--ui-color-elevated-hover); color: var(--ui-color-text); }
    .ctl:active { transform: scale(var(--ui-scale-press)); }
    .ctl.close:hover { background: var(--ui-color-danger); color: var(--ui-color-danger-contrast); }
    .ctl:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    @media (pointer: coarse) {
      .ctl::before { content: ''; position: absolute; inset: calc((var(--ui-size-sm) - var(--ui-size-touch)) / 2) -1px; }
      .rz-n, .rz-s { height: 16px; } .rz-n { top: -8px; } .rz-s { bottom: -8px; }
      .rz-e, .rz-w { width: 16px; } .rz-e { right: -8px; } .rz-w { left: -8px; }
      .rz-ne, .rz-nw, .rz-se, .rz-sw { width: 24px; height: 24px; }
    }
    .body { flex: 1; overflow: auto; padding: var(--ui-space-4); }
    .rz { position: absolute; z-index: 3; touch-action: none; }
    .rz-n { top: -3px; left: 6px; right: 6px; height: 7px; cursor: ns-resize; }
    .rz-s { bottom: -3px; left: 6px; right: 6px; height: 7px; cursor: ns-resize; }
    .rz-e { right: -3px; top: 6px; bottom: 6px; width: 7px; cursor: ew-resize; }
    .rz-w { left: -3px; top: 6px; bottom: 6px; width: 7px; cursor: ew-resize; }
    .rz-ne { top: -3px; right: -3px; width: 12px; height: 12px; cursor: nesw-resize; }
    .rz-nw { top: -3px; left: -3px; width: 12px; height: 12px; cursor: nwse-resize; }
    .rz-se { bottom: -3px; right: -3px; width: 12px; height: 12px; cursor: nwse-resize; }
    .rz-sw { bottom: -3px; left: -3px; width: 12px; height: 12px; cursor: nesw-resize; }
    .snap-preview { position: fixed; z-index: calc(var(--ui-z-window) - 1); border-radius: var(--ui-radius-lg);
      background: color-mix(in srgb, var(--ui-color-primary) 22%, transparent);
      border: 2px solid var(--ui-color-primary); pointer-events: none;
      transition: left var(--ui-motion-fast) var(--ui-ease-standard), top var(--ui-motion-fast) var(--ui-ease-standard),
                  width var(--ui-motion-fast) var(--ui-ease-standard), height var(--ui-motion-fast) var(--ui-ease-standard); }
  `,
})
export class UiWindow implements OnInit, OnDestroy {
  private config = inject(UI_CONFIG);
  private mgr = inject(UiWindowManager);
  private zone = inject(NgZone);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  readonly id = this.mgr.nextId();

  open = model(true);
  title = input('Window');
  draggable = input(true);
  resizable = input(true);
  glass = input<boolean>(this.config.glass);
  radius = input<boolean>(this.config.radius);
  initialX = input(80);
  initialY = input(80);
  initialWidth = input(440);
  initialHeight = input(300);
  closed = output<void>();

  protected readonly edges: ResizeEdge[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'];
  protected readonly x = signal(0);
  protected readonly y = signal(0);
  protected readonly width = signal(440);
  protected readonly height = signal(300);
  protected readonly z = signal(1100);
  protected readonly maximized = signal(false);
  protected readonly minimized = signal(false);
  protected readonly snap = signal<UiDockSide>(null);
  private prev: UiWindowBounds | null = null;

  protected readonly snapBounds = computed(() => this.dockBounds(this.snap()));

  // ----- drag -----
  private dragStart = { px: 0, py: 0, x: 0, y: 0 };
  private dragging = false;
  private readonly dMove = (e: PointerEvent) => this.onDragMove(e);
  private readonly dUp = () => this.onDragUp();
  // ----- resize -----
  private rzEdge: ResizeEdge | null = null;
  private rzStart = { px: 0, py: 0, x: 0, y: 0, w: 0, h: 0 };
  private readonly rMove = (e: PointerEvent) => this.onResizeMove(e);
  private readonly rUp = () => this.onResizeUp();

  ngOnInit(): void {
    let x = this.initialX(), y = this.initialY(), w = this.initialWidth(), h = this.initialHeight();
    // Open fully on screen: on a phone the requested bounds can reach past the edge, and a title bar
    // that starts off-screen can't be grabbed to bring it back.
    if (typeof window !== 'undefined' && window.innerWidth > 0 && window.innerHeight > 0) {
      const vw = window.innerWidth, vh = window.innerHeight;
      w = Math.min(w, vw); h = Math.min(h, vh);
      x = Math.max(0, Math.min(x, vw - w)); y = Math.max(0, Math.min(y, vh - h));
    }
    this.x.set(x);
    this.y.set(y);
    this.width.set(w);
    this.height.set(h);
  }

  constructor() {
    // A closed window leaves the screen and the manager; opening it again brings it back in front.
    effect(() => {
      const open = this.open();
      untracked(() => {
        if (!open) { this.mgr.unregister(this.id); return; }
        this.mgr.register({
          id: this.id,
          minimize: () => this.minimized.set(true),
          restore: () => this.restore(),
          dock: (side) => this.dock(side),
          focus: () => this.focus(),
          setBounds: (b) => this.setBounds(b),
        });
        this.focus();
      });
    });
  }

  ngOnDestroy(): void {
    this.mgr.unregister(this.id);
    this.teardownDrag();
    this.teardownResize();
  }

  protected focus(): void {
    this.z.set(this.mgr.bringToFront(this.id));
  }

  // ---- dragging ----
  protected startDrag(e: PointerEvent): void {
    if (!this.draggable() || e.button !== 0) return;
    if (this.maximized()) { this.restore(); }
    this.dragging = true;
    this.dragStart = { px: e.clientX, py: e.clientY, x: this.x(), y: this.y() };
    this.zone.runOutsideAngular(() => {
      document.addEventListener('pointermove', this.dMove);
      document.addEventListener('pointerup', this.dUp);
      document.addEventListener('pointercancel', this.dUp);
    });
    e.preventDefault();
  }

  private onDragMove(e: PointerEvent): void {
    if (!this.dragging) return;
    const nx = this.dragStart.x + (e.clientX - this.dragStart.px);
    const ny = this.dragStart.y + (e.clientY - this.dragStart.py);
    const side = this.detectSnap(e.clientX, e.clientY);
    const { x, y } = this.clampToViewport(nx, ny);
    this.zone.run(() => {
      this.x.set(x);
      this.y.set(y);
      this.snap.set(side);
    });
  }

  private onDragUp(): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.teardownDrag();
    this.zone.run(() => {
      const side = this.snap();
      this.snap.set(null);
      if (side) this.dock(side);
    });
  }

  private teardownDrag(): void {
    document.removeEventListener('pointermove', this.dMove);
    document.removeEventListener('pointerup', this.dUp);
    document.removeEventListener('pointercancel', this.dUp);
  }

  /**
   * Keep enough of the title bar on screen to grab it again: at least {@link GRAB_MARGIN}px of it
   * horizontally, never above the top edge, and never below the bottom edge.
   */
  private clampToViewport(x: number, y: number): { x: number; y: number } {
    if (typeof window === 'undefined' || window.innerWidth <= 0 || window.innerHeight <= 0) return { x, y: Math.max(0, y) };
    const vw = window.innerWidth, vh = window.innerHeight;
    const w = this.width();
    const keep = Math.min(GRAB_MARGIN, w);
    const bar = this.titlebarHeight();
    return {
      x: Math.min(Math.max(x, keep - w), vw - keep),
      y: Math.max(0, Math.min(y, vh - bar)),
    };
  }

  private titlebarHeight(): number {
    const h = this.host.nativeElement.querySelector<HTMLElement>('.titlebar')?.getBoundingClientRect().height;
    return h && h > 0 ? h : TITLEBAR_FALLBACK;
  }

  private detectSnap(px: number, py: number): UiDockSide {
    const t = 24;
    if (py <= t) return 'maximize';
    if (px <= t) return 'left';
    if (px >= window.innerWidth - t) return 'right';
    if (py >= window.innerHeight - t) return 'bottom';
    return null;
  }

  // ---- resizing ----
  protected startResize(e: PointerEvent, edge: ResizeEdge): void {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    this.rzEdge = edge;
    this.rzStart = { px: e.clientX, py: e.clientY, x: this.x(), y: this.y(), w: this.width(), h: this.height() };
    this.zone.runOutsideAngular(() => {
      document.addEventListener('pointermove', this.rMove);
      document.addEventListener('pointerup', this.rUp);
      document.addEventListener('pointercancel', this.rUp);
    });
  }

  private onResizeMove(e: PointerEvent): void {
    if (!this.rzEdge) return;
    const dx = e.clientX - this.rzStart.px;
    const dy = e.clientY - this.rzStart.py;
    const minW = 220, minH = 120;
    let { x, y, w, h } = this.rzStart;
    const edge = this.rzEdge;
    if (edge.includes('e')) w = Math.max(minW, this.rzStart.w + dx);
    if (edge.includes('s')) h = Math.max(minH, this.rzStart.h + dy);
    if (edge.includes('w')) { w = Math.max(minW, this.rzStart.w - dx); x = this.rzStart.x + (this.rzStart.w - w); }
    if (edge.includes('n')) { h = Math.max(minH, this.rzStart.h - dy); y = this.rzStart.y + (this.rzStart.h - h); }
    this.zone.run(() => {
      this.x.set(x); this.y.set(y); this.width.set(w); this.height.set(h);
    });
  }

  private onResizeUp(): void {
    this.rzEdge = null;
    this.teardownResize();
  }

  private teardownResize(): void {
    document.removeEventListener('pointermove', this.rMove);
    document.removeEventListener('pointerup', this.rUp);
    document.removeEventListener('pointercancel', this.rUp);
  }

  // ---- chrome / docking ----
  protected toggleMax(): void {
    this.maximized() ? this.restore() : this.dock('maximize');
  }

  protected minimize(): void {
    this.minimized.set(true);
  }

  /** Back from minimized, to the size it had (maximized stays maximized). */
  protected unminimize(): void {
    this.minimized.set(false);
  }

  protected close(): void {
    this.open.set(false);
    this.closed.emit();
  }

  dock(side: UiDockSide): void {
    if (!side) { this.restore(); return; }
    if (!this.prev) this.prev = { x: this.x(), y: this.y(), width: this.width(), height: this.height() };
    const b = this.dockBounds(side);
    this.applyBounds(b);
    this.maximized.set(side === 'maximize');
    this.minimized.set(false);
  }

  restore(): void {
    this.maximized.set(false);
    this.minimized.set(false);
    if (this.prev) { this.applyBounds(this.prev); this.prev = null; }
  }

  setBounds(b: UiWindowBounds): void {
    this.prev = null;
    this.maximized.set(false);
    this.minimized.set(false);
    this.applyBounds(b);
  }

  private applyBounds(b: UiWindowBounds): void {
    this.x.set(b.x); this.y.set(b.y); this.width.set(b.width); this.height.set(b.height);
  }

  private dockBounds(side: UiDockSide): UiWindowBounds {
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
    switch (side) {
      case 'left': return { x: 0, y: 0, width: Math.floor(vw / 2), height: vh };
      case 'right': return { x: Math.ceil(vw / 2), y: 0, width: Math.floor(vw / 2), height: vh };
      case 'top': return { x: 0, y: 0, width: vw, height: Math.floor(vh / 2) };
      case 'bottom': return { x: 0, y: Math.ceil(vh / 2), width: vw, height: Math.floor(vh / 2) };
      case 'maximize': return { x: 0, y: 0, width: vw, height: vh };
      default: return { x: this.x(), y: this.y(), width: this.width(), height: this.height() };
    }
  }
}
