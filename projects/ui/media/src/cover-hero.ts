import { Component, computed, effect, input, output, signal, untracked } from '@angular/core';
import { UiContextMenu, type UiMenuItem } from '@zouriel/ui/overlay';

/**
 * `ui-cover-hero` — a full-width cover picture with on-media chrome and a bottom fade into the page.
 *
 * Project top controls into `[hero-top-start]` and `[hero-top-end]`, title and metadata into the
 * default slot, and primary controls into `[hero-actions]`. A non-empty [coverMenu] makes the bare
 * cover an accessible menu trigger on click/tap, right-click, touch long-press and the keyboard.
 */
@Component({
  selector: 'ui-cover-hero',
  imports: [UiContextMenu],
  host: {
    '[attr.data-on-media]': "hasImage() ? '' : null",
    '[class.no-image]': '!hasImage()',
    '[class.editable]': 'editable()',
    '[class.fade-bottom]': 'fadeBottom() && hasImage()',
    '[class.scrim-top]': 'scrimTop() && hasImage()',
    '[class.scrim-start]': 'scrimStart() && hasImage()',
    '[style.--ui-cover-min-height]': "minHeight() === null ? null : minHeight() + 'px'",
  },
  template: `
    @if (editable()) {
      <button
        type="button"
        class="cover"
        aria-haspopup="menu"
        [attr.aria-label]="coverActionLabel() || null"
        [uiContextMenu]="coverMenu()"
        [openOnClick]="true"
        (contextSelect)="coverMenuSelect.emit($event)"
      >
        @if (hasImage()) {
          <img [src]="src()" alt="" draggable="false" (error)="broken.set(true)" />
        }
      </button>
    } @else {
      <div class="cover" aria-hidden="true">
        @if (hasImage()) {
          <img [src]="src()" alt="" draggable="false" (error)="broken.set(true)" />
        }
      </div>
    }

    <div class="start-shade" aria-hidden="true"></div>
    <div class="top-shade" aria-hidden="true"></div>
    <div class="bottom-fade" aria-hidden="true"></div>

    <div class="top">
      <div class="top-slot"><ng-content select="[hero-top-start]" /></div>
      <div class="top-slot"><ng-content select="[hero-top-end]" /></div>
    </div>
    <div class="bottom">
      <div class="body"><ng-content /></div>
      <div class="actions"><ng-content select="[hero-actions]" /></div>
    </div>
  `,
  styles: `
    :host {
      position: relative; isolation: isolate; overflow: hidden;
      display: grid; grid-template-rows: auto 1fr;
      min-height: var(--ui-cover-min-height, 272px);
      background: var(--ui-color-bg); color: var(--ui-media-on-scrim);
      font-family: var(--ui-font-default);
    }
    @media (min-width: 900px) { :host { min-height: var(--ui-cover-min-height, 320px); } }

    /* A missing or failed picture falls back to the page background and ordinary ink. */
    :host(.no-image) {
      color: var(--ui-color-text);
    }
    .cover { position: absolute; inset: 0; z-index: 0; display: block; width: 100%; height: 100%;
      padding: 0; margin: 0; border: 0; overflow: hidden; background: var(--ui-color-bg); }
    button.cover { cursor: pointer; font: inherit; color: inherit;
      user-select: none; -webkit-user-select: none; -webkit-touch-callout: none; }
    button.cover:focus-visible { outline: none; box-shadow: inset 0 0 0 2px var(--ui-color-border-focus); }
    .cover img { display: block; width: 100%; height: 100%; object-fit: cover; user-select: none; -webkit-user-drag: none; }

    .start-shade, .top-shade, .bottom-fade { position: absolute; z-index: 1; pointer-events: none; }
    .start-shade { inset: 0; }
    :host(.scrim-start) .start-shade {
      background: linear-gradient(to right,
        color-mix(in srgb, var(--ui-media-scrim) 35%, transparent) 0%,
        color-mix(in srgb, var(--ui-media-scrim) 12%, transparent) 40%,
        transparent 70%);
    }
    :host(.scrim-start:dir(rtl)) .start-shade,
    :host-context([dir="rtl"]):host(.scrim-start) .start-shade {
      background: linear-gradient(to left,
        color-mix(in srgb, var(--ui-media-scrim) 35%, transparent) 0%,
        color-mix(in srgb, var(--ui-media-scrim) 12%, transparent) 40%,
        transparent 70%);
    }
    .top-shade { inset: 0 0 auto; height: var(--ui-space-20); }
    :host(.scrim-top) .top-shade {
      background: linear-gradient(to bottom,
        color-mix(in srgb, var(--ui-media-scrim) 34%, transparent) 0%,
        color-mix(in srgb, var(--ui-media-scrim) 14%, transparent) 52%,
        transparent 100%);
    }
    .bottom-fade { inset: auto 0 0; height: var(--ui-space-20); }
    :host(.fade-bottom) .bottom-fade {
      background: linear-gradient(to top,
        var(--ui-color-bg) 0%,
        color-mix(in srgb, var(--ui-color-bg) 82%, transparent) 24%,
        color-mix(in srgb, var(--ui-color-bg) 38%, transparent) 52%,
        color-mix(in srgb, var(--ui-color-bg) 10%, transparent) 76%,
        transparent 100%);
    }

    .top { position: relative; z-index: 2; display: flex; align-items: flex-start; justify-content: space-between;
      gap: var(--ui-space-3); padding: var(--ui-space-3) var(--ui-space-4); pointer-events: none; }
    .top-slot { display: flex; align-items: center; gap: var(--ui-space-2); pointer-events: auto; }
    .top-slot:last-child { margin-inline-start: auto; }
    .bottom { position: relative; z-index: 2; align-self: end; display: flex; flex-direction: column;
      gap: var(--ui-space-2); padding: var(--ui-space-4) var(--ui-space-4) var(--ui-space-6); pointer-events: none; }
    .body { display: flex; flex-direction: column; align-items: flex-start; gap: var(--ui-space-1); max-width: 85%; }
    @media (min-width: 600px) { .body { max-width: 69%; } }
    .body:empty, .actions:empty { display: none; }
    .actions { display: flex; flex-wrap: wrap; align-items: center; gap: var(--ui-space-2); pointer-events: auto; }
    :host:not(.editable) .body { pointer-events: auto; }
    :host(.editable) .body ::ng-deep :is(a, button, input, textarea, select, [role="button"], [tabindex], ui-button, ui-icon-button, ui-editable-text) {
      pointer-events: auto;
    }
  `,
})
export class UiCoverHero {
  /** Cover picture URL. Null, empty, or a failed load renders the page background. */
  readonly src = input<string | null | undefined>(null);
  /** Minimum height in px. Null uses 272px, or 320px at viewport widths of 900px and above. */
  readonly minHeight = input<number | null>(null);
  /** Fade the lower edge into the page background. */
  readonly fadeBottom = input(true);
  /** Add subtle darkening behind the top controls. */
  readonly scrimTop = input(true);
  /** Add subtle darkening behind start-aligned body copy; mirrored in RTL. */
  readonly scrimStart = input(true);
  /** Change/remove actions. A non-empty list makes the cover interactive. */
  readonly coverMenu = input<readonly UiMenuItem[]>([]);
  /** Accessible name for an interactive cover, e.g. `Change cover image`. */
  readonly coverActionLabel = input('Change cover image');
  /** The selected cover action. */
  readonly coverMenuSelect = output<UiMenuItem>();

  protected readonly broken = signal(false);
  protected readonly hasImage = computed(() => !!this.src() && !this.broken());
  protected readonly editable = computed(() => this.coverMenu().length > 0);

  constructor() {
    effect(() => {
      this.src();
      untracked(() => this.broken.set(false));
    });
  }
}
