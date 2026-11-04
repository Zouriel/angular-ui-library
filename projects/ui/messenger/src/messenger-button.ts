import { Component, computed, input, output } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';
import { injectUiStrings } from '@zouriel/ui';
import { UiTooltip } from '@zouriel/ui/overlay';
import { UI_MESSENGER_BRANDS, type UiMessengerApp } from './messenger-brand';

let nextId = 0;

/**
 * `ui-messenger-button` — opens a message in WhatsApp, Viber or Telegram: the brand's colour as the
 * fill and its official logo (unaltered, in its own colours: WhatsApp's and Viber's white glyphs,
 * Telegram's white plane on its blue disc), with the app's name beside it. The words are in a dark
 * ink that passes WCAG AA on the fill (white does not on any of the three); the logo is never
 * recoloured. 44px tall, logo and words centred as one group. Telegram's fill is its logo's gradient
 * laid over the logo's own band, so the disc blends in and the white plane shows on Telegram blue.
 *
 * `ticked` puts a small success tick badge on the top-right corner (the same place on every app):
 * "this was done", e.g. the invitation was opened in WhatsApp. A ticked button stays fully usable;
 * `tickLabel` ("Opened in WhatsApp · 3:14 pm") shows as a tooltip and is added to the accessible name.
 *
 * `compact` draws the logo alone (44x44, the name stays the accessible name); `'auto'` does so only
 * when the button is narrower than 120px, for equal-width rows (`expand`) that must fit a phone.
 * A plain `<button>` that emits `(pressed)`: the app opens the link itself. Twin of Flutter's
 * `UiMessengerButton`.
 */
@Component({
  selector: 'ui-messenger-button',
  imports: [HugeiconsIconComponent, UiTooltip],
  host: { class: 'ui-messenger-button', '[class.expand]': 'expand()', '[attr.aria-label]': 'null' },
  template: `
    <button
      type="button"
      class="ui-mbtn"
      [attr.data-app]="app()"
      [class.expand]="expand()"
      [class.icon-only]="compact() === true"
      [class.auto]="compact() === 'auto'"
      [class.ticked]="ticked()"
      [style.--m-top]="brand().fill[0]"
      [style.--m-bottom]="brand().fill[1]"
      [style.--m-ink]="brand().ink"
      [style.--m-logo]="brand().logoSize + 'px'"
      [disabled]="disabled()"
      [attr.aria-label]="accessibleName()"
      [uiTooltip]="tip()"
      (click)="pressed.emit()">
      <svg class="logo" xmlns="http://www.w3.org/2000/svg" [attr.viewBox]="viewBox()" preserveAspectRatio="xMidYMid meet"
        focusable="false" aria-hidden="true">
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
      <span class="label">{{ text() }}</span>
      @if (ticked()) {
        <span class="tick" aria-hidden="true"><hugeicons-icon [icon]="tickIcon" [size]="12" [strokeWidth]="2.5" /></span>
      }
    </button>
  `,
  styles: `
    /* Brand colours come in as --m-top/--m-bottom/--m-ink from messenger-brand.ts. The veils are white:
       lightening the fill only raises the dark words' contrast (a dark veil would take Viber below AA). */
    :host {
      --ui-messenger-veil: #FFFFFF;
      position: relative;
      display: inline-flex;
      max-width: 100%;
      vertical-align: middle;
    }
    /* Expanded, the host is a size container: compact="auto" asks it how wide the button is. */
    :host(.expand) { display: flex; width: 100%; container-type: inline-size; }
    .ui-mbtn {
      position: relative;
      box-sizing: border-box;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--ui-space-2);
      height: var(--ui-size-touch);
      min-width: var(--ui-size-touch);
      max-width: 100%;
      margin: 0;
      padding: 0 var(--ui-space-3);
      border: none;
      border-radius: var(--ui-radius);
      /* The brand fill. A two-colour fill (Telegram) runs over the logo's band, matching its disc. */
      background: linear-gradient(var(--m-top) calc(50% - var(--m-logo) / 2), var(--m-bottom) calc(50% + var(--m-logo) / 2));
      color: var(--m-ink);
      font-family: var(--ui-font-default);
      font-size: var(--ui-font-size-md);
      font-weight: 600;
      line-height: 20px;
      letter-spacing: normal;
      white-space: nowrap;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: transform var(--ui-motion-fast) var(--ui-ease-standard), opacity var(--ui-motion-base) var(--ui-ease-standard), box-shadow var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .ui-mbtn.expand { width: 100%; }
    .ui-mbtn::after {
      content: '';
      position: absolute;
      inset: 0;
      border-radius: inherit;
      background: var(--ui-messenger-veil);
      opacity: 0;
      pointer-events: none;
      transition: opacity var(--ui-motion-fast) var(--ui-ease-standard);
    }
    .ui-mbtn:hover:not(:disabled)::after { opacity: 0.1; }
    .ui-mbtn:active:not(:disabled)::after { opacity: 0.18; }
    .ui-mbtn:active:not(:disabled) { transform: scale(var(--ui-scale-press)); }
    .ui-mbtn:focus-visible { outline: none; box-shadow: var(--ui-focus-ring); }
    .ui-mbtn:disabled { opacity: 0.5; cursor: not-allowed; }
    .logo { position: relative; z-index: 1; flex: none; display: block; width: var(--m-logo); height: var(--m-logo); }
    .label { position: relative; z-index: 1; display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .ui-mbtn.icon-only { padding: 0; }
    .ui-mbtn.icon-only .label { display: none; }
    @container (max-width: 119.98px) {
      .ui-mbtn.auto { padding: 0; }
      .ui-mbtn.auto .label { display: none; }
    }
    /* The tick: an 18px success disc centred 3px inside the top-right corner, ringed in the surface
       colour so it reads on the fill and on the page. Decorative (the name carries it), never hit. */
    .tick {
      position: absolute;
      z-index: 2;
      top: -6px;
      inset-inline-end: -6px;
      box-sizing: border-box;
      width: 18px;
      height: 18px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      background: var(--ui-color-success);
      color: var(--ui-color-success-contrast);
      box-shadow: 0 0 0 2px var(--ui-color-surface);
      pointer-events: none;
    }
    .tick hugeicons-icon { display: block; line-height: 0; }
    @media (prefers-reduced-motion: reduce) { .ui-mbtn, .ui-mbtn::after { transition: none; } }
  `,
})
export class UiMessengerButton {
  /** WhatsApp, Viber or Telegram. */
  app = input.required<UiMessengerApp>();
  /** The visible words; default the app's name. */
  label = input<string>();
  /** `true`: the logo alone. `'auto'`: the logo alone while the button is narrower than 120px (use with `expand`). */
  compact = input<boolean | 'auto'>(false);
  /** Fill the width (logo and words stay centred). */
  expand = input(false);
  /** Shows the tick badge: this channel was used. The button stays usable. */
  ticked = input(false);
  /** What the tick means ("Opened in WhatsApp · 3:14 pm"): a tooltip, and part of the accessible name. */
  tickLabel = input<string>();
  /** The accessible name ("Send to Aisha on WhatsApp"); default the label. */
  ariaLabel = input<string>();
  disabled = input(false);

  readonly pressed = output<void>();

  private readonly strings = injectUiStrings();
  protected readonly tickIcon = Tick02Icon;
  protected readonly gradientId = `ui-mbtn-grad-${nextId++}`;
  protected readonly brand = computed(() => UI_MESSENGER_BRANDS[this.app()]);
  protected readonly viewBox = computed(() => `0 0 ${this.brand().logo.width} ${this.brand().logo.height}`);
  protected readonly text = computed(() => this.label() || this.brand().name);
  protected readonly tip = computed(() => (this.ticked() ? this.tickLabel() ?? '' : ''));
  /** The name, plus what the tick says when ticked. */
  readonly accessibleName = computed(() => {
    const base = this.ariaLabel() || this.text();
    return this.ticked() ? `${base}, ${this.tickLabel() || this.strings.messengerOpened}` : base;
  });
}
