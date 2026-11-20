import { DOCUMENT } from '@angular/common';
import { Directive, ElementRef, NgZone, OnDestroy, inject, input, output, signal } from '@angular/core';
import { UI_LONG_PRESS_MS, UI_LONG_PRESS_SLOP } from '@zouriel/ui';
import { UI_DRAG_MOUSE_SLOP, UiDragService, type UiDragItemHandle } from './drag.service';

export { UI_LONG_PRESS_MS, UI_LONG_PRESS_SLOP } from '@zouriel/ui';

/**
 * `uiDragItem` — marks an element as draggable with a typed data payload onto any matching
 * `uiDropTarget`.
 *
 * - Mouse / pen: starts dragging after moving a few pixels (`UI_DRAG_MOUSE_SLOP`), so clicks still work.
 * - Touch: starts dragging after a long press (`UI_LONG_PRESS_MS`), so scrolling a list never starts a drag.
 * - Keyboard: focus the element and press Space or Enter to pick it up, Arrow keys to choose a valid
 *   target, Enter or Space to drop, and Escape to cancel.
 */
@Directive({
  selector: '[uiDragItem]',
  exportAs: 'uiDragItem',
  host: {
    '[attr.tabindex]': 'disabled() ? null : tabindex()',
    '[attr.aria-description]': 'disabled() ? null : description()',
    '[class.ui-drag-item--dragging]': 'isDragging()',
    '[attr.data-dragging]': 'isDragging() ? "" : null',
    '(pointerdown)': 'onPointerDown($event)',
    '(keydown)': 'onKeyDown($event)',
    '(contextmenu)': 'onContextMenu($event)',
    '(click)': 'onClick($event)',
    '(dragstart)': '$event.preventDefault()',
  },
})
export class UiDragItem<T = unknown> implements UiDragItemHandle<T>, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly doc = inject(DOCUMENT);
  private readonly zone = inject(NgZone);
  private readonly drag = inject(UiDragService);

  /** Data payload carried by this draggable item. */
  readonly data = input.required<T>({ alias: 'uiDragItem' });
  /** Human-readable name used in screen-reader announcements ("Dropped X on Y"). */
  readonly label = input('', { alias: 'uiDragLabel' });
  /** Disables dragging when true. */
  readonly disabled = input(false, { alias: 'uiDragDisabled' });
  /** Accessible description explaining how to move the item. */
  readonly description = input('Press Space or Enter to pick up, or drag and drop onto a target.', {
    alias: 'uiDragDescription',
  });
  /** Tab index applied when enabled so the item is keyboard-focusable. */
  readonly tabindex = input<number | string>(0);

  /** Emitted when a drag (pointer or keyboard) starts. */
  readonly dragStart = output<T>();
  /** Emitted when a drag is cancelled (Escape, pointer cancel, or dropped off target). */
  readonly dragCancel = output<T>();
  /** Emitted when a drag ends (whether dropped or cancelled). */
  readonly dragEnd = output<T>();

  /** True while this item is actively being dragged. */
  readonly isDragging = signal(false);

  private pendingPointerId: number | null = null;
  private pendingTouch = false;
  private startX = 0;
  private startY = 0;
  private lastX = 0;
  private lastY = 0;
  private pressTimer: ReturnType<typeof setTimeout> | null = null;
  private swallowClick = false;
  private swallowTimer: ReturnType<typeof setTimeout> | null = null;

  private readonly onPendingMoveBound = (e: PointerEvent) => this.onPendingMove(e);
  private readonly onPendingUpBound = (e: PointerEvent) => this.onPendingUp(e);
  private readonly onScrollBound = () => this.clearPending();

  get element(): HTMLElement {
    return this.host.nativeElement;
  }

  getPayload(): T {
    return this.data();
  }

  getLabel(): string {
    return this.label() || this.element.getAttribute('aria-label') || this.element.textContent?.trim() || 'item';
  }

  setDragging(dragging: boolean): void {
    this.isDragging.set(dragging);
    if (!dragging) {
      this.swallowClick = true;
      if (this.swallowTimer) clearTimeout(this.swallowTimer);
      this.swallowTimer = setTimeout(() => {
        this.swallowClick = false;
        this.swallowTimer = null;
      }, 0);
    }
  }

  notifyStart(payload: T): void {
    this.dragStart.emit(payload);
  }

  notifyCancel(payload: T): void {
    this.dragCancel.emit(payload);
  }

  notifyEnd(payload: T): void {
    this.dragEnd.emit(payload);
  }

  /** Programmatically starts a keyboard drag for this item. */
  startKeyboardDrag(): boolean {
    if (this.disabled()) return false;
    return this.drag.startKeyboardDrag(this);
  }

  protected onPointerDown(e: PointerEvent): void {
    if (this.disabled()) return;
    if (e.pointerType !== 'touch' && e.button !== 0) return;
    if (this.drag.active()) return;

    this.clearPending();
    this.pendingPointerId = e.pointerId;
    this.pendingTouch = e.pointerType === 'touch';
    this.startX = e.clientX;
    this.startY = e.clientY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;

    this.zone.runOutsideAngular(() => {
      this.doc.addEventListener('pointermove', this.onPendingMoveBound, true);
      this.doc.addEventListener('pointerup', this.onPendingUpBound, true);
      this.doc.addEventListener('pointercancel', this.onPendingUpBound, true);
      if (this.pendingTouch) {
        this.doc.defaultView?.addEventListener('scroll', this.onScrollBound, true);
      }
    });

    if (this.pendingTouch) {
      this.pressTimer = setTimeout(() => {
        this.pressTimer = null;
        if (this.pendingPointerId === null) return;
        const x = this.lastX;
        const y = this.lastY;
        this.clearPending();
        this.doc.defaultView?.navigator?.vibrate?.(10);
        this.zone.run(() => this.drag.startPointerDrag(this, x, y));
      }, UI_LONG_PRESS_MS);
    }
  }

  private onPendingMove(e: PointerEvent): void {
    if (this.pendingPointerId === null || e.pointerId !== this.pendingPointerId) return;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    const dist = Math.hypot(e.clientX - this.startX, e.clientY - this.startY);

    if (this.pendingTouch) {
      // Moving past slop before the long-press timer fires means the user is scrolling.
      if (dist > UI_LONG_PRESS_SLOP) {
        this.clearPending();
      }
      return;
    }

    if (dist >= UI_DRAG_MOUSE_SLOP) {
      const x = e.clientX;
      const y = e.clientY;
      this.clearPending();
      this.zone.run(() => this.drag.startPointerDrag(this, x, y));
    }
  }

  private onPendingUp(e: PointerEvent): void {
    if (this.pendingPointerId !== null && e.pointerId === this.pendingPointerId) {
      this.clearPending();
    }
  }

  protected onKeyDown(e: KeyboardEvent): void {
    if (this.disabled()) return;
    if (this.drag.active()) return;
    if (e.target !== this.element) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      this.drag.startKeyboardDrag(this);
    }
  }

  protected onContextMenu(e: MouseEvent): void {
    if (this.isDragging() || this.pendingTouch) {
      e.preventDefault();
    }
  }

  protected onClick(e: MouseEvent): void {
    if (this.swallowClick) {
      e.preventDefault();
      e.stopPropagation();
    }
  }

  private clearPending(): void {
    if (this.pressTimer !== null) {
      clearTimeout(this.pressTimer);
      this.pressTimer = null;
    }
    this.pendingPointerId = null;
    this.pendingTouch = false;
    this.doc.removeEventListener('pointermove', this.onPendingMoveBound, true);
    this.doc.removeEventListener('pointerup', this.onPendingUpBound, true);
    this.doc.removeEventListener('pointercancel', this.onPendingUpBound, true);
    this.doc.defaultView?.removeEventListener('scroll', this.onScrollBound, true);
  }

  ngOnDestroy(): void {
    this.clearPending();
    if (this.swallowTimer !== null) {
      clearTimeout(this.swallowTimer);
      this.swallowTimer = null;
    }
    if (this.drag.active()?.source === this) {
      this.drag.cancel();
    }
  }
}
