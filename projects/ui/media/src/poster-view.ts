import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, ElementRef, computed, effect, input, model, output, signal, untracked, viewChild } from '@angular/core';
import { injectUiStrings } from '@zouriel/ui';
import { uiPosterFallback } from './poster-grid';
import { UiScrim } from './scrim';

/**
 * `ui-poster-view`: one picture full-size, with the content you project laid over its bottom on a
 * ui-scrim (the details and the buttons for whatever the picture stands for). It is a modal dialog:
 * Tab stays inside, Esc or the close button closes it, and focus returns to what opened it. The
 * picture is shown whole (contained), over a blurred copy of itself that fills the screen; a poster
 * without a picture shows the same gradient ui-poster-grid gives it.
 */
@Component({
  selector: 'ui-poster-view',
  imports: [CdkTrapFocus, UiScrim],
  template: `
    @if (open()) {
      <div #dlg class="view" role="dialog" aria-modal="true" [attr.aria-label]="label()" tabindex="-1" cdkTrapFocus
           (keydown.escape)="close()" animate.enter="ui-fade-enter" animate.leave="ui-fade-leave">
        @if (picture(); as s) {
          <img class="backdrop" [src]="s" alt="" aria-hidden="true" />
          <img class="picture" [src]="s" [alt]="label()" (error)="broken.set(s)" />
        } @else {
          <span class="fallback" [style.background]="fallback()"></span>
        }
        <button type="button" class="x" [attr.aria-label]="strings.close" (click)="close()"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
        <ui-scrim class="details"><ng-content /></ui-scrim>
      </div>
    }
  `,
  styles: `
    :host { display: contents; }
    .view { position: fixed; inset: 0; z-index: var(--ui-z-overlay); overflow: hidden; outline: none; overscroll-behavior: contain;
      background: var(--ui-media-scrim); }
    .backdrop { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; filter: blur(28px) brightness(0.55); transform: scale(1.15); }
    .picture { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: contain; }
    .fallback { position: absolute; inset: 0; }
    .details { position: absolute; inset-inline: 0; bottom: 0; max-height: 70%; overflow-y: auto; overscroll-behavior: contain;
      padding-bottom: max(var(--ui-space-4), env(safe-area-inset-bottom)); }
    .x { position: absolute; top: max(var(--ui-space-4), env(safe-area-inset-top)); inset-inline-end: var(--ui-space-4);
      width: var(--ui-size-touch); height: var(--ui-size-touch); display: flex; align-items: center; justify-content: center;
      border: none; padding: 0; border-radius: 50%; cursor: pointer; color: var(--ui-media-on-scrim);
      background: color-mix(in srgb, var(--ui-media-scrim) 45%, transparent);
      transition: background var(--ui-motion-base) var(--ui-ease-standard), transform var(--ui-motion-fast) var(--ui-ease-standard); }
    .x:hover { background: color-mix(in srgb, var(--ui-media-scrim) 65%, transparent); }
    .x:active { transform: scale(var(--ui-scale-press)); }
    .x:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
  `,
})
export class UiPosterView {
  protected readonly strings = injectUiStrings();
  readonly open = model(false);
  readonly src = input<string | null | undefined>(null);
  /** The dialog's accessible name, and the picture's alt text. */
  readonly label = input('');
  /** Fallback gradient stops when there is no picture, as on ui-poster-grid. */
  readonly colors = input<string[] | null | undefined>(null);
  readonly closed = output<void>();

  protected readonly broken = signal<string | null>(null);
  protected readonly picture = computed(() => {
    const s = this.src();
    return s && s !== this.broken() ? s : null;
  });
  protected readonly fallback = computed(() => uiPosterFallback(this.colors()));

  private readonly dlg = viewChild<ElementRef<HTMLElement>>('dlg');
  private opener: HTMLElement | null = null;

  constructor() {
    effect(() => {
      if (!this.open()) return;
      untracked(() => {
        this.opener = (typeof document !== 'undefined' ? document.activeElement : null) as HTMLElement | null;
        // Focus moves into the view so Esc works at once; only if it is still open by then.
        setTimeout(() => { if (this.open()) this.dlg()?.nativeElement.focus(); });
      });
    });
  }

  close(): void {
    if (!this.open()) return;
    this.open.set(false);
    this.closed.emit();
    this.opener?.focus?.();
    this.opener = null;
  }
}
