import { Component, ElementRef, Injector, afterNextRender, inject, input, linkedSignal, output, signal } from '@angular/core';
import { CdkDrag, CdkDropList, moveItemInArray, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import StarIcon from '@hugeicons/core-free-icons/StarIcon';
import Cancel01Icon from '@hugeicons/core-free-icons/Cancel01Icon';
import { injectUiConfig, uiLogicalKey } from '@zouriel/ui';

/** One picture in `ui-reorder-grid`. */
export interface UiReorderGridItem {
  id: string;
  src: string;
  /** Names the tile for screen readers; without it the tile is "Photo N". */
  alt?: string;
}

let nextId = 0;

/**
 * `ui-reorder-grid` — square photo tiles the user puts in order. With a finger, hold a tile for a
 * moment and drag it (a quick swipe still scrolls the page); with a mouse, press and move. A tap
 * that didn't move fires `tileTap` (open your own menu there). Keyboard: arrows move the focused
 * tile one place (up and down one row), Enter or Space taps it.
 */
@Component({
  selector: 'ui-reorder-grid',
  imports: [CdkDropList, CdkDrag, HugeiconsIconComponent],
  template: `
    <div class="grid" role="list" [attr.aria-label]="ariaLabel()" [class.no-radius]="!radius" [style.--ui-reorder-min]="minTile() + 'px'"
      cdkDropList cdkDropListOrientation="mixed" (cdkDropListDropped)="dropped($event)">
      @for (item of order(); track item.id; let n = $index) {
        <div class="cell" role="listitem" cdkDrag cdkDragPreviewContainer="parent" [cdkDragStartDelay]="delay" [attr.data-id]="item.id"
          (cdkDragStarted)="dragging = true" (cdkDragEnded)="dragEnded()">
          <button type="button" class="tile" [attr.aria-label]="name(item, n) + (item.id === coverId() ? ', ' + coverLabel() : '')"
            [attr.aria-describedby]="hintId" (click)="tap(item)" (keydown)="onKey($event, item)" (contextmenu)="$event.preventDefault()">
            <img [src]="item.src" alt="" draggable="false" />
          </button>
          @if (item.id === coverId()) {
            <span class="cover" aria-hidden="true"><hugeicons-icon [icon]="icons.star" [size]="14" [strokeWidth]="2" /></span>
          }
          @if (removable()) {
            <button type="button" class="x" [attr.aria-label]="removeLabel() + ' ' + (item.alt || 'photo ' + (n + 1))"
              (mousedown)="$event.stopPropagation()" (touchstart)="$event.stopPropagation()" (click)="remove.emit(item.id)">
              <span class="dot"><hugeicons-icon aria-hidden="true" [icon]="icons.x" [size]="14" [strokeWidth]="2" /></span>
            </button>
          }
        </div>
      }
    </div>
    <span class="sr-only" [id]="hintId">{{ moveLabel() }}</span>
    <div class="sr-only" aria-live="polite">{{ announcement() }}</div>
  `,
  styles: `
    :host { display: block; min-width: 0; }
    .grid {
      display: grid; gap: var(--ui-space-2);
      grid-template-columns: repeat(auto-fill, minmax(min(100%, var(--ui-reorder-min)), 1fr));
    }
    .cell { position: relative; min-width: 0; aspect-ratio: 1; border-radius: var(--ui-radius); }
    .grid.no-radius .cell { border-radius: 0; }
    .tile {
      display: block; width: 100%; height: 100%; padding: 0; border: none; border-radius: inherit; overflow: hidden;
      background: var(--ui-color-surface-subtle); cursor: pointer;
      -webkit-touch-callout: none; user-select: none;
    }
    .tile:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .tile img { display: block; width: 100%; height: 100%; object-fit: cover; pointer-events: none; }
    .cover {
      position: absolute; top: var(--ui-space-1); inset-inline-start: var(--ui-space-1);
      display: inline-flex; align-items: center; justify-content: center; width: 24px; height: 24px; border-radius: var(--ui-radius-pill);
      background: var(--ui-color-primary); color: var(--ui-color-primary-contrast); --ui-color-icon: currentColor; pointer-events: none;
    }
    .cover ::ng-deep svg path { fill: currentColor; }
    /* A 44px hit area in the corner that paints a 28px circle. */
    .x {
      position: absolute; top: 0; inset-inline-end: 0; width: var(--ui-size-touch); height: var(--ui-size-touch);
      display: inline-flex; align-items: center; justify-content: center; padding: 0; border: none; background: transparent; cursor: pointer;
    }
    .dot {
      display: inline-flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: var(--ui-radius-pill);
      background: color-mix(in srgb, var(--ui-color-bg) 85%, transparent); color: var(--ui-color-text); --ui-color-icon: currentColor;
      border: 1px solid var(--ui-color-border); box-sizing: border-box;
    }
    .x:hover .dot { background: var(--ui-color-surface-hover); }
    .x:focus-visible { outline: none; }
    .x:focus-visible .dot { box-shadow: var(--ui-focus-ring); }

    .cell.cdk-drag-placeholder { background: var(--ui-color-surface-subtle); border: 1px dashed var(--ui-color-border); box-sizing: border-box; }
    .cell.cdk-drag-placeholder .tile, .cell.cdk-drag-placeholder .cover, .cell.cdk-drag-placeholder .x { visibility: hidden; }
    .cell.cdk-drag-preview { box-shadow: var(--ui-shadow-2); }
    .cell.cdk-drag-animating, .grid.cdk-drop-list-dragging .cell:not(.cdk-drag-placeholder) {
      transition: transform var(--ui-motion-base) var(--ui-ease-standard);
    }
    @media (prefers-reduced-motion: reduce) {
      .cell.cdk-drag-animating, .grid.cdk-drop-list-dragging .cell:not(.cdk-drag-placeholder) { transition: none; }
    }
    .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
  `,
})
export class UiReorderGrid {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  protected readonly radius = injectUiConfig().radius;
  protected readonly icons = { star: StarIcon, x: Cancel01Icon };
  /** A held finger picks a tile up after 350ms, so a quick swipe still scrolls; a mouse picks it up at once. */
  protected readonly delay = { touch: 350, mouse: 0 };
  protected readonly hintId = `ui-reorder-hint-${nextId++}`;
  protected dragging = false;

  items = input.required<UiReorderGridItem[]>();
  /** Narrowest a tile may get, in px; columns fill the width. */
  minTile = input(96);
  /** The tile that shows the star (the cover picture). */
  coverId = input<string | null | undefined>(null);
  ariaLabel = input('Photos');
  moveLabel = input('Hold and drag to move');
  /** What screen readers hear after the cover tile's name. */
  coverLabel = input('Cover');
  /** Shows a small x on every tile. */
  removable = input(false);
  removeLabel = input('Remove');

  /** The full new id order, only when it changed. */
  readonly reorder = output<string[]>();
  /** A tap, click, Enter or Space on a tile (not after a drag). */
  readonly tileTap = output<string>();
  readonly remove = output<string>();

  protected readonly order = linkedSignal(() => this.items());
  protected readonly announcement = signal('');

  protected name(item: UiReorderGridItem, n: number): string {
    return item.alt || `Photo ${n + 1}`;
  }

  protected dragEnded(): void {
    // The click that follows the drop must not count as a tap.
    setTimeout(() => (this.dragging = false));
  }

  protected tap(item: UiReorderGridItem): void {
    if (this.dragging) return;
    this.tileTap.emit(item.id);
  }

  protected dropped(e: CdkDragDrop<unknown>): void {
    this.move(e.previousIndex, e.currentIndex, false);
  }

  protected onKey(e: KeyboardEvent, item: UiReorderGridItem): void {
    const key = uiLogicalKey(e);
    const step = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : key === 'ArrowDown' ? this.columns() : key === 'ArrowUp' ? -this.columns() : 0;
    if (!step) return;
    e.preventDefault();
    const from = this.order().indexOf(item);
    const to = from + step;
    if (to < 0 || to >= this.order().length) return;
    this.move(from, to, true);
  }

  private move(from: number, to: number, refocus: boolean): void {
    if (from === to) return;
    const list = this.order().slice();
    const item = list[from];
    moveItemInArray(list, from, to);
    this.order.set(list);
    const ids = list.map((i) => i.id);
    this.reorder.emit(ids);
    this.announcement.set(`${this.name(item, from)} moved to position ${to + 1} of ${ids.length}`);
    if (refocus) afterNextRender(() => this.tileOf(item.id)?.focus(), { injector: this.injector });
  }

  /** Tiles in the first row, measured; 1 when nothing has a size (no layout). */
  private columns(): number {
    const cells = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.cell'));
    const first = cells[0]?.getBoundingClientRect();
    if (!first || !first.height) return 1;
    return Math.max(1, cells.filter((c) => Math.abs(c.getBoundingClientRect().top - first.top) < 1).length);
  }

  private tileOf(id: string): HTMLElement | null {
    const cell = Array.from(this.host.nativeElement.querySelectorAll<HTMLElement>('.cell[data-id]')).find((c) => c.dataset['id'] === id);
    return cell?.querySelector<HTMLElement>('.tile') ?? null;
  }
}
