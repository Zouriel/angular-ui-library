import { Component, computed, input, output, signal } from '@angular/core';

/** A small dot over a poster's corner: something the grid must say without words (unread, unfinished). */
export interface UiPosterMark {
  tone: 'primary' | 'warning' | 'neutral';
  /** Read out with the poster's name; the dot itself has no text. */
  label: string;
}

export interface UiPoster {
  /** The picture. Without one (or when it fails to load) the tile shows `colors` as a gradient. */
  src?: string | null;
  /** The accessible name of the tile. Never drawn on it. */
  label: string;
  /** Fallback gradient stops, e.g. a design's colours. Without them the theme's primary and accent. */
  colors?: string[];
  mark?: UiPosterMark | null;
}

/** The gradient a poster without a picture shows. Shared with ui-poster-view so both agree. */
export function uiPosterFallback(colors?: string[] | null): string {
  const c = (colors ?? []).filter(Boolean);
  if (c.length >= 2) return `linear-gradient(160deg, ${c.join(', ')})`;
  if (c.length === 1) return `linear-gradient(160deg, ${c[0]}, color-mix(in srgb, ${c[0]} 55%, var(--ui-color-bg)))`;
  return 'linear-gradient(160deg, color-mix(in srgb, var(--ui-color-primary) 70%, var(--ui-color-bg)), color-mix(in srgb, var(--ui-color-accent) 60%, var(--ui-color-bg)))';
}

/**
 * `ui-poster-grid`: a grid of pictures and nothing else. Every tile is the same shape (`ratio`,
 * width / height), there are 2 columns on a phone, 3 from 544px, 4 from 992px and 5 from 1280px of the
 * grid's own width, and a tile carries no text: its name is only its accessible label. A tile with no
 * picture shows a gradient. The one signal allowed on a tile is a small dot (`mark`), named for screen
 * readers. Activating a tile emits `select` with its index; what opens is the caller's (usually a
 * ui-poster-view with the details).
 */
@Component({
  selector: 'ui-poster-grid',
  template: `
    <ul class="grid" role="list" [style.--ui-poster-ratio]="ratio()">
      @for (p of posters(); track $index) {
        <li>
          <button type="button" class="tile" [attr.aria-label]="name(p)" (click)="select.emit($index)">
            @if (p.src && !broken().has(p.src)) {
              <img [src]="p.src" alt="" loading="lazy" decoding="async" [style.object-position]="position()" (error)="fail(p.src)" />
            } @else {
              <span class="fallback" [style.background]="fallback(p)"></span>
            }
            @if (p.mark; as m) {
              <span [class]="'dot dot--' + m.tone" aria-hidden="true"></span>
            }
          </button>
        </li>
      }
    </ul>
  `,
  styles: `
    :host { display: block; container-type: inline-size; }
    .grid { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: var(--ui-space-2); }
    @container (min-width: 544px) { .grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--ui-space-3); } }
    @container (min-width: 992px) { .grid { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
    @container (min-width: 1280px) { .grid { grid-template-columns: repeat(5, minmax(0, 1fr)); } }
    li { min-width: 0; }
    .tile { position: relative; display: block; width: 100%; padding: 0; border: none; cursor: pointer; font: inherit;
      aspect-ratio: var(--ui-poster-ratio, 0.75); overflow: hidden; border-radius: var(--ui-radius);
      background: var(--ui-color-surface-raised);
      transition: transform var(--ui-motion-fast) var(--ui-ease-standard), box-shadow var(--ui-motion-base) var(--ui-ease-standard); }
    .tile:hover { box-shadow: 0 0 0 2px var(--ui-color-border-strong); }
    .tile:active { transform: scale(var(--ui-scale-press)); }
    .tile:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    img, .fallback { position: absolute; inset: 0; width: 100%; height: 100%; display: block; }
    img { object-fit: cover; }
    /* A light ring, then a faint dark edge: the dot shows on any picture, dark posters included. */
    .dot { position: absolute; top: var(--ui-space-2); inset-inline-end: var(--ui-space-2); width: 10px; height: 10px; border-radius: 50%;
      box-shadow: 0 0 0 2px var(--ui-media-on-scrim), 0 0 0 3px color-mix(in srgb, var(--ui-media-scrim) 35%, transparent); }
    .dot--primary { background: var(--ui-color-primary); }
    .dot--warning { background: var(--ui-color-warning); }
    .dot--neutral { background: var(--ui-media-on-scrim); }
  `,
})
export class UiPosterGrid {
  readonly posters = input<UiPoster[]>([]);
  /** Width / height of every tile. 3/4 by default: invitations are read upright. */
  readonly ratio = input(0.75);
  /** Which part of a picture survives the crop: 'top' keeps a poster's heading. */
  readonly focus = input<'top' | 'center'>('center');
  readonly select = output<number>();

  protected readonly broken = signal(new Set<string>());
  protected readonly position = computed(() => (this.focus() === 'top' ? '50% 0' : '50% 50%'));

  protected name(p: UiPoster): string {
    return p.mark ? `${p.label}, ${p.mark.label}` : p.label;
  }
  protected fallback(p: UiPoster): string {
    return uiPosterFallback(p.colors);
  }
  /** A stored URL can outlive its file: a failure shows the gradient, never a broken-image icon. */
  protected fail(src: string): void {
    this.broken.update((s) => new Set(s).add(src));
  }
}
