import {
  AfterViewInit, Directive, ElementRef, NgZone, OnDestroy, effect, inject, input, output,
} from '@angular/core';

export type UiResizeEdge = 'e' | 's' | 'se';
export interface UiResizeEvent { width: number; height: number; }

/**
 * `uiResizable` — adds edge/corner resize handles (E, S, SE) to the host and
 * resizes it in place. Emits `(resized)` with the new dimensions. The host
 * should establish its own width/height (e.g. a sized box). Reusable behavior.
 * A small grip (two diagonal strokes) marks the draggable corner.
 */
@Directive({
  selector: '[uiResizable]',
  host: { '[style.position]': '"relative"' },
})
export class UiResizable implements AfterViewInit, OnDestroy {
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  private zone = inject(NgZone);

  minWidth = input(80);
  minHeight = input(48);
  disabled = input(false, { alias: 'uiResizableDisabled' });
  resized = output<UiResizeEvent>();

  private readonly handleEls: HTMLElement[] = [];
  private gripEl?: SVGSVGElement;

  constructor() {
    // No grip while resizing is off.
    effect(() => {
      const off = this.disabled();
      if (this.gripEl) this.gripEl.style.display = off ? 'none' : '';
    });
  }
  private edge: UiResizeEdge | null = null;
  private start = { x: 0, y: 0, w: 0, h: 0 };
  private readonly move = (e: PointerEvent) => this.onMove(e);
  private readonly up = () => this.onUp();

  ngAfterViewInit(): void {
    const edges: UiResizeEdge[] = ['e', 's', 'se'];
    for (const edge of edges) {
      const el = document.createElement('div');
      el.className = `ui-resize-handle ui-resize-${edge}`;
      Object.assign(el.style, this.styleFor(edge));
      if (edge === 'se') {
        this.gripEl = this.grip();
        this.gripEl.style.display = this.disabled() ? 'none' : '';
        el.appendChild(this.gripEl);
      }
      el.addEventListener('pointerdown', (e) => this.onDown(e, edge));
      this.host.nativeElement.appendChild(el);
      this.handleEls.push(el);
    }
  }

  /** Two short diagonal strokes in the corner: "this corner drags". */
  private grip(): SVGSVGElement {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 10 10');
    svg.setAttribute('width', '10');
    svg.setAttribute('height', '10');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('class', 'ui-resize-grip');
    Object.assign(svg.style, { position: 'absolute', right: '3px', bottom: '3px', pointerEvents: 'none', color: 'var(--ui-color-text-muted)' });
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M10 2L2 10M10 6L6 10');
    path.setAttribute('fill', 'none');
    path.setAttribute('stroke', 'currentColor');
    path.setAttribute('stroke-width', '1.5');
    path.setAttribute('stroke-linecap', 'round');
    svg.appendChild(path);
    return svg;
  }

  private styleFor(edge: UiResizeEdge): Partial<CSSStyleDeclaration> {
    const base: Partial<CSSStyleDeclaration> = { position: 'absolute', zIndex: '2', touchAction: 'none' };
    if (edge === 'e') return { ...base, top: '0', right: '0', width: '6px', height: '100%', cursor: 'ew-resize' };
    if (edge === 's') return { ...base, left: '0', bottom: '0', width: '100%', height: '6px', cursor: 'ns-resize' };
    return { ...base, right: '0', bottom: '0', width: '14px', height: '14px', cursor: 'nwse-resize' };
  }

  private onDown(e: PointerEvent, edge: UiResizeEdge): void {
    if (this.disabled() || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = this.host.nativeElement.getBoundingClientRect();
    this.edge = edge;
    this.start = { x: e.clientX, y: e.clientY, w: rect.width, h: rect.height };
    this.zone.runOutsideAngular(() => {
      document.addEventListener('pointermove', this.move);
      document.addEventListener('pointerup', this.up);
      document.addEventListener('pointercancel', this.up);
    });
  }

  private onMove(e: PointerEvent): void {
    if (!this.edge) return;
    let w = this.start.w;
    let h = this.start.h;
    if (this.edge === 'e' || this.edge === 'se') w = Math.max(this.minWidth(), this.start.w + (e.clientX - this.start.x));
    if (this.edge === 's' || this.edge === 'se') h = Math.max(this.minHeight(), this.start.h + (e.clientY - this.start.y));
    const el = this.host.nativeElement;
    el.style.width = `${w}px`;
    el.style.height = `${h}px`;
    this.zone.run(() => this.resized.emit({ width: w, height: h }));
  }

  private onUp(): void {
    this.edge = null;
    document.removeEventListener('pointermove', this.move);
    document.removeEventListener('pointerup', this.up);
    document.removeEventListener('pointercancel', this.up);
  }

  ngOnDestroy(): void {
    this.onUp();
  }
}
