import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, signal } from '@angular/core';
import { APP_STORE_BADGE_BLACK, APP_STORE_BADGE_WHITE } from './store-badge-art';

/**
 * `ui-store-badge` — Apple's official "Download on the App Store" badge as a link.
 *
 * The artwork is Apple's, unaltered: black on light surfaces, white (outlined) on dark ones. `scheme="auto"`
 * follows the surrounding `color-scheme`, so it flips with the theme. Apple asks for at least 40px height and
 * clear space around the badge; the default height is 40.
 */
@Component({
  selector: 'ui-store-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a class="ui-store-badge" [attr.href]="href()" rel="noopener" [attr.target]="newTab() ? '_blank' : null">
      <img [src]="src()" alt="Download on the App Store" [style.height.px]="height()" />
    </a>
  `,
  styles: `
    :host { display: inline-block; line-height: 0; }
    .ui-store-badge { display: inline-block; border-radius: 8px; line-height: 0; }
    .ui-store-badge:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    img { display: block; width: auto; max-width: none; }
  `,
})
export class UiStoreBadge {
  /** The App Store listing, e.g. https://apps.apple.com/us/app/invites-blog/id6829749209 */
  href = input.required<string>();
  /** `auto` follows the surrounding colour scheme; `light` = black badge (for light surfaces), `dark` = white badge. */
  scheme = input<'auto' | 'light' | 'dark'>('auto');
  /** Height in px; Apple's minimum is 40. */
  height = input(40);
  newTab = input(false);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly destroyRef = inject(DestroyRef);
  private readonly detected = signal<'light' | 'dark'>('light');

  protected readonly src = computed(() => {
    const s = this.scheme();
    const dark = s === 'auto' ? this.detected() === 'dark' : s === 'dark';
    return dark ? APP_STORE_BADGE_WHITE : APP_STORE_BADGE_BLACK;
  });

  constructor() {
    afterNextRender(() => {
      const read = () => {
        const cs = getComputedStyle(this.host.nativeElement).colorScheme;
        this.detected.set(cs.split(/\s+/)[0] === 'dark' ? 'dark' : 'light');
      };
      read();
      // The theme service flips data-theme / color-scheme on the document; watch the root for it.
      const mo = new MutationObserver(read);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'class', 'style'] });
      this.destroyRef.onDestroy(() => mo.disconnect());
    });
  }
}
