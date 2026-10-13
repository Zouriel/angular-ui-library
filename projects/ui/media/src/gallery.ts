import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, ElementRef, computed, input, signal, viewChild } from '@angular/core';

export interface UiGalleryImage {
  src: string;
  thumb?: string;
  alt?: string;
}

/**
 * `ui-gallery` — responsive thumbnail grid with a lightbox (prev/next, Esc to close). The lightbox
 * is a modal dialog: Tab stays inside it, and closing returns focus to the thumbnail that opened it.
 */
@Component({
  selector: 'ui-gallery',
  imports: [CdkTrapFocus],
  template: `
    <div class="grid" [style.--ui-gallery-min]="minThumb()">
      @for (img of images(); track $index) {
        <button type="button" class="thumb" (click)="openAt($index)" [attr.aria-label]="img.alt || 'Open image'">
          <img [src]="img.thumb || img.src" [alt]="img.alt || ''" loading="lazy" />
        </button>
      }
    </div>
    @if (lightbox() >= 0) {
      <div #lb class="lb" (click)="close()" (keydown.escape)="close()" (keydown.arrowleft)="step(-1, $event)" (keydown.arrowright)="step(1, $event)"
           tabindex="-1" role="dialog" aria-modal="true" aria-label="Image viewer" cdkTrapFocus
           animate.enter="ui-fade-enter" animate.leave="ui-fade-leave">
        <img [src]="current()?.src" [alt]="current()?.alt || ''" (click)="$event.stopPropagation()" />
        <button type="button" class="nav prev" aria-label="Previous" (click)="step(-1, $event)"><svg viewBox="0 0 12 12" width="20" height="20" aria-hidden="true"><path d="M7.5 2.5L4 6l3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button type="button" class="nav next" aria-label="Next" (click)="step(1, $event)"><svg viewBox="0 0 12 12" width="20" height="20" aria-hidden="true"><path d="M4.5 2.5L8 6l-3.5 3.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        <button type="button" class="x" aria-label="Close" (click)="close()"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
      </div>
    }
  `,
  styles: `
    :host { display: block; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(var(--ui-gallery-min, 120px), 1fr)); gap: var(--ui-space-2); }
    .thumb { padding: 0; border: 1px solid var(--ui-color-border); border-radius: var(--ui-radius); overflow: hidden; cursor: pointer; background: none; aspect-ratio: 1;
      transition: border-color var(--ui-motion-base) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .thumb:hover { border-color: var(--ui-color-primary); }
    .thumb:active { transform: scale(var(--ui-scale-press)); }
    .thumb:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .lb { position: fixed; inset: 0; z-index: var(--ui-z-overlay); display: flex; align-items: center; justify-content: center;
      background: color-mix(in srgb, var(--ui-media-scrim) 85%, transparent); overscroll-behavior: contain; outline: none; }
    .lb > img { max-width: 86vw; max-height: 86vh; border-radius: var(--ui-radius-lg); box-shadow: var(--ui-shadow-2); }
    .nav, .x { position: absolute; border: none; background: color-mix(in srgb, var(--ui-media-on-scrim) 12%, transparent); color: var(--ui-media-on-scrim); cursor: pointer; border-radius: 50%; font: inherit; padding: 0;
      transition: background var(--ui-motion-base) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .nav { top: 50%; transform: translateY(-50%); width: var(--ui-size-touch); height: var(--ui-size-touch); display: flex; align-items: center; justify-content: center; }
    .prev { left: var(--ui-space-4); } .next { right: var(--ui-space-4); }
    .x { top: var(--ui-space-4); right: var(--ui-space-4); width: var(--ui-size-touch); height: var(--ui-size-touch); display: flex; align-items: center; justify-content: center; }
    .nav:hover, .x:hover { background: color-mix(in srgb, var(--ui-media-on-scrim) 25%, transparent); }
    .nav:active { transform: translateY(-50%) scale(var(--ui-scale-press)); }
    .x:active { transform: scale(var(--ui-scale-press)); }
    .nav:focus-visible, .x:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
  `,
})
export class UiGallery {
  images = input<UiGalleryImage[]>([]);
  minThumb = input('120px');
  protected readonly lightbox = signal(-1);
  protected readonly current = computed(() => this.images()[this.lightbox()]);

  private readonly lb = viewChild<ElementRef<HTMLElement>>('lb');
  private opener: HTMLElement | null = null;

  protected openAt(i: number): void {
    this.opener = (typeof document !== 'undefined' ? document.activeElement : null) as HTMLElement | null;
    this.lightbox.set(i);
    // Focus moves into the viewer so Esc and the arrow keys work straight away.
    // Only if it's still open: a quick Escape could otherwise send focus to a removed element.
    setTimeout(() => { if (this.lightbox() >= 0) this.lb()?.nativeElement.focus(); });
  }
  protected close(): void {
    this.lightbox.set(-1);
    this.opener?.focus();
    this.opener = null;
  }
  protected step(d: number, e: Event): void {
    e.stopPropagation();
    const n = this.images().length;
    this.lightbox.update((i) => (i + d + n) % n);
  }
}
