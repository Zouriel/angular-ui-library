import { Component, inject, input, output } from '@angular/core';
import { UI_CONFIG } from '@zouriel/ui';

/** Spacing steps accepted by `ui-card [gap]` (maps to `--ui-space-N`). */
export type UiCardGap = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 10;

/** Cross-axis alignment for `ui-card` body content. */
export type UiCardAlign = 'stretch' | 'start' | 'center' | 'end';

/**
 * `ui-card` — surface container with optional header/footer slots.
 * Project header content with `[card-header]` and footer with `[card-footer]`.
 */
@Component({
  selector: 'ui-card',
  template: `
    <div
      class="ui-card"
      [class.glass]="glass()"
      [class.no-radius]="radius() === false"
      [class.radius-xl]="radius() === 'xl'"
      [class.interactive]="interactive() || pressable()"
      [class.disabled]="(interactive() || pressable()) && disabled()"
      [attr.data-pad]="padding()"
      [attr.role]="pressable() ? 'button' : null"
      [attr.tabindex]="pressable() && !disabled() ? 0 : null"
      [attr.aria-label]="pressable() ? ariaLabel() : null"
      [attr.aria-disabled]="pressable() && disabled() ? 'true' : null"
      (click)="onClick($event)"
      (keydown)="onKeydown($event)"
    >
      <div class="hd"><ng-content select="[card-header]" /></div>
      <div
        class="bd"
        [class.bd-flex]="gap() !== null || align() !== null"
        [attr.data-gap]="gap()"
        [attr.data-align]="align()"
      ><ng-content /></div>
      <div class="ft"><ng-content select="[card-footer]" /></div>
    </div>
  `,
  styles: `
    :host { display: block; }
    .ui-card {
      display: flex; flex-direction: column;
      /* Fill the host so cards in a stretched context (e.g. a CSS grid) are equal height. In normal
         flow the host height is content-driven, so this resolves to auto and changes nothing. */
      height: 100%;
      background: var(--ui-color-surface);
      border: 1px solid var(--ui-color-border);
      border-radius: var(--ui-radius-lg);
      box-shadow: var(--ui-shadow-1);
      overflow: hidden;
      font-family: var(--ui-font-default); line-height: 1.35;
    }
    /* Opt-in: for cards that are themselves the clickable surface — lifts the whole card on hover
       so it reads as a target, not just decoration. Static/informational cards leave this off. */
    .ui-card.interactive {
      cursor: pointer;
      transition: transform var(--ui-motion-base) var(--ui-ease-standard),
                  box-shadow var(--ui-motion-base) var(--ui-ease-standard),
                  border-color var(--ui-motion-base) var(--ui-ease-standard);
    }
    .ui-card.interactive:not(.disabled):hover { transform: translateY(-2px); box-shadow: var(--ui-shadow-2); border-color: var(--ui-color-border-strong); }
    .ui-card.interactive:not(.disabled):active { transform: translateY(-1px) scale(var(--ui-scale-press)); }
    /* The card is the target, so keyboard focus on the card or a link/button inside rings the whole card. */
    .ui-card.interactive:focus-visible,
    .ui-card.interactive:has(:focus-visible) { outline: none; box-shadow: var(--ui-focus-ring); }
    .ui-card.interactive.disabled { opacity: 0.5; cursor: not-allowed; }
    @media (prefers-reduced-motion: reduce) {
      .ui-card.interactive:hover, .ui-card.interactive:active { transform: none; }
    }
    /* Body takes the slack so a [card-footer] (e.g. an actions row) bottom-aligns across a grid of cards. */
    .bd { flex: 1 1 auto; }
    .bd.bd-flex { display: flex; flex-direction: column; }
    .bd[data-gap="0"] { gap: 0; }
    .bd[data-gap="1"] { gap: var(--ui-space-1); }
    .bd[data-gap="2"] { gap: var(--ui-space-2); }
    .bd[data-gap="3"] { gap: var(--ui-space-3); }
    .bd[data-gap="4"] { gap: var(--ui-space-4); }
    .bd[data-gap="5"] { gap: var(--ui-space-5); }
    .bd[data-gap="6"] { gap: var(--ui-space-6); }
    .bd[data-gap="7"] { gap: var(--ui-space-7); }
    .bd[data-gap="8"] { gap: var(--ui-space-8); }
    .bd[data-gap="10"] { gap: var(--ui-space-10); }
    .bd[data-align="stretch"] { align-items: stretch; }
    .bd[data-align="start"] { align-items: flex-start; text-align: start; }
    .bd[data-align="center"] { align-items: center; text-align: center; }
    .bd[data-align="end"] { align-items: flex-end; text-align: end; }
    .ui-card.no-radius { border-radius: 0; }
    .ui-card.radius-xl { border-radius: var(--ui-radius-xl); }
    .ui-card.glass {
      background: var(--ui-glass-bg);
      backdrop-filter: blur(var(--ui-glass-blur));
      border-color: var(--ui-glass-border);
      box-shadow: var(--ui-glass-highlight), var(--ui-shadow-1);
    }
    .ui-card.glass.interactive:not(.disabled):hover { box-shadow: var(--ui-glass-highlight), var(--ui-shadow-2); }
    .hd, .bd, .ft { padding: var(--ui-card-pad-md); }
    .ui-card[data-pad="sm"] .hd, .ui-card[data-pad="sm"] .bd, .ui-card[data-pad="sm"] .ft { padding: var(--ui-card-pad-sm); }
    .ui-card[data-pad="lg"] .hd, .ui-card[data-pad="lg"] .bd, .ui-card[data-pad="lg"] .ft { padding: var(--ui-card-pad-lg); }
    .hd { border-bottom: 1px solid var(--ui-color-border); font-weight: 600; font-size: var(--ui-font-size-md); }
    .ft { border-top: 1px solid var(--ui-color-border); }
    /* Collapse empty header/footer slots */
    .hd:empty, .ft:empty { display: none; }
  `,
})
export class UiCard {
  private config = inject(UI_CONFIG);
  padding = input<'sm' | 'md' | 'lg'>('md');
  /** Vertical spacing step between direct body children (enables flex column on the body). */
  gap = input<UiCardGap | null>(null);
  /** Cross-axis alignment of body children (enables flex column on the body). */
  align = input<UiCardAlign | null>(null);
  glass = input<boolean>(this.config.glass);
  radius = input<boolean | 'xl'>(this.config.radius);
  /** Opt-in hover lift for cards that are themselves a clickable target, such as a card wrapped in
   *  an `<a>` or `<button>`. Visual only: the wrapping element stays the button. */
  interactive = input(false);
  /** The card itself is the button: hover lift, `role="button"`, focusable, Enter/Space and click
   *  emit `activate`. Use it instead of wrapping the card in a button, never together with one. */
  pressable = input(false);
  /** Accessible name when `pressable` is true. */
  ariaLabel = input<string | null>(null);
  /** Disables activation, focus and hover lift on an interactive or pressable card. */
  disabled = input(false);
  /** Emitted when an enabled pressable card is clicked or activated with Enter or Space. */
  activate = output<void>();

  protected onClick(e: MouseEvent): void {
    if (!this.pressable() || this.disabled()) return;
    const target = e.target as Element | null;
    if (target && target !== e.currentTarget && target.closest('a[href], button, input, select, textarea')) return;
    this.activate.emit();
  }

  protected onKeydown(e: KeyboardEvent): void {
    if (!this.pressable() || this.disabled()) return;
    if (e.target !== e.currentTarget) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.activate.emit();
    }
  }
}
