import { Component, computed, input } from '@angular/core';
import { type UiSize, injectUiConfig, injectUiStrings } from '@zouriel/ui';
import { UiShutterLoader } from '@zouriel/ui/shutter-loader';

/**
 * `ui-spinner` — indeterminate activity indicator. With `provideUiConfig({ spinner: 'shutter' })`
 * it draws `ui-shutter-loader` (same size, the primary colour, same announcement) instead of the ring.
 */
@Component({
  selector: 'ui-spinner',
  imports: [UiShutterLoader],
  template: `
    @if (shutter) {
      <ui-shutter-loader [size]="size()" [label]="labelText()" color="var(--ui-color-primary)" />
    } @else {
      <span class="ui-spinner" [attr.data-size]="size()" role="status" [attr.aria-label]="labelText()"></span>
    }
  `,
  styles: `
    :host { display: inline-flex; }
    .ui-spinner {
      display: inline-block; box-sizing: border-box;
      width: 20px; height: 20px; border-radius: 50%;
      border: 2px solid var(--ui-color-border);
      border-top-color: var(--ui-color-primary);
      animation: ui-spinner-rot 700ms linear infinite;
    }
    .ui-spinner[data-size="sm"] { width: 14px; height: 14px; }
    .ui-spinner[data-size="lg"] { width: 32px; height: 32px; border-width: 3px; }
    @keyframes ui-spinner-rot { to { transform: rotate(360deg); } }
    @media (prefers-reduced-motion: reduce) { .ui-spinner { animation-duration: 1.2s; } }
  `,
})
export class UiSpinner {
  size = input<UiSize>('md');
  protected readonly strings = injectUiStrings();
  protected readonly shutter = injectUiConfig().spinner === 'shutter';
  /** Default: the built-in `loading` (Loading…), which follows the app's language. */
  label = input<string | undefined>(undefined);
  protected readonly labelText = computed(() => this.label() ?? this.strings.loading);
}
