import { Component, DestroyRef, ElementRef, afterNextRender, effect, inject, input, output, signal, viewChild } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import Image01Icon from '@hugeicons/core-free-icons/Image01Icon';
import { UiSpinner } from '@zouriel/ui/spinner';

export interface UiImagePickerItem {
  id: string;
  /** The thumbnail. */
  src: string;
  /** Accessible name, tooltip and (with `captions`) the caption. */
  label: string;
  /** A short tag in the corner, such as "Moves". */
  badge?: string;
  disabled?: boolean;
  /** Why it's disabled, or anything more to say on hover. */
  hint?: string;
}

/**
 * `ui-image-picker` — a grid of image tiles to choose from: search results, stock art, uploads.
 *
 * Tap or Enter picks (`pick`). One tile can show as busy while its choice is being fetched. When
 * `hasMore` is on, scrolling near the end asks for the next page (`more`) — there is no "Load more"
 * button to reach for with a thumb. Thumbnails that fail to load show the label on a plain tile rather
 * than a broken-image glyph. Tiles sit on a faint checkerboard so white or transparent art is visible.
 *
 * With `dragType` set, tiles can be dragged: the item's `id` is the drag data under that type.
 */
@Component({
  selector: 'ui-image-picker',
  imports: [HugeiconsIconComponent, UiSpinner],
  template: `
    <div class="grid" role="list" [style.--ui-image-picker-min]="minThumb()">
      @for (item of items(); track item.id) {
        <div role="listitem" class="cell">
          <button type="button" class="tile" [class.busy]="busyId() === item.id" [disabled]="item.disabled || (busyId() !== null && busyId() !== item.id)"
            [attr.aria-label]="item.label" [attr.aria-busy]="busyId() === item.id" [attr.title]="item.hint || item.label"
            [attr.draggable]="dragType() && !item.disabled ? 'true' : null" (dragstart)="onDragStart($event, item)" (click)="pick.emit(item)">
            @if (!broken().has(item.id)) {
              <img [src]="item.src" alt="" loading="lazy" decoding="async" draggable="false" (error)="markBroken(item.id)" />
            } @else {
              <span class="fallback"><hugeicons-icon [icon]="imageIcon" [size]="22" [strokeWidth]="1.6" aria-hidden="true" /><span>{{ item.label }}</span></span>
            }
            @if (item.badge) { <span class="badge">{{ item.badge }}</span> }
            @if (busyId() === item.id) { <span class="veil"><ui-spinner size="sm" [label]="'Adding ' + item.label" /></span> }
          </button>
          @if (captions()) { <span class="caption" aria-hidden="true">{{ item.label }}</span> }
        </div>
      }
    </div>
    @if (loading()) {
      <div class="status"><ui-spinner size="sm" label="Loading" /></div>
    } @else if (!items().length && emptyText()) {
      <p class="status empty">{{ emptyText() }}</p>
    }
    <div #sentinel class="sentinel" aria-hidden="true"></div>
  `,
  styles: `
    :host { display: block; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--ui-image-picker-min, 96px), 1fr)); gap: var(--ui-space-2); }
    .cell { display: flex; flex-direction: column; gap: var(--ui-space-1); min-width: 0; }
    .tile { position: relative; display: block; width: 100%; aspect-ratio: 1; padding: var(--ui-space-2); cursor: pointer; overflow: hidden;
      border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius);
      background-color: var(--ui-color-surface);
      background-image: linear-gradient(45deg, var(--ui-color-surface-subtle) 25%, transparent 25%, transparent 75%, var(--ui-color-surface-subtle) 75%),
        linear-gradient(45deg, var(--ui-color-surface-subtle) 25%, transparent 25%, transparent 75%, var(--ui-color-surface-subtle) 75%);
      background-size: 16px 16px; background-position: 0 0, 8px 8px;
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .tile:hover:not(:disabled) { border-color: var(--ui-color-primary); }
    .tile:active:not(:disabled) { transform: scale(var(--ui-scale-press)); }
    .tile:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .tile:disabled { cursor: default; opacity: 0.5; }
    .tile.busy { opacity: 1; border-color: var(--ui-color-primary); }
    .tile img { width: 100%; height: 100%; object-fit: contain; display: block; pointer-events: none; }
    .fallback { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--ui-space-1); height: 100%;
      color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); line-height: 1.2; text-align: center; overflow: hidden; }
    .fallback span { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
    .badge { position: absolute; top: 4px; right: 4px; padding: 1px 6px; border-radius: var(--ui-radius-pill);
      background: var(--ui-color-primary); color: var(--ui-color-primary-contrast);
      font-family: var(--ui-font-default); font-size: 10px; font-weight: 600; line-height: 16px; letter-spacing: 0.02em; }
    .veil { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      background: color-mix(in srgb, var(--ui-color-surface) 60%, transparent); }
    .caption { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .status { display: flex; justify-content: center; padding: var(--ui-space-3); margin: 0; }
    .empty { color: var(--ui-color-text-muted); font-size: var(--ui-font-size-sm); text-align: center; }
    .sentinel { height: 1px; }
  `,
})
export class UiImagePicker {
  private readonly destroyRef = inject(DestroyRef);

  items = input<UiImagePickerItem[]>([]);
  /** The tile being fetched; the others wait while it is. */
  busyId = input<string | null>(null);
  /** A page is being loaded. */
  loading = input(false);
  /** There's another page: reaching the end asks for it with `more`. */
  hasMore = input(false);
  minThumb = input('96px');
  captions = input(false);
  /** Shown when there are no items and nothing is loading. */
  emptyText = input('');
  /** A MIME-like type for drag data (the item's id); tiles aren't draggable without one. */
  dragType = input<string | null>(null);

  readonly pick = output<UiImagePickerItem>();
  readonly more = output<void>();

  protected readonly imageIcon = Image01Icon;
  protected readonly broken = signal(new Set<string>());
  private readonly sentinel = viewChild.required<ElementRef<HTMLElement>>('sentinel');
  private observer: IntersectionObserver | null = null;

  constructor() {
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') return;
      this.observer = new IntersectionObserver((entries) => {
        if (entries.some((e) => e.isIntersecting) && this.hasMore() && !this.loading() && this.items().length) this.more.emit();
      }, { rootMargin: '240px' });
      this.observer.observe(this.sentinel().nativeElement);
      this.destroyRef.onDestroy(() => this.observer?.disconnect());
    });
    // An observer only reports changes, so a page that loaded without pushing the end out of view would
    // never ask for the next one. Observing afresh reports where the end is now.
    effect(() => {
      this.items();
      if (this.loading() || !this.observer) return;
      requestAnimationFrame(() => {
        const el = this.sentinel().nativeElement;
        this.observer?.unobserve(el);
        this.observer?.observe(el);
      });
    });
  }

  protected markBroken(id: string): void {
    this.broken.update((s) => new Set(s).add(id));
  }

  protected onDragStart(e: DragEvent, item: UiImagePickerItem): void {
    const type = this.dragType();
    if (!type || item.disabled || !e.dataTransfer) return;
    e.dataTransfer.setData(type, item.id);
    e.dataTransfer.effectAllowed = 'copy';
  }
}
