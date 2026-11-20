import { NgTemplateOutlet } from '@angular/common';
import { Component, Directive, TemplateRef, computed, contentChild, inject, input, output, signal, viewChildren } from '@angular/core';
import { UiDragItem, UiDragService, UiDropTarget } from '@zouriel/ui/drag';
import { UiScrim } from './scrim';

/** A small dot over a poster's corner: something the grid must say without words (unread, unfinished). */
export interface UiPosterMark {
  tone: 'primary' | 'warning' | 'neutral';
  /** Read out with the poster's name; the dot itself has no text. */
  label: string;
}

export interface UiPoster {
  /** The picture. Without one (or when it fails to load) the tile shows `colors` as a gradient. */
  src?: string | null;
  /** The tile's name: its accessible label, or read with the details when there is a details template. */
  label: string;
  /** Makes the tile a link (so it opens in a new tab with a modifier key, and shows its address). */
  href?: string | null;
  /** Fallback gradient stops, e.g. a design's colours. Without them the theme's primary and accent. */
  colors?: string[];
  mark?: UiPosterMark | null;
  /** Opts the tile in to being dragged onto another tile (see `ui-poster-grid` `tileDrop`). Off by default. */
  draggable?: boolean;
}

/** What a `tileDrop` carries, and what `canDrop` is asked about: the dragged tile and the one it was dropped on. */
export interface UiPosterDrop {
  dragged: UiPoster;
  target: UiPoster;
  draggedIndex: number;
  targetIndex: number;
}

/** Context of a `uiPosterDetails` template: the poster and its index. */
export interface UiPosterDetailsContext {
  $implicit: UiPoster;
  index: number;
}

/**
 * Put on an `<ng-template>` inside ui-poster-grid to draw details on every tile, over the bottom of
 * its picture on a compact ui-scrim: `<ng-template uiPosterDetails let-p let-i="index">…</ng-template>`.
 * Keep it short (a title and a line or two, with ellipsis) and non-interactive: the whole tile is the target.
 */
@Directive({ selector: 'ng-template[uiPosterDetails]' })
export class UiPosterDetails {
  readonly template = inject<TemplateRef<UiPosterDetailsContext>>(TemplateRef);
  static ngTemplateContextGuard(_d: UiPosterDetails, ctx: unknown): ctx is UiPosterDetailsContext {
    return true;
  }
}

/**
 * Put on an `<ng-template>` inside ui-poster-grid to draw something small over the top-start corner of
 * every tile's picture (top-left in a left-to-right page), e.g. a venue's ui-avatar-tag:
 * `<ng-template uiPosterCorner let-p let-i="index">…</ng-template>`. It sits inside the picture with a
 * space2 inset, above the picture and below the tile's focus ring, never grows wider than the picture
 * (less the room for a mark's dot), and takes no taps: the whole tile stays the target.
 */
@Directive({ selector: 'ng-template[uiPosterCorner]' })
export class UiPosterCorner {
  readonly template = inject<TemplateRef<UiPosterDetailsContext>>(TemplateRef);
  static ngTemplateContextGuard(_d: UiPosterCorner, ctx: unknown): ctx is UiPosterDetailsContext {
    return true;
  }
}

/**
 * Put on an `<ng-template>` inside ui-poster-grid to give every tile one small action of its own at the
 * top-end corner of its picture (top-right in a left-to-right page), e.g. a "View invite" eye:
 * `<ng-template uiPosterAction let-p let-i="index"><ui-icon-button label="View invite" variant="ghost" size="sm" (click)="view(i)">…</ui-icon-button></ng-template>`.
 * It sits beside the tile's link or button, never inside it, so it is its own tab stop and activating
 * it never selects or opens the tile. A round backdrop in the media scrim colour keeps it readable on
 * any picture; keep it to one small icon button (size sm or md). A mark's dot moves beside it.
 */
@Directive({ selector: 'ng-template[uiPosterAction]' })
export class UiPosterAction {
  readonly template = inject<TemplateRef<UiPosterDetailsContext>>(TemplateRef);
  static ngTemplateContextGuard(_d: UiPosterAction, ctx: unknown): ctx is UiPosterDetailsContext {
    return true;
  }
}

/** The gradient a poster without a picture shows. Shared with ui-poster-view so both agree. */
export function uiPosterFallback(colors?: string[] | null): string {
  const c = (colors ?? []).filter(Boolean);
  if (c.length >= 2) return `linear-gradient(160deg, ${c.join(', ')})`;
  if (c.length === 1) return `linear-gradient(160deg, ${c[0]}, color-mix(in srgb, ${c[0]} 55%, var(--ui-color-bg)))`;
  return 'linear-gradient(160deg, color-mix(in srgb, var(--ui-color-primary) 70%, var(--ui-color-bg)), color-mix(in srgb, var(--ui-color-accent) 60%, var(--ui-color-bg)))';
}

/**
 * `ui-poster-grid`: a grid of same-shape picture tiles (`ratio`, width / height): 2 columns on a phone,
 * 3 from 544px, 4 from 992px and 5 from 1280px of the grid's own width. With a `uiPosterDetails`
 * template each tile carries its details over the bottom of its picture on a compact ui-scrim that
 * fades from clear to dark, so the words stay readable on any picture; without one a tile is the
 * picture alone and its label is only its accessible name. A tile with no picture shows a gradient,
 * and a small dot (`mark`) can flag it, named for screen readers. A tile with an `href` is a link;
 * every tile emits `select` with its index when activated, and with `handleClicks` a plain click on a
 * link is left to `select` (for client-side routing) while modified clicks still open a new tab.
 * A `uiPosterCorner` template draws something small (a ui-avatar-tag) over each picture's top-start corner,
 * and a `uiPosterAction` template one small action (an icon button) at its top-end corner, outside the
 * tile's link so it never selects the tile; a mark's dot then sits beside the action.
 */
@Component({
  selector: 'ui-poster-grid',
  imports: [NgTemplateOutlet, UiScrim, UiDragItem, UiDropTarget],
  template: `
    <ul class="grid" role="list" [style.--ui-poster-ratio]="ratio()">
      @for (p of posters(); track $index) {
        <li
          [uiDragItem]="payloads()[$index]"
          [uiDragLabel]="p.label"
          [uiDragDisabled]="!p.draggable"
          [uiDragDescription]="''"
          [tabindex]="-1"
          (dragEnd)="dragEnded()"
          [uiDropTarget]="p.label"
          [uiDropAccepts]="accepters()[$index]"
          [uiDropDisabled]="!dragEnabled()"
          (dropped)="dropped($event, $index)"
          [class.draggable]="!!p.draggable"
          [class.drag-valid]="session() && isValid($index)"
          [class.drag-dim]="session() && !isValid($index) && !isSource($index)"
        >
          @if (p.href) {
            <a class="tile" [attr.href]="p.href" [attr.aria-label]="details() ? null : name(p)"
              [attr.aria-description]="p.draggable ? dragHint : null" (click)="clicked($event, $index)" (keydown)="tileKey($event, $index)" (keyup)="tileKeyUp($event, $index)">
              <ng-container [ngTemplateOutlet]="body" [ngTemplateOutletContext]="{ $implicit: p, index: $index }" />
            </a>
          } @else {
            <button type="button" class="tile" [attr.aria-label]="details() ? null : name(p)"
              [attr.aria-description]="p.draggable ? dragHint : null" (click)="clicked($event, $index)" (keydown)="tileKey($event, $index)" (keyup)="tileKeyUp($event, $index)">
              <ng-container [ngTemplateOutlet]="body" [ngTemplateOutletContext]="{ $implicit: p, index: $index }" />
            </button>
          }
          @if (action(); as a) {
            <!-- Beside the tile, never inside its link or button: its own tab stop, and its clicks never select the tile. -->
            <div class="top-end">
              @if (p.mark; as m) { <span [class]="'dot dot--' + m.tone" aria-hidden="true"></span> }
              <span class="action">
                <ng-container [ngTemplateOutlet]="a.template" [ngTemplateOutletContext]="{ $implicit: p, index: $index }" />
              </span>
            </div>
          }
        </li>
      }
    </ul>
    <ng-template #body let-p let-i="index">
      @if (p.src && !broken().has(p.src)) {
        <img [src]="p.src" alt="" loading="lazy" decoding="async" [style.object-position]="position()" (error)="fail(p.src)" />
      } @else {
        <span class="fallback" [style.background]="fallback(p)"></span>
      }
      @if (p.mark && !action()) {
        <span [class]="'dot dot--' + p.mark.tone" aria-hidden="true"></span>
      }
      @if (details(); as d) {
        <ui-scrim class="details" [compact]="true">
          <ng-container [ngTemplateOutlet]="d.template" [ngTemplateOutletContext]="{ $implicit: p, index: i }" />
          @if (p.mark; as m) { <span class="sr">{{ m.label }}</span> }
        </ui-scrim>
      }
      @if (corner(); as c) {
        <span class="corner" [class.corner--mark]="!!p.mark && !action()" [class.corner--action]="!!action() && !p.mark" [class.corner--action-mark]="!!action() && !!p.mark">
          <ng-container [ngTemplateOutlet]="c.template" [ngTemplateOutletContext]="{ $implicit: p, index: i }" />
        </span>
      }
    </ng-template>
  `,
  styles: `
    :host { display: block; container-type: inline-size; }
    .grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--ui-space-2); }
    @container (min-width: 544px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--ui-space-3); } }
    @container (min-width: 992px) { .grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
    @container (min-width: 1280px) { .grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
    li { min-width: 0; position: relative; outline: none; border-radius: var(--ui-radius);
      transition: opacity var(--ui-motion-base) var(--ui-ease-standard); }
    /* A tile that can be dragged: a touch long-press must not select text or open a menu. */
    li.draggable .tile { -webkit-touch-callout: none; user-select: none; -webkit-user-select: none; }
    /* While dragging: valid targets get an accent outline, the others step back; the one under the
       pointer gets the full ring (the drag library's own square ring on the li is turned off). */
    li.ui-drop-target--over { box-shadow: none; }
    li.drag-valid .tile { box-shadow: 0 0 0 2px color-mix(in srgb, var(--ui-color-accent) 55%, transparent); }
    li.drag-valid.ui-drop-target--over .tile { box-shadow: 0 0 0 2px var(--ui-color-bg), 0 0 0 4px var(--ui-color-accent); transform: scale(1.02); }
    li.drag-dim { opacity: 0.45; }
    @media (prefers-reduced-motion: reduce) { li.drag-valid.ui-drop-target--over .tile { transform: none; } li { transition: none; } }
    .tile { position: relative; isolation: isolate; display: block; width: 100%; padding: 0; border: none; cursor: pointer; font: inherit; text-align: start;
      color: inherit; text-decoration: none;
      aspect-ratio: var(--ui-poster-ratio, 0.75); overflow: hidden; border-radius: var(--ui-radius);
      background: var(--ui-color-surface-raised);
      transition: transform var(--ui-motion-fast) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard); }
    .tile:hover { box-shadow: 0 0 0 2px var(--ui-color-border-strong); }
    .tile:active { transform: scale(var(--ui-scale-press)); }
    .tile:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    img, .fallback { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    img { object-fit: cover; }
    .details { position: absolute; inset-inline: 0; bottom: 0; max-height: 100%; overflow: hidden; }
    /* Over the picture's top-start corner, inside it: never wider than the picture, nor over the mark's dot. */
    .corner { position: absolute; top: var(--ui-space-2); inset-inline-start: var(--ui-space-2); z-index: 1;
      display: flex; min-width: 0; max-width: calc(100% - 2 * var(--ui-space-2)); pointer-events: none; }
    .corner--mark { max-width: calc(100% - 3 * var(--ui-space-2) - 10px); }
    .corner--action { max-width: calc(100% - 3 * var(--ui-space-2) - var(--ui-size-md)); }
    .corner--action-mark { max-width: calc(100% - 4 * var(--ui-space-2) - var(--ui-size-md) - 10px); }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
    /* A light ring, then a faint dark edge: the dot shows on any picture, dark posters included. */
    .dot { position: absolute; top: var(--ui-space-2); inset-inline-end: var(--ui-space-2); width: 10px; height: 10px; border-radius: 50%;
      box-shadow: 0 0 0 2px var(--ui-media-on-scrim), 0 0 0 3px color-mix(in srgb, var(--ui-media-scrim) 35%, transparent); }
    .dot--primary { background: var(--ui-color-primary); }
    .dot--warning { background: var(--ui-color-warning); }
    .dot--neutral { background: var(--ui-media-on-scrim); }
    /* The action's corner: a sibling of the tile in the li, over the picture's top-end corner. Taps pass
       through everything here but the action itself (the dot beside it still opens the tile). */
    .top-end { position: absolute; top: var(--ui-space-2); inset-inline-end: var(--ui-space-2); z-index: 2;
      display: flex; align-items: center; gap: var(--ui-space-2); pointer-events: none; }
    .top-end .dot { position: static; flex: none; }
    /* A round scrim backdrop with on-scrim colours, so a ghost icon button reads on any picture. */
    .top-end .action { display: inline-flex; pointer-events: auto; border-radius: var(--ui-radius-pill);
      background: color-mix(in srgb, var(--ui-media-scrim) 55%, transparent);
      color: var(--ui-media-on-scrim); --ui-color-text: var(--ui-media-on-scrim); --ui-color-icon: var(--ui-media-on-scrim);
      --ui-color-surface-hover: color-mix(in srgb, var(--ui-media-on-scrim) 18%, transparent);
      --ui-radius: var(--ui-radius-pill); }
  `,
})
export class UiPosterGrid {
  readonly posters = input<UiPoster[]>([]);
  /** Width / height of every tile. 3/4 by default: invitations are read upright. */
  readonly ratio = input(0.75);
  /** Which part of a picture survives the crop: 'top' keeps a poster's heading. */
  readonly focus = input<'top' | 'center'>('center');
  /** A plain click on a link tile is left to `select` (no browser navigation), for client-side routing. */
  readonly handleClicks = input(false);
  readonly select = output<number>();
  /**
   * Decides whether `dragged` may be dropped on `target` (a tile never accepts itself). Default: any
   * other tile. Only tiles with `draggable: true` can be dragged at all.
   */
  readonly canDrop = input<(dragged: UiPoster, target: UiPoster) => boolean>(() => true);
  /**
   * A tile was dragged onto another valid tile: a long press then drag on a phone, a mouse drag on a
   * desktop, or Space to pick up, arrows to choose and Enter to drop from the keyboard. Dropping
   * anywhere else cancels without an event.
   */
  readonly tileDrop = output<UiPosterDrop>();

  protected readonly details = contentChild(UiPosterDetails);
  protected readonly corner = contentChild(UiPosterCorner);
  protected readonly action = contentChild(UiPosterAction);

  private readonly drag = inject(UiDragService);
  private readonly items = viewChildren(UiDragItem);
  private swallow = false;
  protected readonly dragHint = 'Press Space to pick up and drag onto another tile; Enter opens it.';

  /** True when at least one tile can be dragged: only then do tiles take part in dragging at all. */
  protected readonly dragEnabled = computed(() => this.posters().some((p) => !!p.draggable));
  protected readonly payloads = computed(() => this.posters().map((poster, index) => ({ grid: this as unknown, poster, index })));
  protected readonly accepters = computed(() => {
    const posters = this.posters();
    return posters.map((target, targetIndex) => (payload: unknown) => {
      const d = payload as { grid: unknown; poster: UiPoster; index: number } | null;
      if (!d || d.grid !== this || d.index === targetIndex) return false;
      return this.canDrop()(d.poster, target);
    });
  });
  /** The drag in progress, when it came from this grid. */
  protected readonly session = computed(() => {
    const s = this.drag.active();
    return s && (s.payload as { grid?: unknown }).grid === this ? s : null;
  });
  protected isSource(i: number): boolean {
    return (this.session()?.payload as { index?: number } | undefined)?.index === i;
  }
  protected isValid(i: number): boolean {
    const s = this.session();
    return !!s && this.accepters()[i](s.payload);
  }
  protected dropped(payload: unknown, targetIndex: number): void {
    const d = payload as { poster: UiPoster; index: number };
    this.tileDrop.emit({ dragged: d.poster, target: this.posters()[targetIndex], draggedIndex: d.index, targetIndex });
  }
  /** A drag that ends over a tile must not also open it: the click that follows is swallowed. */
  protected dragEnded(): void {
    this.swallow = true;
    setTimeout(() => (this.swallow = false), 0);
  }
  /** Space picks a draggable tile up (Enter still opens it); the drag service then owns the keys. */
  protected tileKey(e: KeyboardEvent, i: number): void {
    if (e.key !== ' ' || !this.posters()[i]?.draggable || this.drag.active()) return;
    e.preventDefault();
    this.items()[i]?.startKeyboardDrag();
  }
  protected tileKeyUp(e: KeyboardEvent, i: number): void {
    // A button fires its click on Space's key-up in some browsers; a draggable tile uses Space to pick up.
    if (e.key === ' ' && this.posters()[i]?.draggable) e.preventDefault();
  }

  protected readonly broken = signal(new Set<string>());
  protected readonly position = computed(() => (this.focus() === 'top' ? '50% 0' : '50% 50%'));

  protected name(p: UiPoster): string {
    return p.mark ? `${p.label}, ${p.mark.label}` : p.label;
  }
  protected clicked(e: MouseEvent, i: number): void {
    if (this.swallow) {
      e.preventDefault();
      return;
    }
    if (!(e.currentTarget as HTMLElement).matches('a')) {
      this.select.emit(i);
      return;
    }
    const modified = e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey;
    if (modified) return;
    if (this.handleClicks()) e.preventDefault();
    this.select.emit(i);
  }
  protected fallback(p: UiPoster): string {
    return uiPosterFallback(p.colors);
  }
  /** A stored URL can outlive its file: a failure shows the gradient, never a broken-image icon. */
  protected fail(src: string): void {
    this.broken.update((s) => new Set(s).add(src));
  }
}
