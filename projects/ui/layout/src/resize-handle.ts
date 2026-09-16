import { Component, NgZone, OnDestroy, inject, input, model, output } from '@angular/core';

/**
 * `ui-resize-handle` — a draggable edge that sets the size of the panel next to it. Put it on the
 * panel's inner edge and bind `[(size)]` (pixels). `edge` says where the handle sits relative to the
 * panel it sizes: a bottom panel's handle is on its `top`, so dragging up makes it bigger.
 *
 * Releasing near one of `snaps` settles on it. Double-click cycles through the snaps; arrow keys
 * resize by 16px (Shift: 64px); Home/End go to min/max.
 */
@Component({
  selector: 'ui-resize-handle',
  host: {
    class: 'ui-resize-handle',
    role: 'separator',
    tabindex: '0',
    '[attr.aria-orientation]': 'edge() === "top" || edge() === "bottom" ? "horizontal" : "vertical"',
    '[attr.aria-valuenow]': 'size()',
    '[attr.aria-valuemin]': 'min()',
    '[attr.aria-valuemax]': 'max()',
    '[attr.aria-label]': 'label()',
    '[attr.data-edge]': 'edge()',
    '(pointerdown)': 'start($event)',
    '(dblclick)': 'cycle()',
    '(keydown)': 'onKey($event)',
  },
  template: `<span class="grip" aria-hidden="true"></span>`,
  styles: `
    :host { position: relative; display: flex; align-items: center; justify-content: center; flex: none; touch-action: none; outline: none; z-index: 1; }
    :host([data-edge="top"]), :host([data-edge="bottom"]) { height: 8px; cursor: row-resize; }
    :host([data-edge="left"]), :host([data-edge="right"]) { width: 8px; cursor: col-resize; }
    .grip { border-radius: var(--ui-radius-pill); background: var(--ui-color-border-strong); transition: background var(--ui-motion-fast); }
    :host([data-edge="top"]) .grip, :host([data-edge="bottom"]) .grip { width: 36px; height: 3px; }
    :host([data-edge="left"]) .grip, :host([data-edge="right"]) .grip { width: 3px; height: 36px; }
    :host(:hover) .grip, :host(:focus-visible) .grip { background: var(--ui-color-primary); }
    :host(:focus-visible) { box-shadow: var(--ui-focus-ring); }
  `,
})
export class UiResizeHandle implements OnDestroy {
  private readonly zone = inject(NgZone);

  size = model(240);
  min = input(0);
  max = input(10000);
  snaps = input<readonly number[]>([]);
  /** Where the handle sits on the panel it resizes. */
  edge = input<'top' | 'bottom' | 'left' | 'right'>('top');
  label = input('Resize');
  /** Distance, in px, within which a release settles on a snap. */
  snapDistance = input(28);

  readonly resizeEnd = output<number>();

  private drag: { start: number; size: number; pointerId: number } | null = null;
  private readonly onMove = (e: PointerEvent) => this.move(e);
  private readonly onUp = (e: PointerEvent) => this.end(e);

  private clamp(v: number): number {
    return Math.round(Math.min(this.max(), Math.max(this.min(), v)));
  }

  protected start(e: PointerEvent): void {
    if (e.button !== 0) return;
    e.preventDefault();
    const vertical = this.edge() === 'top' || this.edge() === 'bottom';
    this.drag = { start: vertical ? e.clientY : e.clientX, size: this.size(), pointerId: e.pointerId };
    this.zone.runOutsideAngular(() => {
      window.addEventListener('pointermove', this.onMove);
      window.addEventListener('pointerup', this.onUp);
      window.addEventListener('pointercancel', this.onUp);
    });
  }

  private move(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    const edge = this.edge();
    const pos = edge === 'top' || edge === 'bottom' ? e.clientY : e.clientX;
    // Dragging away from the panel grows it: up for a top edge, left for a left edge.
    const delta = edge === 'top' || edge === 'left' ? d.start - pos : pos - d.start;
    this.zone.run(() => this.size.set(this.clamp(d.size + delta)));
  }

  private end(e: PointerEvent): void {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    this.detach();
    this.drag = null;
    this.zone.run(() => {
      const near = this.snaps().find((s) => Math.abs(s - this.size()) <= this.snapDistance());
      if (near !== undefined) this.size.set(this.clamp(near));
      this.resizeEnd.emit(this.size());
    });
  }

  protected cycle(): void {
    const snaps = [...this.snaps()].sort((a, b) => a - b);
    if (snaps.length === 0) return;
    const next = snaps.find((s) => s > this.size() + 1) ?? snaps[0];
    this.size.set(this.clamp(next));
    this.resizeEnd.emit(this.size());
  }

  protected onKey(e: KeyboardEvent): void {
    const step = e.shiftKey ? 64 : 16;
    const edge = this.edge();
    const growKeys = edge === 'top' ? ['ArrowUp'] : edge === 'bottom' ? ['ArrowDown'] : edge === 'left' ? ['ArrowLeft'] : ['ArrowRight'];
    const shrinkKeys = edge === 'top' ? ['ArrowDown'] : edge === 'bottom' ? ['ArrowUp'] : edge === 'left' ? ['ArrowRight'] : ['ArrowLeft'];
    let next: number | null = null;
    if (growKeys.includes(e.key)) next = this.size() + step;
    else if (shrinkKeys.includes(e.key)) next = this.size() - step;
    else if (e.key === 'Home') next = this.min();
    else if (e.key === 'End') next = this.max();
    if (next === null) return;
    e.preventDefault();
    this.size.set(this.clamp(next));
    this.resizeEnd.emit(this.size());
  }

  private detach(): void {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
  }

  ngOnDestroy(): void {
    this.detach();
  }
}
