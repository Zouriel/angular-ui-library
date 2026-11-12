import { Component, input, computed } from '@angular/core';
import { injectUiConfig, injectUiStrings } from '@zouriel/ui';
import { UiShutterLoader } from '@zouriel/ui/shutter-loader';

/**
 * `ui-loading-overlay` — covers its positioned parent with a dimmed, blurred
 * veil + spinner while `loading` is true. Place inside a `position: relative`
 * container.
 */
@Component({
  selector: 'ui-loading-overlay',
  imports: [UiShutterLoader],
  template: `
    @if (loading()) {
      <div class="veil" role="status" [attr.aria-label]="labelText()" animate.enter="ui-fade-enter" animate.leave="ui-fade-leave">
        @if (shutterSpin) { <ui-shutter-loader size="lg" decorative color="var(--ui-color-primary)" /> }
        @else { <span class="spin" aria-hidden="true"></span> }
        @if (labelText()) { <span class="lbl">{{ labelText() }}</span> }
      </div>
    }
  `,
  styles: `
    :host { position: absolute; inset: 0; display: contents; }
    .veil {
      position: absolute; inset: 0; z-index: var(--ui-z-docked);
      display: flex; flex-direction: column; align-items: center; justify-content: center; gap: var(--ui-space-2);
      background: color-mix(in srgb, var(--ui-color-bg) 55%, transparent);
      backdrop-filter: blur(2px);
      font-family: var(--ui-font-default); line-height: 1.35;
    }
    /* Same look as <ui-spinner size="lg">. */
    .spin { box-sizing: border-box; width: 32px; height: 32px; border-radius: 50%; border: 3px solid var(--ui-color-border); border-top-color: var(--ui-color-primary); animation: ui-lo-spin 700ms linear infinite; }
    .lbl { font-size: var(--ui-font-size-sm); color: var(--ui-color-text-muted); }
    @keyframes ui-lo-spin { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .spin { animation-duration: 1.2s; } }
  `,
})
export class UiLoadingOverlay {
  /** `provideUiConfig({ spinner: 'shutter' })`: the busy mark is the shutter instead of the ring. */
  protected readonly shutterSpin = injectUiConfig().spinner === 'shutter';
  protected readonly strings = injectUiStrings();
  loading = input(false);
  /** Default: the built-in `loading` (Loading…), which follows the app's language. */
  label = input<string | undefined>(undefined);
  protected readonly labelText = computed(() => this.label() ?? this.strings.loading);
}
