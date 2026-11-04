import { Component, DestroyRef, ElementRef, afterNextRender, computed, inject, input, output, signal } from '@angular/core';
import { HugeiconsIconComponent } from '@hugeicons/angular';
import Tick02Icon from '@hugeicons/core-free-icons/Tick02Icon';
import { injectUiStrings } from '@zouriel/ui';
import { UiTooltip } from '@zouriel/ui/overlay';
import { UI_MESSENGER_BRANDS, type UiMessengerApp } from './messenger-brand';
import { UiMessengerLogo } from './messenger-logo';

/** 'md': 44px tall (the 0.57.0 button). 'sm': 32px to look at, still a 44px target (an invisible hit area). */
export type UiMessengerSize = 'sm' | 'md';

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
 * when the words would not fit in full (measured), for equal-width rows (`expand`) that must fit a
 * phone: a button shows its whole name or its logo, never a cut-off name.
 * A plain `<button>` that emits `(pressed)`: the app opens the link itself. Twin of Flutter's
 * `UiMessengerButton`.
 */
@Component({
  selector: 'ui-messenger-button',
  imports: [HugeiconsIconComponent, UiTooltip, UiMessengerLogo],
  host: { class: 'ui-messenger-button', '[class.expand]': 'expand()', '[attr.aria-label]': 'null' },
  template: `
    <button
      type="button"
      class="ui-mbtn"
      [attr.data-app]="app()"
      [attr.data-size]="size()"
      [class.expand]="expand()"
      [class.icon-only]="iconOnly()"
      [class.ticked]="ticked()"
      [style.--m-top]="brand().fill[0]"
      [style.--m-bottom]="brand().fill[1]"
      [style.--m-ink]="brand().ink"
      [style.--m-logo]="logoPx() + 'px'"
      [disabled]="disabled()"
      [attr.aria-label]="accessibleName()"
      [uiTooltip]="tip()"
      (click)="pressed.emit()">
      <ui-messenger-logo class="logo-box" [app]="app()" [size]="logoPx()" />
      <span #label class="label">{{ text() }}</span>
      @if (ticked()) {
        <span class="tick" aria-hidden="true"><hugeicons-icon [icon]="tickIcon" [size]="size() === 'sm' ? 10 : 12" [strokeWidth]="2.5" /></span>
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
    :host(.expand) { display: flex; width: 100%; }
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
    .logo-box { position: relative; z-index: 1; }
    /* sm: 32px to look at, 13px words; the target stays 44x44 through an invisible hit area centred on it. */
    .ui-mbtn[data-size="sm"] { height: 32px; min-width: 32px; padding: 0 10px; gap: 6px; font-size: var(--ui-font-size-sm); line-height: 18px; }
    .ui-mbtn[data-size="sm"].icon-only { padding: 0; width: 32px; }
    .ui-mbtn[data-size="sm"].icon-only.expand { width: 100%; }
    .ui-mbtn[data-size="sm"]::before {
      content: ''; position: absolute; left: 50%; top: 50%;
      width: max(100%, var(--ui-size-touch)); height: var(--ui-size-touch); transform: translate(-50%, -50%);
    }
    .ui-mbtn { -webkit-touch-callout: none; }
    .label { position: relative; z-index: 1; display: block; min-width: 0; overflow: hidden; text-overflow: ellipsis; }
    .ui-mbtn.icon-only { padding: 0; }
    /* Icon-only keeps the words in the DOM, out of sight and out of layout, so compact="auto" can
       still measure their natural width. The button's aria-label names it either way. */
    .ui-mbtn.icon-only .label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); text-overflow: clip; }
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
    .ui-mbtn[data-size="sm"] .tick { top: -5px; inset-inline-end: -5px; width: 14px; height: 14px; }
    .tick hugeicons-icon { display: block; line-height: 0; }
    @media (prefers-reduced-motion: reduce) { .ui-mbtn, .ui-mbtn::after { transition: none; } }
  `,
})
export class UiMessengerButton {
  /** WhatsApp, Viber or Telegram. */
  app = input.required<UiMessengerApp>();
  /** The visible words; default the app's name. */
  label = input<string>();
  /** `true`: the logo alone. `'auto'`: the logo alone while the words would not fit in full (use with `expand`). */
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
  /** 'md' (44px) or 'sm' (32px to look at, 44px to tap). */
  size = input<UiMessengerSize>('md');

  readonly pressed = output<void>();

  private readonly hostWidth = signal(0);
  private readonly needWidth = signal(0);
  /**
   * Whether the whole name fits beside the logo at the button's current width (measured for expanded
   * buttons; true otherwise). A row of buttons can use it to go icon-only together, as
   * ui-contact-channels does.
   */
  readonly labelFits = computed(() => !this.expand() || !this.needWidth() || this.hostWidth() + 0.5 >= this.needWidth());
  protected readonly iconOnly = computed(() => this.compact() === true || (this.compact() === 'auto' && !this.labelFits()));

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      if (typeof ResizeObserver === 'undefined') return;
      const measure = () => {
        // Only an expanded button: a hugging one's width follows its own content.
        const label = host.querySelector<HTMLElement>('.label');
        if (!this.expand() || !label) return;
        // padding 12 + logo + gap 8 + the words' full width (also while hidden) + padding 12.
        this.needWidth.set(this.size() === 'sm' ? 20 + this.logoPx() + 6 + label.scrollWidth : 24 + this.logoPx() + 8 + label.scrollWidth);
        this.hostWidth.set(host.getBoundingClientRect().width);
      };
      const ro = new ResizeObserver(measure);
      ro.observe(host);
      ro.observe(host.querySelector('.label')!);
      measure();
      destroy.onDestroy(() => ro.disconnect());
    });
  }

  private readonly strings = injectUiStrings();
  protected readonly tickIcon = Tick02Icon;
  protected readonly brand = computed(() => UI_MESSENGER_BRANDS[this.app()]);
  /** The logo's box: the app's size for this button size. */
  protected readonly logoPx = computed(() => (this.size() === 'sm' ? this.brand().logoSizeSm : this.brand().logoSize));
  protected readonly text = computed(() => this.label() || this.brand().name);
  protected readonly tip = computed(() => (this.ticked() ? this.tickLabel() ?? '' : ''));
  /** The name, plus what the tick says when ticked. */
  readonly accessibleName = computed(() => {
    const base = this.ariaLabel() || this.text();
    return this.ticked() ? `${base}, ${this.tickLabel() || this.strings.messengerOpened}` : base;
  });
}
