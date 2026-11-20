import { Directive, ElementRef, OnDestroy, OnInit, computed, inject, input, output, signal } from '@angular/core';
import { UiDragService, type UiDropTargetHandle } from './drag.service';

/**
 * `uiDropTarget` — marks an element as a drop target for `uiDragItem` directives.
 *
 * Highlights with an accent ring while a valid dragged item is over it; ignores items for which
 * `uiDropAccepts` returns false. Emits `dropped` with the dragged payload on drop.
 */
@Directive({
  selector: '[uiDropTarget]',
  exportAs: 'uiDropTarget',
  host: {
    '[class.ui-drop-target--over]': 'isOver()',
    '[attr.data-drop-over]': 'isOver() ? "" : null',
    '[attr.data-drop-valid]': 'isValidTarget() ? "" : null',
  },
})
export class UiDropTarget<T = unknown> implements UiDropTargetHandle<T>, OnInit, OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly drag = inject(UiDragService);

  /** Human-readable name of this target for screen-reader announcements ("Dropped X on Y"). */
  readonly label = input('', { alias: 'uiDropTarget' });
  /** Predicate that decides whether the dragged payload can be dropped here. Defaults to accepting all. */
  readonly accepts = input<(payload: T) => boolean>(() => true, { alias: 'uiDropAccepts' });
  /** Disables dropping on this target when true. */
  readonly disabled = input(false, { alias: 'uiDropDisabled' });

  /** Emitted with the dragged payload when a valid item is dropped onto this target. */
  readonly dropped = output<T>();
  /** Emitted when a valid dragged item enters (`true`) or leaves (`false`) this target. */
  readonly dragOver = output<boolean>();

  /** True while a valid dragged item is hovering over this target. */
  readonly isOver = signal(false);

  /** True while any drag is active and this target accepts its payload. */
  readonly isValidTarget = computed(() => {
    const session = this.drag.active();
    if (!session || this.disabled()) return false;
    return this.canAccept(session.payload);
  });

  get element(): HTMLElement {
    return this.host.nativeElement;
  }

  isEnabled(): boolean {
    return !this.disabled();
  }

  getLabel(): string {
    return this.label() || this.element.getAttribute('aria-label') || this.element.textContent?.trim() || 'target';
  }

  canAccept(payload: unknown): boolean {
    if (this.disabled()) return false;
    try {
      return !!this.accepts()(payload as T);
    } catch {
      return false;
    }
  }

  setOver(over: boolean): void {
    if (this.isOver() === over) return;
    this.isOver.set(over);
    this.dragOver.emit(over);
  }

  receiveDrop(payload: T): void {
    this.dropped.emit(payload);
  }

  ngOnInit(): void {
    this.drag.registerTarget(this as UiDropTargetHandle<unknown>);
  }

  ngOnDestroy(): void {
    this.drag.unregisterTarget(this as UiDropTargetHandle<unknown>);
  }
}
