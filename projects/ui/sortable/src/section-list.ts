import { Component, ElementRef, Injector, afterNextRender, inject, input, linkedSignal, output, signal } from '@angular/core';
import { CdkDrag, CdkDragHandle, CdkDropList, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { HugeiconsIconComponent, type IconSvgObject } from '@hugeicons/angular';
import DragDropVerticalIcon from '@hugeicons/core-free-icons/DragDropVerticalIcon';
import ViewIcon from '@hugeicons/core-free-icons/ViewIcon';
import ViewOffSlashIcon from '@hugeicons/core-free-icons/ViewOffSlashIcon';
import PencilEdit02Icon from '@hugeicons/core-free-icons/PencilEdit02Icon';
import Delete02Icon from '@hugeicons/core-free-icons/Delete02Icon';
import { injectUiConfig } from '@zouriel/ui';
import { UiIconButton } from '@zouriel/ui/button';
import { UiBadge } from '@zouriel/ui/badge';

/** One row of `ui-section-list`. */
export interface UiSectionListItem {
  id: string;
  label: string;
  /** A second, smaller line under the label. */
  description?: string;
  /** A hugeicons icon drawn before the label. */
  icon?: IconSvgObject;
  /** Dims the row and shows the Hidden badge; the eye button flips it. */
  hidden?: boolean;
  /** Can't be dragged and keeps its place (a Cover that always comes first). */
  locked?: boolean;
  /** Shows the pencil button. Default true. */
  editable?: boolean;
  /** Shows the bin button. Default true. */
  removable?: boolean;
  /** Shows the eye button. Default true. */
  hideable?: boolean;
}

/**
 * The new id order after moving the item at `from` to `to` (indexes in the full list), with every
 * locked item put back where it was: the move is made among the unlocked items only, which then
 * fill the unlocked slots in their new order.
 */
export function uiReorderKeepingLocked(items: readonly UiSectionListItem[], from: number, to: number): string[] {
  const ids = items.map((i) => i.id);
  const moved = ids.slice();
  const [it] = moved.splice(from, 1);
  moved.splice(to, 0, it);
  const locked = new Set(items.filter((i) => i.locked).map((i) => i.id));
  const free = moved.filter((id) => !locked.has(id));
  return items.map((i) => (i.locked ? i.id : free.shift()!));
}

/**
 * `ui-section-list` — a list of sections (or any named parts) the user puts in order, hides, edits
 * and removes. Drag a row by its handle (at once, with a finger or a mouse) or focus the handle and
 * press the up and down arrows. Locked rows stay where they are. Outputs only report what the user
 * did; the list shows the new order straight away and follows `items` whenever it changes.
 */
@Component({
  selector: 'ui-section-list',
  imports: [CdkDropList, CdkDrag, CdkDragHandle, HugeiconsIconComponent, UiIconButton, UiBadge],
  template: `
    <div class="list" role="list" [attr.aria-label]="ariaLabel()" [class.no-radius]="!radius"
      cdkDropList cdkDropListLockAxis="y" [cdkDropListSortPredicate]="canTake" (cdkDropListDropped)="dropped($event)">
      @for (item of order(); track item.id) {
        <div class="row" role="listitem" cdkDrag cdkDragPreviewContainer="parent" [cdkDragDisabled]="!!item.locked"
          [class.is-hidden]="item.hidden" [attr.data-id]="item.id">
          @if (item.locked) {
            <span class="handle-space" aria-hidden="true"></span>
          } @else {
            <button type="button" class="handle" cdkDragHandle [attr.aria-label]="moveLabel() + ' ' + item.label"
              (keydown)="onKey($event, item)">
              <hugeicons-icon aria-hidden="true" [icon]="icons.drag" [size]="20" [strokeWidth]="1.8" />
            </button>
          }
          @if (item.icon) { <span class="icon" aria-hidden="true"><hugeicons-icon [icon]="item.icon" [size]="20" [strokeWidth]="1.8" /></span> }
          <span class="text">
            <span class="label">{{ item.label }}</span>
            @if (item.hidden || item.description) {
              <span class="line">
                @if (item.hidden) { <ui-badge class="badge">{{ hiddenLabel() }}</ui-badge> }
                @if (item.description) { <span class="desc">{{ item.description }}</span> }
              </span>
            }
          </span>
          <span class="actions">
            @if (item.hideable !== false) {
              <ui-icon-button class="act" size="lg" [label]="(item.hidden ? showLabel() : hideLabel()) + ' ' + item.label"
                (click)="flip(item)">
                <hugeicons-icon aria-hidden="true" [icon]="item.hidden ? icons.hidden : icons.shown" [size]="20" [strokeWidth]="1.8" />
              </ui-icon-button>
            }
            @if (item.editable !== false) {
              <ui-icon-button class="act" size="lg" [label]="editLabel() + ' ' + item.label" (click)="edit.emit(item.id)">
                <hugeicons-icon aria-hidden="true" [icon]="icons.edit" [size]="20" [strokeWidth]="1.8" />
              </ui-icon-button>
            }
            @if (item.removable !== false) {
              <ui-icon-button class="act danger" size="lg" [label]="removeLabel() + ' ' + item.label" (click)="remove.emit(item.id)">
                <hugeicons-icon aria-hidden="true" [icon]="icons.remove" [size]="20" [strokeWidth]="1.8" />
              </ui-icon-button>
            }
          </span>
        </div>
      }
    </div>
    <div class="sr-only" aria-live="polite">{{ announcement() }}</div>
  `,
  styles: `
    :host { display: block; min-width: 0; container-type: inline-size; }
    .list { display: flex; flex-direction: column; gap: var(--ui-space-2); font-family: var(--ui-font-default); line-height: 1.35; }
    .row {
      display: flex; align-items: center; gap: var(--ui-space-1); min-width: 0; box-sizing: border-box;
      padding: var(--ui-space-1); background: var(--ui-color-surface); color: var(--ui-color-text);
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
    }
    .list.no-radius .row { border-radius: 0; }
    .handle, .handle-space { flex: none; width: var(--ui-size-touch); height: var(--ui-size-touch); }
    .handle {
      display: inline-flex; align-items: center; justify-content: center; padding: 0; border: none; border-radius: var(--ui-radius);
      background: transparent; color: var(--ui-color-text-muted); cursor: grab; font: inherit;
    }
    .handle:hover { background: var(--ui-color-surface-hover); }
    .handle:active { cursor: grabbing; }
    .handle:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .icon { flex: none; display: inline-flex; }
    .text { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; padding-inline-start: var(--ui-space-1); }
    .line { display: flex; align-items: center; gap: var(--ui-space-2); min-width: 0; }
    /* Up to two lines, then an ellipsis: on a small phone a short name wraps rather than being cut. */
    .label { min-width: 0; overflow: hidden; display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2; line-clamp: 2;
      overflow-wrap: anywhere; font-size: var(--ui-font-size-md); }
    .badge { flex: none; }
    .desc { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    .row.is-hidden .label, .row.is-hidden .icon { color: var(--ui-color-text-muted); }
    .actions { flex: none; display: flex; align-items: center; }
    /* Each button sits in its own 44px cell, so the touch hit-slop never reaches the next button. */
    .act { width: var(--ui-size-touch); height: var(--ui-size-touch); align-items: center; justify-content: center; }
    .act.danger { --ui-color-icon: var(--ui-color-danger); color: var(--ui-color-danger); }
    /* On a phone the name needs the room more than the picture does. After the base .icon rule, so it wins. */
    @container (max-width: 359.98px) { .icon { display: none; } }

    /* Dragging (CDK): the gap where the row will land, and the row under the finger. */
    .row.cdk-drag-placeholder { background: var(--ui-color-surface-subtle); border-style: dashed; }
    .row.cdk-drag-placeholder .handle, .row.cdk-drag-placeholder .icon, .row.cdk-drag-placeholder .text, .row.cdk-drag-placeholder .actions { visibility: hidden; }
    .row.cdk-drag-preview { box-shadow: var(--ui-shadow-2); }
    .row.cdk-drag-animating, .list.cdk-drop-list-dragging .row:not(.cdk-drag-placeholder) {
      transition: transform var(--ui-motion-base) var(--ui-ease-standard);
    }
    @media (prefers-reduced-motion: reduce) {
      .row.cdk-drag-animating, .list.cdk-drop-list-dragging .row:not(.cdk-drag-placeholder) { transition: none; }
    }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
  `,
})
export class UiSectionList {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly radius = injectUiConfig().radius;
  protected readonly icons = { drag: DragDropVerticalIcon, shown: ViewIcon, hidden: ViewOffSlashIcon, edit: PencilEdit02Icon, remove: Delete02Icon };

  items = input.required<UiSectionListItem[]>();
  ariaLabel = input('Sections');
  moveLabel = input('Drag to move');
  hideLabel = input('Hide');
  showLabel = input('Show');
  editLabel = input('Edit');
  removeLabel = input('Remove');
  hiddenLabel = input('Hidden');

  /** The full new id order, only when it changed. */
  readonly reorder = output<string[]>();
  /** `hidden` is the new value. */
  readonly toggleHidden = output<{ id: string; hidden: boolean }>();
  readonly edit = output<string>();
  readonly remove = output<string>();

  /** What is shown: `items`, until the user moves or hides something (then until `items` changes). */
  protected readonly order = linkedSignal(() => this.items());
  protected readonly announcement = signal('');

  /** CDK may not put the dragged row into a locked row's slot. */
  protected readonly canTake = (index: number): boolean => !this.order()[index]?.locked;

  protected dropped(e: CdkDragDrop<unknown>): void {
    this.apply(uiReorderKeepingLocked(this.order(), e.previousIndex, e.currentIndex), this.order()[e.previousIndex]?.id, false);
  }

  protected flip(item: UiSectionListItem): void {
    const hidden = !item.hidden;
    this.order.update((list) => list.map((i) => (i.id === item.id ? { ...i, hidden } : i)));
    this.toggleHidden.emit({ id: item.id, hidden });
  }

  protected onKey(e: KeyboardEvent, item: UiSectionListItem): void {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const list = this.order();
    const slots = list.map((i, n) => (i.locked ? -1 : n)).filter((n) => n >= 0);
    const at = slots.indexOf(list.indexOf(item));
    const to = at + (e.key === 'ArrowUp' ? -1 : 1);
    if (at < 0 || to < 0 || to >= slots.length) return;
    this.apply(uiReorderKeepingLocked(list, slots[at], slots[to]), item.id, true);
  }

  private apply(ids: string[], movedId: string | undefined, refocus: boolean): void {
    const list = this.order();
    if (ids.every((id, n) => id === list[n].id)) return;
    const byId = new Map(list.map((i) => [i.id, i]));
    this.order.set(ids.map((id) => byId.get(id)!));
    this.reorder.emit(ids);
    const moved = movedId ? byId.get(movedId) : undefined;
    if (moved) this.announcement.set(`${moved.label} moved to position ${ids.indexOf(moved.id) + 1} of ${ids.length}`);
    if (refocus && moved) {
      // Moving a focused node in the DOM drops its focus; put it back on the moved row's handle.
      afterNextRender(() => this.handleOf(moved.id)?.focus(), { injector: this.injector });
    }
  }

  private handleOf(id: string): HTMLElement | null {
    const row = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.row[data-id]')).find((r) => r.dataset['id'] === id);
    return row?.querySelector<HTMLElement>('.handle') ?? null;
  }
}
