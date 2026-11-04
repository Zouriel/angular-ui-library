import { Component, computed, input } from '@angular/core';
import { UI_MESSENGER_BRANDS, type UiMessengerApp } from './messenger-brand';

let nextId = 0;

/**
 * `ui-messenger-logo` — an app's official logo (messenger-brand.ts), unaltered and in its own colours,
 * drawn `size` px square (aspect kept, centred). Decorative: the control around it carries the name.
 * Used by `ui-messenger-button` and `ui-messenger-switch`; usable on its own. Twin of Flutter's
 * `UiMessengerLogo`.
 */
@Component({
  selector: 'ui-messenger-logo',
  host: { class: 'ui-messenger-logo', 'aria-hidden': 'true', '[style.width.px]': 'px()', '[style.height.px]': 'px()' },
  template: `
    <svg class="logo" xmlns="http://www.w3.org/2000/svg" [attr.viewBox]="viewBox()" [attr.width]="px()" [attr.height]="px()"
      preserveAspectRatio="xMidYMid meet" focusable="false" aria-hidden="true">
      @if (brand().logo.disc; as disc) {
        <defs>
          <linearGradient [attr.id]="gradientId" x1="50%" y1="0%" x2="50%" [attr.y2]="disc.y2 * 100 + '%'">
            <stop [attr.stop-color]="disc.top" offset="0%" />
            <stop [attr.stop-color]="disc.bottom" offset="100%" />
          </linearGradient>
        </defs>
        <circle [attr.cx]="disc.cx" [attr.cy]="disc.cy" [attr.r]="disc.r" [attr.fill]="'url(#' + gradientId + ')'" />
      }
      @for (p of brand().logo.paths; track $index) {
        <path [attr.d]="p.d" fill="#FFFFFF" [attr.fill-rule]="p.evenOdd ? 'evenodd' : null" />
      }
    </svg>
  `,
  styles: `
    :host { display: block; flex: none; line-height: 0; }
    .logo { display: block; width: 100%; height: 100%; }
  `,
})
export class UiMessengerLogo {
  app = input.required<UiMessengerApp>();
  /** Box size in px; default the app's logo size on a md button. */
  size = input<number | undefined>(undefined);
  protected readonly brand = computed(() => UI_MESSENGER_BRANDS[this.app()]);
  protected readonly px = computed(() => this.size() ?? this.brand().logoSize);
  protected readonly viewBox = computed(() => `0 0 ${this.brand().logo.width} ${this.brand().logo.height}`);
  protected readonly gradientId = `ui-mlogo-grad-${nextId++}`;
}
